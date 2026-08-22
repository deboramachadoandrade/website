/* Pre-launch check. Run before every push:
 *
 *   node tools/check.mjs
 *
 * Serves the repo, then verifies internal links and anchors, every referenced
 * asset, console errors, horizontal overflow at three breakpoints, the deploy
 * files, and the head metadata each page needs for a sane social preview. */

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const PORT = 8769;
const BASE = `http://127.0.0.1:${PORT}`;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SITE = 'https://prosop.ai';

const PAGES = ['index.html', 'about.html', 'strategy.html', 'development.html', 'leadership.html', '404.html'];
const INDEXED = ['index.html', 'about.html', 'strategy.html', 'development.html', 'leadership.html'];
const BREAKPOINTS = [[390, 844], [768, 1024], [1440, 900]];

const problems = [];
const notes = [];
const fail = (m) => problems.push(m);

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

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', ROOT], {
    stdio: 'ignore',
});

let browser;
try {
    await waitForPort(PORT);
    browser = await loadChromium().launch({ executablePath: CHROME });

    /* ---- 1. Deploy files ------------------------------------------------ */

    for (const f of ['CNAME', '.nojekyll', 'robots.txt', 'sitemap.xml', '404.html']) {
        if (!fs.existsSync(path.join(ROOT, f))) { fail(`missing deploy file: ${f}`); }
    }

    const cname = fs.readFileSync(path.join(ROOT, 'CNAME'), 'utf8').trim();
    if (cname !== 'prosop.ai') { fail(`CNAME is "${cname}", expected "prosop.ai"`); }

    const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
    for (const page of INDEXED) {
        const url = page === 'index.html' ? `${SITE}/` : `${SITE}/${page}`;
        if (!sitemap.includes(`<loc>${url}</loc>`)) { fail(`sitemap.xml missing ${url}`); }
    }
    const sitemapCount = (sitemap.match(/<loc>/g) || []).length;
    if (sitemapCount !== INDEXED.length) {
        fail(`sitemap.xml has ${sitemapCount} urls, expected ${INDEXED.length}`);
    }

    /* ---- 2. Per page ---------------------------------------------------- */

    for (const page of PAGES) {
        const html = fs.readFileSync(path.join(ROOT, page), 'utf8');

        // Head metadata
        const need = [
            ['og:title', /property="og:title"/],
            ['og:description', /property="og:description"/],
            ['og:image', /property="og:image"/],
            ['og:site_name', /property="og:site_name"/],
            ['twitter:card', /name="twitter:card"/],
            ['theme-color', /name="theme-color"/],
        ];
        if (page !== '404.html') {
            need.push(['canonical', /rel="canonical"/], ['og:url', /property="og:url"/]);
        }
        for (const [label, re] of need) {
            if (!re.test(html)) { fail(`${page}: missing ${label}`); }
        }

        // og:image must be absolute and the file must exist locally
        const ogImage = html.match(/property="og:image" content="([^"]+)"/)?.[1];
        if (ogImage) {
            if (!ogImage.startsWith('https://')) {
                fail(`${page}: og:image is not absolute (${ogImage})`);
            } else {
                const rel = ogImage.replace(`${SITE}/`, '');
                if (!fs.existsSync(path.join(ROOT, rel))) { fail(`${page}: og:image file missing (${rel})`); }
            }
        }

        // Canonical must match the page it sits on
        const canonical = html.match(/rel="canonical" href="([^"]+)"/)?.[1];
        if (canonical) {
            const expected = page === 'index.html' ? `${SITE}/` : `${SITE}/${page}`;
            if (canonical !== expected) { fail(`${page}: canonical is ${canonical}, expected ${expected}`); }
        }

        // JSON-LD must parse
        for (const block of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
            try { JSON.parse(block[1]); }
            catch (e) { fail(`${page}: JSON-LD does not parse -> ${e.message}`); }
        }

        // The legal notice must be in the markup, not injected by script
        if (!/class="footer__legal"/.test(html)) {
            fail(`${page}: footer__legal missing from the HTML`);
        }

        // Console errors + overflow at each breakpoint
        for (const [w, h] of BREAKPOINTS) {
            const ctx = await browser.newContext({ viewport: { width: w, height: h } });
            const p = await ctx.newPage();
            p.on('console', (m) => { if (m.type() === 'error') fail(`${page} @${w} console: ${m.text()}`); });
            p.on('requestfailed', (r) => {
                const u = r.url();
                if (u.startsWith(BASE)) { fail(`${page} @${w} request failed: ${u}`); }
            });
            p.on('response', (r) => {
                if (r.url().startsWith(BASE) && r.status() >= 400) {
                    fail(`${page} @${w} ${r.status()} for ${r.url().replace(BASE, '')}`);
                }
            });
            await p.goto(`${BASE}/${page}`, { waitUntil: 'networkidle' });

            const overflow = await p.evaluate(() => {
                const bad = [];
                const limit = document.documentElement.clientWidth;
                for (const el of document.querySelectorAll('body *')) {
                    const r = el.getBoundingClientRect();
                    if (r.width === 0 || r.height === 0) continue;
                    if (getComputedStyle(el).position === 'fixed') continue;
                    if (r.right > limit + 1) bad.push(`${el.tagName}.${el.className || '-'} right=${Math.round(r.right)}`);
                }
                return { bad: bad.slice(0, 5), scrollW: document.documentElement.scrollWidth, limit };
            });
            if (overflow.scrollW > overflow.limit + 1) {
                fail(`${page} @${w} horizontal scroll ${overflow.scrollW}>${overflow.limit} :: ${overflow.bad.join(' | ')}`);
            }
            await ctx.close();
        }

        // Internal links and anchors
        const ctx = await browser.newContext();
        const p = await ctx.newPage();
        await p.goto(`${BASE}/${page}`, { waitUntil: 'domcontentloaded' });
        const hrefs = await p.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')));
        for (const href of new Set(hrefs)) {
            if (/^(mailto:|tel:|https?:|#$)/.test(href)) continue;
            const [file, hash] = href.split('#');
            const target = file || page;
            const res = await fetch(`${BASE}/${target}`);
            if (!res.ok) { fail(`${page} -> ${href} returns ${res.status}`); continue; }
            if (hash) {
                const body = await res.text();
                if (!body.includes(`id="${hash}"`)) { fail(`${page} -> ${href} anchor #${hash} missing`); }
            }
        }
        await ctx.close();
    }

    /* ---- 3. Tracked images nothing references --------------------------- */

    const allHtml = PAGES.map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n')
        + fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
    for (const img of fs.readdirSync(path.join(ROOT, 'images'))) {
        if (img.startsWith('.')) continue;
        if (!allHtml.includes(img)) { notes.push(`images/${img} is not referenced by any page`); }
    }
} finally {
    if (browser) { await browser.close(); }
    server.kill();
}

if (notes.length) { console.log('NOTES:\n  ' + notes.join('\n  ') + '\n'); }
if (problems.length) {
    console.log(`PROBLEMS (${problems.length}):\n  ` + problems.join('\n  '));
    process.exit(1);
}
console.log('All checks passed.');
