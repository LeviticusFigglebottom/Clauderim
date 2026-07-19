/* ============================================================
   POCKET FRONTIER — battle_ui.js
   The battle *scene*: it draws the arena, the creatures, the
   HP/EXP boxes, the menus and the scrolling battle text, and it
   plays back the event list produced by battle.js — tweening HP
   bars, flashing sprites, shaking the screen, throwing balls and
   morphing evolutions. All input while in battle lands here.
   ============================================================ */
"use strict";

const BW = 720, BH = 480;                 // battle logical resolution

class BattleScene {
  constructor(battle, opts) {
    this.b = battle;
    this.opts = opts || {};
    this.fx = new FX();
    this.t = 0;
    this.mode = "intro";
    this.queue = [];
    this.msg = ""; this.msgN = 0; this.msgDone = true; this.holdT = 0;
    this.cursor = 0; this.subCursor = 0;
    this.evTimer = 0;
    this.result = null;
    this.theme = (opts && opts.theme) || "field";

    // displayed (tweened) values
    this.disp = { foeHp: battle.foe.hp, pHp: battle.active.hp, exp: battle.active.expFrac };

    // per-side sprite animation state
    const mkSpr = ph => ({ appear: 1, faint: 0, scale: 1, flash: 0, offX: 0, lungeT: 0, phase: ph, hidden: false });
    this.spr = { foe: mkSpr(0.6), player: mkSpr(2.1) };

    this.cap = null;             // capture animation state
    this.evo = null;             // evolution animation state
    this.learn = null;           // learn-move prompt state
    this.caughtMon = null;

    this._buildIntro();
  }

  get foe() { return this.b.foe; }
  get me() { return this.b.active; }

  _buildIntro() {
    this.spr.foe.appear = 0; this.spr.player.appear = 0;
    const q = [];
    if (this.b.trainer) {
      q.push({ t: "text", s: `${this.b.trainer.name} wants to battle!` });
      q.push({ t: "sendout", side: "foe" });
      q.push({ t: "text", s: `${this.b.trainer.name} sent out ${this.foe.name}!` });
    } else {
      q.push({ t: "sendout", side: "foe" });
      q.push({ t: "text", s: `A wild ${this.foe.name} appeared!` });
    }
    q.push({ t: "sendout", side: "player" });
    q.push({ t: "text", s: `Go, ${this.me.name}!` });
    this._play(q);
  }

  /* ============================================================
     EVENT PLAYBACK
     ============================================================ */
  _play(events) {
    this.queue = events.concat(this.queue);
    if (this.mode !== "busy") { this.mode = "busy"; this._next(); }
  }

  _next() {
    if (!this.queue.length) { this._afterQueue(); return; }
    const e = this.queue.shift();
    this._start(e);
  }

  _afterQueue() {
    if (this.result) { this.mode = "end"; if (this.opts.onEnd) { const r = this.result; this.result = null; this.opts.onEnd(r, this.b); } return; }
    if (this.b.awaitSwitch) { this.mode = "faintswitch"; this.cursor = this._firstAlive(); this._say(`Choose your next Pokémon.`); return; }
    if (this.learn) { this.mode = "learn"; return; }
    this.mode = "menu"; this.cursor = 0;
  }

  _say(s) { this.msg = s; this.msgN = 0; this.msgDone = false; this.holdT = 0; }

