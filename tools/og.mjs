/* Renders the Open Graph cards in images/og-*.png.
 *
 *   node tools/og.mjs
 *
 * Uses the playwright-core already installed under .audit/ and the local
 * Chrome, so there is nothing new to install. The template is tools/og.html,
 * which pulls its tokens from the real style.css. */

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const PORT = 8766;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/* playwright-core lives in .audit, which is deliberately untracked. */
function loadChromium() {
    for (const base of ['../.audit/package.json', '../package.json', './package.json']) {
        try {
            return createRequire(new URL(base, import.meta.url))('playwright-core').chromium;
        } catch { /* try the next location */ }
    }
    throw new Error('playwright-core not found. Run: npm --prefix .audit install');
}

const CARDS = [
    {
        file: 'og-home.png',
        mark: '§',
        label: 'Independent AI consultancy',
        title: "The AI that's worth doing",
        sub: 'Strategy. Development. Leadership.',
        deco: 'steps',
    },
    {
        file: 'og-strategy.png',
        mark: 'Service 01',
        label: 'Strategy',
        title: 'AI Strategy & Consultancy',
        sub: 'A roadmap you can defend to your board, your engineers, and your own scepticism.',
        deco: 'curve',
    },
    {
        file: 'og-development.png',
        mark: 'Service 02',
        label: 'Development',
        title: 'Custom AI Development',
        sub: 'Systems that keep working on the Tuesday after the demo.',
        deco: 'flow',
    },
    {
        file: 'og-leadership.png',
        mark: 'Service 03',
        label: 'Leadership',
        title: 'Fractional AI Leadership',
        sub: "Senior technical judgement, a few days a month, for as long as it's useful.",
        deco: 'orbit',
    },
    {
        file: 'og-about.png',
        mark: '§ 00',
        label: 'About',
        title: 'Academic habits, pointed at real problems',
        sub: 'The people you call when you want the truth about whether something will work.',
        deco: '',
    },
];

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
        viewport: { width: 1200, height: 700 },
        deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();

    for (const card of CARDS) {
        const q = new URLSearchParams({
            mark: card.mark,
            label: card.label,
            title: card.title,
            sub: card.sub,
        });
        if (card.deco) { q.set('deco', card.deco); }

        await page.goto(`http://127.0.0.1:${PORT}/tools/og.html?${q}`, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        // The turbulence filter and the webfont swap both land a frame late
        await page.waitForTimeout(350);

        const out = path.join(ROOT, 'images', card.file);
        await page.locator('#card').screenshot({ path: out });
        console.log(`wrote images/${card.file}`);
    }
} finally {
    if (browser) { await browser.close(); }
    server.kill();
}
