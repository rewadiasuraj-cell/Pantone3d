/* Pantone3D — landing page choreography.
 *
 * One fixed canvas carries a single filament strand through the whole page.
 * Each pinned section describes the strand as a pure function of its scroll
 * progress; between sections the director blends the end state of one section
 * into the start state of the next, so the page reads as one continuous shot.
 */
import {
  heroForm, straightForm, coilForm, waveForm, layerForm, objectForm, layerPitch,
  mix, ease, smooth, range, lerp, clamp01, catmull, path, at, TAU,
} from './forms.js';
import { StrandRenderer, hexToRgb } from './strand.js';
import { BRAND_YELLOW, COLOURS, COLOUR_STORY, MATERIALS, APPLICATIONS, spoolSrc } from './data.js';

const { gsap, ScrollTrigger, SplitText } = window;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mqMobile = matchMedia('(max-width: 900px) and (orientation: portrait), (max-width: 640px)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const isMobile = () => mqMobile.matches;

const YELLOW = hexToRgb(BRAND_YELLOW);
const DARK = [8, 8, 8];
const SOFT = [245, 244, 240];
const rgbOf = (key) => hexToRgb(COLOURS[key].hex);
const mixRgb = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

if (!gsap || !ScrollTrigger) {
  root.classList.add('static', 'ready');
  throw new Error('GSAP failed to load — static fallback in place.');
}
gsap.registerPlugin(ScrollTrigger, SplitText);
if (reduced) root.classList.add('static');

document.querySelector('[data-year]').textContent = new Date().getFullYear();

/* ==========================================================================
   Generated DOM: colour swatches + range cards
   ========================================================================== */
const swatchWrap = $('.swatches');
COLOUR_STORY.forEach((key, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'sw';
  b.setAttribute('role', 'radio');
  b.setAttribute('aria-checked', i === 0 ? 'true' : 'false');
  b.tabIndex = i === 0 ? 0 : -1;
  b.style.setProperty('--c', COLOURS[key].hex);
  b.innerHTML = `<i aria-hidden="true"></i><span>${COLOURS[key].name}</span>`;
  swatchWrap.appendChild(b);
});

const rangeGrid = $('[data-range]');
MATERIALS.forEach((m, i) => {
  const c = rgbOf(m.colour);
  const names = m.colours.map((k) => COLOURS[k].name).join(', ');
  const el = document.createElement('article');
  el.className = 'card';
  el.style.setProperty('--accent-a', `rgba(${c.join(',')}, .16)`);
  const dark = mixRgb(c, [0, 0, 0], 0.55).map(Math.round).join(',');
  const light = mixRgb(c, [255, 255, 255], 0.5).map(Math.round).join(',');
  el.innerHTML = `
    <div class="card__top label"><span>Material ${String(i + 1).padStart(2, '0')}</span><span>${m.colours.length} colour${m.colours.length > 1 ? 's' : ''}</span></div>
    <div class="card__vis">
      <svg class="card__strand" viewBox="0 0 400 30" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 18 C 80 2, 140 30, 220 14 S 340 4, 400 16" stroke="rgb(${dark})" stroke-width="9"/>
        <path d="M0 18 C 80 2, 140 30, 220 14 S 340 4, 400 16" stroke="${COLOURS[m.colour].hex}" stroke-width="6"/>
        <path d="M0 16.5 C 80 0.5, 140 28.5, 220 12.5 S 340 2.5, 400 14.5" stroke="rgb(${light})" stroke-width="1.6" opacity=".8"/>
      </svg>
      <img src="${spoolSrc(m.colour, true)}" width="560" height="679" loading="lazy" alt="${m.name} filament spool in ${COLOURS[m.colour].name}">
    </div>
    <div class="card__body">
      <h3>${m.name}</h3>
      <p class="card__line">${m.line}</p>
      <div class="dots" role="img" aria-label="Available colours: ${names}">
        ${m.colours.map((k) => `<i style="--c:${COLOURS[k].hex}" title="${COLOURS[k].name}"></i>`).join('')}
        <span aria-hidden="true">${m.colours.length === 1 ? COLOURS[m.colours[0]].name : names.split(', ').slice(0, 3).join(' / ') + (m.colours.length > 3 ? ' …' : '')}</span>
      </div>
      <div class="card__specs"><div>
        <p><span class="label">Best for</span>${m.bestFor}</p>
        <p><span class="label">Character</span>${m.traits.join(' · ')}</p>
      </div></div>
      <a class="link" href="#materials" data-material="${i}" aria-label="View material: ${m.name}">View material <i aria-hidden="true">→</i></a>
    </div>`;
  rangeGrid.appendChild(el);
});

/* ==========================================================================
   Shared UI state: material + colour selection
   ========================================================================== */
const matPanels = $$('.mat');
const matTabs = $$('.mats__tabs [role="tab"]');
const matImgs = $$('.mats__img');
const glowEl = $('.env__glow');
let matIndex = -1;

matPanels.forEach((p) => p.setAttribute('role', 'tabpanel'));

function setMaterial(i, animate = !reduced) {
  if (i === matIndex) return;
  const prev = matIndex;
  matIndex = i;
  const m = MATERIALS[i];
  matTabs.forEach((t, k) => { t.setAttribute('aria-selected', k === i); t.tabIndex = k === i ? 0 : -1; });
  matPanels.forEach((p, k) => p.classList.toggle('is-on', k === i));
  root.style.setProperty('--accent', COLOURS[m.colour].hex);
  glowEl.style.setProperty('--glow', rgbOf(m.colour).join(','));

  const [a, b] = matImgs[0].classList.contains('is-on') ? matImgs : [matImgs[1], matImgs[0]];
  b.src = spoolSrc(m.colour);
  b.alt = `${m.name} filament spool in ${COLOURS[m.colour].name}`;
  a.alt = '';
  a.classList.remove('is-on'); b.classList.add('is-on');
  if (!animate || prev < 0) { gsap.set(a, { opacity: 0 }); gsap.set(b, { opacity: 1, rotate: 0, scale: 1 }); return; }
  const dir = i > prev ? 1 : -1;
  gsap.to(a, { opacity: 0, rotate: -7 * dir, scale: 0.96, duration: 0.7, ease: 'power3.inOut', overwrite: true });
  gsap.fromTo(b, { opacity: 0, rotate: 7 * dir, scale: 1.04 }, { opacity: 1, rotate: 0, scale: 1, duration: 1.0, ease: 'power3.out', overwrite: true });
  gsap.fromTo(matPanels[i].children, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.05, ease: 'power3.out', overwrite: true });
}

