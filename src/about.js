/* Pantone3D — About page.
 * Same design system as the landing page: a drawn filament composition in the
 * hero (no repeated product shot), masked line reveals, and one yellow strand
 * returning in the closing call to action.
 */
import { waveRibbon, at, ease, range, clamp01 } from './forms.js';
import { StrandRenderer, hexToRgb } from './strand.js';
import { COLOURS } from './data.js';
import { initSite } from './site.js';

const { gsap, ScrollTrigger, SplitText } = window;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => matchMedia('(max-width: 900px) and (orientation: portrait), (max-width: 640px)').matches;

let lenis = null;
initSite({ getLenis: () => lenis });

/* ---------------------------------------------------------------- hero strands */
const RIBBON = ['yellow', 'orange', 'red', 'black', 'blue', 'green', 'white', 'grey'];
const heroCanvas = $('.ahero__canvas');
const R = new StrandRenderer(heroCanvas, { chunk: 5 });
let strands = [];
const draw = { v: reduced ? 1 : 0 };

function layoutHero() {
  const L = R.resize(heroCanvas.clientWidth, heroCanvas.clientHeight);
  const { ax, ay } = L;
  const mob = isMobile();
  const W = mob ? 0.034 : 0.026;
  const ctrl = mob
    ? [at(ax + 0.5, -ay * 0.86, 0.2), at(ax * 0.3, -ay * 0.72, 0.1), at(-ax * 0.2, -ay * 0.42, 0), at(ax * 0.2, -ay * 0.1, -0.05), at(ax + 0.6, -ay * 0.2, 0)]
    : [at(ax * 0.02, -ay - 0.4, 0.3), at(ax * 0.2, -ay * 0.55, 0.15), at(ax * 0.52, -ay * 0.05, 0), at(ax * 0.72, ay * 0.32, -0.05), at(ax + 0.6, ay * 0.12, 0)];
  const N = mob ? 220 : 360;
  strands = RIBBON.map((key, j) => {
    const k = j - (RIBBON.length - 1) / 2;
    return { id: key, pts: waveRibbon(L, k, W * 1.12, N, ctrl), color: hexToRgb(COLOURS[key].hex), width: W, matte: key === 'white' || key === 'grey', band: 'ribbon', d: Math.abs(k) * 0.04 };
  });
  renderHero();
}
function renderHero() {
  R.render(strands.map((s) => ({ ...s, alpha: 1, r0: 0, r1: clamp01(0.02 + 0.98 * ease(range(draw.v, s.d, 0.7 + s.d))), fogScale: 0.8 })), document.documentElement.dataset.mode === 'light' ? [245, 244, 239] : [8, 8, 8]);
}
layoutHero();
addEventListener('modechange', renderHero);
let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(layoutHero, 150); });

/* ---------------------------------------------------------------- closing strand */
const cSec = $('.acta');
const cSvg = $('.acta__strand');
const cPaths = $$('path', cSvg);
const cLast = $('.acta__last');
let cLen = 1;
const cDraw = { v: reduced ? 1 : 0 };
function layoutClose() {
  const sr = cSec.getBoundingClientRect();
  const lr = cLast.getBoundingClientRect();
  const W = sr.width, H = sr.height;
  cSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const hr = $('#acta-title').getBoundingClientRect();
  const ux0 = lr.left - sr.left, ux1 = lr.right - sr.left, uy = lr.bottom - sr.top + Math.max(10, lr.height * 0.06);
  const hx = Math.min(W - 60, hr.right - sr.left + W * 0.06), sy = H * 0.2;
  const d = `M ${W + 20} ${sy} C ${W * 0.8} ${sy + 20}, ${hx + 40} ${uy - H * 0.2}, ${hx} ${uy - 20} S ${ux1 + 40} ${uy}, ${ux1} ${uy} L ${ux0} ${uy}`;
  const w = isMobile() ? 6 : 9;
  cPaths.forEach((p, i) => {
    p.setAttribute('d', d);
    p.setAttribute('stroke-width', [w, w * 0.68, w * 0.18][i]);
    if (i === 2) p.setAttribute('transform', `translate(${-w * 0.08} ${-w * 0.18})`);
  });
  cLen = cPaths[0].getTotalLength();
  cPaths.forEach((p) => { p.style.strokeDasharray = `${cLen} ${cLen}`; });
  applyClose();
}
const applyClose = () => cPaths.forEach((p) => { p.style.strokeDashoffset = (cLen * (1 - cDraw.v)).toFixed(1); });

/* ---------------------------------------------------------------- motion */
if (!gsap || !ScrollTrigger || reduced) {
  root.classList.add('static', 'ready');
  layoutClose();
  addEventListener('resize', layoutClose);
} else {
  gsap.registerPlugin(ScrollTrigger, SplitText);
  lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  const split = (h) => {
    const out = [];
    $$('.hl', h).forEach((l) => out.push(...SplitText.create(l, { type: 'lines', mask: 'lines' }).lines));
    return out;
  };

  root.classList.add('ready');
  gsap.timeline({ delay: 0.1 })
    .from('.nav', { opacity: 0, y: -12, duration: 1, ease: 'power3.out' }, 0)
    .from('.ahero .eyebrow', { opacity: 0, y: 12, duration: 0.9, ease: 'power3.out' }, 0.2)
    .from(split($('#about-title')), { yPercent: 110, duration: 1.3, stagger: 0.12, ease: 'power4.out' }, 0.35)
    .to(draw, { v: 1, duration: 3, ease: 'power2.inOut', onUpdate: renderHero }, 0.5)
    .from('.ahero .lede', { opacity: 0, y: 14, duration: 1, ease: 'power3.out' }, 1.2);

  // The strands drift slowly up and away as the hero scrolls out.
  gsap.to(heroCanvas, { yPercent: -12, opacity: 0.3, ease: 'none', scrollTrigger: { trigger: '.ahero', start: 'top top', end: 'bottom top', scrub: true } });

  ['#story-title', '#values-title', '#creators-title', '#acta-title'].forEach((id) => {
    gsap.from(split($(id)), { yPercent: 108, duration: 1.25, stagger: 0.08, ease: 'power4.out', scrollTrigger: { trigger: $(id), start: 'top 82%' } });
  });
  $$('[data-rise]').forEach((el) => {
    gsap.from(el, { y: 40, opacity: 0, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
  });
  gsap.fromTo('.photos img', { yPercent: 4, scale: 1.08 }, { yPercent: -4, scale: 1.08, ease: 'none', scrollTrigger: { trigger: '.photos', start: 'top bottom', end: 'bottom top', scrub: true } });

  gsap.to(cDraw, { v: 1, ease: 'none', onUpdate: applyClose, scrollTrigger: { trigger: cSec, start: 'top 65%', end: 'center 52%', scrub: 0.6 } });
  gsap.from('.acta .label, .acta .ctas', { opacity: 0, y: 20, duration: 1, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: cSec, start: 'top 55%' } });

  // Dark nav text over the light sections.
  const nav = $('.nav');
  $$('.sec--light, .sec--white').forEach((sec) => {
    ScrollTrigger.create({ trigger: sec, start: 'top 40px', end: 'bottom 40px', onToggle: (st) => { nav.dataset.theme = st.isActive ? 'light' : 'dark'; } });
  });

  ScrollTrigger.addEventListener('refresh', layoutClose);
  layoutClose();
  addEventListener('load', () => ScrollTrigger.refresh());
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}
