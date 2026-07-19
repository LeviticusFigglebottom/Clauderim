/* ============================================================
   POCKET FRONTIER — overworld.js
   Walking the map: smooth grid movement, a bobbing walk cycle,
   tall-grass encounters, trainer line-of-sight, and talking to
   signs & people. Renders a camera view of WORLD and hands off
   to the battle scene through callbacks on `game`.
   ============================================================ */
"use strict";

const TS = 40;                             // tile size in px

class Overworld {
  constructor(game) {
    this.game = game;
    this.p = { gx: WORLD.start.x, gy: WORLD.start.y, dir: WORLD.start.dir, moving: false, mt: 0, fromX: WORLD.start.x, fromY: WORLD.start.y, frame: 0, run: false };
    this.cam = { x: 0, y: 0 };
    this.t = 0;
    this.held = {};                        // direction keys currently down
    this.msg = null;                       // {lines, i, shown, done}
    this.pendingTrainer = null;            // {npc, timer}
    this.defeated = game.state.defeated || {}; // trainer flags by name
    this.rustle = null;                    // grass rustle fx {x,y,t}
    this.banner = { text: "Meadowlink Town", t: 2.4 };
    this._snapCam();
  }

  /* ---------- input ---------- */
  setDir(dir, down) { if (down) this.held[dir] = true; else delete this.held[dir]; }
  press(key) {
    if (this.msg) { this._advanceMsg(); return; }
    if (this.pendingTrainer) return;
    if (key === "a") this.interact();
    else if (key === "start") this.game.openMenu();
  }
  setRun(on) { this.p.run = on; }

  _activeDir() {
    // last-pressed priority: check a fixed order but prefer any held
    for (const d of ["up", "down", "left", "right"]) if (this.held[d]) return d;
    return null;
  }

  /* ---------- update ---------- */
  update(dt) {
    this.t += dt;
    if (this.banner.t > 0) this.banner.t -= dt;
    if (this.rustle) { this.rustle.t += dt; if (this.rustle.t > 0.45) this.rustle = null; }

    if (this.msg) { if (!this.msg.done) { this.msg.shown += dt * 60; if (this.msg.shown >= this.msg.lines[this.msg.i].length) { this.msg.shown = this.msg.lines[this.msg.i].length; this.msg.done = true; } } this._snapCam(); return; }

    if (this.pendingTrainer) {
      this.pendingTrainer.timer -= dt;
      if (this.pendingTrainer.timer <= 0) { const npc = this.pendingTrainer.npc; this.pendingTrainer = null; this.game.startTrainerBattle(npc); }
      return;
    }

    if (this.p.moving) {
      this.p.mt += dt / (this.p.run ? 0.11 : 0.16);
      if (this.p.mt >= 1) { this.p.mt = 1; this.p.moving = false; this.p.frame ^= 1; this._onArrive(); }
    } else {
      const d = this._activeDir();
      if (d) this._tryStep(d);
      else this._checkTrainers();
    }
    this._snapCam();
  }

  _tryStep(dir) {
    this.p.dir = dir;
    const dx = dir === "left" ? -1 : dir === "right" ? 1 : 0;
    const dy = dir === "up" ? -1 : dir === "down" ? 1 : 0;
    const nx = this.p.gx + dx, ny = this.p.gy + dy;
    if (WORLD.isSolid(nx, ny) || this._npcAt(nx, ny)) { return; }        // bump — face only
    this.p.fromX = this.p.gx; this.p.fromY = this.p.gy;
    this.p.gx = nx; this.p.gy = ny; this.p.moving = true; this.p.mt = 0;
  }

  _onArrive() {
    // victory gate
    if (this.p.gx === WORLD.gate.x && this.p.gy === WORLD.gate.y) {
      if (this.defeated["Champion Vera"]) { this.game.win(); return; }
    }
    // heal door
    const tile = WORLD.tile(this.p.gx, this.p.gy);
    if (tile === "c") { this.game.healParty(); this.showMessage(["Your Pokémon are fully healed!", "We hope to see you again!"]); return; }
    if (tile === "m") { this.game.openShop(); return; }
    if (tile === "g") {
      this.rustle = { x: this.p.gx, y: this.p.gy, t: 0 };
      if (U.rng() < WORLD.encounterRate) {
        const enc = WORLD.rollEncounter();
        this.game.startWildBattle(enc);
      }
    }
  }