  _start(e) {
    switch (e.t) {
      case "text": this._say(e.s); this.evTimer = -1; break;   // -1 → wait for typewriter+hold
      case "anim": {
        const from = this._pos(e.atk), to = this._pos(e.atk === "player" ? "foe" : "player");
        const r = this.fx.playMove(e.kind, from, to);
        if (r.lunge) { this.spr[e.atk].lungeT = 0.0001; this.spr[e.atk]._lungeDir = e.atk === "player" ? 1 : -1; }
        this.evTimer = Math.max(0.35, r.dur);
        this._sfx("move_" + (MOVES[e.kind] ? MOVES[e.kind].type : "normal"));
        break;
      }
      case "hp": {
        if (e.side === "none") { this.evTimer = 0.25; break; }
        this.spr[e.side].flash = 1; this.fx.addShake(e.tick ? 2 : 5);
        this._sfx("hit");
        this.evTimer = 0.55;
        break;
      }
      case "status": this.spr[e.side].flash = 0.6; this.fx.statusPuff(this._pos(e.side).x, this._pos(e.side).y, e.status); this.evTimer = 0.4; break;
      case "statusHeal": this.evTimer = 0.2; break;
      case "stat": { const p = this._pos(e.side); this.fx.statPuff(p.x, p.y, e.up); this.evTimer = 0.5; break; }
      case "faint": this.spr[e.side].faintStart = true; this._sfx("faint"); this.evTimer = 0.85; break;
      case "recall": this.spr[e.side].recall = 0.0001; this.evTimer = 0.4; break;
      case "sendout":
        this.spr[e.side].hidden = false; this.spr[e.side].faint = 0; this.spr[e.side].scale = 1; this.spr[e.side].appear = 0.0001; this.spr[e.side].recall = 0;
        if (e.side === "foe") this.disp.foeHp = this.foe.hp;
        else { this.disp.pHp = this.me.hp; this.disp.exp = this.me.expFrac; }
        this._sfx("send"); this.evTimer = 0.5; break;
      case "exp": this._sfx("exp"); this.evTimer = 0.7; break;
      case "levelup": {
        this.disp.pHp = this.me.hp;                     // max grew; keep bar honest
        this._say(`${e.mon.name} grew to level ${e.level}!`);
        this.fx.statPuff(this._pos("player").x, this._pos("player").y, true);
        this._sfx("level"); this.evTimer = -1; break;
      }
      case "learn": this._say(`${e.mon.name} learned ${MOVES[e.move].name}!`); this._sfx("level"); this.evTimer = -1; break;
      case "learnFull": this.learn = { mon: e.mon, move: e.move }; this.cursor = 0; this.mode = "learn"; return; // freeze queue until the player decides
      case "evolve": this._startEvolve(e.mon, e.to); return;   // drives its own timing
      case "ball": this._startCapture(e); return;
      case "end": this.result = e.result; this.evTimer = 0.1; break;
      case "faintSwitch": this.b.awaitSwitch = true; this.evTimer = 0; break;
      default: this.evTimer = 0;
    }
  }

  /* ---------- capture sequence ---------- */
  _startCapture(e) {
    this.cap = { phase: "throw", t: 0, shakes: e.shakes, caught: e.caught, block: e.block, x: 120, y: 360, wobble: 0 };
    this._sfx("throw");
  }
  _updateCapture(dt) {
    const c = this.cap; c.t += dt;
    const foe = this.spr.foe, target = this._pos("foe");
    if (c.phase === "throw") {
      const k = U.clamp(c.t / 0.5, 0, 1);
      c.x = U.lerp(120, target.x, k);
      c.y = U.lerp(360, target.y, k) - Math.sin(k * Math.PI) * 110;
      if (k >= 1) { c.phase = c.block ? "block" : "absorb"; c.t = 0; if (!c.block) this._sfx("send"); }
    } else if (c.phase === "block") {
      if (c.t > 0.4) { this.cap = null; this._next(); }
    } else if (c.phase === "absorb") {
      foe.scale = 1 - U.clamp(c.t / 0.3, 0, 1);
      if (c.t >= 0.32) { foe.scale = 0; c.phase = "drop"; c.t = 0; }
    } else if (c.phase === "drop") {
      const k = U.clamp(c.t / 0.35, 0, 1);
      c.y = U.lerp(target.y, 372, U.easeOutCubic(k));
      if (k >= 1) { c.phase = c.shakes > 0 || c.caught ? "wobble" : "burst"; c.t = 0; }
    } else if (c.phase === "wobble") {
      c.wobble = Math.sin(c.t * 10) * 0.3 * (1 - c.t / 0.55);
      if (c.t >= 0.55) {
        c.t = 0; c.done = (c.done || 0) + 1;
        this._sfx("wobble");
        if (c.done >= c.shakes) c.phase = c.caught ? "caught" : "burst";
      }
    } else if (c.phase === "burst") {
      if (c.t < 0.02) { this.fx.burst(c.x, c.y, 16, { color: "#ff5a3a", kind: "star", glow: true, spdMin: 60, spdMax: 200, r: 5, lifeMin: 0.2, lifeMax: 0.5 }); this._sfx("break"); }
      foe.scale = U.clamp(c.t / 0.25, 0, 1);
      if (c.t >= 0.28) { foe.scale = 1; this.cap = null; this._next(); }
    } else if (c.phase === "caught") {
      if (c.t < 0.02) { this.fx.burst(c.x, c.y, 18, { color: "#ffe36a", kind: "star", glow: true, spdMin: 40, spdMax: 150, r: 4, lifeMin: 0.3, lifeMax: 0.7 }); this._sfx("caught"); }
      if (c.t >= 0.5) { this.cap = null; this._next(); }
    }
  }

