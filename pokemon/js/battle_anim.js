/* ============================================================
   POCKET FRONTIER — battle_anim.js
   A little particle + effects engine that turns a move into
   light and motion: fire streams, water arcs, forked lightning,
   spinning leaves, screen shake and colour flashes. The battle
   scene owns one FX instance and asks it to play each move.
   ============================================================ */
"use strict";

class FX {
  constructor() {
    this.parts = [];
    this.timeline = [];   // {at, fn}
    this.t = 0;
    this.shake = 0; this.shakeDecay = 0;
    this.flash = 0; this.flashColor = "#fff";
  }
  clear() { this.parts.length = 0; this.timeline.length = 0; this.shake = 0; this.flash = 0; }

  addShake(mag) { this.shake = Math.max(this.shake, mag); this.shakeDecay = mag / 0.4; }
  doFlash(color, a) { this.flash = a; this.flashColor = color; }
  at(delay, fn) { this.timeline.push({ at: this.t + delay, fn }); }

  spawn(o) {
    this.parts.push(Object.assign({
      x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 1, life: 0.5, max: 0.5,
      r: 3, color: "#fff", kind: "dot", glow: false, spin: 0, ang: 0, grow: 0,
    }, o));
  }

  // a burst of `n` particles around (x,y)
  burst(x, y, n, o) {
    for (let i = 0; i < n; i++) {
      const a = U.randf(0, TAU), sp = U.randf(o.spdMin || 40, o.spdMax || 140);
      this.spawn(Object.assign({}, o, {
        x: x + U.randf(-4, 4), y: y + U.randf(-4, 4),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: U.randf(o.lifeMin || 0.3, o.lifeMax || 0.7),
      }));
    }
  }

