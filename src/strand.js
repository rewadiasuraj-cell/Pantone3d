/* Pantone3D — strand renderer.
 * Draws filament as a shaded cylinder on a single 2D canvas.
 * The path is cut into short chunks which are depth-sorted, so coils,
 * layers and printed objects occlude themselves correctly, then drawn back
 * as one uninterrupted extrusion: shared colours at every joint, butt joins
 * with a hair of overlap, and round tips only at the real ends.
 */
import { FOCAL } from './forms.js';

const LIGHT = (() => { const v = [-0.45, -0.55, -0.7]; const l = Math.hypot(...v); return v.map((c) => c / l); })();

export class StrandRenderer {
  constructor(canvas, { chunk = 5, dprMax = 1.75 } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.chunk = chunk;
    this.dprMax = dprMax;
    this.heads = {};
    this.resize();
  }

  resize(w = this.canvas.clientWidth, h = this.canvas.clientHeight) {
    const dpr = Math.min(window.devicePixelRatio || 1, this.dprMax);
    this.W = w; this.H = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.u = Math.min(w, h) / 2;
    return { W: w, H: h, u: this.u, ax: w / 2 / this.u, ay: h / 2 / this.u };
  }

  project(x, y, z) {
    const k = FOCAL / Math.max(1.4, FOCAL + z);
    return [this.W / 2 + x * k * this.u, this.H / 2 + y * k * this.u, k];
  }

