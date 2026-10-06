/* Pantone3D — landing page choreography.
 *
 * One fixed canvas carries a single filament strand through the whole page.
 * Each pinned section describes the strand as a pure function of its scroll
 * progress; between sections the director blends the end state of one section
 * into the start state of the next, so the page reads as one continuous shot.
 * A second canvas above the page carries only the parts of the strand that
 * pass in front of a product.
 */
import {
  heroForm, aboutForm, iconForm, waveRibbon, straightForm, coilForm, waveForm, layerForm, objectForm, layerPitch, SHAPES,
  mix, ease, smooth, range, lerp, clamp01, catmull, path, at, TAU,
} from './forms.js';
import { StrandRenderer, hexToRgb } from './strand.js';
import { BRAND_YELLOW, COLOURS, COLOUR_STORY, MATERIALS, APPLICATIONS, spoolSrc, texSrc } from './data.js';
import { initSite } from './site.js';

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
const SOFT = [245, 244, 239];
// The page colour the strand fades into with depth: follows the light / dark switch.
const baseFog = () => (root.dataset.mode === 'light' ? SOFT : DARK);
const SPECTRUM = ['#FFD400', '#FF8A00', '#FF2E63', '#D82CFF', '#6A5CFF', '#138CFF', '#00D5C8'].map(hexToRgb);
const rgbOf = (key) => hexToRgb(COLOURS[key].hex);
const mixRgb = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const lum = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
// A version of a filament colour that stays visible as a thin accent on dark UI.
const accentOf = (key) => { const c = rgbOf(key); return lum(c) < 0.25 ? mixRgb(c, [255, 255, 255], 0.45).map(Math.round) : c; };

if (!gsap || !ScrollTrigger) {
  root.classList.add('static', 'ready');
  throw new Error('GSAP failed to load — static fallback in place.');
}
gsap.registerPlugin(ScrollTrigger, SplitText);
if (reduced) root.classList.add('static');

let lenis = null;
const site = initSite({ getLenis: () => lenis });
const nav = site.nav;

/* ==========================================================================
   Generated DOM: colour swatches, material selector, range cards
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

const tabWrap = $('.mats__tabs');
MATERIALS.forEach((m, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'tab';
  b.setAttribute('role', 'tab');
  b.setAttribute('aria-controls', `mat-${m.id}`);
  b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
  b.tabIndex = i === 0 ? 0 : -1;
  const a = accentOf(m.colour);
  b.style.setProperty('--c', `rgb(${a.join(',')})`);
  b.style.setProperty('--c-rgb', a.join(','));
  b.innerHTML = `<img src="${spoolSrc(m.colour, true)}" width="560" height="675" alt="" loading="lazy"><span><b>${m.name}</b><small>${m.line}</small></span>`;
  tabWrap.appendChild(b);
});

const rangeGrid = $('[data-range]');
MATERIALS.forEach((m, i) => {
  const names = m.colours.map((k) => COLOURS[k].name).join(', ');
  const el = document.createElement('article');
  el.className = 'card';
  el.innerHTML = `
    <div class="card__tex"><img src="${texSrc(m.colour)}" width="960" height="260" loading="lazy" alt="Close-up of ${m.name} filament in ${COLOURS[m.colour].name}"></div>
    <img class="card__obj" src="${spoolSrc(m.colour, true)}" width="560" height="675" loading="lazy" alt="" aria-hidden="true">
    <div class="card__body">
      <p class="card__top label"><span>Material ${String(i + 1).padStart(2, '0')}</span></p>
      <h3>${m.name}</h3>
      <p class="card__desc">${m.desc}</p>
      <p class="card__best"><span class="label">Best for</span>${m.bestFor}</p>
      <div class="card__foot">
        <div class="dots" role="img" aria-label="Available colours: ${names}">
          ${m.colours.map((k) => `<i style="--c:${COLOURS[k].hex}" title="${COLOURS[k].name}"></i>`).join('')}
          <span aria-hidden="true">${m.colours.length} colour${m.colours.length > 1 ? 's' : ''}</span>
        </div>
        <a class="arrow" href="#materials" data-material="${i}" aria-label="View material: ${m.name}"><i aria-hidden="true">→</i></a>
      </div>
    </div>`;
  rangeGrid.appendChild(el);
});

/* ==========================================================================
   Shared UI state: material + colour selection
   ========================================================================== */
const matPanels = $$('.mat');
const matTabs = $$('.mats__tabs [role="tab"]');
const matImgs = $$('.mats__img');
const matPanel = $('.mats__panel');
const glowEl = $('.env__glow');
let matIndex = -1;

matPanel.classList.add('panel', 'edge');
matPanels.forEach((p) => p.setAttribute('role', 'tabpanel'));