  _checkTrainers() {
    for (const npc of WORLD.npcs) {
      if (!npc.trainer || !npc.trainer.sight || this.defeated[npc.name]) continue;
      const dx = npc.dir === "left" ? -1 : npc.dir === "right" ? 1 : 0;
      const dy = npc.dir === "up" ? -1 : npc.dir === "down" ? 1 : 0;
      for (let i = 1; i <= npc.trainer.sight; i++) {
        const tx = npc.x + dx * i, ty = npc.y + dy * i;
        if (WORLD.isSolid(tx, ty)) break;
        if (tx === this.p.gx && ty === this.p.gy) {
          this.pendingTrainer = { npc, timer: 0.7 };
          this.p.dir = { up: "down", down: "up", left: "right", right: "left" }[npc.dir];
          return;
        }
      }
    }
  }

  _npcAt(x, y) { return WORLD.npcs.find(n => n.x === x && n.y === y); }

  /* ---------- interaction ---------- */
  interact() {
    const dx = this.p.dir === "left" ? -1 : this.p.dir === "right" ? 1 : 0;
    const dy = this.p.dir === "up" ? -1 : this.p.dir === "down" ? 1 : 0;
    const fx = this.p.gx + dx, fy = this.p.gy + dy;
    const npc = this._npcAt(fx, fy);
    if (npc) { this._talk(npc); return; }
    const tile = WORLD.tile(fx, fy);
    const sign = WORLD.signs[fx + "," + fy];
    if (sign) { this.showMessage([sign]); return; }
    if (tile === "d") { this.showMessage(["It's locked."]); return; }
    if (tile === "c") { this.game.healParty(); this.showMessage(["Welcome! Let me heal your Pokémon.", "…All better! We hope to see you again."]); return; }
    if (tile === "s") { this.showMessage(["The sign is weathered and blank."]); return; }
  }

  _talk(npc) {
    npc.facing = { up: "down", down: "up", left: "right", right: "left" }[this.p.dir];
    if (npc.trainer && !this.defeated[npc.name]) {
      this.showMessage([npc.trainer.intro], () => this.game.startTrainerBattle(npc));
    } else {
      this.showMessage(npc.lines || ["…"]);
    }
  }

  showMessage(lines, onDone) {
    this.msg = { lines: Array.isArray(lines) ? lines : [lines], i: 0, shown: 0, done: false, onDone };
  }
  _advanceMsg() {
    if (!this.msg.done) { this.msg.shown = this.msg.lines[this.msg.i].length; this.msg.done = true; return; }
    this.msg.i++;
    if (this.msg.i >= this.msg.lines.length) { const cb = this.msg.onDone; this.msg = null; if (cb) cb(); }
    else { this.msg.shown = 0; this.msg.done = false; }
  }

  markDefeated(name) { this.defeated[name] = true; this.game.state.defeated = this.defeated; }

  /* ---------- camera ---------- */
  _playerPix() {
    const ex = U.lerp(this.p.fromX, this.p.gx, this.p.moving ? U.smoothstep(this.p.mt) : 1);
    const ey = U.lerp(this.p.fromY, this.p.gy, this.p.moving ? U.smoothstep(this.p.mt) : 1);
    return { x: ex * TS + TS / 2, y: ey * TS + TS / 2 };
  }
  _snapCam() {
    const pp = this._playerPix();
    this.cam.x = U.clamp(pp.x - BW / 2, 0, WORLD.W * TS - BW);
    this.cam.y = U.clamp(pp.y - BH / 2, 0, WORLD.H * TS - BH);
    if (WORLD.W * TS < BW) this.cam.x = (WORLD.W * TS - BW) / 2;
    if (WORLD.H * TS < BH) this.cam.y = (WORLD.H * TS - BH) / 2;
  }

  /* ---------- render ---------- */
  render(ctx) {
    ctx.fillStyle = "#6ab04a"; ctx.fillRect(0, 0, BW, BH);
    const x0 = Math.floor(this.cam.x / TS), y0 = Math.floor(this.cam.y / TS);
    const x1 = Math.ceil((this.cam.x + BW) / TS), y1 = Math.ceil((this.cam.y + BH) / TS);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this._tile(ctx, x, y);

    // people & player sorted by y for depth
    const actors = WORLD.npcs.map(n => ({ npc: n, y: n.y })).concat([{ player: true, y: this.p.gy }]);
    actors.sort((a, b) => a.y - b.y);
    for (const a of actors) {
      if (a.player) this._drawPlayer(ctx);
      else this._drawNpc(ctx, a.npc);
    }

    if (this.rustle) this._drawRustle(ctx);
    this._drawHud(ctx);
    if (this.msg) this._drawMsg(ctx);
    if (this.banner.t > 0) this._drawBanner(ctx);
  }

