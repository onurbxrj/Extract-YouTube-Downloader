/**
 * Offscreen Document — Extract v2.1
 * Handles blob creation, file downloads, and FFmpeg muxing
 * for combining separate video + audio streams.
 */

let ffmpegInstance = null;
let ffmpegLoading = false;

/**
 * Lazy-loads FFmpeg WASM.
 * @returns {Promise<object>} The loaded FFmpeg instance
 */
async function loadFFmpeg() {
    if (ffmpegInstance && ffmpegInstance.loaded) return ffmpegInstance;
    if (ffmpegLoading) {
        // Wait for ongoing load
        while (ffmpegLoading) {
            await new Promise((r) => setTimeout(r, 200));
        }
        return ffmpegInstance;
    }

    ffmpegLoading = true;

    try {
        reportProgress('loading-ffmpeg', 'Carregando FFmpeg...', -1);

        // Load the UMD script dynamically
        await loadScript(chrome.runtime.getURL('vendor/ffmpeg/ffmpeg.js'));

        const { FFmpeg } = FFmpegWASM;
        ffmpegInstance = new FFmpeg();

        ffmpegInstance.on('progress', ({ progress }) => {
            const pct = Math.round(progress * 100);
            reportProgress('muxing', 'Combinando áudio e vídeo...', pct);
        });

        ffmpegInstance.on('log', ({ message }) => {
            console.log('[FFmpeg]', message);
        });

        const coreURL = chrome.runtime.getURL('vendor/ffmpeg/ffmpeg-core.js');
        const wasmURL = chrome.runtime.getURL('vendor/ffmpeg/ffmpeg-core.wasm');
        const workerURL = chrome.runtime.getURL('vendor/ffmpeg/814.ffmpeg.js');

        await ffmpegInstance.load({
            coreURL,
            wasmURL,
            workerURL
        });

        ffmpegLoading = false;
        return ffmpegInstance;
    } catch (error) {
        ffmpegLoading = false;
        console.error('[Extract] FFmpeg load error:', error);
        throw error;
    }
}

/**
 * Dynamically loads a script tag.
 * @param {string} src - Script URL
 * @returns {Promise<void>}
 */
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

/**
 * Reports progress to the popup.
 * @param {string} status
 * @param {string} label
 * @param {number} progress - 0-100 or -1 for indeterminate
 */
function reportProgress(status, label, progress, extra = {}) {
    chrome.runtime.sendMessage({
        type: 'DOWNLOAD_PROGRESS',
        status,
        filename: extra.filename || label,
        progress,
        receivedBytes: extra.receivedBytes || 0,
        totalBytes: extra.totalBytes || 0
    }).catch(() => { });
}

/**
 * Fetches a URL as ArrayBuffer with progress reporting.
 * @param {string} url
 * @param {string} label - Progress label
 * @param {string} method - HTTP method
 * @returns {Promise<Uint8Array>}
 */
async function fetchWithProgress(url, label, method = 'GET') {
    const response = await fetch(url, {
        method: method,
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentLength = parseInt(response.headers.get('content-length') || '0');
    const reader = response.body.getReader();
    const chunks = [];
    let receivedBytes = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedBytes += value.length;

        const progress = contentLength > 0
            ? Math.round((receivedBytes / contentLength) * 100)
            : -1;

        reportProgress('downloading', label, progress, {
            filename: label,
            receivedBytes,
            totalBytes: contentLength
        });
    }

    // Concatenate chunks
    const result = new Uint8Array(receivedBytes);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }

    return result;
}

// --- Message Handling ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.target !== 'offscreen') return;

    if (message.type === 'OFFSCREEN_DOWNLOAD') {
        downloadStream(message.url, message.filename, message.method)
            .then((result) => sendResponse(result))
            .catch((error) => sendResponse({ success: false, error: error.message }));
        return true;
    }

    if (message.type === 'OFFSCREEN_MUX') {
        muxStreams(message.videoUrl, message.audioUrl, message.filename, message.videoMethod, message.audioMethod)
            .then((result) => sendResponse(result))
            .catch((error) => sendResponse({ success: false, error: error.message }));
        return true;
    }
});

/**
 * Downloads a single stream (video+audio combined) directly.
 * @param {string} url - The videoplayback URL
 * @param {string} filename - Suggested filename
 * @param {string} method - HTTP method
 * @returns {Promise<{success: boolean, size?: number}>}
 */
async function downloadStream(url, filename, method = 'GET') {
    try {
        reportProgress('fetching', filename, 0, { filename });

        const data = await fetchWithProgress(url, filename, method);

        const blob = new Blob([data]);
        const blobUrl = URL.createObjectURL(blob);

        await chrome.downloads.download({
            url: blobUrl,
            filename: filename,
            saveAs: true
        });

        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);

        reportProgress('complete', filename, 100, {
            filename,
            receivedBytes: data.length,
            totalBytes: data.length
        });

        return { success: true, size: data.length };
    } catch (error) {
        reportProgress('error', filename, 0, { filename });
        throw error;
    }
}

/**
 * Downloads video and audio separately, then muxes them with FFmpeg.
 * @param {string} videoUrl - Video-only stream URL
 * @param {string} audioUrl - Audio-only stream URL
 * @param {string} filename - Output filename
 * @param {string} videoMethod - HTTP method for video URL
 * @param {string} audioMethod - HTTP method for audio URL
 * @returns {Promise<{success: boolean, size?: number}>}
 */
async function muxStreams(videoUrl, audioUrl, filename, videoMethod = 'GET', audioMethod = 'GET') {
    try {
        // 1. Load FFmpeg
        const ffmpeg = await loadFFmpeg();

        // 2. Download video
        reportProgress('downloading', 'Baixando vídeo...', 0, { filename });
        const videoData = await fetchWithProgress(videoUrl, 'Vídeo', videoMethod);

        // 3. Download audio
        reportProgress('downloading', 'Baixando áudio...', 0, { filename });
        const audioData = await fetchWithProgress(audioUrl, 'Áudio', audioMethod);

        // 4. Write files to FFmpeg virtual FS
        reportProgress('muxing', 'Preparando merge...', 0, { filename });
        await ffmpeg.writeFile('input_video.mp4', videoData);
        await ffmpeg.writeFile('input_audio.m4a', audioData);

        // 5. Run FFmpeg mux command
        reportProgress('muxing', 'Combinando áudio e vídeo...', 10, { filename });
        await ffmpeg.exec([
            '-i', 'input_video.mp4',
            '-i', 'input_audio.m4a',
            '-c', 'copy',
            '-movflags', '+faststart',
            'output.mp4'
        ]);

        // 6. Read output
        const outputData = await ffmpeg.readFile('output.mp4');

        // 7. Cleanup FFmpeg FS
        await ffmpeg.deleteFile('input_video.mp4').catch(() => { });
        await ffmpeg.deleteFile('input_audio.m4a').catch(() => { });
        await ffmpeg.deleteFile('output.mp4').catch(() => { });

        // 8. Download result
        const blob = new Blob([outputData], { type: 'video/mp4' });
        const blobUrl = URL.createObjectURL(blob);

        await chrome.downloads.download({
            url: blobUrl,
            filename: filename,
            saveAs: true
        });

        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);

        reportProgress('complete', filename, 100, {
            filename,
            receivedBytes: outputData.length,
            totalBytes: outputData.length
        });

        return { success: true, size: outputData.length };
    } catch (error) {
        reportProgress('error', filename, 0, { filename });
        console.error('[Extract] Mux error:', error);
        throw error;
    }
}
