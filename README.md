# Pantone3D — Landing Page

A cinematic landing page and About page for Pantone3D engineered 3D-printing filaments.

One filament strand runs through the whole site: hero trail and orbit ring, a printed object in the About block, straight → curve → coil → layer → object in the Material Story, an orbit around the selected spool, a ribbon of coloured strands in the Colour section, a layer-by-layer print, and a single yellow line under the closing headline.

## Run it

It's a static site with no build step. Either:

- open `index.html` directly in a browser, or
- serve the folder, e.g. `python3 -m http.server` and visit `http://localhost:8000`.

## Structure

```
index.html              landing page markup (all content is real DOM)
about.html              About page, same design system
assets/css/main.css     design tokens, type, panels, layout, responsive + reduced-motion styles
assets/js/app.js        generated bundle for index.html (do not edit, see below)
assets/js/about.js      generated bundle for about.html
assets/fonts/           self-hosted Manrope (display) + Inter (body/UI), SIL OFL licences included
assets/img/             spool cut-outs per colour, filament close-ups (tex-*, detail-*), logos, favicon
assets/models/spool.glb the 3D spool (meshopt-compressed glTF, ~440 KB), built from source/spool/
assets/vendor/          GSAP 3.13 (core, ScrollTrigger, SplitText) + Lenis 1.3 + a three.js r186 subset (three-spool.min.js)
src/forms.js            filament forms: hero trail, orbit rings, colour ribbon, coil, wave, layer, printed objects
src/strand.js           2D-canvas renderer: depth-sorted, shaded cylindrical strand with spectrum, glow and shadow
src/data.js             materials, colours, applications, contact details  <- content lives here
src/site.js             shared nav, mobile menu, footer contact, current-page state
src/spool3d.js          the 3D spool: loads three.js + the model on demand, renders one small canvas
src/main.js             landing page scroll choreography ("director"), UI, interactions
src/about.js            About page motion
source/                 original supplied brand assets (logo, spool photo, spool/ 3D model export)
tools/build_assets.py   cuts out + recolours the spool photo, builds logo variants
tools/build_details.py  crops filament close-ups from the same photography
tools/bundle.mjs        bundles /src into assets/js/app.js and assets/js/about.js
tools/build_spool3d*    rebuilds assets/models/spool.glb from source/spool/ (see 3D spool below)
tools/build_three.mjs   rebuilds assets/vendor/three-spool.min.js
```

After editing anything in `src/`, run:

```
node tools/bundle.mjs
```

To regenerate images (needs `pip install pillow numpy`):

```
python3 tools/build_assets.py && python3 tools/build_details.py
```

Spool colour variants are made by re-shading **only the filament pixels** of the supplied product photo. The spool geometry is never altered. Close-ups are crops of the same photography; nothing is painted in.

### 3D spool

On the home page the hero spool, its slide into About and the Materials spool are a real 3D model rendered with WebGL. Scroll turns it and rolls it on its axle; in Materials it takes the selected material's colour and finish. three.js and the model load only after the page has loaded, and the product photos stay underneath until the model can draw. The photos remain the whole experience with reduced motion, without WebGL 2, when opened from disk (`file://`), and on data-saving connections or low-memory phones.

The model comes from the supplied Blender export in `source/spool/` (modelled from one product photo, not manufacturer CAD). To rebuild it:

```
pip install pillow numpy && python3 tools/build_spool3d_textures.py    # flange texture with the real logo lettering
npm i --no-save @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer sharp
node tools/build_spool3d.mjs                                             # -> assets/models/spool.glb
npm i --no-save three@0.186.1 esbuild && node tools/build_three.mjs     # -> assets/vendor/three-spool.min.js
```

### Contact details

Contact links are hidden until real details exist. Fill in `CONTACT` in `src/data.js` and rebuild: the footer contact and social columns, the nav "Contact" link and the "Contact us" buttons then appear on both pages. Leave a value empty to keep that item hidden.

## Hosting

The site is static and has no build step, so any static host can serve the repository root.

- **Cloudflare Workers (current setup):** the Worker runs `npx wrangler deploy`. `wrangler.jsonc` serves the repository root as static assets, `.assetsignore` keeps the source, tools and docs from being published, and `_headers` applies there too.
- **Cloudflare Pages:** connect the repository with production branch `main`, no framework preset, an empty build command and `/` as the output directory. `_headers` sets cache lifetimes and basic security headers.
- **GitHub Pages:** deploy from `main` with `/ (root)` selected. GitHub Pages ignores `_headers`.

If you rename asset files on each release (for example `app.3f9a.js`), you can raise the cache lifetimes in `_headers` to a year with `immutable`.

## Page order (home)

Hero, 01 About, 02 Material Story, 03 Materials, 04 Colours, 05 Process, 06 Consistency, 07 Applications, 08 Range, closing call to action. The About page lives at `about.html` (served as `/about` on Cloudflare).

## Motion system

- **One strand through the page.** The hero trail and multicolour orbit ring hand the strand to the About block, where it crosses behind a printed vase. It then morphs straight, curve, coil, layer, object in the Material Story, becomes the orbit ring around the selected spool in Materials, opens into a ribbon of coloured strands as the off-white Colour section sweeps in on an elliptical edge, feeds the nozzle in Process, and returns as one yellow line under the closing headline.
- Each pinned section describes the strand as a function of its own scroll progress. Between sections the director blends one section's end state into the next section's start state, so there are no cuts.
- Two canvases: one behind the page, and one above it that only carries the half of an orbit ring passing in front of a spool.
- GSAP ScrollTrigger handles pinning and scrubbing. SplitText handles masked line reveals. Lenis provides smooth wheel scrolling; native touch scrolling is kept on phones. Pinned sequences are shorter on phones.
- The spectrum highlight sits on one word or phrase per heading. Only the hero, the Colour heading and the About hero drift slowly (12 s); that stops with reduced motion.
- **Reduced motion** (`prefers-reduced-motion`) turns off pinning, smooth scroll, the strand canvases and the gradient drift, and shows a static, fully readable page. The material and colour selectors still work.
- Without JavaScript the page also falls back to a static layout.

## To confirm before launch

None of this is shown on the page as a placeholder any more, but it was not supplied as verified brand data:

| Item | Where |
| --- | --- |
| Official Pantone3D yellow. `#F7B102` is sampled from the product photo. | `--yellow` in `main.css`, `BRAND_YELLOW` in `src/data.js` |
| Which materials are actually sold (PLA+, Matte PLA, PETG, ABS, Nylon, Carbon Fiber) | `src/data.js`, Materials panels in `index.html` |
| Colours available per material and their swatch hex values | `src/data.js` |
| Material descriptions, attribute pills and "best for" wording. Qualitative only, no specs. | `src/data.js` and the `.mat` panels in `index.html` |
| About page and Home About copy (story, stages, values) | `about.html`, `index.html` |
| Spool images for non-yellow colours are recolours of the yellow spool photo. Replace them with real photography when available. | `assets/img/spool-*.webp`, `tex-*.webp` |
| Contact email, phone, address, social links, legal pages (currently hidden) | `CONTACT` in `src/data.js` |

The site deliberately states no tolerances, temperatures, strength figures, certifications, customers, dates or statistics. The printed objects are illustrative.

## Browser support

The page targets current evergreen browsers. Layout was checked at 1440×900, 1366×768, 768×1024 and 393×852, with no horizontal overflow at any of them.
