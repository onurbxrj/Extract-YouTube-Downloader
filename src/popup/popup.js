/**
 * Popup Controller — Extract v2
 * Copy link, export log, download, progress bar, expire timer.
 */

const requestListEl = document.getElementById('requestList');
const emptyStateEl = document.getElementById('emptyState');
const footerCountEl = document.getElementById('footerCount');
const clearBtn = document.getElementById('clearBtn');
const exportBtn = document.getElementById('exportBtn');
const toastEl = document.getElementById('toast');
const toastIconEl = document.getElementById('toastIcon');
const toastTextEl = document.getElementById('toastText');
const downloadBar = document.getElementById('downloadBar');
const downloadLabel = document.getElementById('downloadLabel');
const downloadPercent = document.getElementById('downloadPercent');
const downloadFill = document.getElementById('downloadFill');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const outputDirInput = document.getElementById('outputDirInput');
const saveOutputDirBtn = document.getElementById('saveOutputDir');

let toastTimeout = null;

// --- Settings Panel Logic ---
settingsBtn.addEventListener('click', () => {
    settingsPanel.classList.toggle('visible');
});

// Load saved output directory
chrome.storage.local.get('outputDir').then((data) => {
    if (data.outputDir) {
        outputDirInput.value = data.outputDir;
    }
});

// Save output directory
saveOutputDirBtn.addEventListener('click', () => {
    const dir = outputDirInput.value.trim();
    chrome.storage.local.set({ outputDir: dir }).then(() => {
        showToast(dir ? `Pasta salva: ${dir}` : 'Pasta padrão restaurada', '📂');
        settingsPanel.classList.remove('visible');
    });
});

// --- SVG Icons (inline) ---
const ICONS = {
    copy: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    download: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    mux: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>'
};

/**
 * Shows a toast notification.
 * @param {string} text - Toast message
 * @param {string} icon - Toast icon character
 * @param {number} duration - Duration in ms
 */
function showToast(text, icon = '✓', duration = 2000) {
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTextEl.textContent = text;
    toastIconEl.textContent = icon;
    toastEl.classList.add('visible');
    toastTimeout = setTimeout(() => {
        toastEl.classList.remove('visible');
    }, duration);
}

/**
 * Formats timestamp to localized time.
 * @param {number} ts
 * @returns {string}
 */
function formatTime(ts) {
    return new Date(ts).toLocaleTimeString('pt-BR', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
}

/**
 * Formats remaining time from expire timestamp.
 * @param {number} expireUnix - Unix timestamp (seconds)
 * @returns {{ text: string, isExpiring: boolean, isExpired: boolean }}
 */
function formatExpire(expireUnix) {
    if (!expireUnix) return { text: '', isExpiring: false, isExpired: false };

    const now = Math.floor(Date.now() / 1000);
    const remaining = expireUnix - now;

    if (remaining <= 0) {
        return { text: 'Expirado', isExpiring: true, isExpired: true };
    }

    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);

    const text = hours > 0 ? `${hours}h ${minutes}m restantes` : `${minutes}m restantes`;
    const isExpiring = remaining < 1800; // < 30 min

    return { text, isExpiring, isExpired: false };
}

/**
 * Truncates string.
 * @param {string} str
 * @param {number} max
 * @returns {string}
 */
function truncate(str, max = 55) {
    return str.length <= max ? str : str.substring(0, max) + '…';
}

/**
 * Returns badge class for stream type.
 * @param {string} streamType
 * @returns {string}
 */
function getTypeBadgeClass(streamType) {
    if (streamType === 'video+audio') return 'badge-type-va';
    if (streamType === 'video-only') return 'badge-type-vo';
    if (streamType === 'audio-only') return 'badge-type-ao';
    return '';
}

/**
 * Returns short label for stream type.
 * @param {string} streamType
 * @returns {string}
 */
function getTypeLabel(streamType) {
    if (streamType === 'video+audio') return 'V+A';
    if (streamType === 'video-only') return 'Video';
    if (streamType === 'audio-only') return 'Audio';
    return '';
}

/**
 * Copies text to clipboard.
 * @param {string} text
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('Link copiado!', '📋');
    } catch {
        showToast('Erro ao copiar', '✗');
    }
}

/**
 * Initiates a stream download via service worker.
 * @param {string} url
 * @param {object} request
 */
function startDownload(url, request) {
    const quality = request.quality || 'video';
    const container = (request.container || 'mp4').toLowerCase();
    const filename = `extract_${quality}_${Date.now()}.${container}`;

    showToast('Iniciando download...', '⬇');

    chrome.runtime.sendMessage({
        type: 'DOWNLOAD_STREAM',
        url,
        filename,
        method: request.method || 'GET'
    }, (response) => {
        if (chrome.runtime.lastError || !response?.success) {
            showToast('Erro no download', '✗');
        }
    });
}

