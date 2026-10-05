/* Pantone3D — filament form library.
 * Every form returns N points (x, y, z) in "world units", so any form can morph
 * into any other by index. 1 unit = half of the viewport's short side;
 * origin = viewport centre; +y is down, +z is away from the camera.
 */

export const TAU = Math.PI * 2;
export const FOCAL = 5;

export const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
export const ease = (t) => { t = clamp01(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const range = (t, a, b) => clamp01((t - a) / (b - a));

/* Un-project: the point lands on screen-unit (x, y) when drawn at depth z. */
export const at = (x, y, z = 0) => [x * (FOCAL + z) / FOCAL, y * (FOCAL + z) / FOCAL, z];

/* Sample fn(t) densely, then redistribute `count` points evenly by arc length. */
function resample(fn, count, out, offset) {
  if (count <= 0) return;
  const M = Math.max(16, count * 4);
  const pts = new Float32Array((M + 1) * 3);
  const acc = new Float32Array(M + 1);
  for (let i = 0; i <= M; i++) {
    const p = fn(i / M);
    pts[i * 3] = p[0]; pts[i * 3 + 1] = p[1]; pts[i * 3 + 2] = p[2];
    if (i) {
      const dx = p[0] - pts[i * 3 - 3], dy = p[1] - pts[i * 3 - 2], dz = p[2] - pts[i * 3 - 1];
      acc[i] = acc[i - 1] + Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
  }
  const total = acc[M] || 1;
  let k = 0;
  for (let j = 0; j < count; j++) {
    const s = count === 1 ? 0 : (j / (count - 1)) * total;
    while (k < M - 1 && acc[k + 1] < s) k++;
    const seg = acc[k + 1] - acc[k] || 1;
    const f = clamp01((s - acc[k]) / seg);
    const o = (offset + j) * 3;
    out[o] = lerp(pts[k * 3], pts[k * 3 + 3], f);
    out[o + 1] = lerp(pts[k * 3 + 1], pts[k * 3 + 4], f);
    out[o + 2] = lerp(pts[k * 3 + 2], pts[k * 3 + 5], f);
  }
}

/* A path made of parts [{fn, w}] where w is the share of points. */
export function path(parts, N) {
  const out = new Float32Array(N * 3);
  const sum = parts.reduce((s, p) => s + p.w, 0);
  let used = 0;
  parts.forEach((p, i) => {
    const c = i === parts.length - 1 ? N - used : Math.round((p.w / sum) * N);
    resample(p.fn, c, out, used);
    used += c;
  });
  return out;
}

/* Centripetal-ish Catmull-Rom through control points. */
export function catmull(ctrl) {
  const n = ctrl.length - 1;
  return (t) => {
    const f = t * n;
    const i = Math.min(n - 1, Math.floor(f));
    const u = f - i;
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(n, i + 2)];
    const u2 = u * u, u3 = u2 * u;
    const r = [0, 0, 0];
    for (let a = 0; a < 3; a++) {
      r[a] = 0.5 * (2 * p1[a] + (-p0[a] + p2[a]) * u + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * u2 + (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * u3);
    }
    return r;
  };
}

const line = (a, b) => (t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/* Rotate (x,y,z) about Y then X, return [x,y,z]. */
function rotYX(x, y, z, ry, rx) {
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
  const cx = Math.cos(rx), sx = Math.sin(rx);
  return [x1, y * cx - z1 * sx, y * sx + z1 * cx];
}

/* ---------------------------------------------------------------- lines */

export function heroForm(L, spool, N) {
  const { ax, ay } = L;
  const sx = spool.x, sy = spool.y, r = spool.r;
  const portrait = ax < ay;
  // One unbroken strand: it sweeps in under the spool, rises round its left
  // side and slips behind the flange into the winding. No loops, no crossings.
  const ctrl = portrait
    ? [
        at(ax + 0.4, sy + r * 0.95, -0.2),
        at(sx + r * 0.1, sy + r * 1.2, -0.2),
        at(sx - r * 0.85, sy + r * 0.95, 0),
        at(sx - r * 1.2, sy + r * 0.2, 0.5),
        at(sx - r * 0.85, sy - r * 0.45, 1.1),
        at(sx - r * 0.25, sy - r * 0.3, 1.5),
        at(sx, sy, 1.7),
      ]
    : [
        at(ax + 0.45, ay * 0.82, -0.3),
        at(sx + r * 0.2, sy + r * 1.3, -0.25),
        at(sx - r * 0.9, sy + r * 1.05, -0.05),
        at(sx - r * 1.35, sy + r * 0.25, 0.5),
        at(sx - r * 1.05, sy - r * 0.55, 1.1),
        at(sx - r * 0.35, sy - r * 0.4, 1.5),
        at(sx, sy, 1.7),
      ];
  return path([{ fn: catmull(ctrl), w: 1 }], N);
}

/* Half of a tilted orbit ring around a product (the hero / materials spool).
 * half = 'back' (passes behind, top) or 'front' (passes in front, bottom).
 * o = {x, y, rx, ry, roll} in world units: rx/ry are the on-screen radii. */
export function ringForm(o, half, N) {
  const a0 = half === 'back' ? 0 : Math.PI;
  const depth = o.depth ?? o.rx * 0.6;
  const cr = Math.cos(o.roll || 0), sr = Math.sin(o.roll || 0);
  const fn = (t) => {
    const a = a0 + t * Math.PI;
    const x = -Math.cos(a) * o.rx, y = -Math.sin(a) * o.ry;
    return at(o.x + x * cr - y * sr, o.y + x * sr + y * cr, Math.sin(a) * depth);
  };
  return path([{ fn, w: 1 }], N);
}

/* About block: the strand runs in low from the left, under the copy, climbs the
 * side of the printed object and finishes as its top layer (`end`, world xyz). */
export function aboutForm(L, box, N, end) {
  const { ax, ay } = L;
  const k = box.s;
  const lead = ax < ay
    ? [at(-ax - 0.4, box.y + k * 0.3, 0.2), at(box.x - k * 0.62, box.y + k * 0.12, 0.3)]
    : [at(-ax - 0.4, ay * 0.86, 0.2), at(lerp(-ax, box.x, 0.5), ay * 0.74, 0.3), at(box.x - k * 0.62, box.y + k * 0.42, 0.4)];
  const ctrl = [
    ...lead,
    at(box.x - k * 0.58, box.y - k * 0.2, 0.3),
    at(lerp(box.x - k * 0.5, end[0], 0.5), end[1] - k * 0.16, end[2] * 0.6),
    end,
  ];
  return path([{ fn: catmull(ctrl), w: 1 }], N);
}

/* Colour section: a ribbon of parallel strands that enters from the upper
 * left, sweeps across the top of the section and opens out to the right.
 * k = strand index offset from the ribbon centre (…, -1, 0, 1, …). */
/* flat: a calm ribbon that keeps its strands side by side, with no twist. */
export function waveRibbon(L, k, gap, N, ctrl, flat = false) {
  const { ax, ay } = L;
  const base = catmull(ctrl || [
    at(-ax - 0.5, -ay * 0.92, 0.3),
    at(-ax * 0.45, -ay * 0.86, 0.25),
    at(ax * 0.1, -ay * 0.62, 0.05),
    at(ax * 0.55, -ay * 0.2, -0.05),
    at(ax + 0.6, -ay * 0.38, 0),
  ]);
  const fn = (t) => {
    const p = base(t);
    const fan = flat ? 0.85 + 0.3 * t : 0.45 + 1.1 * t;
    const tw = flat ? 0.3 : 0.4 + t * 1.6;
    const off = k * gap * fan;
    return [p[0] - off * 0.18, p[1] + off * Math.cos(tw), p[2] + off * Math.sin(tw) * 1.2];
  };
  return path([{ fn, w: 1 }], N);
}

export function straightForm(L, cy, N) {
  const a = at(-L.ax - 0.4, cy + 0.04, 0.35), b = at(L.ax + 0.4, cy - 0.04, -0.15);
  return path([{ fn: line(a, b), w: 1 }], N);
}

export function coilForm(L, box, N) {
  const half = Math.min(L.ax * 0.78, box.s * 2.4);
  const rad = box.s * 0.26, turns = 8;
  const a = at(-L.ax - 0.4, box.y + 0.04, 0.35);
  const b = at(L.ax + 0.4, box.y - 0.04, -0.15);
  const coil = (t) => {
    const ang = t * turns * TAU - Math.PI / 2;
    const env = Math.sin(Math.PI * t) ** 0.35;
    const [x, y, z] = rotYX(lerp(-half, half, t), Math.sin(ang) * rad * env, Math.cos(ang) * rad * env, 0.38, 0.05);
    return [box.x + x, box.y + y, z + 0.2];
  };
  const c0 = coil(0), c1 = coil(1);
  return path([
    { fn: line(a, c0), w: 0.12 },
    { fn: coil, w: 0.76 },
    { fn: line(c1, b), w: 0.12 },
  ], N);
}

export function waveForm(L, box, N) {
  const half = Math.min(L.ax * 0.82, box.s * 2.6);
  const amp = box.s * 0.3;
  const a = at(-L.ax - 0.4, box.y + 0.04, 0.35);
  const b = at(L.ax + 0.4, box.y - 0.04, -0.15);
  const wave = (t) => {
    const env = Math.sin(Math.PI * t) ** 0.6;
    const ph = t * 3.5 * TAU;
    return [box.x + lerp(-half, half, t), box.y + Math.sin(ph) * amp * env, 0.2 + Math.cos(ph) * amp * 0.9 * env];
  };
  return path([
    { fn: line(a, wave(0)), w: 0.1 },
    { fn: wave, w: 0.8 },
    { fn: line(wave(1), b), w: 0.1 },
  ], N);
}

/* A single printed layer: raster infill inside a rounded perimeter, seen from above. */
export function layerForm(L, box, N) {
  const w = box.s * 1.05, d = box.s * 0.8, rows = 11;
  const tilt = 0.95, spin = -0.45;
  const P = (x, z) => {
    const [rx, ry, rz] = rotYX(x, 0, z, spin, tilt);
    return [box.x + rx, box.y + box.s * 0.12 + ry, rz + 0.25];
  };
  const perim = (t) => {
    const a = -0.75 * Math.PI + t * TAU; // start/end at the corner where the infill begins
    const c = Math.cos(a), s = Math.sin(a);
    const k = 1 / Math.pow(Math.pow(Math.abs(c), 6) + Math.pow(Math.abs(s), 6), 1 / 6);
    return P(c * k * w * 0.5, s * k * d * 0.5);
  };
  const infill = (t) => {
    const f = t * rows;
    const r = Math.min(rows - 1, Math.floor(f));
    const u = f - r;
    const z = lerp(-d * 0.42, d * 0.42, (r + smooth(range(u, 0.86, 1))) / (rows - 1));
    const dir = r % 2 ? -1 : 1;
    const x = dir * lerp(-w * 0.43, w * 0.43, ease(range(u, 0, 0.86)));
    return P(x, z);
  };
  const a = at(-L.ax - 0.4, box.y + 0.04, 0.35);
  return path([
    { fn: line(a, perim(0)), w: 0.12 },
    { fn: perim, w: 0.22 },
    { fn: line(perim(1), infill(0)), w: 0.015 },
    { fn: infill, w: 0.645 },
  ], N);
}

/* ----------------------------------------------------- printed objects
 * Spiral ("vase mode") prints — one continuous strand stacked as layers,
 * which is exactly how a single-wall FDM print is built.
 */
const polyR = (a, n, round) => {
  if (!n) return 1;
  const seg = TAU / n;
  const m = ((a % seg) + seg) % seg - seg / 2;
  const p = Math.cos(Math.PI / n) / Math.cos(m);
  return lerp(p, 1, round);
};

export const SHAPES = {
  vase:     { turns: 22, h: 1.15, prof: (v) => 0.3 + 0.12 * Math.sin(Math.PI * (v * 0.9 + 0.05)) - 0.05 * v },
  cylinder: { turns: 20, h: 1.0, prof: (v) => 0.36 * (0.9 + 0.1 * Math.sqrt(Math.sin(Math.PI * clamp01(v * 0.98 + 0.01)))) },
  bottle:   { turns: 24, h: 1.25, prof: (v) => 0.36 - 0.13 * smooth(range(v, 0.55, 0.85)), twist: 0.6, n: 8, round: 0.55 },
  hexbox:   { turns: 18, h: 0.9, prof: () => 0.38, n: 6, round: 0.08 },
  gear:     { turns: 10, h: 0.42, prof: () => 0.4, gear: 14 },
  tri:      { turns: 22, h: 1.15, prof: (v) => 0.4 - 0.06 * v, n: 3, round: 0.22, twist: 1.05 },
  lamp:     { turns: 22, h: 1.0, prof: (v) => 0.2 + 0.26 * Math.pow(1 - v, 1.6) },
  star:     { turns: 24, h: 1.2, prof: (v) => 0.36 + 0.05 * Math.sin(Math.PI * v), n: 5, round: 0.35, twist: 1.4 },
  bushing:  { turns: 20, h: 1.0, prof: (v) => (v < 0.22 ? 0.42 : 0.26) },
  organic:  { turns: 24, h: 1.15, prof: (v) => 0.3 + 0.08 * Math.sin(Math.PI * v), wobble: 1 },
  sculpt:   { turns: 30, h: 1.3, prof: (v) => 0.22 + 0.2 * Math.sin(Math.PI * (0.12 + v * 0.8)) ** 1.4 - 0.05 * v, n: 12, round: 0.55, twist: 2.2 },
};

/* box = {x, y, s}; s scales the object; rot = {rx, ry}; z adds depth;
 * turns overrides the layer count (more, thinner layers read as a finished print). */
export function objectForm(shape, box, rot, N, z = 0, turns = SHAPES[shape].turns) {
  const S = SHAPES[shape];
  const out = new Float32Array(N * 3);
  const s = box.s, h = S.h;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const a = t * turns * TAU;
    let r = S.prof(t) * polyR(a + (S.twist || 0) * t * TAU * 0.25, S.n, S.round ?? 1);
    if (S.gear) r *= 1 + 0.07 * Math.tanh(4 * Math.sin(a * S.gear));
    if (S.wobble) r *= 1 + 0.09 * Math.sin(a * 6 + t * 9);
    const [x, y, zz] = rotYX(Math.cos(a) * r * s, (0.5 - t) * h * s, Math.sin(a) * r * s, rot.ry, rot.rx);
    const o = i * 3;
    out[o] = box.x + x * (FOCAL + z) / FOCAL;
    out[o + 1] = box.y + y * (FOCAL + z) / FOCAL;
    out[o + 2] = zz + z;
  }
  return out;
}

/* Layer pitch of an object in world units, used to size the strand so layers touch. */
export const layerPitch = (shape, s, turns = SHAPES[shape].turns) => (SHAPES[shape].h * s) / turns;

export function mix(a, b, t, out) {
  const n = a.length;
  out = out || new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = a[i] + (b[i] - a[i]) * t;
  return out;
}