const swatches = $$('.sw');
const colourImg = $('.colour__img');
const colourName = $('.colour__name');
const colourCount = $('.colour__count');
let colourIndex = -1;
let colourManual = false;
const colourTrail = []; // previously shown colours, newest first
const colourRGB = { cur: rgbOf(COLOUR_STORY[0]), target: rgbOf(COLOUR_STORY[0]) };

function setColour(i, manual = false) {
  if (i === colourIndex) return;
  if (colourIndex >= 0) {
    colourTrail.unshift(COLOUR_STORY[colourIndex]);
    colourTrail.length = Math.min(colourTrail.length, 4);
  }
  colourIndex = i;
  colourManual = manual;
  const key = COLOUR_STORY[i];
  swatches.forEach((s, k) => { s.setAttribute('aria-checked', k === i); s.tabIndex = k === i ? 0 : -1; });
  colourImg.src = spoolSrc(key);
  colourImg.alt = `Pantone3D PLA+ spool in ${COLOURS[key].name}`;
  colourName.textContent = COLOURS[key].name;
  colourCount.textContent = `${String(i + 1).padStart(2, '0')} / ${String(COLOUR_STORY.length).padStart(2, '0')}`;
  colourRGB.target = rgbOf(key);
  if (!reduced) gsap.fromTo(colourImg, { scale: 1.025 }, { scale: 1, duration: 0.6, ease: 'power3.out', overwrite: true });
}

swatches.forEach((s, i) => {
  s.addEventListener('click', () => setColour(i, true));
  if (finePointer) s.addEventListener('pointerenter', () => setColour(i, true));
  s.addEventListener('focus', () => setColour(i, true));
  s.addEventListener('keydown', (e) => {
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    swatches[(i + d + swatches.length) % swatches.length].focus();
  });
});

// Preload all colour spools once the colour section approaches.
let preloaded = false;
const preloadSpools = () => {
  if (preloaded) return; preloaded = true;
  Object.keys(COLOURS).forEach((k) => { const im = new Image(); im.src = spoolSrc(k); });
};

setMaterial(0, false);
setColour(0);
colourTrail.length = 0;

/* ==========================================================================
   Navigation
   ========================================================================== */
const nav = $('.nav');
const menuBtn = $('.nav__menu');
const menu = $('#menu');
let lenis = null;

function setMenu(open) {
  menuBtn.setAttribute('aria-expanded', open);
  menu.hidden = !open;
  document.body.style.overflow = open ? 'hidden' : '';
  if (lenis) open ? lenis.stop() : lenis.start();
  if (open) menu.querySelector('a').focus();
}
menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); } });