/**
 * Initiates an HD mux download (video-only + audio pair).
 * Searches for a matching audio stream and uses FFmpeg to combine.
 * @param {string} videoUrl
 * @param {object} request
 */
async function startMuxDownload(videoUrl, request) {
    const quality = request.quality || '1080p';
    const filename = `extract_${quality}_muxed_${Date.now()}.mp4`;

    showToast('Buscando par de áudio...', '🔍');

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // Parse videoId from the URL or fallback to req.videoId from background tracker
        const urlObj = new URL(videoUrl);
        let videoId = request.videoId;
        if (!videoId || videoId === 'unknown') {
            if (urlObj.hostname.includes('googlevideo.com')) {
                videoId = urlObj.searchParams.get('docid') || urlObj.searchParams.get('ei') || '';
            } else {
                videoId = urlObj.searchParams.get('v') || urlObj.searchParams.get('id') || '';
            }
        }

        chrome.runtime.sendMessage({
            type: 'FIND_AUDIO_PAIR',
            videoId,
            tabId: tab?.id
        }, (response) => {
            if (chrome.runtime.lastError) {
                showToast('Erro ao buscar áudio', '✗');
                return;
            }

            if (!response?.audioPair || !response.audioPair.segments?.length) {
                showToast('Par de áudio não encontrado. Baixando sem áudio...', '⚠️');
                startDownload(videoUrl, request);
                return;
            }

            const audioUrl = response.audioPair.segments[0].url;
            showToast('Iniciando HD download + merge...', '⬇');

            chrome.runtime.sendMessage({
                type: 'MUX_DOWNLOAD',
                videoUrl,
                audioUrl,
                filename,
                videoMethod: request.method || 'GET',
                audioMethod: request.method || 'GET' // usually same origin/method
            }, (res) => {
                if (chrome.runtime.lastError || !res?.success) {
                    const errMsg = res?.error || 'Erro desconhecido';
                    showToast(`Mux falhou: ${errMsg}`, '✗');
                }
            });
        });
    } catch {
        showToast('Erro no HD download', '✗');
    }
}

/**
 * Creates a request card DOM element.
 * @param {object} req
 * @returns {HTMLElement}
 */
function createRequestCard(req) {
    const card = document.createElement('div');
    card.className = 'request-card';
    card.title = req.fullUrl || '';

    // Top row: badges + timestamp
    const badges = [`<span class="badge badge-get">${req.method || 'GET'}</span>`];
    if (req.quality && req.quality !== 'Unknown') {
        badges.push(`<span class="badge badge-quality">${req.quality}</span>`);
    }
    if (req.streamType && req.streamType !== 'unknown') {
        badges.push(`<span class="badge ${getTypeBadgeClass(req.streamType)}">${getTypeLabel(req.streamType)}</span>`);
    }

    // Expire info
    let expireHtml = '';
    if (req.expire) {
        const { text, isExpiring, isExpired } = formatExpire(req.expire);
        if (text) {
            const cls = isExpiring ? 'card-expire expiring' : 'card-expire';
            expireHtml = `<div class="${cls}"><span class="expire-dot"></span>${text}</div>`;
        }
    }

    // Action buttons
    const copyBtn = `<button class="action-btn copy-btn" data-url="${encodeURIComponent(req.fullUrl)}">${ICONS.copy} Copy</button>`;

    // Download button via Bridge Server (yt-dlp local) for matched youtube videos
    let downloadBtn = '';
    if (req.videoId && req.videoId !== 'unknown') {
        const ytUrl = `https://www.youtube.com/watch?v=${req.videoId}`;
        downloadBtn = `<button class="action-btn primary bridge-btn" data-url="${encodeURIComponent(ytUrl)}" data-quality="best" title="Download via yt-dlp Local Server">${ICONS.download} Download</button>`;
    }

    card.innerHTML = `
    <div class="card-top">
      <div class="card-top-left">${badges.join('')}</div>
      <span class="card-timestamp">${formatTime(req.timestamp)}</span>
    </div>
    <div class="card-authority">${req.authority}</div>
    <div class="card-path">${truncate(req.path)}</div>
    ${expireHtml}
    <div class="card-actions">${copyBtn}${downloadBtn}</div>
  `;

    // Event: Copy
    card.querySelector('.copy-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        const url = decodeURIComponent(e.currentTarget.dataset.url);
        copyToClipboard(url);
    });

    // Event: Download (Bridge Server)
    const bridgeBtnEl = card.querySelector('.bridge-btn');
    if (bridgeBtnEl) {
        bridgeBtnEl.addEventListener('click', (e) => {
            e.stopPropagation();
            const url = decodeURIComponent(e.currentTarget.dataset.url);
            startBridgeDownload(url, req);
        });
    }

    return card;
}

