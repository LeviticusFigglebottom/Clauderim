/* ============================================================
   POCKET FRONTIER — sprites.js
   A tiny vector-creature renderer. Every species is a list of
   shape "parts" in a normalised [-1,1] box; one animated draw
   routine gives the whole cast breathing, blinking, flapping,
   flame-flicker, a hit-flash and a faint slide — for free.

   A part:
     { k:'ellipse', x,y, rx,ry, fill, line?, noline?, anim?, pivot? }
     { k:'circle',  x,y, r,    fill, ... }
     { k:'poly',    pts:[[x,y]...], fill, ... }
     { k:'arc',     x,y, r, a0,a1, w, stroke }        // mouths / brows
     { k:'eye',     x,y, r, look? }                    // blinking eye
   anim: 'flame' | 'wing' | 'tail' | 'float'
   Parts are drawn in array order (painter's algorithm).
   ============================================================ */
"use strict";

const SPRITES = {

  _scratch: null,
  _sctx: null,
  _sw: 0,

  _buf(px) {
    if (!SPRITES._scratch) {
      SPRITES._scratch = document.createElement("canvas");
      SPRITES._sctx = SPRITES._scratch.getContext("2d");
    }
    if (SPRITES._sw !== px) {
      SPRITES._scratch.width = px;
      SPRITES._scratch.height = px;
      SPRITES._sw = px;
    }
    return SPRITES._sctx;
  },

  darken(hex, f) {
    const c = U.hex(hex);
    return `rgb(${Math.round(c[0] * (1 - f))},${Math.round(c[1] * (1 - f))},${Math.round(c[2] * (1 - f))})`;
  },
  lighten(hex, f) {
    const c = U.hex(hex);
    return `rgb(${Math.round(c[0] + (255 - c[0]) * f)},${Math.round(c[1] + (255 - c[1]) * f)},${Math.round(c[2] + (255 - c[2]) * f)})`;
  },

  /* draw a species' form centred at (cx,cy).
     size = half-height in px. opts:
       flip   mirror horizontally (player's side faces right)
       t      seconds, for idle animation
       phase  per-instance offset so twins don't sync
       flash  0..1 white hit-flash
       alpha  0..1
       faint  0..1 → slides down & fades (fainting)
       squash 0..1 → transient squash on impact                        */
  draw(ctx, form, cx, cy, size, opts) {
    opts = opts || {};
    const t = opts.t || 0, phase = opts.phase || 0;
    const box = Math.ceil(size * 2.9);
    const g = SPRITES._buf(box);
    g.clearRect(0, 0, box, box);
    g.save();
    g.translate(box / 2, box / 2 + size * 0.12);
    if (opts.flip) g.scale(-1, 1);

    // idle breathing (subtle squash-stretch) + impact squash
    const breath = 1 + 0.03 * Math.sin(t * 2.3 + phase);
    const sq = opts.squash || 0;
    g.scale(breath * (1 + sq * 0.35), (1 / breath) * (1 - sq * 0.45));

    for (const p of form) SPRITES._part(g, p, size, t, phase);
    g.restore();

    if (opts.flash) {
      g.save();
      g.globalCompositeOperation = "source-atop";
      g.globalAlpha = opts.flash;
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, box, box);
      g.restore();
    }

    const faint = opts.faint || 0;
    ctx.save();
    ctx.globalAlpha = (opts.alpha == null ? 1 : opts.alpha) * (1 - faint * 0.9);
    ctx.drawImage(g.canvas, cx - box / 2, cy - box / 2 - size * 0.12 + faint * size * 1.4);
    ctx.restore();
  },

  _part(g, p, S, t, phase) {
    g.save();
    const fill = p.fill;
    const lw = Math.max(1.1, S * 0.052);

    // per-part animation transforms
    if (p.anim === "wing") {
      const pv = p.pivot || [p.x, p.y];
      g.translate(pv[0] * S, pv[1] * S);
      g.rotate(0.42 * Math.sin(t * 9 + phase));
      g.translate(-pv[0] * S, -pv[1] * S);
    } else if (p.anim === "tail") {
      const pv = p.pivot || [p.x, p.y];
      g.translate(pv[0] * S, pv[1] * S);
      g.rotate(0.14 * Math.sin(t * 2.4 + phase));
      g.translate(-pv[0] * S, -pv[1] * S);
    } else if (p.anim === "float") {
      g.translate(0, 0.05 * S * Math.sin(t * 3 + phase + 1));
    }

    let fx = 1, fy = 1;
    if (p.anim === "flame") {
      fx = 1 + 0.10 * Math.sin(t * 17 + phase);
      fy = 1 + 0.18 * Math.sin(t * 21 + phase * 1.7);
    }

    g.fillStyle = fill;
    g.strokeStyle = p.line || SPRITES.darken(fill || "#000", 0.42);
    g.lineWidth = lw;
    g.lineJoin = "round";

    if (p.k === "ellipse") {
      g.beginPath();
      g.ellipse(p.x * S, p.y * S, p.rx * S * fx, p.ry * S * fy, 0, 0, TAU);
      g.fill(); if (!p.noline) g.stroke();
    } else if (p.k === "circle") {
      g.beginPath();
      g.arc(p.x * S, p.y * S, p.r * S, 0, TAU);
      g.fill(); if (!p.noline) g.stroke();
    } else if (p.k === "poly") {
      g.beginPath();
      for (let i = 0; i < p.pts.length; i++) {
        const px = p.pts[i][0] * S * fx, py = p.pts[i][1] * S * fy;
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.closePath();
      g.fill(); if (!p.noline) g.stroke();
    } else if (p.k === "arc") {
      g.beginPath();
      g.arc(p.x * S, p.y * S, p.r * S, p.a0, p.a1);
      g.lineWidth = (p.w || 0.05) * S;
      g.strokeStyle = p.stroke || "#222";
      g.lineCap = "round";
      g.stroke();
    } else if (p.k === "eye") {
      const blinkT = (t * 1 + phase) % 3.4;
      const blinking = blinkT < 0.12;
      if (blinking) {
        g.strokeStyle = "#1a1a1a"; g.lineWidth = lw; g.lineCap = "round";
        g.beginPath();
        g.moveTo((p.x - p.r) * S, p.y * S);
        g.lineTo((p.x + p.r) * S, p.y * S);
        g.stroke();
      } else {
        g.fillStyle = "#20232b";
        g.beginPath(); g.arc(p.x * S, p.y * S, p.r * S, 0, TAU); g.fill();
        g.fillStyle = "#fff";
        g.beginPath(); g.arc((p.x - p.r * 0.3) * S, (p.y - p.r * 0.35) * S, p.r * 0.4 * S, 0, TAU); g.fill();
      }
    }
    g.restore();
  },

  // Convenience: draw the little ground shadow a creature stands on.
  shadow(ctx, cx, cy, w) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.ellipse(cx, cy, w, w * 0.28, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  },
};

if (typeof module !== "undefined" && module.exports) module.exports = { SPRITES };
