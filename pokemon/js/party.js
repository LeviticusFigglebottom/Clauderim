/* ============================================================
   POCKET FRONTIER — party.js
   The pause menu (Party · Bag · Save · Pokédex) and the Poké
   Mart shop. Both are simple canvas scenes drawn over a frozen
   overworld, driven by the same normalised key input.
   ============================================================ */
"use strict";

class MenuScene {
  constructor(game) {
    this.game = game;
    this.mode = "root";
    this.cursor = 0; this.sub = 0;
    this.note = "";
    this.pendingItem = null;
    this.roots = ["Party", "Bag", "Save", "Pokédex", "Close"];
  }
  get state() { return this.game.state; }

  update() {}

  input(k) {
    if (this.mode === "root") return this._root(k);
    if (this.mode === "party") return this._party(k);
    if (this.mode === "summary") { if (k === "a" || k === "b") { this.mode = "party"; } return; }
    if (this.mode === "bag") return this._bag(k);
    if (this.mode === "bagtarget") return this._bagtarget(k);
    if (this.mode === "dex") { if (k === "b" || k === "a") this.mode = "root"; else if (k === "down") this.sub = Math.min(Object.keys(SPECIES).length - 1, this.sub + 1); else if (k === "up") this.sub = Math.max(0, this.sub - 1); return; }
    if (this.mode === "saved") { if (k === "a" || k === "b") this.mode = "root"; return; }
  }

  _root(k) {
    if (k === "up") this.cursor = (this.cursor + this.roots.length - 1) % this.roots.length;
    else if (k === "down") this.cursor = (this.cursor + 1) % this.roots.length;
    else if (k === "b" || (k === "start")) this.game.closeMenu();
    else if (k === "a") {
      Sound.sfx("select");
      const r = this.roots[this.cursor];
      if (r === "Close") this.game.closeMenu();
      else if (r === "Party") { this.mode = "party"; this.sub = 0; }
      else if (r === "Bag") { this.mode = "bag"; this.sub = 0; this._bagList(); }
      else if (r === "Save") { this.game.save(); this.note = "Game saved!"; this.mode = "saved"; Sound.sfx("heal"); }
      else if (r === "Pokédex") { this.mode = "dex"; this.sub = 0; }
    }
  }
  _party(k) {
    const n = this.state.party.length;
    if (k === "up") this.sub = (this.sub + n - 1) % n;
    else if (k === "down") this.sub = (this.sub + 1) % n;
    else if (k === "b") this.mode = "root";
    else if (k === "a") { this.mode = "summary"; Sound.sfx("select"); }
  }
  _bagList() {
    this.items = Object.keys(this.state.bag).filter(id => this.state.bag[id] > 0 && ITEMS[id]);
  }
  _bag(k) {
    this._bagList();
    if (k === "b") { this.mode = "root"; return; }
    if (!this.items.length) return;
    if (k === "up") this.sub = (this.sub + this.items.length - 1) % this.items.length;
    else if (k === "down") this.sub = (this.sub + 1) % this.items.length;
    else if (k === "a") {
      const id = this.items[this.sub], def = ITEMS[id];
      if (def.kind === "ball") { this.note = "Save Balls for wild Pokémon!"; Sound.sfx("deny"); return; }
      this.pendingItem = id; this.mode = "bagtarget"; this.cursor = 0; Sound.sfx("select");
    }
  }
  _bagtarget(k) {
    const n = this.state.party.length;
    if (k === "b") { this.mode = "bag"; return; }
    if (k === "up") this.cursor = (this.cursor + n - 1) % n;
    else if (k === "down") this.cursor = (this.cursor + 1) % n;
    else if (k === "a") {
      const mon = this.state.party[this.cursor], def = ITEMS[this.pendingItem];
      const msg = this._apply(def, mon, this.pendingItem);
      this.note = msg;
      this.mode = "bag"; this._bagList();
      if (this.sub >= this.items.length) this.sub = Math.max(0, this.items.length - 1);
    }
  }
  _apply(def, mon, id) {
    if (def.kind === "revive") {
      if (!mon.fainted) return `${mon.name} isn't fainted.`;
      mon.hp = Math.ceil(mon.maxHp / 2); mon.status = null;
      this._consume(id); Sound.sfx("heal"); return `${mon.name} was revived!`;
    }
    if (def.kind === "heal") {
      if (mon.fainted) return `${mon.name} has fainted — use a Revive.`;
      if (mon.hp >= mon.maxHp && !(def.cures && mon.status)) return `${mon.name} is already healthy.`;
      const before = mon.hp; mon.hp = Math.min(mon.maxHp, mon.hp + def.amount);
      if (def.cures === "any") mon.status = null;
      this._consume(id); Sound.sfx("heal"); return `${mon.name} recovered ${mon.hp - before} HP!`;
    }
    if (def.kind === "cure") {
      if (!mon.status) return `${mon.name} has no status to cure.`;
      if (def.cures !== "any" && mon.status !== def.cures) return `It won't help ${mon.name} right now.`;
      mon.status = null; mon.sleepTurns = 0; this._consume(id); Sound.sfx("heal"); return `${mon.name} was cured!`;
    }
    return "";
  }
  _consume(id) { this.state.bag[id]--; if (this.state.bag[id] <= 0) delete this.state.bag[id]; }

