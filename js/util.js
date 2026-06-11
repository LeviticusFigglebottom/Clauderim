/* ============================================================
   CLAUDERIM — util.js
   Deterministic RNG, value noise / fBm, math & geometry helpers.
   ============================================================ */
"use strict";

const TAU = Math.PI * 2;

const U = {

  /* ---------- RNG ---------- */

  // mulberry32: fast deterministic PRNG. Returns function () -> [0,1)
  mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  },

  // 2D coordinate hash -> [0,1), seeded
  hash2(x, y, seed) {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  },

  randi(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); },
  randf(rng, a, b) { return a + rng() * (b - a); },
  choice(rng, arr) { return arr[Math.floor(rng() * arr.length)]; },
  shuffle(rng, arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },
  // weighted pick from [{w, ...}, ...]
  weighted(rng, arr) {
    let total = 0;
    for (const e of arr) total += e.w;
    let r = rng() * total;
    for (const e of arr) { r -= e.w; if (r <= 0) return e; }
    return arr[arr.length - 1];
  },

  /* ---------- Noise ---------- */

  // smooth value noise at (x, y), period 1, range [0,1)
  vnoise(x, y, seed) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const sx = xf * xf * (3 - 2 * xf);
    const sy = yf * yf * (3 - 2 * yf);
    const a = U.hash2(xi, yi, seed), b = U.hash2(xi + 1, yi, seed);
    const c = U.hash2(xi, yi + 1, seed), d = U.hash2(xi + 1, yi + 1, seed);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  },

  // fractal Brownian motion, range roughly [0,1]
  fbm(x, y, seed, octaves = 4, lac = 2.0, gain = 0.5) {
    let amp = 0.5, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * U.vnoise(x * freq, y * freq, seed + i * 1013);
      norm += amp;
      amp *= gain; freq *= lac;
    }
    return sum / norm;
  },

  /* ---------- Math ---------- */

  clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
  lerp(a, b, t) { return a + (b - a) * t; },
  smoothstep(a, b, t) { t = U.clamp((t - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); },
  dist(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return Math.sqrt(dx * dx + dy * dy); },
  dist2(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; },
  angTo(x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); },
  // smallest signed angle difference a->b in (-PI, PI]
  angDiff(a, b) {
    let d = (b - a) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
  },
  // move angle a toward b by at most step
  angApproach(a, b, step) {
    const d = U.angDiff(a, b);
    if (Math.abs(d) <= step) return b;
    return a + Math.sign(d) * step;
  },
  approach(v, target, step) {
    if (v < target) return Math.min(v + step, target);
    if (v > target) return Math.max(v - step, target);
    return v;
  },

  /* ---------- Formatting ---------- */

  fmt(n) {
    n = Math.floor(n);
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "m";
    if (n >= 10000) return (n / 1000).toFixed(1) + "k";
    return String(n);
  },
  cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); },
  roman(n) {
    const tbl = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
    let out = "";
    for (const [v, s] of tbl) while (n >= v) { out += s; n -= v; }
    return out;
  },

  /* ---------- DOM helpers ---------- */

  el(id) { return document.getElementById(id); },
  mk(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  },
  show(id) { U.el(id).classList.remove("hidden"); },
  hide(id) { U.el(id).classList.add("hidden"); },
  esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  },
};
