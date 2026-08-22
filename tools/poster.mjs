/* Captures the hero video poster frame.
 *
 *   node tools/poster.mjs --sample          write candidate frames to /tmp
 *   node tools/poster.mjs --at 2.4          write images/hero-poster.jpg
 *
 * There is no ffmpeg on this machine, so the frame is pulled by seeking the
 * video in Chrome and painting it to a canvas. */

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const PORT = 8768;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const VIDEO = 'images/Owl_Programs_on_Laptop_Flies_Away_cropped.mp4';

function loadChromium() {
    for (const base of ['../.audit/package.json', '../package.json', './package.json']) {
        try {
            return createRequire(new URL(base, import.meta.url))('playwright-core').chromium;
        } catch { /* try the next location */ }
    }
    throw new Error('playwright-core not found. Run: npm --prefix .audit install');
}

function waitForPort(port, timeoutMs = 10000) {
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolve, reject) => {
        const attempt = () => {
            const s = net.connect(port, '127.0.0.1');
            s.once('connect', () => { s.end(); resolve(); });
            s.once('error', () => {
                s.destroy();
                if (Date.now() > deadline) { reject(new Error(`port ${port} never opened`)); }
                else { setTimeout(attempt, 120); }
            });
        };
        attempt();
    });
}

const args = process.argv.slice(2);
const sample = args.includes('--sample');
const atIndex = args.indexOf('--at');
const at = atIndex >= 0 ? Number(args[atIndex + 1]) : null;

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', ROOT], {
    stdio: 'ignore',
});

let browser;
try {
    await waitForPort(PORT);
    browser = await loadChromium().launch({ executablePath: CHROME });
    const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });

    // Must be a real same-origin document, otherwise the canvas is tainted
    // by the video and toDataURL throws a SecurityError.
    await page.goto(`http://127.0.0.1:${PORT}/404.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((src) => {
        document.body.innerHTML = '';
        const v = document.createElement('video');
        v.id = 'v';
        v.muted = true;
        v.playsInline = true;
        v.src = '/' + src;
        document.body.appendChild(v);
    }, VIDEO);

    await page.waitForFunction(() => {
        const v = document.getElementById('v');
        return v && v.readyState >= 2;
    }, null, { timeout: 20000 });

    const meta = await page.evaluate(() => {
        const v = document.getElementById('v');
        return { duration: v.duration, width: v.videoWidth, height: v.videoHeight };
    });
    console.log(`video: ${meta.width}x${meta.height}, ${meta.duration.toFixed(2)}s`);

    /* Seeking alone does not present a new frame in headless Chrome: every
     * grab comes back as frame zero. Playing the clip through and capturing on
     * requestVideoFrameCallback is the only reliable way to get real frames. */
    const grabMany = async (times) => page.evaluate(async (targets) => {
        const v = document.getElementById('v');
        const c = document.createElement('canvas');
        c.width = v.videoWidth;
        c.height = v.videoHeight;
        const ctx = c.getContext('2d');
        const out = new Array(targets.length).fill(null);

        await new Promise((resolve) => {
            const onFrame = (_now, meta) => {
                const t = meta ? meta.mediaTime : v.currentTime;
                targets.forEach((target, i) => {
                    if (out[i] === null && t >= target) {
                        ctx.drawImage(v, 0, 0);
                        out[i] = c.toDataURL('image/jpeg', 0.82);
                    }
                });
                if (out.every((x) => x !== null) || v.ended) { resolve(); return; }
                v.requestVideoFrameCallback(onFrame);
            };
            v.requestVideoFrameCallback(onFrame);
            v.addEventListener('ended', resolve, { once: true });
            v.play();
            setTimeout(resolve, 30000);
        });

        v.pause();
        return out;
    }, times);

    const write = (dataUrl, out) => {
        fs.writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
        console.log(`wrote ${out}`);
    };

    if (sample) {
        const n = 10;
        const times = Array.from({ length: n }, (_, i) => (meta.duration * i) / n);
        const frames = await grabMany(times);
        frames.forEach((f, i) => {
            if (f) { write(f, `/tmp/poster-${String(i).padStart(2, '0')}-t${times[i].toFixed(2)}.jpg`); }
            else { console.log(`no frame at t=${times[i].toFixed(2)}`); }
        });
    } else {
        const t = at === null ? meta.duration / 2 : at;
        const [frame] = await grabMany([t]);
        if (!frame) { throw new Error(`no frame captured at t=${t}`); }

        const out = path.join(ROOT, 'images', 'hero-poster.jpg');
        write(frame, out);

        // Feather detail compresses badly; the raw grab lands near 100KB
        spawn('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '55',
            '--resampleWidth', '1000', out, '--out', out], { stdio: 'ignore' })
            .on('exit', () => {
                console.log(`compressed to ${fs.statSync(out).size} bytes`);
            });
    }
} finally {
    if (browser) { await browser.close(); }
    server.kill();
}
