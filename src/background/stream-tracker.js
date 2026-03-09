/**
 * Stream Tracker — Groups videoplayback segments by videoId + itag
 * Maintains a map of captured streams for download orchestration.
 */

/**
 * @typedef {object} StreamSegment
 * @property {string} url - Full URL of the segment
 * @property {string} range - Byte range (e.g., "0-1048575")
 * @property {number} timestamp - Capture timestamp
 */

/**
 * @typedef {object} StreamEntry
 * @property {string} videoId - Extracted video identifier
 * @property {string} itag - Quality/codec identifier
 * @property {string} quality - Human-readable quality (from itag-map)
 * @property {string} type - 'video+audio', 'video-only', 'audio-only'
 * @property {string} container - File container format
 * @property {number} contentLength - Total bytes (from clen param)
 * @property {number} expire - Expiration Unix timestamp
 * @property {string} authority - CDN hostname
 * @property {StreamSegment[]} segments - Captured segments
 * @property {number} tabId - Browser tab ID
 */

/** @type {Map<string, StreamEntry>} Key = `${videoId}-${itag}` */
const streamMap = new Map();

/**
 * Parses videoplayback URL parameters into structured data.
 * @param {string} rawUrl - Full videoplayback URL
 * @returns {object|null} Parsed params or null if invalid
 */
function parseVideoplaybackUrl(rawUrl) {
    try {
        const url = new URL(rawUrl);
        if (!url.pathname.includes('/videoplayback')) return null;

        const params = url.searchParams;
        return {
            id: params.get('id') || '',
            ei: params.get('ei') || '',
            itag: params.get('itag') || '',
            range: params.get('range') || '',
            clen: params.get('clen') || '',
            expire: params.get('expire') || '',
            mime: params.get('mime') || '',
            source: params.get('source') || '',
            authority: url.host
        };
    } catch {
        return null;
    }
}

/**
 * Generates a unique stream key from parsed params.
 * @param {object} parsed - Parsed URL params
 * @returns {string} Stream key
 */
function getStreamKey(parsed) {
    const videoId = parsed.id || parsed.ei || 'unknown';
    return `${videoId}-${parsed.itag}`;
}

/**
 * Tracks a videoplayback request, grouping by videoId + itag.
 * @param {string} url - Full URL
 * @param {number} tabId - Browser tab ID
 * @param {function} getItagInfo - Function to resolve itag info
 * @returns {StreamEntry|null} Updated stream entry
 */
function trackSegment(url, tabId, getItagInfo) {
    const parsed = parseVideoplaybackUrl(url);
    if (!parsed || !parsed.itag) return null;

    const key = getStreamKey(parsed);
    const itagInfo = getItagInfo(parsed.itag);

    if (!streamMap.has(key)) {
        streamMap.set(key, {
            videoId: parsed.id || parsed.ei || 'unknown',
            itag: parsed.itag,
            quality: itagInfo.quality,
            type: itagInfo.type,
            container: itagInfo.container,
            contentLength: parsed.clen ? parseInt(parsed.clen) : 0,
            expire: parsed.expire ? parseInt(parsed.expire) : 0,
            authority: parsed.authority,
            segments: [],
            tabId
        });
    }

    const entry = streamMap.get(key);

    const isDuplicate = entry.segments.some((s) => s.range === parsed.range && s.url === url);
    if (!isDuplicate) {
        entry.segments.push({
            url,
            range: parsed.range,
            timestamp: Date.now()
        });
    }

    return entry;
}

/**
 * Returns all tracked streams for a given tab.
 * @param {number} tabId
 * @returns {StreamEntry[]}
 */
function getStreamsByTab(tabId) {
    const results = [];
    for (const entry of streamMap.values()) {
        if (entry.tabId === tabId) {
            results.push(entry);
        }
    }
    return results;
}

/**
 * Returns all tracked streams.
 * @returns {StreamEntry[]}
 */
function getAllStreams() {
    return Array.from(streamMap.values());
}

/**
 * Clears all tracked streams.
 */
function clearStreams() {
    streamMap.clear();
}

/**
 * Removes expired streams based on current time.
 */
function cleanExpiredStreams() {
    const now = Math.floor(Date.now() / 1000);
    for (const [key, entry] of streamMap) {
        if (entry.expire > 0 && entry.expire < now) {
            streamMap.delete(key);
        }
    }
}