  render(items, fog = [8, 8, 8]) {
    const { ctx, u, chunk } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    const chunks = [];

    // Strands that share a `band` (a flat ribbon of parallel strands) sort as one
    // unit, then each run is drawn strand by strand, back to front, so neighbours
    // in the ribbon don't chop each other into short pieces.
    let order = 0;
    const bands = {};
    for (const it of items) {
      const io = it && it.band != null ? (bands[it.band] ??= order++) : order++;
      if (!it || it.alpha <= 0.004) continue;
      const P = it.pts;
      const n = P.length / 3;
      const i0 = Math.max(0, Math.floor((it.r0 ?? 0) * (n - 1)));
      const i1 = Math.min(n - 1, Math.ceil((it.r1 ?? 1) * (n - 1)));
      if (i1 - i0 < 1) continue;
      if (it.head) {
        const o = i1 * 3;
        this.heads[it.id] = this.project(P[o], P[o + 1], P[o + 2]);
      }
      // Project every visible sample once. Chunk ends are shaded once and shared,
      // so neighbouring chunks have exactly the same colour where they meet.
      const xy = new Float32Array((i1 - i0 + 1) * 2);
      const kk = new Float32Array(i1 - i0 + 1);
      const shade = new Map();
      const sh = (i) => { if (!shade.has(i)) shade.set(i, this._shade(it, P, i, n, fog)); return shade.get(i); };
      for (let i = i0; i <= i1; i++) {
        const o = i * 3;
        const p = this.project(P[o], P[o + 1], P[o + 2]);
        xy[(i - i0) * 2] = p[0]; xy[(i - i0) * 2 + 1] = p[1]; kk[i - i0] = p[2];
      }
      for (let s = i0; s < i1; s += chunk) {
        const e = Math.min(i1, s + chunk);
        let zs = 0, ks = 0;
        for (let i = s; i <= e; i++) { zs += P[i * 3 + 2]; ks += kk[i - i0]; }
        const c = e - s + 1;
        chunks.push({
          s: s - i0, e: e - i0, xy, z: zs / c, b: Math.floor((zs / c) / 0.04), io, k: ks / c, it,
          c0: sh(s), c1: sh(e), first: s === i0, last: e === i1, g: it.band ?? it,
        });
      }
    }

    // Back to front in thin depth slabs; inside a slab keep each strand together,
    // so separate strands that share a depth range don't break each other into beads.
    chunks.sort((a, b) => (b.b - a.b) || (a.io - b.io) || (b.z - a.z));
    for (const ch of chunks) ch.w = Math.max(0.6, ch.it.width * u * ch.k);
    for (const it of items) if (it) { it._mz = 0; it._n = 0; }
    for (const ch of chunks) { ch.it._mz += ch.z; ch.it._n++; }
    for (const it of items) if (it && it._n) it._mz /= it._n;

    // Soft halo for light trails, or a contact shadow on light backgrounds. Halos
    // are drawn opaque off-screen and laid in once per strength, so nothing doubles
    // up where pieces (or neighbouring strands) meet.
    const halos = new Map();
    for (const ch of chunks) {
      const it = ch.it;
      if (!(it.glow || it.shadow)) continue;
      const a = Math.round((it.glow ? it.alpha * it.glow * 0.1 : it.alpha * it.shadow * 0.16) * 200) / 200;
      if (a <= 0) continue;
      if (!halos.has(a)) halos.set(a, []);
      halos.get(a).push(ch);
    }
    for (const [a, list] of halos) {
      const hc = this._haloCtx();
      hc.clearRect(0, 0, this.W, this.H);
      hc.lineCap = 'round'; hc.lineJoin = 'round';
      for (const ch of list) {
        const glow = ch.it.glow;
        this._path(ch, glow ? 0 : ch.w * 0.35, glow ? 0 : ch.w * 0.9, hc);
        hc.lineWidth = ch.w * (glow ? 2.6 : 1.5);
        hc.strokeStyle = glow ? this._style(ch, 3, hc) : 'rgb(40,32,20)';
        hc.stroke();
      }
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = a;
      ctx.drawImage(this.halo, 0, 0);
      ctx.restore();
    }

    // Draw runs of one strand at a time: every pass runs across the whole run, so
    // the strand reads as one continuous extrusion. Chunks meet with butt caps and
    // a hair of overlap, which leaves no visible joint; only the real ends are round.
    ctx.lineJoin = 'round';
    let g0 = 0;
    while (g0 < chunks.length) {
      let g1 = g0 + 1, zmin = chunks[g0].z, zmax = zmin;
      while (g1 < chunks.length && g1 - g0 < 240 && chunks[g1].g === chunks[g0].g) {
        const z = chunks[g1].z;
        if (Math.max(zmax, z) - Math.min(zmin, z) > (chunks[g0].g === chunks[g0].it ? 0.14 : 0.6)) break;
        zmin = Math.min(zmin, z); zmax = Math.max(zmax, z);
        g1++;
      }
      for (const run of this._split(chunks, g0, g1)) {
      for (let pass = 0; pass < 3; pass++) {
        for (const ch of run) {
          const { w, it } = ch;
          ctx.lineCap = 'butt';
          ctx.globalAlpha = it.alpha;
          let ox = 0, oy = 0;
          if (pass === 2) {
            if (w <= 2.2) continue;
            oy = -w * 0.17; ox = oy * 0.4;
            ctx.lineWidth = w * 0.2;
          } else {
            ctx.lineWidth = pass ? w * 0.7 : w;
          }
          ctx.strokeStyle = this._style(ch, pass);
          this._path(ch, ox, oy, ctx, pass === 2);
          ctx.stroke();
          // rounded tips only where the strand really starts or ends
          if ((ch.first || ch.last) && pass < 2) {
            ctx.lineCap = 'round';
            ctx.beginPath();
            if (ch.first) { const x = ch.xy[ch.s * 2] + ox, y = ch.xy[ch.s * 2 + 1] + oy; ctx.moveTo(x, y); ctx.lineTo(x + 0.01, y); }
            if (ch.last) { const x = ch.xy[ch.e * 2] + ox, y = ch.xy[ch.e * 2 + 1] + oy; ctx.moveTo(x, y); ctx.lineTo(x + 0.01, y); }
            ctx.stroke();
          }
        }
      }
      }
      g0 = g1;
    }
    ctx.globalAlpha = 1;
    ctx.lineCap = 'round';
  }

  /* One run per strand; a band's strands keep one back-to-front order (mean depth
   * over the whole strand), so they never swap places and leave a mark. */
  _split(chunks, g0, g1) {
    if (chunks[g0].g === chunks[g0].it) return [chunks.slice(g0, g1)];
    const by = new Map();
    for (let c = g0; c < g1; c++) {
      const ch = chunks[c];
      if (!by.has(ch.it)) by.set(ch.it, []);
      by.get(ch.it).push(ch);
    }
    return [...by.values()].sort((a, b) => b[0].it._mz - a[0].it._mz);
  }

