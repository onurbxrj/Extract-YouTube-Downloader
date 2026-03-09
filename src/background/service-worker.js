/**
 * Service Worker — Extract v2
 * Intercepts GET requests to YouTube/Googlevideo, tracks streams,
 * and manages download operations via Offscreen Document.
 */

importScripts('../config.js');
importScripts('../lib/itag-map.js');
importScripts('./stream-tracker.js');

const MAX_REQUESTS = 50;

const URL_PATTERNS = [
    '*://*.youtube.com/embed/*',
    '*://*.youtube.com/watch*',
    '*://*.googlevideo.com/videoplayback*',
    '*://*.youtube-nocookie.com/embed/*'
];

/**
 * Extracts structured metadata from a raw request URL.
 * @param {string} rawUrl
 * @returns {{ authority: string, path: string }}
 */
function parseRequestUrl(rawUrl) {
    try {
        const url = new URL(rawUrl);
        return {
            authority: url.host,
            path: url.pathname + url.search
        };
    } catch {
        return { authority: 'unknown', path: rawUrl };
    }
}

/**
 * Extracts itag and expire from a videoplayback URL.
 * @param {string} rawUrl
 * @returns {{ itag: string, expire: number, quality: string, streamType: string, container: string }}
 */
function extractStreamInfo(rawUrl) {
    try {
        const url = new URL(rawUrl);
        const itag = url.searchParams.get('itag') || '';
        const expire = url.searchParams.get('expire') || '';
        const info = getItagInfo(itag);
        return {
            itag,
            expire: expire ? parseInt(expire) : 0,
            quality: info.quality,
            streamType: info.type,
            container: info.container
        };
    } catch {
        return { itag: '', expire: 0, quality: 'Unknown', streamType: 'unknown', container: '?' };
    }
}

/**
 * Stores a captured request in chrome.storage.local.
 * @param {object} requestData
 */
async function storeRequest(requestData) {
    try {
        const result = await chrome.storage.local.get('requests');
        const requests = result.requests || [];

        requests.unshift(requestData);

        if (requests.length > MAX_REQUESTS) {
            requests.length = MAX_REQUESTS;
        }

        await chrome.storage.local.set({ requests });

        chrome.runtime.sendMessage({
            type: 'NEW_REQUEST',
            data: requestData
        }).catch(() => { });
    } catch (error) {
        console.error('[Extract] Storage error:', error);
    }
}

// Map to store true YouTube Video IDs by Tab ID
const tabVideoIds = new Map();

// --- Request Interception (all methods) ---
chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
        if (details.tabId < 0) return;

        // Track YouTube embeds to capture real video ID dynamically
        if (details.url.includes('/embed/')) {
            const match = details.url.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
            if (match) {
                tabVideoIds.set(details.tabId, match[1]);
            }
        }

        const { authority, path } = parseRequestUrl(details.url);
        const streamInfo = details.url.includes('/videoplayback')
            ? extractStreamInfo(details.url)
            : { itag: '', expire: 0, quality: '', streamType: '', container: '' };

        // Determine best videoId (from URL param or from tracked Tab map)
        let videoId = 'unknown';
        try {
            const urlObj = new URL(details.url);
            if (urlObj.hostname.includes('googlevideo.com')) {
                videoId = tabVideoIds.get(details.tabId) || urlObj.searchParams.get('docid') || 'unknown';
            } else {
                videoId = urlObj.searchParams.get('v') || urlObj.searchParams.get('id') || tabVideoIds.get(details.tabId) || 'unknown';
            }
        } catch { }

        const requestData = {
            id: `${details.requestId}-${Date.now()}`,
            method: details.method,
            authority,
            path,
            fullUrl: details.url,
            tabId: details.tabId,
            timestamp: Date.now(),
            videoId,
            itag: streamInfo.itag,
            expire: streamInfo.expire,
            quality: streamInfo.quality,
            streamType: streamInfo.streamType,
            container: streamInfo.container,
            isVideoplayback: details.url.includes('/videoplayback')
        };

        storeRequest(requestData);

        // Track stream segments for download
        if (requestData.isVideoplayback) {
            trackSegment(details.url, details.tabId, getItagInfo);
        }
    },
    { urls: URL_PATTERNS },
    ['requestHeaders']
);