  _sx(x) { return x * TS - this.cam.x; }
  _sy(y) { return y * TS - this.cam.y; }

  _tile(ctx, x, y) {
    const c0 = WORLD.tile(x, y);
    const c = c0 === "@" ? "." : c0;
    const px = this._sx(x), py = this._sy(y);
    // grass base under everything
    const shade = ((x + y) & 1) === 0;
    ctx.fillStyle = shade ? "#6fb84e" : "#68b048";
    ctx.fillRect(px, py, TS, TS);
    if (c === "t") { this._tree(ctx, px, py); return; }
    if (c === "g") { this._grass(ctx, px, py, x, y); return; }
    if (c === "w") { this._water(ctx, px, py); return; }
    if (c === "p") { ctx.fillStyle = "#d9c48f"; ctx.fillRect(px + 1, py + 1, TS - 2, TS - 2); this._dots(ctx, px, py, "#c9b27a", x, y); return; }
    if (c === "r") { ctx.fillStyle = "#9a9082"; ctx.beginPath(); ctx.ellipse(px + TS / 2, py + TS / 2, 15, 12, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = "#6f6659"; ctx.stroke(); return; }
    if (c === "f") { this._fence(ctx, px, py); return; }
    if (c === "F") { this._flowers(ctx, px, py, x, y); return; }
    if (c === "s") { this._sign(ctx, px, py); return; }
    if (c === "G") { ctx.fillStyle = "#b9b2c9"; ctx.fillRect(px, py, TS, TS); ctx.fillStyle = "#8a84a0"; ctx.fillRect(px + 4, py, 4, TS); ctx.fillRect(px + TS - 8, py, 4, TS); return; }
    if (c === "C" || c === "c" || c === "M" || c === "m" || c === "b" || c === "d") this._building(ctx, px, py, c);
  }

  _dots(ctx, px, py, col, x, y) {
    ctx.fillStyle = col;
    for (let i = 0; i < 3; i++) { const h = U.hash2 ? 0 : 0; const rx = ((x * 7 + i * 13 + y * 3) % 5) * 7, ry = ((y * 11 + i * 5 + x) % 5) * 7; ctx.fillRect(px + 6 + rx % (TS - 12), py + 6 + ry % (TS - 12), 2, 2); }
  }
  _tree(ctx, px, py) {
    ctx.fillStyle = "#6a4a2a"; ctx.fillRect(px + TS / 2 - 4, py + TS - 14, 8, 12);
    ctx.fillStyle = "#2f7a34"; ctx.beginPath(); ctx.arc(px + TS / 2, py + TS / 2 - 2, 16, 0, TAU); ctx.fill();
    ctx.fillStyle = "#3c9440"; ctx.beginPath(); ctx.arc(px + TS / 2 - 5, py + TS / 2 - 6, 9, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#245c28"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px + TS / 2, py + TS / 2 - 2, 16, 0, TAU); ctx.stroke();
  }
  _grass(ctx, px, py, x, y) {
    ctx.fillStyle = "#4c9a3c"; ctx.fillRect(px, py, TS, TS);
    ctx.strokeStyle = "#3c8030"; ctx.lineWidth = 2; ctx.lineCap = "round";
    const sway = Math.sin(this.t * 2 + x * 0.7 + y) * 2;
    for (let i = 0; i < 4; i++) {
      const bx = px + 7 + i * 8;
      ctx.beginPath(); ctx.moveTo(bx, py + TS - 5); ctx.lineTo(bx + sway, py + TS - 18); ctx.stroke();
    }
    ctx.fillStyle = "#5fae48"; for (let i = 0; i < 3; i++) ctx.fillRect(px + 5 + i * 11, py + TS - 5, 3, 3);
  }
  _water(ctx, px, py) {
    ctx.fillStyle = "#4f97c8"; ctx.fillRect(px, py, TS, TS);
    ctx.strokeStyle = "#7fbfe0"; ctx.lineWidth = 2; ctx.lineCap = "round";
    for (let i = 0; i < 2; i++) { const yy = py + 12 + i * 14 + Math.sin(this.t * 2 + px + i) * 2; ctx.beginPath(); ctx.moveTo(px + 6, yy); ctx.quadraticCurveTo(px + TS / 2, yy - 4, px + TS - 6, yy); ctx.stroke(); }
  }
  _fence(ctx, px, py) {
    ctx.strokeStyle = "#a9895f"; ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(px + 8, py + 14); ctx.lineTo(px + 8, py + TS - 6); ctx.moveTo(px + TS - 8, py + 14); ctx.lineTo(px + TS - 8, py + TS - 6);
    ctx.moveTo(px + 2, py + 20); ctx.lineTo(px + TS - 2, py + 20); ctx.moveTo(px + 2, py + 30); ctx.lineTo(px + TS - 2, py + 30); ctx.stroke();
  }
  _flowers(ctx, px, py, x, y) {
    const cols = ["#f06fa6", "#f2d23a", "#ee92ac", "#f0803a"];
    for (let i = 0; i < 3; i++) { const cx = px + 8 + ((x * 5 + i * 11) % 22), cy = py + 10 + ((y * 7 + i * 9) % 22); ctx.fillStyle = cols[(x + y + i) % 4]; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, TAU); ctx.fill(); ctx.fillStyle = "#ffe36a"; ctx.beginPath(); ctx.arc(cx, cy, 1.6, 0, TAU); ctx.fill(); }
  }
  _sign(ctx, px, py) {
    ctx.fillStyle = "#8a6a3a"; ctx.fillRect(px + TS / 2 - 2, py + 16, 4, TS - 20);
    ctx.fillStyle = "#c8a86a"; ctx.fillRect(px + 8, py + 8, TS - 16, 16);
    ctx.strokeStyle = "#6a4a20"; ctx.lineWidth = 1.5; ctx.strokeRect(px + 8, py + 8, TS - 16, 16);
  }
  _building(ctx, px, py, c) {
    const roof = c === "C" || c === "c" ? "#e0574a" : c === "M" || c === "m" ? "#3a8fd0" : "#b58a5a";
    const wall = c === "C" || c === "c" ? "#f2e2df" : c === "M" || c === "m" ? "#dfeefb" : "#efe3d0";
    ctx.fillStyle = wall; ctx.fillRect(px, py, TS, TS);
    ctx.fillStyle = roof; ctx.fillRect(px, py, TS, TS * 0.5);
    ctx.strokeStyle = "rgba(0,0,0,0.15)"; ctx.strokeRect(px + 0.5, py + 0.5, TS - 1, TS - 1);
    if (c === "c" || c === "m" || c === "d") {
      ctx.fillStyle = "#5a3a20"; ctx.fillRect(px + TS / 2 - 8, py + TS - 20, 16, 20);
      ctx.fillStyle = "#8fd0ff"; ctx.fillRect(px + TS / 2 - 6, py + TS - 18, 12, 8);
      if (c === "c") { ctx.fillStyle = "#e0574a"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center"; ctx.fillText("♥", px + TS / 2, py + 16); }
      if (c === "m") { ctx.fillStyle = "#2a6ab0"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "center"; ctx.fillText("$", px + TS / 2, py + 16); }
    }
  }

  _drawRustle(ctx) {
    const px = this._sx(this.rustle.x), py = this._sy(this.rustle.y);
    const k = this.rustle.t / 0.45;
    ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = "#3c8030"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU - k * 2; ctx.beginPath(); ctx.moveTo(px + TS / 2, py + TS / 2); ctx.lineTo(px + TS / 2 + Math.cos(a) * (10 + k * 14), py + TS / 2 + Math.sin(a) * (8 + k * 10)); ctx.stroke(); }
    ctx.restore();
  }

  _drawPlayer(ctx) {
    const pp = this._playerPix();
    const bob = this.p.moving ? Math.sin(this.p.mt * Math.PI) * 2 : 0;
    drawPerson(ctx, pp.x - this.cam.x, pp.y - this.cam.y - bob, this.p.dir, "#d24a3a", "#3a2a20", this.p.moving ? this.p.frame : 2, this.t);
  }
  _drawNpc(ctx, npc) {
    const x = this._sx(npc.x) + TS / 2, y = this._sy(npc.y) + TS / 2;
    if (x < -TS || x > BW + TS || y < -TS || y > BH + TS) return;
    drawPerson(ctx, x, y, npc.facing || npc.dir, npc.color, npc.hair, 2, this.t);
    if (this.pendingTrainer && this.pendingTrainer.npc === npc) {
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "#e0473a"; ctx.lineWidth = 2;
      this._bubble(ctx, x, y - 42); ctx.fillStyle = "#e0473a"; ctx.font = "bold 20px sans-serif"; ctx.textAlign = "center"; ctx.fillText("!", x, y - 34);
    }
  }
  _bubble(ctx, x, y) { ctx.beginPath(); ctx.arc(x, y, 13, 0, TAU); ctx.fill(); ctx.stroke(); }

  _drawHud(ctx) {
    // location + money chip
    ctx.save();
    ctx.fillStyle = "rgba(20,24,32,0.72)"; this._chip(ctx, 12, 12, 150, 30);
    ctx.fillStyle = "#fff"; ctx.font = "700 15px 'Segoe UI', system-ui, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(this.p.gy <= 11 ? "Route 1" : "Meadowlink Town", 24, 28);
    ctx.fillStyle = "rgba(20,24,32,0.72)"; this._chip(ctx, BW - 150, 12, 138, 30);
    ctx.fillStyle = "#ffe08a"; ctx.textAlign = "right"; ctx.fillText("₽ " + this.game.state.money, BW - 22, 28);
    ctx.restore();
  }
  _chip(ctx, x, y, w, h) { ctx.beginPath(); const r = 8; ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill(); }

  _drawMsg(ctx) {
    const x = 20, y = BH - 108, w = BW - 40, h = 92;
    ctx.save();
    ctx.fillStyle = "#f7f7fb"; ctx.strokeStyle = "#3a4a6a"; ctx.lineWidth = 4;
    this._chip(ctx, x, y, w, h); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#22252c"; ctx.font = "600 20px 'Segoe UI', system-ui, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "top";
    const line = this.msg.lines[this.msg.i].slice(0, Math.floor(this.msg.shown));
    this._wrap(ctx, line, x + 22, y + 20, w - 44, 27);
    if (this.msg.done) { ctx.fillStyle = "#e0473a"; ctx.font = "700 16px sans-serif"; ctx.textAlign = "right"; ctx.fillText("▼", x + w - 20, y + h - 24); }
    ctx.restore();
  }
  _drawBanner(ctx) {
    const a = U.clamp(this.banner.t, 0, 1) * U.clamp((2.4 - this.banner.t) * 2, 0, 1);
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(20,24,32,0.8)"; this._chip(ctx, BW / 2 - 130, 60, 260, 44);
    ctx.fillStyle = "#fff"; ctx.font = "700 22px 'Segoe UI', system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(this.banner.text, BW / 2, 82); ctx.restore();
  }
  _wrap(ctx, text, x, y, maxW, lh) {
    const words = String(text).split(" "); let line = "", yy = y;
    for (const wd of words) { const test = line ? line + " " + wd : wd; if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = wd; yy += lh; } else line = test; }
    if (line) ctx.fillText(line, x, yy);
  }
}

