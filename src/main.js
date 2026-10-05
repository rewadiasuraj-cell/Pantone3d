/* Pantone3D — landing page choreography.
 *
 * One fixed canvas carries a single filament strand through the whole page.
 * Each pinned section describes the strand as a pure function of its scroll
 * progress; between sections the director blends the end state of one section
 * into the start state of the next, so the page reads as one continuous shot.
 * A second canvas above the page carries only the parts of the strand that
 * pass in front of a product (the orbit ring around the hero spool).
 */
import {
  heroForm, aboutForm, ringForm, waveRibbon, straightForm, coilForm, waveForm, layerForm, objectForm, layerPitch, SHAPES,
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
const SPECTRUM = ['#FFD400', '#FF8A00', '#FF2E63', '#D82CFF', '#6A5CFF', '#138CFF', '#00D5C8'].map(hexToRgb);
const SCULPT = ['#1A1A1C', '#3A2A1A', '#E07A10', '#F7B102', '#FFD400'].map(hexToRgb); // bottom → top
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
  b.innerHTML = `<img src="${spoolSrc(m.colour, true)}" width="560" height="679" alt="" loading="lazy"><span><b>${m.name}</b><small>${m.line}</small></span>`;
  tabWrap.appendChild(b);
});

const rangeGrid = $('[data-range]');
MATERIALS.forEach((m, i) => {
  const names = m.colours.map((k) => COLOURS[k].name).join(', ');
  const el = document.createElement('article');
  el.className = 'card';
  el.innerHTML = `
    <div class="card__tex"><img src="${texSrc(m.colour)}" width="960" height="260" loading="lazy" alt="Close-up of ${m.name} filament in ${COLOURS[m.colour].name}"></div>
    <img class="card__obj" src="${spoolSrc(m.colour, true)}" width="560" height="679" loading="lazy" alt="" aria-hidden="true">
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
    if (shape === 'sculpt') Object.assign(it, { grad: SCULPT, gradAmt: 1 });
    r.render([it], DARK);
  });
}

if (reduced) {
  root.classList.add('ready');
  renderStaticForms();
  let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(renderStaticForms, 200); });
  ScrollTrigger.create({ trigger: '.colour', start: 'top 40px', end: 'bottom 40px', onToggle: (s) => { nav.dataset.theme = s.isActive ? 'light' : 'dark'; } });
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
  ['hero', 'about', 'story', 'mats', 'colour', 'build', 'apps'].forEach((k) => sections[k].classList.add('pin'));

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
    const hr = { x: hs.x - hs.w * 0.02, y: hs.y + hs.h * 0.05, rx: hs.w * (isMobile() ? 0.66 : 0.62), ry: hs.w * 0.17, roll: -0.12 };
    F.heroRingB = ringForm(hr, 'back', N);
    F.heroRingF = ringForm(hr, 'front', N);
    F.about = aboutForm(L, aboutBox(), N);
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
  const env = (o = {}) => ({ glow: 0, glowRGB: YELLOW, space: 0, light: 0, fog: DARK, ...o });
  let clock = 0;
  const ringStyle = (o = {}) => ({ grad: SPECTRUM, gradAmt: 1, gradCycle: true, gradShift: clock * 0.025, glow: 1, width: W0 * 0.42, ...o });

  // ---------------------------------------------------------------- section states
  const intro = { v: 0, ring: 0, glow: 0 };

  function heroState(p) {
    const t = ease(range(p, 0.12, 0.95));
    const ringA = 1 - smooth(range(p, 0.04, 0.5));
    return {
      items: [
        item('main', mix(F.hero, F.about, t), YELLOW, { r1: intro.v }),
        item('ringB', F.heroRingB, YELLOW, ringStyle({ r1: clamp01(intro.ring * 2), alpha: ringA })),
        item('ringF', F.heroRingF, YELLOW, ringStyle({ r1: clamp01(intro.ring * 2 - 1), alpha: ringA, front: true })),
      ],
      env: env({ glow: intro.glow * (1 - range(p, 0.3, 0.9)) }),
    };
  }

  function aboutBox() { const a = A['about-obj']; return { x: a.x, y: a.y, s: Math.min(a.w * 1.2, a.h * 0.78) }; }
  function aboutState(p) {
    const box = aboutBox();
    const rise = smooth(range(p, 0, 0.35));
    return {
      items: [
        item('main', F.about, YELLOW),
        item('obj', objectForm('sculpt', { ...box, y: box.y + (1 - rise) * 0.08 }, { rx: 0.3, ry: 0.4 + p * 1.3 }, N), YELLOW,
          { grad: SCULPT, gradAmt: 1, width: layerPitch('sculpt', box.s) * 0.95, alpha: 0.35 + 0.65 * rise }),
      ],
      env: env({ glow: 0.55, glowRGB: [224, 122, 16] }),
    };
  }

  const STORY_FORMS = ['straight', 'wave', 'coil', 'layer', 'obj'];
  const STORY_OBJ = 'tri';
  const storyBox = () => ({ ...A['story-stage'], s: A['story-stage'].s * 1.05 });
  function storyForm(k, p) {
    if (k === 'obj') return objectForm(STORY_OBJ, storyBox(), { rx: 0.42, ry: p * 1.6 }, N);
    return F[k];
  }
  function storyState(p) {
    const k = clamp01(p) * 4;
    const i = Math.min(3, Math.floor(k));
    const t = ease(range(k - i, 0.2, 0.85));
    const a = storyForm(STORY_FORMS[i], p), b = storyForm(STORY_FORMS[i + 1], p);
    const pitch = layerPitch(STORY_OBJ, storyBox().s) * 0.95;
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
    return { items, env: env({ light: open, fog: mixRgb(DARK, SOFT, open) }) };
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
        item('main', mix(F.ribbon0, feed, toFeed), colourRGB.cur, { alpha: feedAlpha }),
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

  // Applications show finished prints: many fine layers that close into a solid wall.
  const appTurns = (shape) => Math.round(SHAPES[shape].turns * (isMobile() ? 2.4 : 3.2));
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
      const turns = appTurns(ap.shape);
      const pts = objectForm(ap.shape, box, { rx: 0.42 - d * 0.12, ry: d * 0.9 + i }, turns * (isMobile() ? 40 : 52), z, turns);
      items.push(item('app' + i, pts, rgbOf(ap.colour), { width: layerPitch(ap.shape, box.s, turns) * 1.15, alpha, matte: ap.colour === 'carbon', fogScale: 0.25 }));
    });
    return { items, env: env() };
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
  const buildST = pinST(sections.build, 2.4, 1.6);
  const proofST = ScrollTrigger.create({ trigger: sections.proof, start: 'top top', end: 'bottom bottom' });
  const appsST = pinST(sections.apps, 3.0, 2.0);
  const rangeST = ScrollTrigger.create({ trigger: sections.range, start: 'top top', end: 'bottom bottom' });

  const timeline = [
    { st: heroST, state: heroState, update: heroUpdate },
    { st: aboutST, state: aboutState },
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
    // The light section opens as one sweeping ellipse from above, not a hard horizontal cut.
    const o = e.light;
    const clip = o <= 0.001 ? 'ellipse(0% 0% at 58% -12%)' : `ellipse(${(o * 104).toFixed(2)}% ${(o * 158).toFixed(2)}% at 58% -12%)`;
    if (envCache.clip !== clip) { envEls.light.style.clipPath = clip; envCache.clip = clip; }
    const theme = e.light > 0.55 ? 'light' : 'dark';
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
      const p = clamp01((y - s.st.start) / Math.max(1, s.st.end - s.st.start));
      if (y >= s.st.start - vh() && y <= s.st.end + vh()) s.update(p, y);
    });
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
    .to(heroSpool, { scale: 1.18, rotate: -7, xPercent: 6, yPercent: -4, duration: 1 }, 0)
    .to(heroSpool, { opacity: 0, duration: 0.35 }, 0.62)
    .to(heroTitleLines, { y: () => -innerHeight * 0.08, opacity: 0, duration: 0.6, stagger: 0.06 }, 0.1)
    .to([heroEyebrow, heroLede, heroCtas], { y: -30, opacity: 0, duration: 0.4, stagger: 0.04 }, 0)
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
  revealHeading($('#about-title'), sections.about, 'top 55%');
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
  gsap.from('.about__copy > .label, .about__copy .lede, .proofs li, .about .link, .about__aside', { opacity: 0, y: 18, duration: 1, stagger: 0.08, ease: 'power3.out', scrollTrigger: { trigger: sections.about, start: 'top 45%' } });
  gsap.from('.build__head .lede, .build__steps, .build__frame, .build__z', { opacity: 0, y: 16, duration: 1, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: sections.build, start: 'top 40%' } });
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
  gsap.fromTo('.macro img', { yPercent: 3 }, { yPercent: -3, ease: 'none', scrollTrigger: { trigger: '.tile--wind', start: 'top bottom', end: 'bottom top', scrub: true } });
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
    const d = `M ${W + 20} ${sy} C ${W * 0.8} ${sy + 20}, ${hx + 40} ${uy - H * 0.2}, ${hx} ${uy - 20} S ${ux1 + 40} ${uy}, ${ux1} ${uy} L ${ux0} ${uy}`;
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
  ScrollTrigger.addEventListener('refresh', () => { measure(); layoutFinal(); applyFinal(); });
  measure();
  layoutFinal();
  gsap.ticker.add(frame);

  // Intro: nav, eyebrow, heading line by line, the spool, the light trail, CTA last.
  const heroSplit = splitLines($('.hero__title'));
  gsap.set(heroImg, { opacity: 0 });
  root.classList.add('ready');
  const top = scrollY < 20;
  const at0 = (t) => (top ? t : 0);
  gsap.timeline({ delay: 0.1 })
    .from(nav, { opacity: 0, y: -12, duration: 1, ease: 'power3.out' }, 0)
    .from(heroEyebrow, { opacity: 0, y: 12, duration: 0.9, ease: 'power3.out' }, at0(0.2))
    .from(heroSplit, { yPercent: 110, duration: 1.3, stagger: 0.12, ease: 'power4.out' }, at0(0.35))
    .fromTo(heroImg, { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 2, ease: 'power3.out', immediateRender: false }, at0(0.75))
    .to(intro, { glow: 1, duration: 2.2, ease: 'power2.out' }, at0(0.9))
    .to(intro, { v: 1, duration: top ? 2.2 : 0.01, ease: 'power2.inOut' }, at0(1.0))
    .to(intro, { ring: 1, duration: top ? 2.2 : 0.01, ease: 'power2.inOut' }, at0(1.3))
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
