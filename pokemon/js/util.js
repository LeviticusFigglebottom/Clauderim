/* ============================================================
   POCKET FRONTIER — util.js
   Deterministic RNG, math, tween & DOM helpers shared by every
   system. Zero dependencies; loaded first.
   ============================================================ */
"use strict";

const TAU = Math.PI * 2;

const U = {

  /* ---------- RNG ----------
     A single global stream. Battles want *some* luck, so unlike the
     worldgen in the parent project we don't reseed per action — we
     keep one fast PRNG and reseed only on new game / load.          */

  _a: (Date.now ? (Date.now() & 0xffffffff) : 123456789) >>> 0,

  seed(n) { U._a = (n >>> 0) || 1; },

  // mulberry32 core
  rng() {
    let a = U._a;
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    U._a = a;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  },

  randi(a, b) { return a + Math.floor(U.rng() * (b - a + 1)); },  // inclusive
  randf(a, b) { return a + U.rng() * (b - a); },
  chance(p) { return U.rng() < p; },
  choice(arr) { return arr[Math.floor(U.rng() * arr.length)]; },
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(U.rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },
  // weighted pick from [{w,...}]
  weighted(arr) {
    let total = 0;
    for (const e of arr) total += e.w;
    let r = U.rng() * total;
    for (const e of arr) { r -= e.w; if (r <= 0) return e; }
    return arr[arr.length - 1];
  },

  hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  },

  /* ---------- Math ---------- */
  clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
  lerp(a, b, t) { return a + (b - a) * t; },
  smoothstep(t) { t = U.clamp(t, 0, 1); return t * t * (3 - 2 * t); },
  easeOutBack(t) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); },
  easeInCubic(t) { return t * t * t; },
  approach(v, target, step) {
    if (v < target) return Math.min(v + step, target);
    if (v > target) return Math.max(v - step, target);
    return v;
  },

  /* ---------- Formatting ---------- */
  cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; },
  pad(n, w) { let s = String(n); while (s.length < w) s = " " + s; return s; },

  /* ---------- DOM ---------- */
  el(id) { return document.getElementById(id); },
  mk(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  },
  show(id) { const e = U.el(id); if (e) e.classList.remove("hidden"); },
  hide(id) { const e = U.el(id); if (e) e.classList.add("hidden"); },
  esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); },

  /* ---------- Color ---------- */
  // mix two "#rrggbb" by t
  mix(c1, c2, t) {
    const a = U.hex(c1), b = U.hex(c2);
    const r = Math.round(U.lerp(a[0], b[0], t));
    const g = Math.round(U.lerp(a[1], b[1], t));
    const bl = Math.round(U.lerp(a[2], b[2], t));
    return `rgb(${r},${g},${bl})`;
  },
  hex(c) {
    c = c.replace("#", "");
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
  },
};

// Node smoke-test export (ignored in browser)
if (typeof module !== "undefined" && module.exports) module.exports = { U, TAU };