function goTo(target, offset = 0) {
  if (lenis) lenis.scrollTo(target, { offset, duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else window.scrollTo({ top: typeof target === 'number' ? target : target.getBoundingClientRect().top + scrollY + offset, behavior: reduced ? 'auto' : 'smooth' });
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  const el = id === '#top' ? document.body : $(id);
  if (!el) return;
  e.preventDefault();
  if (!menu.hidden) setMenu(false);
  const mi = a.dataset.material;
  if (mi !== undefined && id === '#materials') {
    if (matST && !reduced) goTo(matST.start + (matST.end - matST.start) * ((+mi + 0.5) / MATERIALS.length));
    else { setMaterial(+mi); goTo(el); }
  } else {
    goTo(id === '#top' ? 0 : el);
  }
  const focusEl = id === '#top' ? $('#hero-title') : el;
  focusEl.setAttribute('tabindex', '-1');
  focusEl.focus({ preventScroll: true });
  history.replaceState(null, '', id);
});

/* ==========================================================================
   Material tabs (keyboard + click)
   ========================================================================== */
let matST = null;
matTabs.forEach((t, i) => {
  t.addEventListener('click', () => {
    if (matST && !reduced) goTo(matST.start + (matST.end - matST.start) * ((i + 0.5) / MATERIALS.length));
    else setMaterial(i);
  });
  t.addEventListener('keydown', (e) => {
    const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    const n = (i + d + matTabs.length) % matTabs.length;
    matTabs[n].focus();
    matTabs[n].click();
  });
});

/* ==========================================================================
   Microinteractions
   ========================================================================== */
if (finePointer && !reduced) {
  $$('.btn').forEach((b) => {
    const qx = gsap.quickTo(b, 'x', { duration: 0.5, ease: 'power3.out' });
    const qy = gsap.quickTo(b, 'y', { duration: 0.5, ease: 'power3.out' });
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      qx(gsap.utils.clamp(-6, 6, (e.clientX - r.left - r.width / 2) * 0.18));
      qy(gsap.utils.clamp(-5, 5, (e.clientY - r.top - r.height / 2) * 0.25));
    });
    b.addEventListener('pointerleave', () => { qx(0); qy(0); });
  });
  $$('.card').forEach((c) => {
    gsap.set(c, { transformPerspective: 1200 });
    const rx = gsap.quickTo(c, 'rotationX', { duration: 0.8, ease: 'power3.out' });
    const ry = gsap.quickTo(c, 'rotationY', { duration: 0.8, ease: 'power3.out' });
    c.addEventListener('pointermove', (e) => {
      const r = c.getBoundingClientRect();
      ry(((e.clientX - r.left) / r.width - 0.5) * 3);
      rx(-((e.clientY - r.top) / r.height - 0.5) * 3);
    });
    c.addEventListener('pointerleave', () => { rx(0); ry(0); });
  });
}

/* ==========================================================================
   Static mode (reduced motion): everything readable, no pinning
   ========================================================================== */
function renderStaticForms() {
  $$('.static-form').forEach((cv) => {
    const r = new StrandRenderer(cv, { chunk: 4 });
    const L = r.resize(cv.clientWidth, cv.clientHeight);
    const N = 700;
    const kind = cv.dataset.forms;
    const colour = YELLOW;
    let pts;
    if (kind === 'vase') pts = objectForm('vase', { x: 0, y: 0, s: 1.5 }, { rx: 0.42, ry: 0.4 }, N);
    else pts = waveForm(L, { x: 0, y: 0, s: 0.9 }, N);
    const w = kind === 'vase' ? layerPitch('vase', 1.5) * 0.95 : 0.03;
    r.render([{ id: 's', pts, color: colour, alpha: 1, width: w }], DARK);
  });
}

if (reduced) {
  root.classList.add('ready');
  renderStaticForms();
  let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(renderStaticForms, 200); });
  // Colour section works without motion.
  preloadSpools();
  // Light nav over the off-white colour section.
  ScrollTrigger.create({ trigger: '.colour', start: 'top 40px', end: 'bottom 40px', onToggle: (s) => nav.dataset.theme = s.isActive ? 'light' : 'dark' });
} else {
  initMotion();
}

/* ==========================================================================
   Motion
   ========================================================================== */