  /* ---------- render ---------- */
  render(ctx) {
    ctx.save();
    ctx.fillStyle = "rgba(10,14,22,0.55)"; ctx.fillRect(0, 0, BW, BH);
    const x = BW - 300, y = 20, w = 280, h = BH - 40;
    this._panel(ctx, x, y, w, h);
    ctx.fillStyle = "#2a3550"; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.font = "800 22px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("MENU", x + 20, y + 16);
    if (this.mode === "root") this._drawRoot(ctx, x, y, w);
    else if (this.mode === "party" || this.mode === "bagtarget") this._drawParty(ctx, x, y, w, h, this.mode === "bagtarget");
    else if (this.mode === "summary") this._drawSummary(ctx, x, y, w, h);
    else if (this.mode === "bag") this._drawBag(ctx, x, y, w, h);
    else if (this.mode === "dex") this._drawDex(ctx, x, y, w, h);
    else if (this.mode === "saved") { ctx.font = "700 20px 'Segoe UI',sans-serif"; ctx.fillStyle = "#2a8a5a"; ctx.fillText(this.note, x + 20, y + 60); ctx.fillStyle = "#8894a8"; ctx.font = "500 14px sans-serif"; ctx.fillText("Press Z", x + 20, y + h - 30); }
    if (this.note && this.mode !== "saved") { ctx.fillStyle = "#3a4560"; ctx.font = "500 13px 'Segoe UI',sans-serif"; ctx.fillText(this.note, x + 20, y + h - 28); }
    ctx.restore();
  }

  _drawRoot(ctx, x, y, w) {
    ctx.font = "700 20px 'Segoe UI', system-ui, sans-serif";
    for (let i = 0; i < this.roots.length; i++) {
      const sel = i === this.cursor;
      ctx.fillStyle = sel ? "#e0473a" : "#33373f";
      ctx.fillText((sel ? "▶ " : "   ") + this.roots[i], x + 24, y + 60 + i * 40);
    }
  }

