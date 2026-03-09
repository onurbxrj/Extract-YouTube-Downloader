/**
 * itag-map.js — YouTube itag → Quality/Type mapping
 * Reference for parsing video quality from videoplayback URLs.
 */

const ITAG_MAP = {
    // Video + Audio (ready to download)
    18: { quality: '360p', type: 'video+audio', container: 'MP4', codec: 'H.264/AAC' },
    22: { quality: '720p', type: 'video+audio', container: 'MP4', codec: 'H.264/AAC' },
    43: { quality: '360p', type: 'video+audio', container: 'WebM', codec: 'VP8/Vorbis' },

    // Video Only (need audio pair)
    134: { quality: '360p', type: 'video-only', container: 'MP4', codec: 'H.264' },
    135: { quality: '480p', type: 'video-only', container: 'MP4', codec: 'H.264' },
    136: { quality: '720p', type: 'video-only', container: 'MP4', codec: 'H.264' },
    137: { quality: '1080p', type: 'video-only', container: 'MP4', codec: 'H.264' },
    138: { quality: '2160p', type: 'video-only', container: 'MP4', codec: 'H.264' },
    160: { quality: '144p', type: 'video-only', container: 'MP4', codec: 'H.264' },
    242: { quality: '240p', type: 'video-only', container: 'WebM', codec: 'VP9' },
    243: { quality: '360p', type: 'video-only', container: 'WebM', codec: 'VP9' },
    244: { quality: '480p', type: 'video-only', container: 'WebM', codec: 'VP9' },
    247: { quality: '720p', type: 'video-only', container: 'WebM', codec: 'VP9' },
    248: { quality: '1080p', type: 'video-only', container: 'WebM', codec: 'VP9' },
    271: { quality: '1440p', type: 'video-only', container: 'WebM', codec: 'VP9' },
    313: { quality: '2160p', type: 'video-only', container: 'WebM', codec: 'VP9' },

    // Audio Only
    139: { quality: '48kbps', type: 'audio-only', container: 'M4A', codec: 'AAC' },
    140: { quality: '128kbps', type: 'audio-only', container: 'M4A', codec: 'AAC' },
    141: { quality: '256kbps', type: 'audio-only', container: 'M4A', codec: 'AAC' },
    249: { quality: '50kbps', type: 'audio-only', container: 'WebM', codec: 'Opus' },
    250: { quality: '70kbps', type: 'audio-only', container: 'WebM', codec: 'Opus' },
    251: { quality: '160kbps', type: 'audio-only', container: 'WebM', codec: 'Opus' },
};

/**
 * Returns itag info or a fallback for unknown itags.
 * @param {number|string} itag
 * @returns {{ quality: string, type: string, container: string, codec: string }}
 */
function getItagInfo(itag) {
    return ITAG_MAP[Number(itag)] || {
        quality: 'Unknown',
        type: 'unknown',
        container: '?',
        codec: '?'
    };
}

/**
 * Checks if an itag has both video and audio combined.
 * @param {number|string} itag
 * @returns {boolean}
 */
function isCombinedStream(itag) {
    const info = getItagInfo(itag);
    return info.type === 'video+audio';
}

/**
 * Checks if itag is audio-only.
 * @param {number|string} itag
 * @returns {boolean}
 */
function isAudioOnly(itag) {
    const info = getItagInfo(itag);
    return info.type === 'audio-only';
}

/**
 * Checks if itag is video-only.
 * @param {number|string} itag
 * @returns {boolean}
 */
function isVideoOnly(itag) {
    const info = getItagInfo(itag);
    return info.type === 'video-only';
}