function setMaterial(i, animate = !reduced) {
  if (i === matIndex) return;
  const prev = matIndex;
  matIndex = i;
  const m = MATERIALS[i];
  matTabs.forEach((t, k) => { t.setAttribute('aria-selected', k === i); t.tabIndex = k === i ? 0 : -1; });
  matPanels.forEach((p, k) => p.classList.toggle('is-on', k === i));
  glowEl.style.setProperty('--glow', rgbOf(m.colour).join(','));
  if (isMobile()) matTabs[i].scrollIntoView({ block: 'nearest', inline: 'center', behavior: animate ? 'smooth' : 'auto' });

  const [a, b] = matImgs[0].classList.contains('is-on') ? matImgs : [matImgs[1], matImgs[0]];
  b.removeAttribute('srcset');
  b.src = spoolSrc(m.colour);
  b.alt = `${m.name} filament spool in ${COLOURS[m.colour].name}`;
  a.alt = '';
  a.classList.remove('is-on'); b.classList.add('is-on');
  if (!animate || prev < 0) { gsap.set(a, { opacity: 0 }); gsap.set(b, { opacity: 1, rotate: 0, scale: 1 }); return; }
  const dir = i > prev ? 1 : -1;
  gsap.to(a, { opacity: 0, rotate: -6 * dir, scale: 0.97, duration: 0.7, ease: 'power3.inOut', overwrite: true });
  gsap.fromTo(b, { opacity: 0, rotate: 6 * dir, scale: 1.03 }, { opacity: 1, rotate: 0, scale: 1, duration: 1.0, ease: 'power3.out', overwrite: true });
  gsap.fromTo(matPanels[i].children, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.05, ease: 'power3.out', overwrite: true });
}

const swatches = $$('.sw');
const colourName = $('.colour__name');
const colourCount = $('.colour__count');
let colourIndex = -1;
const colourRGB = { cur: rgbOf(COLOUR_STORY[0]), target: rgbOf(COLOUR_STORY[0]) };

function setColour(i) {
  if (i === colourIndex) return;
  colourIndex = i;
  const key = COLOUR_STORY[i];
  swatches.forEach((s, k) => { s.setAttribute('aria-checked', k === i); s.tabIndex = k === i ? 0 : -1; });
  colourName.textContent = COLOURS[key].name;
  colourCount.textContent = `${String(i + 1).padStart(2, '0')} / ${String(COLOUR_STORY.length).padStart(2, '0')}`;
  colourRGB.target = rgbOf(key);
  if (reduced) colourRGB.cur = colourRGB.target;
}

swatches.forEach((s, i) => {
  s.addEventListener('click', () => setColour(i));
  s.addEventListener('focus', () => setColour(i));
  s.addEventListener('keydown', (e) => {
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    swatches[(i + d + swatches.length) % swatches.length].focus();
  });
});

setMaterial(0, false);
setColour(0);

/* ==========================================================================
   In-page links
   ========================================================================== */
function goTo(target, offset = 0) {
  if (lenis) lenis.scrollTo(target, { offset, duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else window.scrollTo({ top: typeof target === 'number' ? target : target.getBoundingClientRect().top + scrollY + offset, behavior: reduced ? 'auto' : 'smooth' });
}

let matST = null;
const matScrollPos = (i) => matST.start + (matST.end - matST.start) * ((i + 0.5) / MATERIALS.length);

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  const el = id === '#top' ? document.body : $(id);
  if (!el) return;
  e.preventDefault();
  const mi = a.dataset.material;
  if (mi !== undefined && id === '#materials') {
    if (matST && !reduced) goTo(matScrollPos(+mi));
    else { setMaterial(+mi); goTo(el); }
  } else if (mi !== undefined && id === '#range') {
    goTo(el);
  } else {
    goTo(id === '#top' ? 0 : el);
  }
  const focusEl = id === '#top' ? $('#hero-title') : el;
  focusEl.setAttribute('tabindex', '-1');
  focusEl.focus({ preventScroll: true });
  history.replaceState(null, '', id);
});

/* ==========================================================================
   Material selector (keyboard + click)
   ========================================================================== */