/* ---------- a small top-down person, four facings + walk bob ---------- */
function drawPerson(ctx, x, y, dir, color, hair, frame, t) {
  ctx.save();
  ctx.translate(x, y);
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.beginPath(); ctx.ellipse(0, 15, 12, 4, 0, 0, TAU); ctx.fill();
  // legs (frame 0/1 step, 2 idle)
  ctx.fillStyle = "#3a3a44";
  const step = frame === 2 ? 0 : (frame === 0 ? 3 : -3);
  ctx.fillRect(-7, 8, 5, 8 + step); ctx.fillRect(2, 8, 5, 8 - step);
  // body
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(-9, -4); ctx.lineTo(9, -4); ctx.lineTo(8, 10); ctx.lineTo(-8, 10); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 1.5; ctx.stroke();
  // head
  ctx.fillStyle = "#f0c9a0"; ctx.beginPath(); ctx.arc(0, -12, 9, 0, TAU); ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.2)"; ctx.stroke();
  // hair depends on facing
  ctx.fillStyle = hair;
  if (dir === "up") { ctx.beginPath(); ctx.arc(0, -12, 9, 0, TAU); ctx.fill(); }
  else { ctx.beginPath(); ctx.arc(0, -14, 9, Math.PI, TAU); ctx.fill(); ctx.fillRect(-9, -14, 18, 4); }
  // face
  ctx.fillStyle = "#2a2530";
  if (dir === "down") { ctx.fillRect(-4, -12, 2.4, 3); ctx.fillRect(2, -12, 2.4, 3); }
  else if (dir === "left") { ctx.fillRect(-5, -12, 2.4, 3); }
  else if (dir === "right") { ctx.fillRect(3, -12, 2.4, 3); }
  ctx.restore();
}

if (typeof module !== "undefined" && module.exports) module.exports = { Overworld, TS, drawPerson };
