# Prosop.ai — website

A static site. No build step, no dependencies, no framework. Edit the HTML, refresh the browser.

## Preview locally

Opening the files directly with `file://` mostly works, but the video and fonts behave better over HTTP:

```bash
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## Structure

```
index.html          Home: hero, services, how we work, a client note, trusted by, contact
about.html          About, principles and the open position
strategy.html       Service 01 — AI Strategy & Consultancy
development.html    Service 02 — Custom AI Development
leadership.html     Service 03 — Fractional AI Leadership
404.html            Not found
style.css           All styling, organised in 25 numbered sections
js/main.js          Menu, scroll ruler, reveal animations — shared by every page
images/             Logos, portrait, video, generated icons, social cards
image_creation.py   Standalone helper for generating imagery with the OpenAI API

CNAME               Custom domain for GitHub Pages
.nojekyll           Skip Jekyll processing
robots.txt          Allows everything, points at the sitemap
sitemap.xml         The five indexable pages

tools/og.html       1200x630 social card template, styled from style.css
tools/og.mjs        Renders images/og-*.png
tools/banner.html   1128x191 LinkedIn cover template, same approach as og.html
tools/banner.mjs    Renders images/linkedin-banner.png
tools/poster.mjs    Pulls the hero video poster frame
tools/check.mjs     Pre-launch check — run before every push
tools/analytics.mjs Writes the analytics beacon into all six pages
```

There is no templating, so the header and footer markup is repeated in each HTML file. The blocks are byte-identical on purpose: to change navigation everywhere, find and replace across all six pages.

## Design system

The look is a physicist's lab notebook — graph paper, numbered sections (`§ 01`), hand-drawn diagrams, handwritten margin notes.

| Token | Value | Used for |
| --- | --- | --- |
| `--orange` | `#FFB203` | Brand accent, sampled from the logo. Fine on charcoal, too pale for text on paper |
| `--ochre-deep` | `#96660F` | Accent text on light backgrounds (4.71:1, passes AA) |
| `--paper` | `#FAF8F3` | Default page background |
| `--charcoal` | `#2B2B2B` | Body text, dark sections |
| `--grey-deep` | `#6E6B66` | Secondary text (5.00:1) |

Type is IBM Plex Sans for body, IBM Plex Mono for headings and labels, and Caveat for the handwritten annotations only.

Diagrams are inline SVG rather than images. They share a `#sketch` filter — a turbulence displacement map defined at the top of each page — which is what gives clean vector paths their wobble.

## Contact form

The contact section is deliberately `mailto:` only, since static hosting cannot accept a form POST. To add a real form, drop a `<form>` into `.contact__card` and point its `action` at [Formspree](https://formspree.io) or, if you deploy to Netlify, add the `netlify` attribute.

## Before you push

```bash
node tools/check.mjs
```

Serves the repo and verifies internal links and anchors, every referenced asset, console errors, horizontal overflow at 390 / 768 / 1440, the deploy files, canonical and Open Graph tags, and that the JSON-LD parses. Exits non-zero if anything is wrong.

It borrows `playwright-core` from `.audit/`, which is untracked. If it is missing:

```bash
npm --prefix .audit install
```

## Deploying

Live on **GitHub Pages** from `main` at the repository root, with `CNAME` holding the custom domain. The repository must stay public for Pages to serve on a free plan.

DNS lives at GoDaddy. The apex `A` records point at GitHub (`185.199.108.153`, `.109.153`, `.110.153`, `.111.153`) and `www` is a `CNAME` to `deboramachadoandrade.github.io`. **Leave the `MX` records alone** — Google Workspace serves `hello@prosop.ai` from them.

## Social cards

`images/og-*.png` are generated, not hand-made:

```bash
node tools/og.mjs
```

The template is `tools/og.html`, which links the real `style.css`, so the cards track the design tokens. Note that everything in it is namespaced `og-card__*`: the site's own `.card` block uses the `background` shorthand and would otherwise wipe out the graph-paper grid.

Each page points at its card with an absolute `og:image` URL. Relative URLs are silently rejected by LinkedIn and X.

The LinkedIn company cover is separate — the cards are what appear when someone *shares* a link, the cover is what they see *on the page*:

```bash
node tools/banner.mjs
node tools/banner.mjs --title "Something else"
```

Rendered at 2x (2256x382) for retina; LinkedIn downsamples. Nothing sits in the bottom-left, which the round logo tile covers on desktop, and the headline is centred so the sides can crop on mobile without losing words.

## Analytics

Not enabled yet. Add `prosop.ai` in the Cloudflare dashboard under Web Analytics, copy the beacon token, then:

```bash
node tools/analytics.mjs <token>
node tools/check.mjs
```

Cloudflare Web Analytics is free and cookieless, so it needs no consent banner — a cookie prompt would sit badly next to "GDPR-native from the first sketch". `--remove` takes it out again, and re-running with a new token replaces the old one.

## The job posting

`about.html` carries `JobPosting` structured data, which is what puts the role into Google Jobs. Google drops postings once `validThrough` has passed, currently **2026-11-20**. While the vacancy is open, push `datePosted` and `validThrough` forward every couple of months.

## Regenerating images

Requires Pillow (`pip install pillow`). Only the assets the pages actually reference live in `images/`; the full-resolution originals are kept outside the repository, so point these commands at wherever you have them.

- **Portrait** — `sips -s format jpeg -s formatOptions 72 --resampleWidth 900 <original> --out images/portrait-900.jpg`
- **Video poster** — `node tools/poster.mjs --at 4.0`, or `--sample` first to write ten candidate frames to `/tmp` and pick one. Seeking alone returns frame zero in headless Chrome, so the script plays the clip and captures on `requestVideoFrameCallback`; the exact frame therefore shifts slightly between runs.
- **Social cards** — `node tools/og.mjs`
- **Icons** — `images/icon-512.png`, `apple-touch-icon.png` and `favicon.ico` are cropped from the orange mark in `Transparent Logo_black_letters.png`