function initMotion() {
  // ---------------------------------------------------------------- smooth scroll
  lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  ScrollTrigger.config({ ignoreMobileResize: true });

  const sections = {
    hero: $('.hero'), story: $('.story'), mats: $('.mats'), colour: $('.colour'),
    build: $('.build'), proof: $('.proof'), apps: $('.apps'), range: $('.range'), final: $('.final'),
  };
  ['hero', 'story', 'mats', 'colour', 'build', 'apps'].forEach((k) => sections[k].classList.add('pin'));

  // ---------------------------------------------------------------- renderer + layout
  const canvas = $('.strand');
  const R = new StrandRenderer(canvas, { chunk: 5 });
  let L, N, W0, A = {}, F = {};
  let lastW = 0, lastH = 0;

  function measure() {
    const w = innerWidth, h = innerHeight;
    if (w !== lastW || Math.abs(h - lastH) > 120) { L = R.resize(w, h); lastW = w; lastH = h; }
    N = isMobile() ? 520 : 900;
    W0 = isMobile() ? 0.026 : 0.018;
    $$('[data-anchor]').forEach((el) => {
      const sec = el.closest('.s');
      const r = el.getBoundingClientRect(), sr = sec.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top - sr.top + r.height / 2;
      A[el.dataset.anchor] = {
        x: (cx - L.W / 2) / L.u, y: (cy - L.H / 2) / L.u,
        w: r.width / L.u, h: r.height / L.u, s: Math.min(r.width, r.height) / L.u,
      };
    });
    const hs = A['hero-spool'];
    F.hero = heroForm(L, { x: hs.x, y: hs.y, r: hs.w / 2 }, N);
    const sb = A['story-stage'];
    F.straight = straightForm(L, sb.y, N);
    F.coil = coilForm(L, sb, N);
    F.wave = waveForm(L, sb, N);
    F.layer = layerForm(L, sb, N);
    F.colourLine = straightForm(L, A['colour-line'].y, N);
    // Flatten the colour line so it reads as one long horizontal strand.
    for (let i = 0; i < N; i++) { F.colourLine[i * 3 + 1] = A['colour-line'].y; F.colourLine[i * 3 + 2] = 0.1; }
  }

  const item = (id, pts, color, o = {}) => ({ id, pts, color, alpha: 1, width: W0, r0: 0, r1: 1, ...o });
  const env = (o = {}) => ({ glow: 0, glowRGB: YELLOW, space: 0, light: 0, lightY: 0.5, fog: DARK, ...o });

  // ---------------------------------------------------------------- section states
  const intro = { v: 0, glow: 0 };

  function heroState(p) {
    const t = ease(range(p, 0.12, 0.95));
    return {
      items: [item('main', mix(F.hero, F.straight, t), YELLOW, { r1: intro.v })],
      env: env({ glow: intro.glow * (1 - range(p, 0.3, 0.9)) }),
    };
  }

  const STORY_FORMS = ['straight', 'coil', 'wave', 'layer', 'vase'];
  const storyBox = () => ({ ...A['story-stage'], s: A['story-stage'].s * 1.05 });
  function storyForm(k, p) {
    if (k === 'vase') return objectForm('vase', storyBox(), { rx: 0.42, ry: p * 1.6 }, N);
    return F[k];
  }
  function storyState(p) {
    const k = clamp01(p) * 4;
    const i = Math.min(3, Math.floor(k));
    const t = ease(range(k - i, 0.2, 0.85));
    const a = storyForm(STORY_FORMS[i], p), b = storyForm(STORY_FORMS[i + 1], p);
    const pitch = layerPitch('vase', storyBox().s) * 0.95;
    const width = i < 3 ? W0 : lerp(W0, pitch, t);
    return { items: [item('main', mix(a, b, t), YELLOW, { width })], env: env() };
  }

  const matBox = () => ({ ...A['mats-sample'], s: A['mats-sample'].s * 1.15 });
  function matsState(p) {
    const n = MATERIALS.length;
    const k = clamp01(p) * n;
    const i = Math.min(n - 1, Math.floor(k));
    const j = Math.min(n - 1, i + 1);
    const t = i === j ? 0 : ease(range(k - i, 0.62, 1));
    const rot = { rx: 0.42, ry: p * TAU * 0.6 };
    const box = matBox();
    const ma = MATERIALS[i], mb = MATERIALS[j];
    const pts = mix(objectForm(ma.shape, box, rot, N), objectForm(mb.shape, box, rot, N), t);
    const width = lerp(layerPitch(ma.shape, box.s), layerPitch(mb.shape, box.s), t) * 0.95;
    const color = mixRgb(rgbOf(ma.colour), rgbOf(mb.colour), t);
    return {
      items: [item('main', pts, color, { width, matte: (t < 0.5 ? ma : mb).matte })],
      env: env({ glow: 1, glowRGB: color }),
    };
  }

  function colourState(p) {
    const open = smooth(range(p, 0, 0.1)) * (1 - smooth(range(p, 0.9, 1)));
    const ly = A['colour-line'];
    const items = [item('main', F.colourLine, colourRGB.cur)];
    colourTrail.forEach((key, j) => {
      const pts = new Float32Array(F.colourLine);
      const dy = (j + 1) * (W0 * 1.6);
      for (let q = 0; q < N; q++) pts[q * 3 + 1] += dy;
      items.push(item('trail' + j, pts, rgbOf(key), { width: W0 * 0.42, alpha: 0.5 / (j + 1) * open, fogScale: 0 }));
    });
    const sb = { ...A['colour-sample'], s: A['colour-sample'].s * 1.1 };
    items.push(item('sample', objectForm('vase', sb, { rx: 0.42, ry: p * 4 }, N), colourRGB.cur, {
      width: layerPitch('vase', sb.s) * 0.95, alpha: smooth(range(p, 0.06, 0.16)) * (1 - smooth(range(p, 0.86, 0.94))),
    }));
    return {
      items,
      env: env({ light: open, lightY: (ly.y * L.u + L.H / 2) / L.H, fog: mixRgb(DARK, SOFT, open) }),
    };
  }

  const buildBox = () => ({ x: A['build-stage'].x, y: A['build-stage'].y + A['build-stage'].h * 0.08, s: A['build-stage'].w * 1.25 });
  let buildHead = null;
  function buildState(p) {
    const box = buildBox();
    const grow = smooth(range(p, 0.85, 1));
    const obj = objectForm('vase', { ...box, s: box.s * (1 + grow * 0.05) }, { rx: 0.42, ry: grow * 0.7 }, N);
    const reveal = lerp(0.0, 0.03, range(p, 0.18, 0.3)) + (1 - 0.03) * ease(range(p, 0.3, 0.85));
    const hi = Math.min(N - 1, Math.max(0, Math.round(reveal * (N - 1))));
    const hx = obj[hi * 3], hy = obj[hi * 3 + 1], hz = obj[hi * 3 + 2];
    const top = A['build-stage'].y - A['build-stage'].h * 0.62;
    const feed = path([{
      fn: catmull([
        at(-L.ax - 0.4, top, 0), at(lerp(-L.ax, hx, 0.55), top, 0),
        [hx - 0.12, top + 0.01, hz * 0.6], [hx, top + 0.14, hz], [hx, hy - 0.07, hz],
      ]),
      w: 1,
    }], N);
    const toFeed = ease(range(p, 0.02, 0.18));
    const feedAlpha = 1 - smooth(range(p, 0.86, 0.96));
    buildHead = R.project(hx, hy, hz);
    buildHead.push(smooth(range(p, 0.16, 0.26)) * feedAlpha, Math.round(reveal * 22));
    return {
      items: [
        item('main', mix(F.colourLine, feed, toFeed), colourRGB.cur, { alpha: feedAlpha }),
        item('obj', obj, colourRGB.cur, { width: layerPitch('vase', box.s) * 0.95, r1: reveal }),
      ],
      env: env(),
    };
  }

  function proofState() {
    const box = buildBox();
    return {
      items: [item('obj', objectForm('vase', { ...box, s: box.s * 1.05 }, { rx: 0.42, ry: 1.4 }, N, 9), colourRGB.cur, { width: layerPitch('vase', box.s), alpha: 0 })],
      env: env(),
    };
  }

  function appsState(p) {
    const n = APPLICATIONS.length;
    const box = { ...A['apps-stage'], s: A['apps-stage'].s * 1.15 };
    const items = [];
    APPLICATIONS.forEach((ap, i) => {
      const d = (p * n - (i + 0.5));
      if (d < -1.25 || d > 0.75) return;
      const hold = 0.22;
      const z = d < -hold ? (-d - hold) * 9 : d > hold ? -(d - hold) * 5 : 0;
      const alpha = smooth(range(-d, 1.25, 0.6)) * (1 - smooth(range(d, 0.4, 0.72)));
      const pts = objectForm(ap.shape, box, { rx: 0.42 - d * 0.12, ry: d * 0.9 + i }, N, z);
      items.push(item('app' + i, pts, rgbOf(ap.colour), { width: layerPitch(ap.shape, box.s) * 0.95, alpha, matte: ap.colour === 'carbon' }));
    });
    return { items, env: env({ space: 1 }) };
  }

  const emptyState = () => ({ items: [], env: env() });

  // ---------------------------------------------------------------- blending
  function blend(A1, B1, t) {
    if (t <= 0) return A1;
    if (t >= 1) return B1;
    const items = [];
    const byId = new Map(B1.items.map((it) => [it.id, it]));
    A1.items.forEach((a) => {
      const b = byId.get(a.id);
      if (b) {
        byId.delete(a.id);
        items.push({
          ...b, pts: mix(a.pts, b.pts, t), color: mixRgb(a.color, b.color, t),
          alpha: lerp(a.alpha, b.alpha, t), width: lerp(a.width, b.width, t),
          r0: lerp(a.r0, b.r0, t), r1: lerp(a.r1, b.r1, t), matte: t < 0.5 ? a.matte : b.matte,
        });
      } else items.push({ ...a, alpha: a.alpha * (1 - t) });
    });
    byId.forEach((b) => items.push({ ...b, alpha: b.alpha * t }));
    const ea = A1.env, eb = B1.env;
    return {
      items,
      env: {
        glow: lerp(ea.glow, eb.glow, t), glowRGB: mixRgb(ea.glowRGB, eb.glowRGB, t),
        space: lerp(ea.space, eb.space, t), light: lerp(ea.light, eb.light, t),
        lightY: eb.light > ea.light ? eb.lightY : ea.lightY, fog: mixRgb(ea.fog, eb.fog, t),
      },
    };
  }

  // ---------------------------------------------------------------- scroll triggers
  const vh = () => innerHeight;
  const len = (desk, mob) => () => '+=' + Math.round(vh() * (isMobile() ? mob : desk));
  const pinST = (el, desk, mob) => ScrollTrigger.create({ trigger: el, start: 'top top', end: len(desk, mob), pin: true, pinSpacing: true, invalidateOnRefresh: true });

  const heroST = pinST(sections.hero, 0.9, 0.7);
  const storyST = pinST(sections.story, 3.2, 2.4);
  matST = pinST(sections.mats, 4.2, 3.2);
  const colourST = pinST(sections.colour, 2.8, 2.2);
  const buildST = pinST(sections.build, 2.6, 2.0);
  const proofST = ScrollTrigger.create({ trigger: sections.proof, start: 'top top', end: 'bottom bottom' });
  const appsST = pinST(sections.apps, 3.6, 2.8);
  const rangeST = ScrollTrigger.create({ trigger: sections.range, start: 'top top', end: 'bottom bottom' });

  const timeline = [
    { st: heroST, state: heroState, update: heroUpdate },
    { st: storyST, state: storyState, update: storyUpdate },
    { st: matST, state: matsState, update: matsUpdate },
    { st: colourST, state: colourState, update: colourUpdate },
    { st: buildST, state: buildState, update: buildUpdate },
    { st: proofST, state: proofState },
    { st: appsST, state: appsState, update: appsUpdate },
    { st: rangeST, state: emptyState },
  ];

  function stateAt(y) {
    for (let k = 0; k < timeline.length; k++) {
      const s = timeline[k], st = s.st;
      const span = Math.max(1, st.end - st.start);
      if (y < st.start) {
        if (k === 0) return s.state(0);
        const prev = timeline[k - 1];
        const t = range(y, prev.st.end, st.start);
        return blend(prev.state(1), s.state(0), ease(t));
      }
      if (y <= st.end) return s.state((y - st.start) / span);
    }
    return emptyState();
  }

  // ---------------------------------------------------------------- environment output
  const envEls = { glow: $('.env__glow'), space: $('.env__space'), light: $('.env__light') };
  const envCache = {};
  function applyEnv(e) {
    const g = e.glow.toFixed(3);
    if (envCache.glow !== g) { envEls.glow.style.opacity = g; envCache.glow = g; }
    const gc = e.glowRGB.map(Math.round).join(',');
    if (envCache.gc !== gc) { envEls.glow.style.setProperty('--glow', gc); envCache.gc = gc; }
    const sp = e.space.toFixed(3);
    if (envCache.sp !== sp) { envEls.space.style.opacity = sp; envCache.sp = sp; }
    const o = 1 - e.light;
    const clip = e.light <= 0.001 ? 'inset(50% 0 50% 0)'
      : `inset(${(e.lightY * o * 100).toFixed(2)}% 0 ${((1 - e.lightY) * o * 100).toFixed(2)}% 0)`;
    if (envCache.clip !== clip) { envEls.light.style.clipPath = clip; envCache.clip = clip; }
    const theme = e.light > 0.55 ? 'light' : 'dark';
    if (nav.dataset.theme !== theme) nav.dataset.theme = theme;
  }

  // ---------------------------------------------------------------- per-frame
  let visibleItems = true;
  function frame() {
    // ease colour toward selection — immediate, but not a hard cut
    colourRGB.cur = mixRgb(colourRGB.cur, colourRGB.target, 0.22);
    const y = scrollY;
    timeline.forEach((s) => {
      if (!s.update) return;
      const p = clamp01((y - s.st.start) / Math.max(1, s.st.end - s.st.start));
      if (y >= s.st.start - vh() && y <= s.st.end + vh()) s.update(p, y);
    });
    const S = stateAt(y);
    applyEnv(S.env);
    const any = S.items.some((it) => it.alpha > 0.004);
    if (any || visibleItems) R.render(S.items, S.env.fog.map(Math.round));
    visibleItems = any;
  }

  // ---------------------------------------------------------------- DOM: per-section updates
  // Hero — intro, then a scrubbed scroll shot.
  const heroTitleLines = $$('.hero__title .hl');
  const heroSpool = $('.hero__spool-inner');
  const heroImg = $('.hero__spool img');
  const heroCue = $('.hero__cue');
  const heroReveal = $$('.hero [data-reveal]');

  const heroScroll = gsap.timeline({ paused: true, defaults: { ease: 'none' } })
    .to(heroSpool, { scale: 1.28, rotate: -9, xPercent: 8, yPercent: -6, duration: 1 }, 0)
    .to(heroSpool, { opacity: 0, duration: 0.35 }, 0.62)
    .to(heroTitleLines[0], { x: () => -innerWidth * 0.12, opacity: 0, duration: 0.75 }, 0.12)
    .to(heroTitleLines[1], { x: () => innerWidth * 0.1, opacity: 0, duration: 0.75 }, 0.12)
    .to(heroTitleLines[2], { x: () => -innerWidth * 0.05, opacity: 0, duration: 0.75 }, 0.12)
    .to(heroReveal, { y: -30, opacity: 0, duration: 0.4, stagger: 0.04 }, 0)
    .to(heroCue, { opacity: 0, duration: 0.1 }, 0);
  function heroUpdate(p) { if (heroScroll.progress() !== p) heroScroll.progress(p); }

  if (finePointer) {
    const rx = gsap.quickTo(heroImg, 'rotationX', { duration: 1.4, ease: 'power3.out' });
    const ry = gsap.quickTo(heroImg, 'rotationY', { duration: 1.4, ease: 'power3.out' });
    const tx = gsap.quickTo(heroImg, 'x', { duration: 1.4, ease: 'power3.out' });
    addEventListener('pointermove', (e) => {
      if (scrollY > heroST.end) return;
      const nx = e.clientX / innerWidth - 0.5, ny = e.clientY / innerHeight - 0.5;
      ry(nx * 3); rx(-ny * 2.4); tx(nx * 8); // ≤ 1.5° / 1.2°
    });
  }

  // Story
  const railItems = $$('.story__rail li');
  const notes = $$('.note');
  gsap.set(notes, { opacity: 0, y: 20 });
  let storyIdx = -1;
  function storyUpdate(p) {
    const k = p * 4;
    const idx = Math.min(4, Math.round(k - 0.05));
    if (idx === storyIdx) return;
    storyIdx = idx;
    railItems.forEach((li, i) => li.classList.toggle('is-on', i === idx));
    notes.forEach((n, i) => {
      const on = i === idx - 1;
      gsap.to(n, { opacity: on ? 1 : 0, y: on ? 0 : (i < idx - 1 ? -20 : 20), duration: on ? 0.8 : 0.45, ease: on ? 'power3.out' : 'power2.in', overwrite: true });
    });
  }

  // Materials
  const matBar = $('.mats__bar i');
  function matsUpdate(p) {
    const n = MATERIALS.length;
    setMaterial(Math.min(n - 1, Math.floor(clamp01(p) * n)));
    matBar.style.transform = `scaleX(${p.toFixed(4)})`;
  }

  // Colour
  let colourScrollIdx = -1;
  function colourUpdate(p) {
    preloadSpools();
    if (p > 0.07 && !colourReveal.progress()) colourReveal.play();
    const n = COLOUR_STORY.length;
    const idx = Math.min(n - 1, Math.floor(range(p, 0.1, 0.9) * n));
    if (idx !== colourScrollIdx) {
      colourScrollIdx = idx;
      setColour(idx, false);
    }
  }

  // Build
  const nozzle = $('.nozzle');
  const steps = $$('.build__steps li');
  const zCount = $('.build__z b');
  let buildIdx = -1, lastZ = -1;
  function buildUpdate(p) {
    const idx = p < 0.18 ? 0 : p < 0.3 ? 1 : p < 0.85 ? 2 : 3;
    if (idx !== buildIdx) { buildIdx = idx; steps.forEach((s, i) => s.classList.toggle('is-on', i === idx)); }
    if (buildHead) {
      const [x, y, , a, z] = buildHead;
      nozzle.style.transform = `translate3d(${(x - 13).toFixed(1)}px, ${(y - 37).toFixed(1)}px, 0)`;
      nozzle.style.opacity = a.toFixed(3);
      if (z !== lastZ) { lastZ = z; zCount.textContent = String(z).padStart(3, '0'); }
    }
  }

  // Applications
  const appItems = $$('.apps__list li');
  const appBig = $('.apps__big');
  let appIdx = -1;
  function appsUpdate(p) {
    const idx = Math.min(APPLICATIONS.length - 1, Math.floor(clamp01(p) * APPLICATIONS.length));
    if (idx === appIdx) return;
    appIdx = idx;
    appItems.forEach((li, i) => li.classList.toggle('is-on', i === idx));
    appBig.textContent = `${String(idx + 1).padStart(2, '0')} / ${String(APPLICATIONS.length).padStart(2, '0')} — ${APPLICATIONS[idx].name}`;
  }

  // ---------------------------------------------------------------- text reveals
  function revealHeading(h, trigger, start = 'top 70%') {
    const lines = $$('.hl', h);
    const targets = [];
    lines.forEach((l) => {
      const s = SplitText.create(l, { type: 'lines', mask: 'lines' });
      targets.push(...s.lines);
    });
    return gsap.from(targets, {
      yPercent: 108, duration: 1.25, stagger: 0.08, ease: 'power4.out',
      scrollTrigger: trigger ? { trigger, start, toggleActions: 'play none none none' } : undefined,
    });
  }
  revealHeading($('#story-title'), sections.story, 'top 55%');
  revealHeading($('#build-title'), sections.build, 'top 50%');
  revealHeading($('#proof-title'), sections.proof, 'top 75%');
  revealHeading($('#range-title'), sections.range, 'top 75%');
  revealHeading($('#final-title'), sections.final, 'top 60%');

  // The colour scene reveals once the off-white canvas has opened — driven by
  // the pinned section's own progress rather than a separate trigger.
  const colourReveal = gsap.timeline({ paused: true })
    .add(revealHeading($('#colour-title')), 0)
    .from('.colour__spool', { opacity: 0, scale: 0.94, duration: 1.2, ease: 'power3.out' }, 0.1)
    .from('.colour__meta, .colour__pick', { opacity: 0, y: 20, duration: 0.9, stagger: 0.1, ease: 'power3.out' }, 0.3);
  gsap.from('.build__head .lede, .build__steps, .build__frame, .build__z', { opacity: 0, y: 16, duration: 1, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: sections.build, start: 'top 40%' } });
  gsap.from('.mats__top, .mats__tabs', { opacity: 0, y: 16, duration: 1, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: sections.mats, start: 'top 50%' } });
  gsap.from('.mats__spool', { opacity: 0, scale: 0.92, duration: 1.4, ease: 'power3.out', scrollTrigger: { trigger: sections.mats, start: 'top 45%' } });
  gsap.from('.apps__head, .apps__list, .apps__big', { opacity: 0, y: 16, duration: 1, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: sections.apps, start: 'top 45%' } });
  gsap.from('.story__rail', { opacity: 0, duration: 1, scrollTrigger: { trigger: sections.story, start: 'top 40%' } });

  // Bento — blocks rise in, diagrams draw.
  $$('.proof .tile:not(.tile--head)').forEach((t, i) => {
    gsap.from(t, { y: 60, opacity: 0, duration: 1.2, delay: (i % 2) * 0.08, ease: 'power3.out', scrollTrigger: { trigger: t, start: 'top 88%' } });
  });
  gsap.from('.dia__strands rect', { scaleX: 0, transformOrigin: 'left center', duration: 1.4, stagger: 0.12, ease: 'power4.inOut', scrollTrigger: { trigger: '.tile--dim', start: 'top 75%' } });
  gsap.from('.dia__gauge', { opacity: 0, duration: 1, delay: 0.6, scrollTrigger: { trigger: '.tile--dim', start: 'top 75%' } });
  gsap.from('.batch i', { scaleX: 0, duration: 1.1, stagger: 0.05, ease: 'power3.inOut', scrollTrigger: { trigger: '.tile--col', start: 'top 80%' } });
  gsap.fromTo('.macro img', { yPercent: 4 }, { yPercent: -4, ease: 'none', scrollTrigger: { trigger: '.tile--wind', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.from('.choice li', { opacity: 0, y: 10, duration: 0.7, stagger: 0.05, ease: 'power3.out', scrollTrigger: { trigger: '.tile--choice', start: 'top 80%' } });

  // Range — cards rise in sequence
  gsap.from('.card', { y: 70, opacity: 0, duration: 1.2, stagger: 0.08, ease: 'power3.out', scrollTrigger: { trigger: '.grid', start: 'top 82%' } });

  // ---------------------------------------------------------------- final: strand draws the underline
  const fSvg = $('.final__strand');
  const fPaths = $$('path', fSvg);
  const fLast = $('.final__last');
  const fSpool = $('.final__spool');
  let fLen = 1;
  function layoutFinal() {
    const sr = sections.final.getBoundingClientRect();
    const sp = fSpool.getBoundingClientRect();
    const lr = fLast.getBoundingClientRect();
    fSvg.setAttribute('viewBox', `0 0 ${sr.width} ${sr.height}`);
    const sx = sp.left - sr.left + sp.width * 0.12, sy = sp.top - sr.top + sp.height * 0.5;
    const ux0 = lr.left - sr.left, ux1 = lr.right - sr.left, uy = lr.bottom - sr.top + Math.max(10, lr.height * 0.08);
    const d = `M ${sx} ${sy} C ${sx - 140} ${sy + 10}, ${ux1 + 160} ${uy - 120}, ${ux1 + 40} ${uy - 6} S ${ux1 - 40} ${uy}, ${ux1 - 80} ${uy} L ${ux0} ${uy}`;
    const w = isMobile() ? 6 : 9;
    fPaths.forEach((p, i) => {
      p.setAttribute('d', d);
      p.setAttribute('stroke-width', [w, w * 0.68, w * 0.18][i]);
      if (i === 2) p.setAttribute('transform', `translate(${-w * 0.08} ${-w * 0.18})`);
    });
    fLen = fPaths[0].getTotalLength();
    fPaths.forEach((p) => { p.style.strokeDasharray = `${fLen} ${fLen}`; });
  }
  const finalDraw = { v: 0 };
  const applyFinal = () => fPaths.forEach((p) => { p.style.strokeDashoffset = (fLen * (1 - finalDraw.v)).toFixed(1); });
  gsap.to(finalDraw, {
    v: 1, ease: 'none', onUpdate: applyFinal,
    scrollTrigger: { trigger: sections.final, start: 'top 55%', end: 'center 52%', scrub: 0.6 },
  });
  gsap.from(fSpool, { xPercent: 12, opacity: 0, rotate: 8, duration: 1.6, ease: 'power3.out', scrollTrigger: { trigger: sections.final, start: 'top 70%' } });
  gsap.from('.final .ctas', { opacity: 0, y: 20, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: sections.final, start: 'top 35%' } });

  // ---------------------------------------------------------------- nav: active section
  const navLinks = $$('.nav__links a');
  ['materials', 'colour', 'process', 'applications', 'range'].forEach((id) => {
    ScrollTrigger.create({
      trigger: '#' + id, start: 'top 50%', end: 'bottom 50%',
      onToggle: (s) => navLinks.forEach((a) => { if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', s.isActive); }),
    });
  });

  // ---------------------------------------------------------------- lifecycle
  ScrollTrigger.addEventListener('refreshInit', () => { lastH = -9999; });
  ScrollTrigger.addEventListener('refresh', () => { measure(); layoutFinal(); applyFinal(); });
  measure();
  layoutFinal();
  gsap.ticker.add(frame);

  // Intro: strand enters, spool emerges from the dark, type reveals.
  const heroSplit = [];
  heroTitleLines.forEach((l) => heroSplit.push(...SplitText.create(l, { type: 'lines', mask: 'lines' }).lines));
  gsap.set(heroImg, { opacity: 0 });
  root.classList.add('ready');
  const startAtTop = scrollY < 20;
  gsap.timeline({ delay: 0.15 })
    .to(intro, { v: 1, duration: startAtTop ? 2.6 : 0.01, ease: 'power2.inOut' }, 0)
    .to(intro, { glow: 1, duration: 2.4, ease: 'power2.out' }, startAtTop ? 0.9 : 0)
    .fromTo(heroImg, { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 2.2, ease: 'power3.out', immediateRender: false }, startAtTop ? 0.9 : 0)
    .from(heroSplit, { yPercent: 110, duration: 1.3, stagger: 0.1, ease: 'power4.out' }, startAtTop ? 1.3 : 0)
    .from(heroReveal, { opacity: 0, y: 16, duration: 1.1, stagger: 0.12, ease: 'power3.out', immediateRender: true }, startAtTop ? 1.6 : 0)
    .from(nav, { opacity: 0, y: -12, duration: 1, ease: 'power3.out' }, startAtTop ? 1.4 : 0)
    .from(heroCue, { opacity: 0, duration: 1 }, startAtTop ? 2.4 : 0);

  // Mobile browser chrome changes height without a full refresh: keep the canvas in sync.
  addEventListener('resize', () => { if (innerWidth === lastW && Math.abs(innerHeight - lastH) > 40) { lastH = -9999; measure(); } });
  addEventListener('load', () => ScrollTrigger.refresh());
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}