  /* ---------- evolution sequence ---------- */
  _startEvolve(mon, to) {
    this.mode = "busy";
    this.evo = { mon, to, from: mon.species, t: 0, phase: "glow", done: false };
    this._say(`What? ${mon.name} is evolving!`);
    this._sfx("evolve");
  }
  _updateEvolve(dt) {
    const e = this.evo; e.t += dt;
    if (e.phase === "glow") {
      if (e.t > 1.4) { e.phase = "flash"; e.t = 0; }
    } else if (e.phase === "flash") {
      this.fx.doFlash("#fff", 0.9);
      if (e.t > 0.15 && !e.swapped) { e.swapped = true; this.evo.mon.evolve(this.evo.to); this._sfx("shine"); }
      if (e.t > 1.0) { e.phase = "done"; e.t = 0; this._say(`Congratulations! Your ${SPECIES[e.from].name} evolved into ${this.evo.mon.name}!`); this.fx.burst(this._pos("player").x, this._pos("player").y - 20, 20, { color: "#fff0a0", kind: "star", glow: true, spdMin: 40, spdMax: 160, r: 5, lifeMin: 0.4, lifeMax: 0.9 }); }
    } else if (e.phase === "done") {
      if (this.msgDone && this.holdT > 1.0) { this.evo = null; this._next(); }
    }
  }

  /* ============================================================
     UPDATE
     ============================================================ */
  update(dt) {
    this.t += dt;
    this.fx.update(dt);

    // HP / EXP tweening
    this.disp.foeHp = U.approach(this.disp.foeHp, this.foe.hp, this.foe.maxHp * dt * 1.8 + 0.4);
    this.disp.pHp = U.approach(this.disp.pHp, this.me.hp, this.me.maxHp * dt * 1.8 + 0.4);
    this.disp.exp = U.approach(this.disp.exp, this.me.expFrac, dt * 1.6);

    // sprite anims
    for (const side of ["foe", "player"]) {
      const s = this.spr[side];
      if (s.appear < 1 && s.appear > 0) s.appear = Math.min(1, s.appear + dt * 2.6);
      if (s.recall) { s.recall = Math.min(1, s.recall + dt * 3.2); if (s.recall >= 1) s.hidden = true; }
      if (s.faintStart) { s.faint = Math.min(1, s.faint + dt * 1.4); if (s.faint >= 1) { s.hidden = true; s.faintStart = false; } }
      if (s.flash > 0) s.flash = Math.max(0, s.flash - dt * 4);
      if (s.lungeT > 0) {
        s.lungeT += dt;
        const k = s.lungeT / 0.32;
        s.offX = (k < 0.5 ? U.smoothstep(k * 2) : U.smoothstep((1 - k) * 2)) * 42 * (s._lungeDir || 1);
        if (s.lungeT >= 0.32) { s.lungeT = 0; s.offX = 0; }
      }
    }

    if (this.cap) { this._updateCapture(dt); return; }
    if (this.evo) { this._updateEvolve(dt); }

    // typewriter
    if (!this.msgDone) {
      this.msgN += dt * (this._fast ? 220 : 52);
      if (this.msgN >= this.msg.length) { this.msgN = this.msg.length; this.msgDone = true; this.holdT = 0; }
    } else {
      this.holdT += dt;
    }

    // drive busy queue
    if (this.mode === "busy" && !this.evo) {
      if (this.evTimer === -1) {
        // text: advance after typed + hold, unless waiting on fx
        if (this.msgDone && this.holdT >= (this._fast ? 0.12 : 0.5) && !this.fx.busy) { this.evTimer = 0; this._next(); }
      } else if (this.evTimer > 0) {
        this.evTimer -= dt;
        if (this.evTimer <= 0 && !this._blockedByHp()) this._next();
      } else if (this.evTimer === 0) {
        this._next();
      }
    }
  }

  _blockedByHp() {
    // keep HP-bar events on screen until the bar catches up
    return Math.abs(this.disp.foeHp - this.foe.hp) > 0.6 || Math.abs(this.disp.pHp - this.me.hp) > 0.6;
  }