  _haloCtx() {
    if (!this.halo) { this.halo = document.createElement('canvas'); this.hctx = this.halo.getContext('2d'); }
    const w = this.canvas.width, h = this.canvas.height;
    if (this.halo.width !== w || this.halo.height !== h) { this.halo.width = w; this.halo.height = h; }
    this.hctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    return this.hctx;
  }

  /* Edge, body, highlight and glow colours of sample i. */
  _shade(it, P, i, n, fog) {
    const o = i * 3;
    const a = Math.max(0, i - 1) * 3, b = Math.min(n - 1, i + 1) * 3;
    const tx = P[b] - P[a], tz = P[b + 2] - P[a + 2];
    const tl = Math.hypot(tx, tz) || 1;
    const facing = Math.abs((tz / tl) * LIGHT[0] + (-tx / tl) * LIGHT[2]);
    const fogT = Math.min(0.72, Math.max(0, (P[o + 2] + 0.3) / 5.5)) * (it.fogScale ?? 1);
    const lit = 0.62 + 0.38 * facing;
    const f = i / (n - 1);
    let base = it.color;
    if (it.grad && it.gradAmt > 0) base = mixStops(base, it.grad, it.gradCycle ? f + (it.gradShift || 0) : f, it.gradCycle, it.gradAmt);
    const col = (m, add = 0) => [0, 1, 2].map((q) => (base[q] * m + add) * (1 - fogT) + fog[q] * fogT);
    const hl = it.matte ? 0.18 : 0.42;
    return [col(lit * 0.5), col(lit * 0.92), col(lit * (1 - hl), 255 * hl * lit), col(1.1, 20)];
  }

  /* A solid colour, or a gradient along the chunk when its two ends differ. */
  _style(ch, q, cx = this.ctx) {
    const a = ch.c0[q], b = ch.c1[q];
    const css = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
    if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 24) return css([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]);
    const { xy, s, e } = ch;
    const x0 = xy[s * 2], y0 = xy[s * 2 + 1], x1 = xy[e * 2], y1 = xy[e * 2 + 1];
    if (Math.hypot(x1 - x0, y1 - y0) < 0.5) return css(a);
    const g = cx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, css(a));
    g.addColorStop(1, css(b));
    return g;
  }

  /* Chunk polyline. It reaches ~0.8px into the next chunk so abutting strokes leave
   * no seam; the highlight line (`hl`) overlaps a whole sample on both sides, so it
   * stays one unbroken line even where neighbouring chunks are drawn in other runs. */
  _path(ch, ox, oy, ctx = this.ctx, hl = false) {
    const { xy, s, e } = ch;
    const a = hl && !ch.first ? s - 1 : s;
    ctx.beginPath();
    ctx.moveTo(xy[a * 2] + ox, xy[a * 2 + 1] + oy);
    for (let i = a + 1; i <= e; i++) ctx.lineTo(xy[i * 2] + ox, xy[i * 2 + 1] + oy);
    if (!ch.last) {
      const x = xy[e * 2], y = xy[e * 2 + 1], dx = xy[e * 2 + 2] - x, dy = xy[e * 2 + 3] - y;
      const l = Math.hypot(dx, dy);
      if (l > 0) { const t = hl ? 1 : Math.min(1, 0.8 / l); ctx.lineTo(x + dx * t + ox, y + dy * t + oy); }
    }
  }

}

/* Colour at f (0–1) along a list of RGB stops, mixed into base by amt. */
function mixStops(base, stops, f, cycle, amt) {
  const n = cycle ? stops.length : stops.length - 1;
  f = cycle ? ((f % 1) + 1) % 1 : Math.min(1, Math.max(0, f));
  const x = f * n, i = Math.floor(x) % stops.length, j = (i + 1) % stops.length, u = x - Math.floor(x);
  const a = stops[i], b = stops[cycle ? j : Math.min(stops.length - 1, i + 1)];
  return [0, 1, 2].map((q) => base[q] + ((a[q] + (b[q] - a[q]) * u) - base[q]) * amt);
}

export const hexToRgb = (h) => {
  const v = parseInt(h.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
