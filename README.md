# Pantone3D — Landing Page

A cinematic, single-page landing page for Pantone3D engineered 3D-printing filaments.

One filament strand runs through the whole page. It enters the hero and curves behind the spool. It then morphs from **straight → coil → wave → layer → printed form**. Next it becomes each material's sample geometry, travels across the off-white colour canvas, and feeds a layer-by-layer print. Finally it passes through depth as application objects.

## Run it

It's a static site with no build step. Either:

- open `index.html` directly in a browser, or
- serve the folder, e.g. `python3 -m http.server` and visit `http://localhost:8000`.

## Structure

```
index.html              semantic page markup (all content is real DOM)
assets/css/main.css     design tokens, layout, responsive + reduced-motion styles
assets/js/app.js        generated bundle (do not edit — see below)
assets/img/             spool cut-outs per colour (WebP, 1000w + 560w), logos, favicon
assets/vendor/          GSAP 3.13 (core, ScrollTrigger, SplitText) + Lenis 1.3
src/forms.js            filament forms: hero curve, coil, wave, layer, spiral "vase-mode" objects
src/strand.js           2D-canvas renderer: depth-sorted, shaded cylindrical strand
src/data.js             materials, colours, applications  ← content lives here
src/main.js             scroll choreography ("director"), UI, interactions
source/                 original supplied brand assets (logo, spool photo)
tools/build_assets.py   cuts out + recolours the spool photo, builds logo variants
tools/bundle.mjs        bundles /src into assets/js/app.js
```

After editing anything in `src/`, run:

```
node tools/bundle.mjs
```

To regenerate images (needs `pip install pillow numpy`):

```
python3 tools/build_assets.py
```

Spool colour variants are made by re-shading **only the filament pixels** of the supplied product photo. The spool geometry is never altered.

## Hosting

The site is static and has no build step, so any static host can serve the repository root.

- **Cloudflare Workers (current setup):** the Worker runs `npx wrangler deploy`. `wrangler.jsonc` serves the repository root as static assets, `.assetsignore` keeps the source, tools and docs from being published, and `_headers` applies there too.
- **Cloudflare Pages:** connect the repository with production branch `main`, no framework preset, an empty build command and `/` as the output directory. `_headers` sets cache lifetimes and basic security headers.
- **GitHub Pages:** deploy from `main` with `/ (root)` selected. GitHub Pages ignores `_headers`.

If you rename asset files on each release (for example `app.3f9a.js`), you can raise the cache lifetimes in `_headers` to a year with `immutable`.

## Motion system

- **One canvas, one strand.** Each pinned section describes the strand as a function of its own scroll progress. Between sections the director blends one section's end state into the next section's start state, so there are no cuts.
- GSAP ScrollTrigger handles pinning and scrubbing. SplitText handles masked line reveals. Lenis provides smooth wheel scrolling; native touch scrolling is kept on phones.
- Only transform and opacity are animated in the DOM. The strand is drawn on a single 2D canvas (no WebGL), with fewer points on mobile.
- Pointer parallax on the hero spool stays within about 1.5°. Product-card tilt stays within about 1.5°. Spool hover rotation is about 10°.
- **Reduced motion** (`prefers-reduced-motion`) turns off pinning, smooth scroll and the canvas, and shows a static, fully readable page. The material tabs and colour selector still work.
- Without JavaScript the page also falls back to a static layout.

## [VERIFY] before launch

Nothing below was supplied as verified brand data, so it is a placeholder or a design assumption:

| Item | Where |
| --- | --- |
| Official Pantone3D yellow. `#F7B102` is sampled from the product photo. | `--yellow` in `main.css`, `BRAND_YELLOW` in `src/data.js` |
| Which materials are actually sold (PLA+, Matte PLA, PETG, ABS, Nylon, Carbon Fiber) | `src/data.js`, sections 03 and 08 in `index.html` |
| Colours available per material and their swatch hex values | `src/data.js` |
| Material descriptions and "best for" wording. These are qualitative only, with no specs. | `src/data.js` and the `.mat` panels in `index.html` |
| Spool images for non-yellow colours are recolours of the yellow spool photo. Replace them with real photography when available. | `assets/img/spool-*.webp` |
| Contact email, phone, address and social links | footer in `index.html` |
| Legal page links | footer |

The page deliberately states no tolerances, temperatures, strength figures, certifications, customers or statistics. The sample geometry and application objects are illustrative, and the page labels them that way. Visible `[VERIFY]` tags are styled amber so they are easy to find and remove.

## Browser support

The page targets current evergreen browsers. Layout was checked at 1440×900, 1366×768, 768×1024 and 393×852, with no horizontal overflow at any of them.