/**
 * Sends request to localhost Bridge Server to trigger yt-dlp download
 * @param {string} url - Base YouTube URL
 * @param {object} req - Request object
 */
async function startBridgeDownload(url, req) {
    try {
        downloadBar.classList.add('visible');
        downloadLabel.textContent = `Aguardando Local Server...`;
        downloadPercent.textContent = '...';

        // Read custom output directory from storage
        const storageData = await chrome.storage.local.get('outputDir');
        const outputDir = storageData.outputDir || '';

        const res = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
                { type: 'BRIDGE_DOWNLOAD', url, quality: 'best', outputDir },
                (response) => {
                    if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                    else resolve(response);
                }
            );
        });

        if (res && res.success) {
            downloadPercent.textContent = '✅';
            downloadFill.style.width = '100%';
            showToast('Download concluído no Backend!', '✅');
        } else {
            throw new Error(res?.error || 'Erro no servidor. Está rodando npm start?');
        }
    } catch (e) {
        downloadPercent.textContent = '❌';
        downloadFill.style.width = '0%';
        showToast(`Falha Server: ${e.message}`, '❌');
    } finally {
        setTimeout(() => downloadBar.classList.remove('visible'), 5000);
    }
}

/**
 * Renders request list.
 * @param {Array} requests
 */
function renderRequests(requests) {
    requestListEl.innerHTML = '';

    if (!requests || requests.length === 0) {
        requestListEl.style.display = 'none';
        emptyStateEl.classList.add('visible');
        footerCountEl.textContent = '0 requests';
        return;
    }

    emptyStateEl.classList.remove('visible');
    requestListEl.style.display = 'flex';

    requests.forEach((req) => {
        requestListEl.appendChild(createRequestCard(req));
    });

    footerCountEl.textContent = `${requests.length} request${requests.length !== 1 ? 's' : ''}`;
}

/**
 * Loads requests from service worker.
 */
async function loadRequests() {
    try {
        chrome.runtime.sendMessage(
            { type: 'GET_REQUESTS' },
            (res) => {
                if (chrome.runtime.lastError) {
                    renderRequests([]);
                    return;
                }
                renderRequests(res?.requests || []);
            }
        );
    } catch {
        renderRequests([]);
    }
}

/**
 * Clears all requests.
 */
function clearRequests() {
    chrome.runtime.sendMessage({ type: 'CLEAR_REQUESTS' }, () => {
        renderRequests([]);
        showToast('Histórico limpo', '🗑');
    });
}

/**
 * Exports log as JSON file.
 */
async function exportLog() {
    try {
        chrome.runtime.sendMessage(
            { type: 'EXPORT_LOG' },
            (res) => {
                if (chrome.runtime.lastError || !res) {
                    showToast('Erro ao exportar', '✗');
                    return;
                }

                const blob = new Blob([res.log], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `extract_log_${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);

                showToast(`${res.count} requests exportados`, '📥');
            }
        );
    } catch {
        showToast('Erro ao exportar', '✗');
    }
}

// --- Download Progress Listener ---
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'NEW_REQUEST') {
        loadRequests();
        return;
    }

    if (message.type === 'DOWNLOAD_PROGRESS') {
        if (message.status === 'fetching' || message.status === 'downloading' ||
            message.status === 'loading-ffmpeg' || message.status === 'muxing') {
            downloadBar.classList.add('visible');
            downloadLabel.textContent = message.filename || 'Processando...';
            const pct = message.progress >= 0 ? `${message.progress}%` : '...';
            downloadPercent.textContent = pct;
            downloadFill.style.width = message.progress >= 0 ? `${message.progress}%` : '0%';
        }

        if (message.status === 'complete') {
            downloadPercent.textContent = '100%';
            downloadFill.style.width = '100%';
            showToast('Download concluído!', '✅');
            setTimeout(() => downloadBar.classList.remove('visible'), 2000);
        }

        if (message.status === 'error') {
            downloadPercent.textContent = 'Erro';
            showToast(`Download falhou: ${message.error || 'desconhecido'}`, '✗');
            setTimeout(() => downloadBar.classList.remove('visible'), 3000);
        }
    }
});

// --- Expire timer refresh (every 30s) ---
setInterval(() => {
    document.querySelectorAll('.card-expire').forEach((el) => {
        // Re-render will update timers on next loadRequests
    });
    loadRequests();
}, 30000);

// --- Event Listeners ---
clearBtn.addEventListener('click', clearRequests);
exportBtn.addEventListener('click', exportLog);

// --- Init ---
document.addEventListener('DOMContentLoaded', loadRequests);