  update(dt) {
    this.t += dt;
    // due timeline items
    for (let i = this.timeline.length - 1; i >= 0; i--) {
      if (this.t >= this.timeline[i].at) { const f = this.timeline[i].fn; this.timeline.splice(i, 1); f(); }
    }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - this.shakeDecay * dt);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.6);
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy = p.vy * Math.pow(p.drag, dt * 60) + p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.ang += p.spin * dt;
      p.r += p.grow * dt;
    }
  }

  get busy() { return this.parts.length > 0 || this.timeline.length > 0; }

  draw(ctx) {
    for (const p of this.parts) {
      const k = U.clamp(p.life / p.max, 0, 1);
      ctx.save();
      if (p.glow) ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = p.fade === false ? 1 : k;
      ctx.fillStyle = p.color; ctx.strokeStyle = p.color;
      if (p.kind === "dot") {
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.5, p.r), 0, TAU); ctx.fill();
      } else if (p.kind === "streak") {
        ctx.lineWidth = p.r; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05); ctx.stroke();
      } else if (p.kind === "ring") {
        ctx.lineWidth = p.lw || 3;
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, p.r), 0, TAU); ctx.stroke();
      } else if (p.kind === "leaf") {
        ctx.translate(p.x, p.y); ctx.rotate(p.ang);
        ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.45, 0, 0, TAU); ctx.fill();
      } else if (p.kind === "star") {
        ctx.translate(p.x, p.y); ctx.rotate(p.ang);
        ctx.beginPath();
        for (let a = 0; a < 4; a++) { const an = a / 4 * TAU; ctx.lineTo(Math.cos(an) * p.r, Math.sin(an) * p.r); ctx.lineTo(Math.cos(an + 0.39) * p.r * 0.4, Math.sin(an + 0.39) * p.r * 0.4); }
        ctx.closePath(); ctx.fill();
      } else if (p.kind === "bolt") {
        ctx.lineWidth = p.r; ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.beginPath();
        for (let j = 0; j < p.path.length; j++) { const q = p.path[j]; j ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawFlash(ctx, w, h) {
    if (this.flash > 0) {
      ctx.save();
      ctx.globalAlpha = U.clamp(this.flash, 0, 0.85);
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  shakeOffset() {
    if (this.shake <= 0) return [0, 0];
    return [U.randf(-this.shake, this.shake), U.randf(-this.shake, this.shake)];
  }

  /* ----- forked lightning between two points ----- */
  _bolt(x0, y0, x1, y1, segs) {
    const path = [[x0, y0]];
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      path.push([U.lerp(x0, x1, t) + U.randf(-16, 16), U.lerp(y0, y1, t) + U.randf(-16, 16)]);
    }
    path.push([x1, y1]);
    return path;
  }

  /* ============================================================
     playMove — spawn the right effect. Returns
       { dur, lunge }  (lunge = attacker should dash forward)
     from/to are {x,y} screen positions of attacker & target.
     ============================================================ */
  playMove(moveKey, from, to) {
    const mv = MOVES[moveKey] || { type: "normal", cat: "physical" };
    const type = mv.type, contact = mv.cat === "physical";
    const col = TYPES.color[type] || "#fff";
    let dur = 0.7, lunge = false;

    const stream = (color, kind, n, speed, glow) => {
      for (let i = 0; i < n; i++) {
        const t = i / n;
        this.at(0.12 + t * 0.35, () => {
          const a = Math.atan2(to.y - from.y, to.x - from.x) + U.randf(-0.25, 0.25);
          this.spawn({
            x: U.lerp(from.x, to.x, 0.2), y: U.lerp(from.y, to.y, 0.2),
            vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
            r: U.randf(3, 6), color, kind, glow, drag: 0.98,
            life: U.randf(0.35, 0.6), max: 0.6,
          });
        });
      }
      this.at(0.5, () => this.burst(to.x, to.y, 10, { color, kind: "dot", glow, spdMin: 30, spdMax: 120, lifeMin: 0.25, lifeMax: 0.5, r: 3, drag: 0.9 }));
    };

    switch (type) {
      case "fire":
        stream("#ff7a2a", "dot", 16, 360, true);
        this.at(0.2, () => this.doFlash("#ff8a3a", 0.18));
        this.at(0.55, () => { this.burst(to.x, to.y, 14, { color: "#ffcf4d", kind: "dot", glow: true, spdMin: 40, spdMax: 160, r: 4, lifeMin: 0.2, lifeMax: 0.5, drag: 0.9 }); this.addShake(4); });
        dur = 0.95; break;
      case "water":
        stream("#5aa0f0", "dot", 16, 380, false);
        this.at(0.55, () => this.burst(to.x, to.y, 16, { color: "#bfe0ff", kind: "dot", spdMin: 40, spdMax: 150, g: 260, r: 3, lifeMin: 0.3, lifeMax: 0.6 }));
        dur = 0.9; break;
      case "electric":
        for (let i = 0; i < 3; i++) this.at(0.15 + i * 0.12, () => {
          this.spawn({ kind: "bolt", path: this._bolt(to.x + U.randf(-30, 30), to.y - 130, to.x, to.y, 6), r: U.randf(2.5, 4.5), color: i % 2 ? "#fff" : "#fff36a", glow: true, life: 0.18, max: 0.18, drag: 1 });
          this.doFlash("#fdfbe0", 0.3); this.addShake(5);
        });
        this.at(0.2, () => this.burst(to.x, to.y, 12, { color: "#fff36a", kind: "star", glow: true, spdMin: 60, spdMax: 180, r: 5, spin: 8, lifeMin: 0.2, lifeMax: 0.45 }));
        dur = 0.85; break;
      case "grass":
        for (let i = 0; i < 14; i++) this.at(0.1 + i * 0.03, () => {
          const a = Math.atan2(to.y - from.y, to.x - from.x) + U.randf(-0.3, 0.3);
          this.spawn({ x: U.lerp(from.x, to.x, 0.15), y: U.lerp(from.y, to.y, 0.15), vx: Math.cos(a) * 320, vy: Math.sin(a) * 320, kind: "leaf", r: U.randf(6, 10), color: i % 2 ? "#67c94a" : "#4aa838", spin: U.randf(-12, 12), drag: 0.99, life: 0.55, max: 0.55 });
        });
        if (mv.drain) this.at(0.6, () => { for (let i = 0; i < 10; i++) this.at(i * 0.03, () => this.spawn({ x: to.x + U.randf(-20, 20), y: to.y + U.randf(-20, 20), vx: (from.x - to.x) * 1.4, vy: (from.y - to.y) * 1.4, kind: "star", r: 4, color: "#9cff7a", glow: true, drag: 0.98, life: 0.5, max: 0.5 })); });
        dur = mv.drain ? 1.15 : 0.85; break;
      case "ice":
        stream("#bfeaff", "star", 12, 340, true);
        this.at(0.55, () => this.burst(to.x, to.y, 14, { color: "#dff4ff", kind: "star", spdMin: 40, spdMax: 150, r: 4, spin: 6, lifeMin: 0.3, lifeMax: 0.6 }));
        dur = 0.9; break;
      case "poison":
        stream("#c86fd0", "dot", 12, 300, false);
        this.at(0.5, () => this.burst(to.x, to.y, 12, { color: "#d98ae0", kind: "dot", spdMin: 30, spdMax: 120, g: 120, r: 4, lifeMin: 0.3, lifeMax: 0.6 }));
        dur = 0.85; break;
      case "psychic":
        for (let i = 0; i < 4; i++) this.at(0.1 + i * 0.1, () => this.spawn({ x: to.x, y: to.y, r: 6, grow: 260, kind: "ring", lw: 4, color: "#f85a86", glow: true, drag: 1, life: 0.5, max: 0.5 }));
        this.at(0.25, () => this.doFlash("#f85a86", 0.16));
        dur = 0.9; break;
      case "ghost":
        this.at(0.1, () => this.spawn({ x: from.x, y: from.y, vx: (to.x - from.x) * 1.6, vy: (to.y - from.y) * 1.6, r: 16, color: "#6a5596", kind: "dot", glow: true, drag: 1, life: 0.45, max: 0.45 }));
        this.at(0.5, () => this.burst(to.x, to.y, 14, { color: "#8a6ab0", kind: "dot", glow: true, spdMin: 40, spdMax: 150, r: 5, lifeMin: 0.3, lifeMax: 0.6 }));
        dur = 0.85; break;
      case "rock": case "ground":
        for (let i = 0; i < 8; i++) this.at(0.1 + i * 0.04, () => this.spawn({ x: U.lerp(from.x, to.x, 0.2), y: from.y - 20, vx: (to.x - from.x) * U.randf(0.8, 1.4), vy: -U.randf(120, 220), g: 700, r: U.randf(5, 9), color: i % 2 ? "#9c8a66" : "#7a6a4a", kind: "dot", drag: 1, life: 0.7, max: 0.7 }));
        this.at(0.5, () => { this.addShake(8); this.burst(to.x, to.y, 10, { color: "#8a7654", kind: "dot", spdMin: 40, spdMax: 140, g: 400, r: 5, lifeMin: 0.3, lifeMax: 0.6 }); });
        dur = 0.95; break;
      case "flying":
        for (let i = 0; i < 5; i++) this.at(0.1 + i * 0.06, () => this.spawn({ x: to.x - 40 + i * 6, y: to.y - 30 + i * 12, vx: 260, vy: 60, kind: "streak", r: 4, color: "#eef2ff", drag: 0.96, life: 0.3, max: 0.3 }));
        lunge = contact; dur = 0.7; break;
      case "dragon":
        for (let i = 0; i < 16; i++) this.at(0.1 + i * 0.03, () => { const a = i / 16 * TAU; this.spawn({ x: to.x, y: to.y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120 - 40, kind: "dot", r: 5, color: i % 2 ? "#7a52e0" : "#59c0b0", glow: true, drag: 0.95, life: 0.5, max: 0.5 }); });
        this.at(0.3, () => this.addShake(5)); dur = 0.9; break;
      case "bug":
        stream("#9fb018", "dot", 12, 320, false); dur = 0.8; break;
      case "steel":
        this.at(0.2, () => this.burst(to.x, to.y, 12, { color: "#dfe3f0", kind: "star", glow: true, spdMin: 60, spdMax: 170, r: 4, spin: 10, lifeMin: 0.2, lifeMax: 0.4 }));
        lunge = contact; dur = 0.7; break;
      case "fairy":
        for (let i = 0; i < 16; i++) this.at(0.1 + i * 0.03, () => this.spawn({ x: U.lerp(from.x, to.x, U.randf(0.2, 0.9)), y: U.lerp(from.y, to.y, U.randf(0.2, 0.9)) + U.randf(-20, 20), kind: "star", r: U.randf(3, 6), color: i % 2 ? "#ee92ac" : "#fff0f5", glow: true, spin: 6, drag: 1, life: 0.5, max: 0.5 }));
        dur = 0.85; break;
      default: // normal & anything else → contact impact
        lunge = contact;
        this.at(contact ? 0.22 : 0.1, () => { this.burst(to.x, to.y, 10, { color: "#fff", kind: "dot", spdMin: 40, spdMax: 150, r: 4, lifeMin: 0.15, lifeMax: 0.35, drag: 0.9 }); this.addShake(4); });
        dur = 0.65;
    }
    if (mv.cat === "status") { lunge = false; dur = 0.5; }
    return { dur, lunge };
  }

  // rising sparkles for a stat boost / falling for a drop
  statPuff(x, y, up) {
    for (let i = 0; i < 12; i++) this.at(i * 0.03, () =>
      this.spawn({ x: x + U.randf(-24, 24), y: y + (up ? 20 : -20), vx: U.randf(-20, 20), vy: up ? -U.randf(60, 130) : U.randf(60, 130), kind: "star", r: U.randf(3, 5), color: up ? "#7affd0" : "#ff9a9a", glow: true, spin: 5, drag: 1, life: 0.6, max: 0.6 }));
  }
  statusPuff(x, y, status) {
    const c = { brn: "#ff6a2a", psn: "#c86fd0", par: "#f6d23a", slp: "#8aa0c0", frz: "#bfeaff" }[status] || "#fff";
    this.burst(x, y, 14, { color: c, kind: "dot", glow: true, spdMin: 30, spdMax: 110, r: 4, lifeMin: 0.3, lifeMax: 0.6, drag: 0.94 });
  }
}

if (typeof module !== "undefined" && module.exports) module.exports = { FX };