  _drawParty(ctx, x, y, w, h, targeting) {
    ctx.font = "700 14px 'Segoe UI',sans-serif"; ctx.fillStyle = "#55607a";
    ctx.fillText(targeting ? "Use on which Pokémon?" : "Your party", x + 20, y + 46);
    const cur = targeting ? this.cursor : this.sub;
    for (let i = 0; i < this.state.party.length; i++) {
      const mon = this.state.party[i], sel = i === cur;
      const ry = y + 66 + i * 62;
      ctx.fillStyle = sel ? "#eef3fb" : "#f7f8fc"; this._round(ctx, x + 14, ry, w - 28, 54, 10); ctx.fill();
      if (sel) { ctx.strokeStyle = "#e0473a"; ctx.lineWidth = 2.5; ctx.stroke(); }
      SPRITES.draw(ctx, mon.data.form, x + 40, ry + 28, 20, { t: this.game.last / 1000, phase: i });
      ctx.fillStyle = mon.fainted ? "#b6323a" : "#2a3550"; ctx.textAlign = "left"; ctx.font = "700 16px 'Segoe UI',sans-serif";
      ctx.fillText(mon.name, x + 70, ry + 16);
      ctx.fillStyle = "#55607a"; ctx.font = "600 12px 'Consolas',monospace";
      ctx.fillText("Lv" + mon.level + (mon.status ? "  " + mon.status.toUpperCase() : ""), x + 70, ry + 44);
      // hp bar
      const bx = x + 150, bw = w - 28 - (150 - 14);
      ctx.fillStyle = "#d5dae4"; this._round(ctx, bx, ry + 30, bw, 7, 3); ctx.fill();
      const f = mon.hpFrac; ctx.fillStyle = f > 0.5 ? "#5ec46a" : f > 0.2 ? "#f2c23a" : "#ec5a48";
      this._round(ctx, bx, ry + 30, Math.max(3, bw * f), 7, 3); ctx.fill();
      ctx.fillStyle = "#55607a"; ctx.font = "600 11px 'Consolas',monospace"; ctx.textAlign = "right";
      ctx.fillText(mon.hp + "/" + mon.maxHp, x + w - 20, ry + 24); ctx.textAlign = "left";
    }
  }

  _drawSummary(ctx, x, y, w, h) {
    const mon = this.state.party[this.sub];
    SPRITES.draw(ctx, mon.data.form, x + 60, y + 100, 44, { t: this.game.last / 1000, phase: 1 });
    ctx.textAlign = "left"; ctx.fillStyle = "#2a3550"; ctx.font = "800 22px 'Segoe UI',sans-serif";
    ctx.fillText(mon.name, x + 120, y + 60);
    ctx.font = "600 15px 'Segoe UI',sans-serif"; ctx.fillStyle = "#55607a";
    ctx.fillText("Lv " + mon.level + "   " + SPECIES[mon.species].name, x + 120, y + 84);
    let bx = x + 120;
    for (const ty of mon.types) { ctx.fillStyle = TYPES.color[ty]; this._round(ctx, bx, y + 96, 58, 18, 5); ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = "700 11px sans-serif"; ctx.textAlign = "center"; ctx.fillText(ty.toUpperCase(), bx + 29, y + 109); bx += 64; }
    ctx.textAlign = "left";
    // stats
    const stats = [["HP", mon.maxHp], ["ATK", mon.raw("atk")], ["DEF", mon.raw("def")], ["SPA", mon.raw("spa")], ["SPD", mon.raw("spd")], ["SPE", mon.raw("spe")]];
    ctx.font = "600 13px 'Consolas',monospace";
    for (let i = 0; i < stats.length; i++) {
      const sx = x + 24 + (i % 2) * 130, sy = y + 150 + Math.floor(i / 2) * 24;
      ctx.fillStyle = "#55607a"; ctx.fillText(stats[i][0], sx, sy);
      ctx.fillStyle = "#2a3550"; ctx.fillText(String(stats[i][1]), sx + 44, sy);
    }
    ctx.font = "700 14px 'Segoe UI',sans-serif"; ctx.fillStyle = "#2a3550"; ctx.fillText("Moves", x + 24, y + 236);
    for (let i = 0; i < mon.moves.length; i++) {
      const mv = MOVES[mon.moves[i]]; const my = y + 260 + i * 40;
      ctx.fillStyle = TYPES.color[mv.type]; this._round(ctx, x + 24, my, 12, 30, 3); ctx.fill();
      ctx.fillStyle = "#2a3550"; ctx.font = "700 14px 'Segoe UI',sans-serif"; ctx.fillText(mv.name, x + 44, my + 6);
      ctx.fillStyle = "#8894a8"; ctx.font = "600 11px 'Consolas',monospace"; ctx.fillText("PP " + mon.pp[i] + "/" + mon.maxpp[i] + (mv.power ? "  PWR " + mv.power : "  —"), x + 44, my + 22);
    }
    ctx.fillStyle = "#8894a8"; ctx.font = "500 13px sans-serif"; ctx.fillText("Z / X to go back", x + 24, y + h - 26);
  }

