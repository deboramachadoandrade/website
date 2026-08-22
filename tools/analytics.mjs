/* Adds (or updates) the Cloudflare Web Analytics beacon on every page.
 *
 *   node tools/analytics.mjs <token>
 *   node tools/analytics.mjs --remove
 *
 * Cloudflare Web Analytics is free, cookieless and needs no consent banner,
 * which is the point: a cookie prompt would sit badly next to "GDPR-native
 * from the first sketch". Get the token from the Cloudflare dashboard under
 * Web Analytics, after adding prosop.ai as a site.
 *
 * There is no templating in this repo, so the beacon has to be written into
 * all six pages. This keeps them identical. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = ['index.html', 'about.html', 'strategy.html', 'development.html', 'leadership.html', '404.html'];
const MARKER = 'static.cloudflareinsights.com/beacon.min.js';

const arg = process.argv[2];
if (!arg) {
    console.error('usage: node tools/analytics.mjs <token>   |   --remove');
    process.exit(1);
}

const remove = arg === '--remove';
if (!remove && !/^[a-f0-9]{16,}$/i.test(arg)) {
    console.error(`"${arg}" does not look like a Cloudflare beacon token (hex, 32 chars).`);
    process.exit(1);
}

const line = `    <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${arg}"}'></script>\n`;

for (const page of PAGES) {
    const file = path.join(ROOT, page);
    let html = fs.readFileSync(file, 'utf8');

    // Drop any existing beacon first, so this is safe to re-run
    const before = html;
    html = html.replace(new RegExp(`^.*${MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*\\n`, 'gm'), '');
    const had = before !== html;

    if (!remove) {
        if (!html.includes('</body>')) {
            console.error(`${page}: no </body> found, skipped`);
            continue;
        }
        html = html.replace('</body>', `${line}</body>`);
    }

    fs.writeFileSync(file, html);
    console.log(`${page}: ${remove ? (had ? 'removed' : 'nothing to remove') : (had ? 'updated' : 'added')}`);
}

console.log(`\nNow run: node tools/check.mjs`);