matTabs.forEach((t, i) => {
  t.addEventListener('click', () => {
    if (matST && !reduced) goTo(matScrollPos(i));
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
   Process cards: small strand scenes, one per step
   ========================================================================== */
const stepCvs = $$('.step__cv').map((cv) => ({ cv, kind: cv.dataset.step, nz: cv.parentElement.querySelector('.step__nozzle') }));
let stepP = 1;
const stepFog = () => (root.dataset.mode === 'light' ? [233, 232, 227] : [24, 24, 27]);
const STEP_WHITE = [236, 233, 224];
function placeNozzle(nz, p, a = 1) {
  if (!nz) return;
  const w = nz.getBoundingClientRect().width || 46, h = w * (100 / 60);
  nz.style.transform = `translate3d(${(p[0] - w / 2).toFixed(1)}px, ${(p[1] - h * 0.94).toFixed(1)}px, 0)`;
  nz.style.opacity = a;
}
function renderSteps(p = stepP) {
  stepP = p;
  const fog = stepFog();
  stepCvs.forEach((o) => {
    if (!o.cv.clientWidth) return;
    if (!o.r || o.w !== o.cv.clientWidth || o.h !== o.cv.clientHeight) {
      o.r = new StrandRenderer(o.cv, { chunk: 4 });
      o.w = o.cv.clientWidth; o.h = o.cv.clientHeight;
      o.L = o.r.resize(o.w, o.h);
    }
    const { r, L } = o;
    if (o.kind === 'extrude') {
      // Filament feeds down through the hotend and is laid as a bead on the bed.
      const tip = [0, -0.18, 0], bed = 0.5;
      const pts = path([
        { fn: catmull([[0.05, -L.ay - 0.2, 0], [0, -0.6, 0], tip]), w: 1 },
        { fn: catmull([tip, [0, 0.2, 0], [0.12, bed - 0.02, 0], [0.5, bed, 0], [L.ax + 0.2, bed, 0]]), w: 1.4 },
      ], 420);
      const lay = 0.62 + 0.38 * ease(range(p, 0, 0.5));
      r.render([{ id: 'x', pts, color: YELLOW, alpha: 1, width: 0.075, r1: lay }], fog);
      // The print bed, just under the bead.
      const by = r.project(0, bed + 0.045, 0)[1], ctx = r.ctx;
      ctx.fillStyle = root.dataset.mode === 'light' ? 'rgba(0,0,0,.16)' : 'rgba(255,255,255,.14)';
      ctx.fillRect(r.W * 0.08, by, r.W * 0.92, 2);
      placeNozzle(o.nz, r.project(...tip));
    } else if (o.kind === 'layers') {
      // A vase printing layer by layer, nozzle riding the newest layer.
      const box = { x: 0, y: 0.16, s: 1.45 };
      const pts = objectForm('vase', box, { rx: 0.42, ry: 0 }, 640);
      const r1 = 0.28 + 0.5 * ease(range(p, 0.1, 0.75));
      const i = Math.round(r1 * 639) * 3;
      r.render([{ id: 'l', pts, color: YELLOW, alpha: 1, width: layerPitch('vase', box.s) * 0.95, r1 }], fog);
      placeNozzle(o.nz, r.project(pts[i], pts[i + 1], pts[i + 2]));
    } else {
      // The finished part, many fine layers, turning as you scroll.
      const box = { x: 0, y: 0.04, s: 1.35 };
      const pts = objectForm('sculpt', box, { rx: 0.42, ry: -0.6 + p * 1.8 }, 900, 0, 46);
      r.render([{ id: 'o', pts, color: YELLOW, alpha: 1, width: layerPitch('sculpt', box.s, 46) * 0.95, grad: SPECTRUM, gradAmt: 1 }], fog);
    }
  });
}
{
  let t;
  addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => renderSteps(), 150); });
  addEventListener('modechange', () => renderSteps());
  addEventListener('load', () => renderSteps());
  renderSteps(reduced ? 1 : 0);
}

/* ==========================================================================
   Static mode (reduced motion): everything readable, no pinning
   ========================================================================== */
function renderStaticForms() {
  $$('.static-form').forEach((cv) => {
    const r = new StrandRenderer(cv, { chunk: 4 });
    r.resize(cv.clientWidth, cv.clientHeight);
    const shape = cv.dataset.forms;
    const s = 1.45;
    const pts = objectForm(shape, { x: 0, y: 0, s }, { rx: 0.42, ry: 0.4 }, 760);
    const it = { id: 's', pts, color: YELLOW, alpha: 1, width: layerPitch(shape, s) * 0.95 };
    if (shape === 'sculpt') Object.assign(it, { grad: SPECTRUM, gradAmt: 1 });
    r.render([it], baseFog());
  });
}

if (reduced) {
  root.classList.add('ready');
  renderStaticForms();
  let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(renderStaticForms, 200); });
  addEventListener('modechange', renderStaticForms);
  ScrollTrigger.create({ trigger: '.colour', start: 'top 40px', end: 'bottom 40px', onToggle: (s) => { nav.dataset.theme = s.isActive || root.dataset.mode === 'light' ? 'light' : 'dark'; } });
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
    hero: $('.hero'), about: $('.about'), story: $('.story'), mats: $('.mats'), colour: $('.colour'),
    build: $('.build'), proof: $('.proof'), apps: $('.apps'), range: $('.range'), final: $('.final'),
  };
  ['hero', 'about', 'story', 'mats', 'colour', 'apps'].forEach((k) => sections[k].classList.add('pin'));

  // ---------------------------------------------------------------- renderers + layout
  const canvas = $('.strand');
  const front = document.createElement('canvas');
  front.className = 'strand strand--front';
  front.setAttribute('aria-hidden', 'true');
  canvas.after(front);
  const R = new StrandRenderer(canvas, { chunk: 5 });
  const RF = new StrandRenderer(front, { chunk: 5 });
  let L, N, NR, W0, A = {}, F = {};
  let lastW = 0, lastH = 0;

  const RIBBON = ['yellow', 'orange', 'red', 'green', 'blue', 'white', 'grey', 'black'];
  const RIBBON_K = [-4, -3, -2, -1, 1, 2, 3, 4];

  function measure() {
    const w = innerWidth, h = innerHeight;
    if (w !== lastW || Math.abs(h - lastH) > 120) { L = R.resize(w, h); RF.resize(w, h); lastW = w; lastH = h; }
    N = isMobile() ? 520 : 900;
    NR = isMobile() ? 220 : 340;
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
    { const b = aboutBox(); F.about = aboutForm(L, b, N, at(b.x, b.y, 1.7)); }
    const sb = A['story-stage'];
    F.straight = straightForm(L, sb.y, N);
    F.coil = coilForm(L, sb, N);
    F.wave = waveForm(L, sb, N);
    F.layer = layerForm(L, sb, N);
    const gap = W0 * 1.9 * 1.12;
    // One long, gentle arc across the top of the Colour section: no dip, no twist.
    const rib = [
      at(-L.ax - 0.5, -L.ay * 0.42, 0.2),
      at(-L.ax * 0.35, -L.ay * 0.6, 0.1),
      at(L.ax * 0.35, -L.ay * 0.58, 0),
      at(L.ax + 0.5, -L.ay * 0.36, -0.05),
    ];
    F.ribbon0 = waveRibbon(L, 0, gap, N, rib, true);
    F.ribbon = RIBBON_K.map((k) => waveRibbon(L, k, gap, NR, rib, true));
  }

  const item = (id, pts, color, o = {}) => ({ id, pts, color, alpha: 1, width: W0, r0: 0, r1: 1, gradAmt: 0, ...o });
  const env = (o = {}) => ({ glow: 0, glowRGB: YELLOW, space: 0, light: 0, fog: baseFog(), ...o });
  let clock = 0;

  // ---------------------------------------------------------------- section states
  const intro = { v: 0, glow: 0 };

  function heroState(p) {
    const t = ease(range(p, 0.12, 0.95));
    return {
      items: [
        item('main', mix(F.hero, F.about, t), YELLOW, { r1: intro.v, grad: SPECTRUM, gradAmt: 1 }),
      ],
      env: env({ glow: intro.glow * (1 - range(p, 0.3, 0.9)) }),
    };
  }

  // About: the strand follows the travelling spool down and slips in behind it.
  function aboutBox() { const a = A['about-obj']; return { x: a.x, y: a.y, s: Math.min(a.w * 1.2, a.h * 0.78) }; }
  function aboutState() {
    return { items: [item('main', F.about, YELLOW, { grad: SPECTRUM, gradAmt: 1 })], env: env({ glow: 0.35, glowRGB: [150, 70, 200] }) };
  }

  const STORY_FORMS = ['straight', 'wave', 'coil', 'layer', 'obj'];
  const STORY_OBJ = 'vase', STORY_TURNS = 30;
  const storyBox = () => ({ ...A['story-stage'], s: A['story-stage'].s * 1.05 });
  function storyForm(k, p) {
    if (k === 'obj') return objectForm(STORY_OBJ, storyBox(), { rx: 0.42, ry: p * 1.6 }, N, 0, STORY_TURNS);
    return F[k];
  }
  function storyState(p) {
    const k = clamp01(p) * 4;
    const i = Math.min(3, Math.floor(k));
    const t = ease(range(k - i, 0.2, 0.85));
    const a = storyForm(STORY_FORMS[i], p), b = storyForm(STORY_FORMS[i + 1], p);
    const pitch = layerPitch(STORY_OBJ, storyBox().s, STORY_TURNS) * 0.95;
    const width = i < 3 ? W0 : lerp(W0, pitch, t);
    return { items: [item('main', mix(a, b, t), YELLOW, { width, grad: SPECTRUM, gradAmt: 1 })], env: env() };
  }

  function matsState() {
    const m = MATERIALS[Math.max(0, matIndex)];
    return {
      items: [],
      env: env({ glow: 1, glowRGB: rgbOf(m.colour) }),
    };
  }

  function colourState(p) {
    const open = smooth(range(p, 0, 0.12)) * (1 - smooth(range(p, 0.88, 1)));
    const WR = W0 * 1.9;
    const items = [item('main', F.ribbon0, colourRGB.cur, { width: WR, shadow: open, fogScale: 0.35, band: 'ribbon' })];
    RIBBON.forEach((key, j) => {
      const d = Math.abs(RIBBON_K[j]) * 0.02;
      items.push(item('rb' + j, F.ribbon[j], rgbOf(key), {
        width: WR, alpha: open, shadow: open, fogScale: 0.35, matte: key === 'white' || key === 'grey', band: 'ribbon',
        r1: 0.02 + 0.98 * ease(range(p, 0.03 + d, 0.3 + d)),
      }));
    });
    return { items, env: env({ light: open, fog: mixRgb(baseFog(), SOFT, open) }) };
  }


  // Applications: no printed objects. One spectrum strand redraws itself as a
  // simple line drawing for each use, holding, then reshaping into the next.
  const appBox = () => ({ x: A['apps-stage'].x, y: A['apps-stage'].y, s: A['apps-stage'].s * 0.6 });
  const appIcon = (i, p) => iconForm(APPLICATIONS[i].icon, appBox(), { ry: Math.sin(p * 9 + i) * 0.18, rx: 0.08 }, N);
  function appsState(p) {
    const n = APPLICATIONS.length;
    const u = Math.min(n - 1, Math.max(0, p * n - 0.5));
    const i = Math.min(n - 2, Math.floor(u));
    const t = ease(range(u - i, 0.3, 0.75));
    const pts = t <= 0 ? appIcon(i, p) : t >= 1 ? appIcon(i + 1, p) : mix(appIcon(i, p), appIcon(i + 1, p), t);
    return {
      items: [item('app', pts, YELLOW, { grad: SPECTRUM, gradAmt: 1, width: W0 * 1.25, r1: ease(range(p * n, 0.02, 0.4)), shadow: 0.6 })],
      env: env(),
    };
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
          grad: b.grad || a.grad, gradCycle: b.grad ? b.gradCycle : a.gradCycle, gradShift: b.gradShift ?? a.gradShift,
          gradAmt: lerp(a.gradAmt || 0, b.gradAmt || 0, t), glow: lerp(a.glow || 0, b.glow || 0, t), shadow: lerp(a.shadow || 0, b.shadow || 0, t),
        });
      } else items.push({ ...a, alpha: a.alpha * (1 - t) });
    });
    byId.forEach((b) => items.push({ ...b, alpha: b.alpha * t }));
    const ea = A1.env, eb = B1.env;
    return {
      items,
      env: {
        glow: lerp(ea.glow, eb.glow, t), glowRGB: mixRgb(ea.glowRGB, eb.glowRGB, t),
        space: lerp(ea.space, eb.space, t), light: lerp(ea.light, eb.light, t), fog: mixRgb(ea.fog, eb.fog, t),
      },
    };
  }

  // ---------------------------------------------------------------- scroll triggers
  const vh = () => innerHeight;
  const len = (desk, mob) => () => '+=' + Math.round(vh() * (isMobile() ? mob : desk));
  const pinST = (el, desk, mob) => ScrollTrigger.create({ trigger: el, start: 'top top', end: len(desk, mob), pin: true, pinSpacing: true, invalidateOnRefresh: true });

  const heroST = pinST(sections.hero, 0.8, 0.5);
  const aboutST = pinST(sections.about, 0.9, 0.6);
  const storyST = pinST(sections.story, 2.6, 1.8);
  matST = pinST(sections.mats, 3.4, 2.4);
  const colourST = pinST(sections.colour, 2.4, 1.7);
  const buildST = ScrollTrigger.create({ trigger: sections.build, start: 'top top', end: 'bottom bottom' });
  const proofST = ScrollTrigger.create({ trigger: sections.proof, start: 'top top', end: 'bottom bottom' });
  const appsST = pinST(sections.apps, 3.0, 2.0);
  const rangeST = ScrollTrigger.create({ trigger: sections.range, start: 'top top', end: 'bottom bottom' });

  const timeline = [
    { st: heroST, state: heroState, update: heroUpdate },
    { st: aboutST, state: aboutState },
    { st: storyST, state: storyState, update: storyUpdate },
    { st: matST, state: matsState, update: matsUpdate },
    // On phones the colour section starts opening while it scrolls in, so no screen is left empty.
    { st: colourST, state: colourState, update: colourUpdate, lead: () => (isMobile() ? vh() * 0.4 : 0) },
    { st: buildST, state: emptyState },
    { st: proofST, state: emptyState },
    { st: appsST, state: appsState, update: appsUpdate },
    { st: rangeST, state: emptyState },
  ];

  const startOf = (s) => s.st.start - (s.lead ? s.lead() : 0);
  function stateAt(y) {
    for (let k = 0; k < timeline.length; k++) {
      const s = timeline[k], st = s.st, start = startOf(s);
      const span = Math.max(1, st.end - start);
      if (y < start) {
        if (k === 0) return s.state(0);
        const prev = timeline[k - 1];
        let t = range(y, prev.st.end, start);
        // Phones stack the strand stage behind the next heading, so the old form clears early.
        if (isMobile()) t = range(t, 0, 0.35);
        return blend(prev.state(1), s.state(0), ease(t));
      }
      if (y <= st.end) return s.state((y - start) / span);
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
    // The light section opens as one sweeping ellipse from above, not a hard horizontal cut.
    const o = e.light;
    const clip = o <= 0.001 ? 'ellipse(0% 0% at 58% -12%)' : `ellipse(${(o * 104).toFixed(2)}% ${(o * 158).toFixed(2)}% at 58% -12%)`;
    if (envCache.clip !== clip) { envEls.light.style.clipPath = clip; envCache.clip = clip; }
    const theme = e.light > 0.55 || root.dataset.mode === 'light' ? 'light' : 'dark';
    if (nav.dataset.theme !== theme) nav.dataset.theme = theme;
  }

  // ---------------------------------------------------------------- per-frame
  let visBack = true, visFront = true;
  function frame(time) {
    clock = time;
    colourRGB.cur = mixRgb(colourRGB.cur, colourRGB.target, 0.2);
    const y = scrollY;
    timeline.forEach((s) => {
      if (!s.update) return;
      const start = startOf(s);
      const p = clamp01((y - start) / Math.max(1, s.st.end - start));
      if (y >= start - vh() && y <= s.st.end + vh()) s.update(p, y);
    });
    travelUpdate(y);
    const S = stateAt(y);
    applyEnv(S.env);
    const back = [], fr = [];
    S.items.forEach((it) => { if (it.alpha > 0.004) (it.front ? fr : back).push(it); });
    const fog = S.env.fog.map(Math.round);
    if (back.length || visBack) R.render(back, fog);
    if (fr.length || visFront) RF.render(fr, fog);
    visBack = back.length > 0; visFront = fr.length > 0;
  }

  // ---------------------------------------------------------------- DOM: per-section updates
  // Hero — intro, then a scrubbed scroll shot.
  const heroTitleLines = $$('.hero__title .hl');
  const heroSpool = $('.hero__spool-inner');
  const heroImg = $('.hero__spool img');
  const heroCue = $('.hero__cue');
  const heroEyebrow = $('.hero .eyebrow');
  const heroLede = $('.hero .lede');
  const heroCtas = $('.hero__ctas');

  const heroScroll = gsap.timeline({ paused: true, defaults: { ease: 'none' } })
    .to(heroTitleLines, { y: () => -innerHeight * 0.08, opacity: 0, duration: 0.6, stagger: 0.06 }, 0.1)
    .to([heroEyebrow, heroLede, heroCtas], { y: -30, opacity: 0, duration: 0.4, stagger: 0.04 }, 0)
    .to(heroCue, { opacity: 0, duration: 0.1 }, 0)
    .to('.hero__floor', { opacity: 0, duration: 0.12 }, 0);
  let introTl = null;
  function heroUpdate(p) {
    // Scrolling before the intro has finished: finish it now, or its late tweens bring
    // the faded copy (the CTAs especially) back while the hero is scrolling away.
    if (p > 0 && introTl && introTl.isActive()) { introTl.progress(1); heroScroll.invalidate().progress(0); }
    if (heroScroll.progress() !== p) heroScroll.progress(p);
  }

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

  // The hero spool travels: the original product photo slides down into About.
  // It is never redrawn or stretched; it only leans a little as the page scrolls.
  const travel = document.createElement('div');
  travel.className = 'spool-travel';
  travel.setAttribute('aria-hidden', 'true');
  travel.innerHTML = `<img class="spool-travel__photo" src="${heroImg.currentSrc || heroImg.src}" alt="">`;
  document.body.appendChild(travel);
  const travelPhoto = $('.spool-travel__photo', travel);
  const heroWrap = $('.hero__spool');
  let T = null;
  function measureTravel() {
    const rel = (el, sec) => { const r = el.getBoundingClientRect(), q = sec.getBoundingClientRect(); return { x: r.left - q.left, y: r.top - q.top, w: r.width, h: r.height }; };
    const h = rel(heroWrap, sections.hero), a = rel($('.about__stage'), sections.about);
    T = { hero: h, about: { x: a.x + a.w / 2 - h.w / 2, y: a.y + a.h / 2 - h.h / 2, w: h.w, h: h.h } };
    travel.style.width = `${h.w}px`; travel.style.height = `${h.h}px`;
  }
  let travelOn = null;
  function travelUpdate(y) {
    if (!T) return;
    const on = y > 2;
    if (on !== travelOn) { travelOn = on; travel.style.visibility = on ? 'visible' : 'hidden'; heroWrap.style.visibility = on ? 'hidden' : 'visible'; }
    if (!on) return;
    const a0 = aboutST.start, a1 = aboutST.end;
    const t = ease(range(y, 0, a0));
    const x = lerp(T.hero.x, T.about.x, t);
    const top = lerp(T.hero.y, T.about.y, t) + (y > a1 ? a1 - y : 0);
    if (top < -T.hero.h * 1.2) { travel.style.opacity = '0'; return; }
    travel.style.opacity = '1';
    travel.style.transform = `translate3d(${x.toFixed(1)}px, ${top.toFixed(1)}px, 0)`;
    const lean = Math.sin((y / innerHeight) * 1.6) * 7;
    travelPhoto.style.transform = `rotate(${lean.toFixed(2)}deg)`;
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
  function matsUpdate(p) {
    const n = MATERIALS.length;
    setMaterial(Math.min(n - 1, Math.floor(clamp01(p) * n)));
  }

  // Colour — the section's own content fades with the light, so ink never sits on black.
  let colourScrollIdx = -1, lastOpen = -1;
  function colourUpdate(p) {
    if (p > 0.08 && !colourReveal.progress()) colourReveal.play();
    const open = smooth(range(p, 0, 0.1)) * (1 - smooth(range(p, 0.86, 0.96)));
    const o = open.toFixed(3);
    if (o !== lastOpen) { sections.colour.style.setProperty('--open', o); lastOpen = o; }
    const n = COLOUR_STORY.length;
    const idx = Math.min(n - 1, Math.floor(range(p, 0.12, 0.88) * n));
    if (idx !== colourScrollIdx) { colourScrollIdx = idx; setColour(idx); }
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
  function splitLines(h) {
    const targets = [];
    $$('.hl', h).forEach((l) => targets.push(...SplitText.create(l, { type: 'lines', mask: 'lines' }).lines));
    return targets;
  }
  function revealHeading(h, trigger, start = 'top 70%') {
    return gsap.from(splitLines(h), {
      yPercent: 108, duration: 1.25, stagger: 0.08, ease: 'power4.out',
      scrollTrigger: trigger ? { trigger, start, toggleActions: 'play none none none' } : undefined,
    });
  }
  // On phones the travelling spool crosses the About heading, so About copy waits until the spool has landed.
  const aboutStart = (desk) => () => (isMobile() ? 'top 12%' : desk);
  revealHeading($('#about-title'), sections.about, aboutStart('top 55%'));
  revealHeading($('#story-title'), sections.story, 'top 55%');
  revealHeading($('#mats-title'), sections.mats, 'top 55%');
  revealHeading($('#build-title'), sections.build, 'top 50%');
  revealHeading($('#proof-title'), sections.proof, 'top 75%');
  revealHeading($('#range-title'), sections.range, 'top 75%');
  revealHeading($('#final-title'), sections.final, 'top 60%');

  const colourReveal = gsap.timeline({ paused: true })
    .add(revealHeading($('#colour-title')), 0)
    .from('.colour__head .label, .colour__head .lede, .colour__head .btn', { opacity: 0, y: 18, duration: 0.9, stagger: 0.08, ease: 'power3.out' }, 0.2)
    .from('.colour__pick', { opacity: 0, y: 20, duration: 0.9, ease: 'power3.out' }, 0.35)
    .from('.sw', { opacity: 0, y: 14, duration: 0.7, stagger: 0.04, ease: 'power3.out' }, 0.4);
  gsap.from('.about__copy > .label, .about__copy .lede, .proofs li, .about .link, .about__aside', { opacity: 0, y: 18, duration: 1, stagger: 0.08, ease: 'power3.out', scrollTrigger: { trigger: sections.about, start: aboutStart('top 45%') } });
  gsap.from('.build__top, .build__head .lede', { opacity: 0, y: 16, duration: 1, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: sections.build, start: 'top 60%' } });
  gsap.from('.step', { opacity: 0, y: 40, duration: 1.1, stagger: 0.12, ease: 'power3.out', scrollTrigger: { trigger: '.steps', start: 'top 80%' } });
  // The cards play the journey as you scroll through them: the bead lays down,
  // layers stack under the nozzle, the finished part turns.
  ScrollTrigger.create({ trigger: '.steps', start: 'top 85%', end: 'bottom 30%', onUpdate: (st) => renderSteps(st.progress) });
  gsap.from('.mats__head > .label, .mats__head .lede', { opacity: 0, y: 16, duration: 1, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: sections.mats, start: 'top 50%' } });
  gsap.from('.mats__panel', { opacity: 0, x: 30, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: sections.mats, start: 'top 45%' } });
  gsap.from('.tab', { opacity: 0, y: 24, duration: 1, stagger: 0.06, ease: 'power3.out', scrollTrigger: { trigger: sections.mats, start: 'top 40%' } });
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
  gsap.fromTo('.tile__spool', { x: 0, xPercent: -50, rotate: -18 }, { x: 0, xPercent: -50, rotate: 10, ease: 'none', scrollTrigger: { trigger: '.tile--wind', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.from('.choice li', { opacity: 0, y: 10, duration: 0.7, stagger: 0.05, ease: 'power3.out', scrollTrigger: { trigger: '.tile--choice', start: 'top 80%' } });

  // Range — cards rise in sequence
  gsap.from('.card', { y: 70, opacity: 0, duration: 1.2, stagger: 0.08, ease: 'power3.out', clearProps: 'transform', scrollTrigger: { trigger: '.grid', start: 'top 82%' } });

  // ---------------------------------------------------------------- final: a single yellow strand returns and underlines the last word
  const fSvg = $('.final__strand');
  const fPaths = $$('path', fSvg);
  const fLast = $('.final__last');
  let fLen = 1;
  function layoutFinal() {
    const sr = sections.final.getBoundingClientRect();
    const lr = fLast.getBoundingClientRect();
    const W = sr.width, H = sr.height;
    fSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const hr = $('#final-title').getBoundingClientRect();
    const ux0 = lr.left - sr.left, ux1 = lr.right - sr.left, uy = lr.bottom - sr.top + Math.max(10, lr.height * 0.06);
    const hx = Math.min(W - 60, hr.right - sr.left + W * 0.06), sy = H * 0.2;
    // enters from the right edge, stays clear of the heading, then underlines the last word
    const d = isMobile()
      ? `M ${W + 20} ${uy + 34} C ${W - 40} ${uy + 30}, ${ux1 + 50} ${uy}, ${ux1} ${uy} L ${ux0} ${uy}`
      : `M ${W + 20} ${sy} C ${W * 0.8} ${sy + 20}, ${hx + 40} ${uy - H * 0.2}, ${hx} ${uy - 20} S ${ux1 + 40} ${uy}, ${ux1} ${uy} L ${ux0} ${uy}`;
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
    scrollTrigger: { trigger: sections.final, start: 'top 60%', end: 'center 52%', scrub: 0.6 },
  });
  gsap.from('.final__copy > .label, .final .ctas', { opacity: 0, y: 20, duration: 1, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: sections.final, start: 'top 45%' } });

  // ---------------------------------------------------------------- nav: active section
  const navLinks = $$('.nav__links a');
  const setCurrent = (key) => navLinks.forEach((a) => {
    if (a.dataset.nav === key) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
  });
  [['top', 'home'], ['materials', 'materials'], ['colour', 'colour'], ['applications', 'applications']].forEach(([id, key]) => {
    ScrollTrigger.create({ trigger: '#' + id, start: 'top 50%', end: 'bottom 50%', onToggle: (s) => { if (s.isActive) setCurrent(key); } });
  });
  ScrollTrigger.create({ trigger: sections.about, start: 'top 50%', end: 'bottom 50%', onToggle: (s) => { if (s.isActive) setCurrent(''); } });

  // ---------------------------------------------------------------- lifecycle
  ScrollTrigger.addEventListener('refreshInit', () => { lastH = -9999; });
  ScrollTrigger.addEventListener('refresh', () => { measure(); layoutFinal(); applyFinal(); measureTravel(); travelOn = null; });
  measure();
  measureTravel();
  layoutFinal();
  gsap.ticker.add(frame);

  // Intro: nav, eyebrow, heading line by line, the spool, the light trail, CTA last.
  const heroSplit = splitLines($('.hero__title'));
  gsap.set(heroImg, { opacity: 0 });
  root.classList.add('ready');
  const top = scrollY < 20;
  const at0 = (t) => (top ? t : 0);
  introTl = gsap.timeline({ delay: 0.1 })
    .from(nav, { opacity: 0, y: -12, duration: 1, ease: 'power3.out' }, 0)
    .from(heroEyebrow, { opacity: 0, y: 12, duration: 0.9, ease: 'power3.out' }, at0(0.2))
    .from(heroSplit, { yPercent: 110, duration: 1.3, stagger: 0.12, ease: 'power4.out' }, at0(0.35))
    .fromTo(heroImg, { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 2, ease: 'power3.out', immediateRender: false }, at0(0.75))
    .to(intro, { glow: 1, duration: 2.2, ease: 'power2.out' }, at0(0.9))
    .to(intro, { v: 1, duration: top ? 2.2 : 0.01, ease: 'power2.inOut' }, at0(1.0))
    .from(heroLede, { opacity: 0, y: 14, duration: 1, ease: 'power3.out' }, at0(1.5))
    .from(heroCtas, { opacity: 0, y: 16, duration: 1, ease: 'power3.out' }, at0(2.1))
    .from(heroCue, { opacity: 0, duration: 1 }, at0(2.6));

  // Mobile browser chrome changes height without a full refresh: keep the canvas in sync.
  addEventListener('resize', () => { if (innerWidth === lastW && Math.abs(innerHeight - lastH) > 40) { lastH = -9999; measure(); } });
  addEventListener('load', () => {
    ScrollTrigger.refresh();
    // Arriving from another page with a #section: jump there once pins are measured.
    const target = location.hash.length > 1 && $(location.hash);
    if (target) lenis.scrollTo(target, { immediate: true, force: true });
  });
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}