// --- Message Handling ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_REQUESTS') {
        chrome.storage.local.get('requests').then((result) => {
            const allRequests = result.requests || [];
            const filtered = message.tabId
                ? allRequests.filter((r) => r.tabId === message.tabId)
                : allRequests;
            sendResponse({ requests: filtered });
        });
        return true;
    }

    if (message.type === 'CLEAR_REQUESTS') {
        chrome.storage.local.set({ requests: [] }).then(() => {
            clearStreams();
            sendResponse({ success: true });
        });
        return true;
    }

    if (message.type === 'EXPORT_LOG') {
        chrome.storage.local.get('requests').then((result) => {
            const allRequests = result.requests || [];
            const filtered = message.tabId
                ? allRequests.filter((r) => r.tabId === message.tabId)
                : allRequests;
            sendResponse({
                log: JSON.stringify(filtered, null, 2),
                count: filtered.length,
                exportedAt: new Date().toISOString()
            });
        });
        return true;
    }

    if (message.type === 'GET_STREAMS') {
        const streams = message.tabId
            ? getStreamsByTab(message.tabId)
            : getAllStreams();
        sendResponse({ streams });
        return true;
    }

    if (message.type === 'DOWNLOAD_STREAM') {
        handleStreamDownload(message.url, message.filename, message.method).then((result) => {
            sendResponse(result);
        }).catch((error) => {
            sendResponse({ success: false, error: error.message });
        });
        return true;
    }

    if (message.type === 'MUX_DOWNLOAD') {
        handleMuxDownload(message.videoUrl, message.audioUrl, message.filename, message.videoMethod, message.audioMethod).then((result) => {
            sendResponse(result);
        }).catch((error) => {
            sendResponse({ success: false, error: error.message });
        });
        return true;
    }

    if (message.type === 'BRIDGE_DOWNLOAD') {
        fetch(EXT_CONFIG.BRIDGE_SERVER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: message.url, quality: message.quality, outputDir: message.outputDir || '' })
        })
            .then(r => r.json())
            .then(data => sendResponse(data))
            .catch(err => sendResponse({ success: false, error: `Servidor não acessível. IP ou Porta ${EXT_CONFIG.BRIDGE_SERVER_URL} rejeitou a conexão.` }));
        return true;
    }

    if (message.type === 'FIND_AUDIO_PAIR') {
        const streams = message.tabId
            ? getStreamsByTab(message.tabId)
            : getAllStreams();
        const audioPair = streams.find((s) =>
            s.type === 'audio-only' &&
            s.videoId === message.videoId
        );
        sendResponse({ audioPair: audioPair || null });
        return true;
    }
});

/**
 * Ensures the offscreen document is created.
 */
async function ensureOffscreen() {
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT']
    });

    if (existingContexts.length === 0) {
        await chrome.offscreen.createDocument({
            url: chrome.runtime.getURL('offscreen/offscreen.html'),
            reasons: ['BLOBS'],
            justification: 'Download and mux video streams via FFmpeg WASM'
        });
    }
}

/**
 * Handles single stream download via Offscreen Document.
 * @param {string} url - The videoplayback URL to download
 * @param {string} filename - Suggested filename
 * @param {string} method - HTTP Method used in original request
 * @returns {Promise<{success: boolean}>}
 */
async function handleStreamDownload(url, filename, method = 'GET') {
    try {
        await ensureOffscreen();

        const response = await chrome.runtime.sendMessage({
            type: 'OFFSCREEN_DOWNLOAD',
            target: 'offscreen',
            url,
            filename,
            method
        });

        return response;
    } catch (error) {
        console.error('[Extract] Download error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Handles muxing download: fetches video + audio, muxes with FFmpeg.
 * @param {string} videoUrl - Video-only stream URL
 * @param {string} audioUrl - Audio-only stream URL
 * @param {string} filename - Output filename
 * @param {string} videoMethod - Output filename
 * @param {string} audioMethod - Output filename
 * @returns {Promise<{success: boolean}>}
 */
async function handleMuxDownload(videoUrl, audioUrl, filename, videoMethod = 'GET', audioMethod = 'GET') {
    try {
        await ensureOffscreen();

        const response = await chrome.runtime.sendMessage({
            type: 'OFFSCREEN_MUX',
            target: 'offscreen',
            videoUrl,
            audioUrl,
            filename,
            videoMethod,
            audioMethod
        });

        return response;
    } catch (error) {
        console.error('[Extract] Mux download error:', error);
        return { success: false, error: error.message };
    }
}

// Clean expired streams periodically
chrome.alarms.create('cleanExpired', { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'cleanExpired') {
        cleanExpiredStreams();
    }
});