  _drawBag(ctx, x, y, w, h) {
    ctx.font = "700 14px 'Segoe UI',sans-serif"; ctx.fillStyle = "#55607a"; ctx.textAlign = "left"; ctx.fillText("Bag", x + 20, y + 46);
    if (!this.items.length) { ctx.fillStyle = "#8894a8"; ctx.font = "600 15px sans-serif"; ctx.fillText("Your bag is empty.", x + 20, y + 80); return; }
    for (let i = 0; i < this.items.length; i++) {
      const id = this.items[i], sel = i === this.sub;
      ctx.fillStyle = sel ? "#e0473a" : "#2a3550"; ctx.font = "700 16px 'Segoe UI',sans-serif"; ctx.textAlign = "left";
      ctx.fillText((sel ? "▶ " : "   ") + ITEMS[id].name, x + 20, y + 70 + i * 26);
      ctx.textAlign = "right"; ctx.fillStyle = "#55607a"; ctx.font = "600 14px 'Consolas',monospace";
      ctx.fillText("x" + this.state.bag[id], x + w - 20, y + 70 + i * 26);
    }
    const sel = this.items[this.sub];
    if (sel) { ctx.textAlign = "left"; ctx.fillStyle = "#3a4560"; ctx.font = "500 13px 'Segoe UI',sans-serif";
      this._wrap(ctx, ITEMS[sel].desc, x + 20, y + h - 78, w - 40, 17); }
  }

  _drawDex(ctx, x, y, w, h) {
    const keys = Object.keys(SPECIES).sort((a, b) => SPECIES[a].dex - SPECIES[b].dex);
    const caught = Object.keys(this.state.caught).length, seen = Object.keys(this.state.seen).length;
    ctx.font = "700 15px 'Segoe UI',sans-serif"; ctx.fillStyle = "#2a3550"; ctx.textAlign = "left";
    ctx.fillText(`Seen ${seen}  ·  Caught ${caught}/${keys.length}`, x + 20, y + 46);
    const per = 9, off = U.clamp(this.sub - 4, 0, Math.max(0, keys.length - per));
    for (let i = 0; i < Math.min(per, keys.length); i++) {
      const gi = off + i, key = keys[gi]; if (!key) break;
      const sp = SPECIES[key], isSeen = this.state.seen[key], isCaught = this.state.caught[key], sel = gi === this.sub;
      const ry = y + 66 + i * 30;
      ctx.fillStyle = sel ? "#e0473a" : "#33373f"; ctx.font = "700 15px 'Segoe UI',sans-serif";
      ctx.fillText((sel ? "▶" : " ") + String(sp.dex).padStart(2, "0") + " " + (isSeen ? sp.name : "?????"), x + 20, ry);
      if (isCaught) { ctx.fillStyle = "#e0473a"; ctx.fillText("●", x + w - 26, ry); }
    }
  }

  /* primitives */
  _panel(ctx, x, y, w, h) { ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = 14; ctx.fillStyle = "#f6f7fb"; this._round(ctx, x, y, w, h, 16); ctx.fill(); ctx.shadowColor = "transparent"; ctx.strokeStyle = "#3a4a6a"; ctx.lineWidth = 3; this._round(ctx, x, y, w, h, 16); ctx.stroke(); ctx.restore(); }
  _round(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  _wrap(ctx, text, x, y, maxW, lh) { const words = String(text).split(" "); let line = "", yy = y; for (const wd of words) { const test = line ? line + " " + wd : wd; if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = wd; yy += lh; } else line = test; } if (line) ctx.fillText(line, x, yy); }
}