  /* ============================================================
     INPUT
     ============================================================ */
  input(key) {
    if (key === "a") this._fast = true;
    if (this.mode === "busy" || this.mode === "intro" || this.mode === "end") {
      if (key === "a") { if (!this.msgDone) { this.msgN = this.msg.length; this.msgDone = true; } else if (this.evTimer === -1) { this.evTimer = 0; this._next(); } }
      return;
    }
    if (this.mode === "menu") return this._menuInput(key);
    if (this.mode === "move") return this._moveInput(key);
    if (this.mode === "bag") return this._bagInput(key);
    if (this.mode === "party" || this.mode === "faintswitch") return this._partyInput(key);
    if (this.mode === "learn") return this._learnInput(key);
  }
  inputUp(key) { if (key === "a") this._fast = false; }

  _menuInput(key) {
    // grid: 0 FIGHT 1 BAG / 2 POKéMON 3 RUN
    if (key === "right") this.cursor = this.cursor % 2 === 0 ? this.cursor + 1 : this.cursor;
    else if (key === "left") this.cursor = this.cursor % 2 === 1 ? this.cursor - 1 : this.cursor;
    else if (key === "down") this.cursor = this.cursor < 2 ? this.cursor + 2 : this.cursor;
    else if (key === "up") this.cursor = this.cursor >= 2 ? this.cursor - 2 : this.cursor;
    else if (key === "a") {
      this._sfx("select");
      if (this.cursor === 0) { this.mode = "move"; this.cursor = 0; }
      else if (this.cursor === 1) { this.mode = "bag"; this.cursor = 0; this._bagList(); }
      else if (this.cursor === 2) { this.mode = "party"; this.cursor = 0; }
      else if (this.cursor === 3) this._play(this.b.playerRun());
    }
  }

  _moveInput(key) {
    const n = this.me.moves.length;
    if (key === "b") { this.mode = "menu"; this.cursor = 0; this._sfx("select"); return; }
    if (key === "right" && this.cursor % 2 === 0 && this.cursor + 1 < n) this.cursor++;
    else if (key === "left" && this.cursor % 2 === 1) this.cursor--;
    else if (key === "down" && this.cursor + 2 < n) this.cursor += 2;
    else if (key === "up" && this.cursor - 2 >= 0) this.cursor -= 2;
    else if (key === "a") {
      if (this.me.pp[this.cursor] <= 0) { this._sfx("deny"); return; }
      this._sfx("select");
      this._play(this.b.playerMove(this.cursor));
    }
  }

  _bagList() {
    const bag = this.opts.bag || {};
    this.items = [];
    for (const id in bag) if (bag[id] > 0 && ITEMS[id]) this.items.push({ id, qty: bag[id] });
  }
  _bagInput(key) {
    if (key === "b") { this.mode = "menu"; this.cursor = 1; this._sfx("select"); return; }
    if (!this.items || !this.items.length) { if (key === "a") this._sfx("deny"); return; }
    if (key === "down") this.cursor = Math.min(this.items.length - 1, this.cursor + 1);
    else if (key === "up") this.cursor = Math.max(0, this.cursor - 1);
    else if (key === "a") {
      const it = this.items[this.cursor]; const def = ITEMS[it.id];
      // consume via game callback so bag counts persist
      if (this.opts.onUseItem) this.opts.onUseItem(it.id);
      this._sfx("select");
      const spec = { kind: def.kind, id: it.id, name: def.name, amount: def.amount, bonus: def.bonus };
      if (def.kind === "heal" || def.kind === "cure") {
        // target the active mon (simple); could open party — kept to active for flow
        this._play(this.b.playerItem(spec, this.b.pi));
      } else {
        this._play(this.b.playerItem(spec));
      }
    }
  }

  _partyInput(key) {
    const party = this.b.party;
    if (key === "b" && this.mode === "party") { this.mode = "menu"; this.cursor = 2; this._sfx("select"); return; }
    if (key === "down") this.cursor = Math.min(party.length - 1, this.cursor + 1);
    else if (key === "up") this.cursor = Math.max(0, this.cursor - 1);
    else if (key === "a") {
      const mon = party[this.cursor];
      if (mon.fainted) { this._sfx("deny"); return; }
      if (this.mode === "faintswitch") {
        this._sfx("select"); this._play(this.b.switchAfterFaint(this.cursor));
      } else {
        if (this.cursor === this.b.pi) { this._sfx("deny"); return; }
        this._sfx("select"); this._play(this.b.playerSwitch(this.cursor));
      }
    }
  }

