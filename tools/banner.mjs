/* Renders the LinkedIn company cover into images/linkedin-banner.png.
 *
 *   node tools/banner.mjs
 *   node tools/banner.mjs --title "Something else"
 *
 * LinkedIn wants 1128x191. Shot at 2x for retina, which keeps the aspect
 * ratio identical, and LinkedIn downsamples. Template is tools/banner.html. */

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const PORT = 8767;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

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
            const socket = net.connect(port, '127.0.0.1');
            socket.once('connect', () => { socket.end(); resolve(); });
            socket.once('error', () => {
                socket.destroy();
                if (Date.now() > deadline) { reject(new Error(`port ${port} never opened`)); }
                else { setTimeout(attempt, 120); }
            });
        };
        attempt();
    });
}

const titleArg = process.argv.indexOf('--title');
const title = titleArg > -1 ? process.argv[titleArg + 1] : null;

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', ROOT], {
    stdio: 'ignore',
});

let browser;
try {
    await waitForPort(PORT);

    if (!fs.existsSync(CHROME)) {
        throw new Error(`Chrome not found at ${CHROME}`);
    }

    browser = await loadChromium().launch({ executablePath: CHROME });
    const ctx = await browser.newContext({
        viewport: { width: 1200, height: 400 },
        deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();

    const q = new URLSearchParams();
    if (title) { q.set('title', title); }

    await page.goto(`http://127.0.0.1:${PORT}/tools/banner.html?${q}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    // The turbulence filter and the webfont swap both land a frame late
    await page.waitForTimeout(350);

    const out = path.join(ROOT, 'images', 'linkedin-banner.png');
    await page.locator('#banner').screenshot({ path: out });
    console.log('wrote images/linkedin-banner.png');
} finally {
    if (browser) { await browser.close(); }
    server.kill();
}
