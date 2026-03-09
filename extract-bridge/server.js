const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const ffmpegStatic = require('ffmpeg-static');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3010;

app.use(cors());
app.use(express.json());

// Ensure downloads directory exists
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir);
}

// Path to portable yt-dlp executable
const ytDlpExecPath = path.resolve(__dirname, 'yt-dlp.exe');
const YT_DLP_RELEASE_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';

/**
 * Downloads the yt-dlp.exe binary if it doesn't already exist.
 * Uses native buffer write to prevent zero-byte EFTYPE stream errors in Node.js 24+.
 */
async function ensureYtDlp() {
    if (fs.existsSync(ytDlpExecPath)) {
        return;
    }
    console.log(`[!] yt-dlp.exe not found. Downloading from official release...`);
    const res = await fetch(YT_DLP_RELEASE_URL);

    if (!res.ok) throw new Error(`Failed to download yt-dlp: ${res.statusText}`);

    // Download completely into memory first
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Write entire solid binary to disk
    fs.writeFileSync(ytDlpExecPath, buffer);
    console.log(`[+] yt-dlp.exe downloaded successfully. Size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
}

app.post('/download', async (req, res) => {
    const { url, quality, outputDir } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        await ensureYtDlp();
    } catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to initialize yt-dlp binary', details: err.message });
    }

    // Use custom output directory if provided, otherwise default
    const targetDir = outputDir && outputDir.trim() ? outputDir.trim() : downloadsDir;
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    console.log(`\n[+] Starting download for: ${url}`);

    // Choose format string based on quality if provided, else best
    const formatStr = quality === 'audio-only'
        ? 'bestaudio[ext=m4a]/bestaudio'
        : 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';

    // Spawn portable process
    // yt-dlp.exe -f ... <url> -o "downloads/%(title)s.%(ext)s" --ffmpeg-location ... --no-warnings
    const dlpProcess = spawn(ytDlpExecPath, [
        '-f', formatStr,
        '-o', path.join(targetDir, '%(title)s.%(ext)s'),
        '--ffmpeg-location', ffmpegStatic,
        '--no-warnings',
        url
    ]);

    let stdoutData = '';
    let stderrData = '';

    dlpProcess.stdout.on('data', (data) => {
        const str = data.toString();
        stdoutData += str;
        process.stdout.write(str); // echo to server console
    });

    dlpProcess.stderr.on('data', (data) => {
        const str = data.toString();
        stderrData += str;
        process.stderr.write(str); // echo to server console
    });

    dlpProcess.on('close', (code) => {
        console.log(`[!] yt-dlp child process exited with code ${code}`);
        if (code === 0) {
            res.json({ success: true, message: 'Download completed successfully. Check the /downloads folder.' });
        } else {
            res.status(500).json({ success: false, error: 'Download failed', logs: stderrData });
        }
    });

    // In case execution fails (e.g permissions)
    dlpProcess.on('error', (err) => {
        console.error('Failed to start subprocess:', err);
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: 'Command failed to start.', details: err.message });
        }
    });
});

app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`  Extract Bridge Server Running!        `);
    console.log(`  Listening on http://localhost:${PORT} `);
    console.log(`  Downloads will be saved to: /downloads`);
    console.log(`========================================`);
});
