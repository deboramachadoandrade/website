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
index.html          Home: hero, services, how we work, peer review, trusted by, contact
about.html          About and principles
strategy.html       Service 01 — AI Strategy & Consultancy
development.html    Service 02 — Custom AI Development
leadership.html     Service 03 — Fractional AI Leadership
404.html            Not found
style.css           All styling, organised in 25 numbered sections
js/main.js          Menu, scroll ruler, reveal animations — shared by every page
images/             Logos, portrait, video, generated icons
image_creation.py   Standalone helper for generating imagery with the OpenAI API
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

## Deploying

Any static host works: GitHub Pages, Netlify, Vercel, Cloudflare Pages. Upload the repository root as-is. `404.html` is picked up automatically by all four.

## Regenerating images

Requires Pillow (`pip install pillow`). Only the assets the pages actually reference live in `images/`; the full-resolution originals are kept outside the repository, so point these commands at wherever you have them.

- **Portrait** — `sips -s format jpeg -s formatOptions 72 --resampleWidth 900 <original> --out images/portrait-900.jpg`
- **Video poster** — `qlmanage -t -s 1400 -o . "images/Owl_*.mp4"`, then convert the PNG with `sips`
- **Icons** — `images/icon-512.png`, `apple-touch-icon.png` and `favicon.ico` are cropped from the orange mark in `Transparent Logo_black_letters.png`