  _learnInput(key) {
    // options: 4 moves + "Don't learn"
    const opts = 5;
    if (key === "down") this.cursor = Math.min(opts - 1, this.cursor + 1);
    else if (key === "up") this.cursor = Math.max(0, this.cursor - 1);
    else if (key === "a") {
      const L = this.learn;
      if (this.cursor === 4) {
        this._say(`${L.mon.name} did not learn ${MOVES[L.move].name}.`);
      } else {
        const old = MOVES[L.mon.moves[this.cursor]].name;
        L.mon.replaceMove(this.cursor, L.move);
        this._say(`${L.mon.name} forgot ${old} and learned ${MOVES[L.move].name}!`);
      }
      this._sfx("level");
      this.learn = null; this.mode = "busy"; this.evTimer = -1;
    }
  }

  /* ============================================================
     RENDER
     ============================================================ */
  render(ctx) {
    const [sx, sy] = this.fx.shakeOffset();
    ctx.save();
    ctx.translate(sx, sy);
    this._drawBg(ctx);
    // draw order: foe behind, player front
    this._drawCreature(ctx, "foe");
    this._drawCreature(ctx, "player");
    this.fx.draw(ctx);
    if (this.cap) this._drawBall(ctx);
    this._drawHpBox(ctx, "foe");
    this._drawHpBox(ctx, "player");
    ctx.restore();

    this.fx.drawFlash(ctx, BW, BH);
    if (this.evo && this.evo.phase === "glow") this._drawEvoGlow(ctx);
    this._drawBottom(ctx);
  }

  _pos(side) {
    return side === "foe" ? { x: 512, y: 196 } : { x: 196, y: 344 };
  }