/* ============================================================
   Poké Mart
   ============================================================ */
class ShopScene {
  constructor(game) {
    this.game = game;
    this.stock = ["pokeball", "greatball", "potion", "superpotion", "antidote", "paralyzeheal", "awakening", "revive"];
    this.cursor = 0; this.note = "Welcome! What'll it be?";
  }
  get state() { return this.game.state; }
  update() {}
  input(k) {
    if (k === "b" || k === "start") { this.game.closeShop(); return; }
    if (k === "up") this.cursor = (this.cursor + this.stock.length - 1) % this.stock.length;
    else if (k === "down") this.cursor = (this.cursor + 1) % this.stock.length;
    else if (k === "a") {
      const id = this.stock[this.cursor], price = ITEMS[id].price;
      if (this.state.money < price) { this.note = "You don't have enough money."; Sound.sfx("deny"); return; }
      this.state.money -= price; this.state.bag[id] = (this.state.bag[id] || 0) + 1;
      this.note = `Bought a ${ITEMS[id].name}! Anything else?`; Sound.sfx("select");
    }
  }
  render(ctx) {
    ctx.save();
    ctx.fillStyle = "rgba(10,14,22,0.5)"; ctx.fillRect(0, 0, BW, BH);
    const x = 120, y = 40, w = BW - 240, h = BH - 80;
    ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = 14; ctx.fillStyle = "#f6f7fb"; this._round(ctx, x, y, w, h, 16); ctx.fill(); ctx.shadowColor = "transparent";
    ctx.strokeStyle = "#3a8fd0"; ctx.lineWidth = 4; this._round(ctx, x, y, w, h, 16); ctx.stroke();
    ctx.fillStyle = "#2a3550"; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.font = "800 24px 'Segoe UI',sans-serif";
    ctx.fillText("POKé MART", x + 24, y + 18);
    ctx.textAlign = "right"; ctx.fillStyle = "#c58a1a"; ctx.font = "700 20px 'Segoe UI',sans-serif";
    ctx.fillText("₽ " + this.state.money, x + w - 24, y + 20);
    ctx.textAlign = "left";
    for (let i = 0; i < this.stock.length; i++) {
      const id = this.stock[i], sel = i === this.cursor, ry = y + 70 + i * 34;
      ctx.fillStyle = sel ? "#e0473a" : "#2a3550"; ctx.font = "700 18px 'Segoe UI',sans-serif";
      ctx.fillText((sel ? "▶ " : "   ") + ITEMS[id].name, x + 28, ry);
      ctx.textAlign = "right"; ctx.fillStyle = "#55607a"; ctx.font = "600 15px 'Consolas',monospace";
      ctx.fillText("₽ " + ITEMS[id].price + "   (have " + (this.state.bag[id] || 0) + ")", x + w - 28, ry + 2); ctx.textAlign = "left";
    }
    const sel = this.stock[this.cursor];
    ctx.fillStyle = "#3a4560"; ctx.font = "500 14px 'Segoe UI',sans-serif";
    this._wrap(ctx, ITEMS[sel].desc, x + 28, y + h - 76, w - 56, 18);
    ctx.fillStyle = "#2a8a5a"; ctx.font = "600 14px 'Segoe UI',sans-serif";
    ctx.fillText(this.note, x + 28, y + h - 36);
    ctx.fillStyle = "#8894a8"; ctx.textAlign = "right"; ctx.fillText("Z buy · X leave", x + w - 28, y + h - 36);
    ctx.restore();
  }
  _round(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  _wrap(ctx, text, x, y, maxW, lh) { const words = String(text).split(" "); let line = "", yy = y; for (const wd of words) { const test = line ? line + " " + wd : wd; if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = wd; yy += lh; } else line = test; } if (line) ctx.fillText(line, x, yy); }
}

if (typeof module !== "undefined" && module.exports) module.exports = { MenuScene, ShopScene };
