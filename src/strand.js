/* Pantone3D — strand renderer.
 * Draws filament as a shaded cylinder on a single 2D canvas.
 * The path is cut into short chunks which are depth-sorted, so coils,
 * layers and printed objects occlude themselves correctly.
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

    for (const it of items) {
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
      for (let s = i0; s < i1; s += chunk) {
        const e = Math.min(i1, s + chunk);
        let zs = 0, ks = 0;
        const xy = [];
        for (let i = s; i <= e; i++) {
          const o = i * 3;
          const p = this.project(P[o], P[o + 1], P[o + 2]);
          xy.push(p[0], p[1]);
          zs += P[o + 2]; ks += p[2];
        }
        const c = e - s + 1;
        // facing term from the chunk tangent (horizontal normal)
        const tx = P[e * 3] - P[s * 3], tz = P[e * 3 + 2] - P[s * 3 + 2];
        const tl = Math.hypot(tx, tz) || 1;
        const facing = Math.abs((tz / tl) * LIGHT[0] + (-tx / tl) * LIGHT[2]);
        chunks.push({ xy, z: zs / c, k: ks / c, it, facing });
      }
    }

    chunks.sort((a, b) => b.z - a.z);

    // Style each chunk once.
    for (const ch of chunks) {
      const { it } = ch;
      ch.w = Math.max(0.6, it.width * u * ch.k);
      const fogT = Math.min(0.72, Math.max(0, (ch.z + 0.3) / 5.5)) * (it.fogScale ?? 1);
      const lit = 0.62 + 0.38 * ch.facing;
      const base = it.color;
      const col = (m, add = 0) => {
        const r = (base[0] * m + add) * (1 - fogT) + fog[0] * fogT;
        const g = (base[1] * m + add) * (1 - fogT) + fog[1] * fogT;
        const b = (base[2] * m + add) * (1 - fogT) + fog[2] * fogT;
        return `rgb(${r | 0},${g | 0},${b | 0})`;
      };
      const hl = it.matte ? 0.18 : 0.42;
      ch.c = [col(lit * 0.5), col(lit * 0.92), col(lit * (1 - hl), 255 * hl * lit)];
    }

    // Draw in small groups of near-equal depth: each pass runs across the whole
    // group, so joints between chunks stay seamless while occlusion stays right.
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    let g0 = 0;
    while (g0 < chunks.length) {
      let g1 = g0 + 1;
      while (g1 < chunks.length && g1 - g0 < 40 && chunks[g1].it === chunks[g0].it && chunks[g0].z - chunks[g1].z < 0.045) g1++;
      for (let pass = 0; pass < 3; pass++) {
        for (let c = g0; c < g1; c++) {
          const ch = chunks[c];
          const w = ch.w;
          ctx.globalAlpha = ch.it.alpha;
          if (pass === 2) {
            if (w <= 2.2) continue;
            const off = -w * 0.17;
            this._poly(ch.xy, off * 0.4, off);
            ctx.lineWidth = w * 0.2;
          } else {
            this._poly(ch.xy, 0, 0);
            ctx.lineWidth = pass ? w * 0.7 : w;
          }
          ctx.strokeStyle = ch.c[pass];
          ctx.stroke();
        }
      }
      g0 = g1;
    }
    ctx.globalAlpha = 1;
  }

  _poly(xy, ox, oy) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(xy[0] + ox, xy[1] + oy);
    for (let i = 2; i < xy.length; i += 2) ctx.lineTo(xy[i] + ox, xy[i + 1] + oy);
  }
}

export const hexToRgb = (h) => {
  const v = parseInt(h.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