  _drawBg(ctx) {
    const th = BATTLE_THEMES[this.theme] || BATTLE_THEMES.field;
    const g = ctx.createLinearGradient(0, 0, 0, BH);
    g.addColorStop(0, th.sky1); g.addColorStop(0.62, th.sky2); g.addColorStop(0.62, th.ground1); g.addColorStop(1, th.ground2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, BW, BH);
    // distant band
    ctx.fillStyle = th.band; ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.moveTo(0, 300); ctx.quadraticCurveTo(BW / 2, 250, BW, 300); ctx.lineTo(BW, 305); ctx.quadraticCurveTo(BW / 2, 258, 0, 305); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    // platforms
    this._platform(ctx, 512, 236, 128, 30, th.plat);
    this._platform(ctx, 196, 392, 156, 36, th.plat);
  }
  _platform(ctx, x, y, rx, ry, col) {
    ctx.save();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.25; ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(x, y + ry * 0.5, rx * 0.8, ry * 0.5, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  _drawCreature(ctx, side) {
    const s = this.spr[side];
    if (s.hidden) return;
    const mon = side === "foe" ? this.foe : this.me;
    const p = this._pos(side);
    const size = side === "foe" ? 66 : 82;
    // appear scale (send-out pop) + capture scale + faint handled by opts.faint
    const app = s.appear <= 0 ? 0 : U.easeOutBack(s.appear);
    let scale = app * s.scale;
    let alpha = 1;
    if (s.recall) { scale *= (1 - s.recall); }
    if (scale <= 0.01) return;
    SPRITES.shadow(ctx, p.x, side === "foe" ? 236 : 392, size * 0.7 * s.scale * (1 - s.faint));
    SPRITES.draw(ctx, mon.data.form, p.x + s.offX, p.y, size * scale, {
      flip: side === "player", t: this.t, phase: s.phase,
      flash: s.flash, alpha, faint: s.faint, squash: s.flash * 0.25,
    });
  }

  _drawBall(ctx) {
    const c = this.cap;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.wobble || 0);
    const r = 13;
    ctx.fillStyle = "#e24a3a"; ctx.beginPath(); ctx.arc(0, 0, r, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = "#f4f4f4"; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI); ctx.fill();
    ctx.strokeStyle = "#222"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#222"; ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  _drawHpBox(ctx, side) {
    const mon = side === "foe" ? this.foe : this.me;
    const s = this.spr[side];
    if (s.hidden && side === "foe" && !this.cap) { /* still show until faint text passes */ }
    if (s.appear <= 0) return;
    const isP = side === "player";
    const x = isP ? 384 : 40, y = isP ? 300 : 54, w = 296, h = isP ? 92 : 70;
    // slide-in from the side
    const slide = (1 - U.clamp(s.appear, 0, 1)) * (isP ? 60 : -60);
    ctx.save(); ctx.translate(slide, 0);
    this._panel(ctx, x, y, w, h);
    ctx.fillStyle = "#2a2a33"; ctx.textBaseline = "alphabetic";
    ctx.font = "700 20px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "left"; ctx.fillText(mon.name, x + 16, y + 26);
    ctx.textAlign = "right"; ctx.font = "700 17px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("Lv" + mon.level, x + w - 16, y + 26);
    // status badge
    if (mon.status) {
      const bc = { brn: "#e0743a", psn: "#a24fb0", par: "#e0b83a", slp: "#8391a8", frz: "#5ab8d8" }[mon.status];
      ctx.fillStyle = bc; this._round(ctx, x + 16, y + 34, 46, 18, 4); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "700 12px 'Segoe UI', system-ui, sans-serif"; ctx.textAlign = "center";
      ctx.fillText(mon.status.toUpperCase(), x + 39, y + 47);
    }
    // HP bar
    const barX = x + (mon.status ? 72 : 16), barY = y + 40, barW = x + w - 16 - barX, barH = 9;
    ctx.textAlign = "left"; ctx.fillStyle = "#3a3a44"; ctx.font = "700 12px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("HP", barX, barY - 3);
    const hpFrac = U.clamp((side === "foe" ? this.disp.foeHp : this.disp.pHp) / mon.maxHp, 0, 1);
    this._bar(ctx, barX + 22, barY - 11, barW - 22, barH, hpFrac, hpFrac > 0.5 ? "#5ec46a" : hpFrac > 0.2 ? "#f2c23a" : "#ec5a48");
    if (isP) {
      ctx.fillStyle = "#2a2a33"; ctx.font = "700 15px 'Consolas', monospace"; ctx.textAlign = "right";
      ctx.fillText(`${Math.round(side === "foe" ? this.disp.foeHp : this.disp.pHp)}/${mon.maxHp}`, x + w - 16, y + 66);
      // EXP bar
      ctx.fillStyle = "#3a3a44"; ctx.textAlign = "left"; ctx.font = "700 11px 'Segoe UI', system-ui, sans-serif";
      ctx.fillText("EXP", x + 16, y + 84);
      this._bar(ctx, x + 46, y + 76, w - 62, 6, this.disp.exp, "#4aa8e0", "#e8ecf2");
    }
    ctx.restore();
  }

  _drawBottom(ctx) {
    const x = 20, y = 398, w = BW - 40, h = 74;
    // main text panel
    this._panel(ctx, x, y, this.mode === "menu" || this.mode === "move" || this.mode === "bag" || this.mode === "party" || this.mode === "faintswitch" || this.mode === "learn" ? w * 0.62 : w, h, "#f7f7fb", "#3a4a6a");
    ctx.fillStyle = "#22252c"; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.font = "600 20px 'Segoe UI', system-ui, sans-serif";
    if (this.mode === "move") this._drawMoveInfo(ctx, x, y, w, h);
    else if (this.mode === "learn") this._drawLearn(ctx, x, y, w, h);
    else this._wrapText(ctx, this._bottomText(), x + 20, y + 16, w * 0.6 - 30, 26);

    // right-side menu
    if (this.mode === "menu") this._drawMainMenu(ctx, x + w * 0.62 + 8, y, w * 0.38 - 8, h);
    else if (this.mode === "move") this._drawMoveGrid(ctx, x + w * 0.62 + 8, y, w * 0.38 - 8, h);
    else if (this.mode === "bag") this._drawBag(ctx, x + w * 0.62 + 8, y, w * 0.38 - 8, h);
    else if (this.mode === "party" || this.mode === "faintswitch") this._drawPartyList(ctx, x + w * 0.62 + 8, y, w * 0.38 - 8, h);
  }

  _bottomText() {
    if (this.mode === "menu") return `What will ${this.me.name} do?`;
    return this.msg.slice(0, Math.floor(this.msgN)) + (this.msgDone ? "" : "");
  }

  _drawMainMenu(ctx, x, y, w, h) {
    this._panel(ctx, x, y, w, h, "#fff", "#3a4a6a");
    const labels = ["FIGHT", "BAG", "POKéMON", "RUN"];
    const colw = w / 2, rowh = h / 2;
    ctx.font = "700 19px 'Segoe UI', system-ui, sans-serif"; ctx.textBaseline = "middle";
    for (let i = 0; i < 4; i++) {
      const cx = x + (i % 2) * colw + 18, cy = y + Math.floor(i / 2) * rowh + rowh / 2;
      const sel = i === this.cursor;
      ctx.fillStyle = sel ? "#e0473a" : "#33373f"; ctx.textAlign = "left";
      ctx.fillText((sel ? "▶ " : "   ") + labels[i], cx, cy + 1);
    }
  }

  _drawMoveGrid(ctx, x, y, w, h) {
    this._panel(ctx, x, y, w, h, "#fff", "#3a4a6a");
    const colw = w / 2, rowh = h / 2;
    ctx.font = "700 15px 'Segoe UI', system-ui, sans-serif"; ctx.textBaseline = "middle";
    for (let i = 0; i < 4; i++) {
      const cx = x + (i % 2) * colw + 12, cy = y + Math.floor(i / 2) * rowh + rowh / 2;
      if (i >= this.me.moves.length) { ctx.fillStyle = "#c9ccd6"; ctx.textAlign = "left"; ctx.fillText("—", cx + 12, cy); continue; }
      const mv = MOVES[this.me.moves[i]]; const sel = i === this.cursor;
      ctx.fillStyle = sel ? "#e0473a" : "#33373f"; ctx.textAlign = "left";
      ctx.fillText((sel ? "▶" : " ") + mv.name, cx, cy);
    }
  }

  _drawMoveInfo(ctx, x, y, w, h) {
    // left panel shows PP + type + description of highlighted move
    const mv = MOVES[this.me.moves[this.cursor]];
    ctx.fillStyle = "#22252c"; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.font = "700 14px 'Segoe UI', system-ui, sans-serif";
    // type badge
    const tcol = TYPES.color[mv.type];
    ctx.fillStyle = tcol; this._round(ctx, x + 18, y + 14, 62, 20, 5); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.font = "700 12px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(mv.type.toUpperCase(), x + 49, y + 18);
    // category + PP
    ctx.fillStyle = "#33373f"; ctx.textAlign = "left"; ctx.font = "700 13px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(mv.cat.toUpperCase(), x + 92, y + 17);
    ctx.textAlign = "right"; ctx.fillText(`PP ${this.me.pp[this.cursor]}/${this.me.maxpp[this.cursor]}`, x + w * 0.6 - 20, y + 17);
    // description
    ctx.fillStyle = "#3a3f48"; ctx.textAlign = "left"; ctx.font = "500 14px 'Segoe UI', system-ui, sans-serif";
    this._wrapText(ctx, mv.desc, x + 18, y + 40, w * 0.6 - 34, 17);
  }

  _drawBag(ctx, x, y, w, h) {
    this._panel(ctx, x, y, w, h, "#fff", "#3a4a6a");
    ctx.font = "700 15px 'Segoe UI', system-ui, sans-serif"; ctx.textBaseline = "middle"; ctx.textAlign = "left";
    if (!this.items || !this.items.length) { ctx.fillStyle = "#8890a0"; ctx.fillText("Bag is empty", x + 16, y + h / 2); return; }
    const show = this.items.slice(Math.max(0, this.cursor - 2), Math.max(0, this.cursor - 2) + 3);
    const off = Math.max(0, this.cursor - 2);
    for (let i = 0; i < show.length; i++) {
      const it = show[i], gi = off + i, sel = gi === this.cursor;
      ctx.fillStyle = sel ? "#e0473a" : "#33373f";
      ctx.fillText((sel ? "▶" : " ") + ITEMS[it.id].name, x + 12, y + 20 + i * 22);
      ctx.textAlign = "right"; ctx.fillText("x" + it.qty, x + w - 14, y + 20 + i * 22); ctx.textAlign = "left";
    }
  }

  _drawPartyList(ctx, x, y, w, h) {
    this._panel(ctx, x, y, w, h, "#fff", "#3a4a6a");
    ctx.font = "700 14px 'Segoe UI', system-ui, sans-serif"; ctx.textBaseline = "middle"; ctx.textAlign = "left";
    const party = this.b.party;
    const off = Math.max(0, Math.min(this.cursor - 1, party.length - 3));
    for (let i = 0; i < Math.min(3, party.length); i++) {
      const gi = off + i, mon = party[gi], sel = gi === this.cursor;
      ctx.fillStyle = mon.fainted ? "#b6323a" : sel ? "#e0473a" : gi === this.b.pi ? "#2a8a5a" : "#33373f";
      const tag = gi === this.b.pi ? "●" : mon.fainted ? "✕" : " ";
      ctx.fillText((sel ? "▶" : " ") + tag + mon.name, x + 10, y + 18 + i * 22);
      ctx.textAlign = "right"; ctx.font = "600 12px 'Consolas', monospace";
      ctx.fillText(`L${mon.level} ${mon.hp}/${mon.maxHp}`, x + w - 12, y + 18 + i * 22);
      ctx.textAlign = "left"; ctx.font = "700 14px 'Segoe UI', system-ui, sans-serif";
    }
  }

  _drawLearn(ctx, x, y, w, h) {
    const L = this.learn;
    ctx.fillStyle = "#22252c"; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.font = "600 15px 'Segoe UI', system-ui, sans-serif";
    this._wrapText(ctx, `${L.mon.name} wants to learn ${MOVES[L.move].name}. Forget a move?`, x + 16, y + 10, w * 0.6 - 30, 18);
    // list on right handled by a compact list here
    ctx.font = "700 13px 'Segoe UI', system-ui, sans-serif";
    for (let i = 0; i < 5; i++) {
      const sel = i === this.cursor;
      const label = i < 4 ? (this.learn.mon.moves[i] ? MOVES[this.learn.mon.moves[i]].name : "—") : "Don't learn";
      ctx.fillStyle = sel ? "#e0473a" : "#33373f"; ctx.textAlign = "left";
      ctx.fillText((sel ? "▶" : " ") + label, x + w * 0.62 + 14, y + 12 + i * 12);
    }
  }

  _drawEvoGlow(ctx) {
    const p = this._pos("player");
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const a = 0.3 + 0.3 * Math.sin(this.t * 12);
    const g = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, 120);
    g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, BW, BH); ctx.restore();
  }

  /* ---------- primitives ---------- */
  _panel(ctx, x, y, w, h, fill, border) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
    ctx.fillStyle = fill || "#f6f7fb"; this._round(ctx, x, y, w, h, 12); ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.lineWidth = 3; ctx.strokeStyle = border || "#4a5a7a"; this._round(ctx, x, y, w, h, 12); ctx.stroke();
    ctx.restore();
  }
  _bar(ctx, x, y, w, h, frac, col, track) {
    ctx.fillStyle = track || "#3a3f48"; this._round(ctx, x, y, w, h, h / 2); ctx.fill();
    if (frac > 0) { ctx.fillStyle = col; this._round(ctx, x, y, Math.max(h, w * frac), h, h / 2); ctx.fill(); }
  }
  _round(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  _wrapText(ctx, text, x, y, maxW, lh) {
    const words = String(text).split(" "); let line = "", yy = y;
    for (const wd of words) {
      const test = line ? line + " " + wd : wd;
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = wd; yy += lh; }
      else line = test;
    }
    if (line) ctx.fillText(line, x, yy);
  }

  _firstAlive() { const i = this.b.party.findIndex(m => !m.fainted); return i < 0 ? 0 : i; }
  _sfx(name) { if (typeof Sound !== "undefined" && Sound && Sound.sfx) try { Sound.sfx(name); } catch (e) {} }
}

const BATTLE_THEMES = {
  field: { sky1: "#8fd0ff", sky2: "#cdeaff", ground1: "#bfe38f", ground2: "#8ec763", band: "#a6d6a0", plat: "#7cb85a" },
  cave: { sky1: "#3a3550", sky2: "#57506e", ground1: "#5a5064", ground2: "#3e3648", band: "#4a4258", plat: "#6a5f74" },
  water: { sky1: "#7fc0ff", sky2: "#bfe6ff", ground1: "#7fbfe0", ground2: "#4f97c8", band: "#9fd0ec", plat: "#5fa8d0" },
  tall: { sky1: "#a8dcff", sky2: "#d8f0ff", ground1: "#8fbf5f", ground2: "#6aa544", band: "#98cf78", plat: "#5f9a3c" },
};

if (typeof module !== "undefined" && module.exports) module.exports = { BattleScene, BW, BH };
