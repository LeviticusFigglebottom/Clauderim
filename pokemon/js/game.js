/* ============================================================
   POCKET FRONTIER — game.js
   The conductor: owns the canvas, the game loop, the current
   scene (title → starter select → overworld ↔ battle ↔ menu →
   win), the player's state (party, bag, money, dex, flags) and
   the keyboard. Every other module hangs off here.
   ============================================================ */
"use strict";

const STARTERS = ["emberling", "dewdrop", "sproutle"];
const RIVAL_COUNTER = { emberling: "dewdrop", dewdrop: "sproutle", sproutle: "emberling" };

const Game = {
  canvas: null, ctx: null,
  scene: "title",
  state: null,
  overworld: null, battle: null, menu: null, shop: null,
  last: 0, acc: 0,
  titleSel: 0, starterSel: 0, overlay: null,

  init() {
    this.canvas = U.el("game");
    this.ctx = this.canvas.getContext("2d");
    this.canvas.width = BW; this.canvas.height = BH;
    this._bindKeys();
    this._resize(); window.addEventListener("resize", () => this._resize());
    this.state = this._blankState();
    requestAnimationFrame(ts => this.loop(ts));
  },

  _blankState() {
    return { name: "You", party: [], box: [], bag: { pokeball: 5, potion: 3 }, money: 3000, defeated: {}, seen: {}, caught: {}, starter: null };
  },

  /* ---------- lifecycle ---------- */
  newGame(starterKey) {
    U.seed((Date.now && Date.now()) ? (Date.now() & 0x7fffffff) : 20260719);
    this.state = this._blankState();
    this.state.starter = starterKey;
    const mon = new Monster(starterKey, 5);
    mon.nickname = null;
    this.state.party = [mon];
    this.state.seen[starterKey] = true; this.state.caught[starterKey] = true;
    // set the rival's team to counter the player
    const rival = WORLD.npcs.find(n => n.trainer && n.trainer.rival);
    if (rival) rival.trainer.party = [["chirplet", 5], [RIVAL_COUNTER[starterKey], 6]];
    // reset trainer defeat flags on the shared WORLD npc objects
    for (const n of WORLD.npcs) delete n.facing;
    this.overworld = new Overworld(this);
    this.scene = "overworld";
    Sound.music("route");
  },

  continueGame() {
    const s = Save.load();
    if (!s) return false;
    this.state = s.state;
    this.state.party = s.party.map(Monster.fromJSON);
    this.state.box = (s.box || []).map(Monster.fromJSON);
    // restore rival team from starter
    const rival = WORLD.npcs.find(n => n.trainer && n.trainer.rival);
    if (rival && this.state.starter) rival.trainer.party = [["chirplet", 5], [RIVAL_COUNTER[this.state.starter], 6]];
    this.overworld = new Overworld(this);
    this.scene = "overworld";
    Sound.music("route");
    return true;
  },

  save() { Save.write(this.state); },

  /* ---------- battle entry ---------- */
  startWildBattle(enc) {
    const foe = new Monster(enc.species, enc.level);
    this.state.seen[enc.species] = true;
    Sound.music("battle_wild");
    const battle = new Battle(this.state.party, foe, { isWild: true, bag: this.state.bag });
    this._enterBattle(battle, "tall");
  },

  startTrainerBattle(npc) {
    const party = npc.trainer.party.map(([sp, lv]) => { const m = new Monster(sp, lv); this.state.seen[sp] = true; return m; });
    Sound.music(npc.trainer.champion ? "battle_champ" : "battle_trainer");
    const battle = new Battle(this.state.party, party[0], {
      trainer: { name: npc.name, party, prize: npc.trainer.prize, champion: npc.trainer.champion },
      bag: this.state.bag,
    });
    battle._npc = npc;
    this._enterBattle(battle, npc.trainer.champion ? "field" : "field");
  },

  _enterBattle(battle, theme) {
    this.battle = new BattleScene(battle, {
      theme,
      bag: this.state.bag,
      onUseItem: id => { if (this.state.bag[id]) this.state.bag[id]--; if (this.state.bag[id] <= 0) delete this.state.bag[id]; },
      onEnd: (res, b) => this.endBattle(res, b),
    });
    this.scene = "battle";
  },

  endBattle(result, battle) {
    // caught → add to party or box, mark dex
    if (result === "caught") {
      const c = battle.foe;
      this.state.caught[c.species] = true;
      if (this.state.party.length < 6) this.state.party.push(c);
      else this.state.box.push(c);
      this.overlay = null;
    }
    if (battle.trainer && result === "win") {
      const npc = battle._npc;
      if (npc) this.overworld.markDefeated(npc.name);
      this.state.money += battle.trainer.prize || 0;
    }
    const fadeToOverworld = () => {
      this.scene = "overworld";
      this.battle = null;
      Sound.music(this.overworld.p.gy <= 11 ? "route" : "town");
    };
    if (result === "lose") {
      // whiteout
      this._whiteout();
      return;
    }
    // any surviving mons that need healing keep their HP; return
    fadeToOverworld();
    // champion post-battle: let overworld know player may now pass the gate
    if (battle.trainer && battle.trainer.champion && result === "win") {
      this.overworld.showMessage(["The path beyond the gate is open now.", "Step through when you're ready, Champion!"]);
    }
    this.save();
  },

  _whiteout() {
    for (const m of this.state.party) m.restore();
    this.state.money = Math.max(0, Math.floor(this.state.money * 0.5));
    this.overworld.p.gx = WORLD.start.x; this.overworld.p.gy = WORLD.start.y;
    this.overworld.p.moving = false; this.overworld.p.fromX = WORLD.start.x; this.overworld.p.fromY = WORLD.start.y;
    this.overworld._snapCam();
    this.scene = "overworld"; this.battle = null;
    Sound.music("town");
    this.overworld.showMessage(["You blacked out!", "You scurried back to Meadowlink Town, Pokémon healed but pockets lighter."]);
    this.save();
  },

  /* ---------- overworld callbacks ---------- */
  healParty() { for (const m of this.state.party) m.restore(); Sound.sfx("heal"); this.save(); },
  openMenu() { this.menu = new MenuScene(this); this.scene = "menu"; },
  closeMenu() { this.menu = null; this.scene = "overworld"; },
  openShop() { this.shop = new ShopScene(this); this.scene = "shop"; },
  closeShop() { this.shop = null; this.scene = "overworld"; },
  win() { this.scene = "win"; this.overlay = { t: 0 }; Sound.music("victory"); this.save(); },

  /* ---------- loop ---------- */
  loop(ts) {
    const dt = Math.min(0.05, (ts - this.last) / 1000 || 0);
    this.last = ts;
    this.update(dt);
    this.render();
    requestAnimationFrame(t => this.loop(t));
  },

  update(dt) {
    if (this.scene === "overworld") this.overworld.update(dt);
    else if (this.scene === "battle") this.battle.update(dt);
    else if (this.scene === "menu") this.menu.update(dt);
    else if (this.scene === "shop") this.shop.update(dt);
    else if (this.overlay) this.overlay.t += dt;
  },

  render() {
    const ctx = this.ctx;
    if (this.scene === "title") return this._renderTitle(ctx);
    if (this.scene === "starter") return this._renderStarter(ctx);
    if (this.scene === "overworld") { this.overworld.render(ctx); return; }
    if (this.scene === "battle") { this.battle.render(ctx); return; }
    if (this.scene === "menu") { this.overworld.render(ctx); this.menu.render(ctx); return; }
    if (this.scene === "shop") { this.overworld.render(ctx); this.shop.render(ctx); return; }
    if (this.scene === "win") return this._renderWin(ctx);
  },

  /* ---------- title ---------- */
  _renderTitle(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, BH);
    g.addColorStop(0, "#2a3f8a"); g.addColorStop(0.5, "#4a6fd0"); g.addColorStop(1, "#8fd0ff");
    ctx.fillStyle = g; ctx.fillRect(0, 0, BW, BH);
    // floating creatures
    const t = (this.last || 0) / 1000;
    const demo = ["emberling", "dewdrop", "sproutle", "zappup", "drakeling"];
    for (let i = 0; i < demo.length; i++) {
      const x = 90 + i * 135, y = 360 + Math.sin(t * 1.5 + i) * 10;
      SPRITES.draw(ctx, SPECIES[demo[i]].form, x, y, 40, { t, phase: i * 1.3 });
    }
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff"; ctx.strokeStyle = "#1a2a5a"; ctx.lineWidth = 8; ctx.lineJoin = "round";
    ctx.font = "800 64px 'Segoe UI', system-ui, sans-serif";
    ctx.strokeText("POCKET FRONTIER", BW / 2, 130); ctx.fillStyle = "#ffe36a"; ctx.fillText("POCKET FRONTIER", BW / 2, 130);
    ctx.fillStyle = "#eaf2ff"; ctx.font = "600 20px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("A monster-taming adventure", BW / 2, 168);

    const hasSave = Save.has();
    const opts = ["New Adventure", hasSave ? "Continue" : "Continue (no save)"];
    ctx.font = "700 26px 'Segoe UI', system-ui, sans-serif";
    for (let i = 0; i < 2; i++) {
      const sel = i === this.titleSel;
      const dim = i === 1 && !hasSave;
      ctx.fillStyle = dim ? "rgba(255,255,255,0.4)" : sel ? "#ffe36a" : "#fff";
      ctx.fillText((sel ? "▶ " : "") + opts[i], BW / 2, 250 + i * 42);
    }
    ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.font = "500 15px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("Arrows/WASD move · Z or Enter confirm · X back · Shift run · M menu", BW / 2, BH - 20);
  },

  /* ---------- starter select ---------- */
  _renderStarter(ctx) {
    ctx.fillStyle = "#eef4fb"; ctx.fillRect(0, 0, BW, BH);
    ctx.fillStyle = "#2a3550"; ctx.textAlign = "center";
    ctx.font = "800 34px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("Choose your first partner", BW / 2, 60);
    ctx.font = "500 17px 'Segoe UI', system-ui, sans-serif"; ctx.fillStyle = "#55607a";
    ctx.fillText("Prof. Elm-Wood offers you three. Choose wisely — this bond lasts a lifetime.", BW / 2, 90);
    const t = (this.last || 0) / 1000;
    for (let i = 0; i < 3; i++) {
      const cx = 160 + i * 200, cy = 220, sel = i === this.starterSel;
      const sp = SPECIES[STARTERS[i]];
      // card
      ctx.save();
      ctx.fillStyle = sel ? "#fff" : "#f2f5fa"; ctx.strokeStyle = sel ? TYPES.color[sp.types[0]] : "#c8d2e0"; ctx.lineWidth = sel ? 5 : 2;
      this._roundRect(ctx, cx - 88, cy - 120, 176, 240, 16); ctx.fill(); ctx.stroke();
      ctx.restore();
      SPRITES.draw(ctx, sp.form, cx, cy - 20, 54, { t, phase: i, squash: sel ? 0.03 * Math.sin(t * 6) : 0 });
      ctx.textAlign = "center"; ctx.fillStyle = "#2a3550"; ctx.font = "800 22px 'Segoe UI', system-ui, sans-serif";
      ctx.fillText(sp.name, cx, cy + 66);
      // type badges
      let bx = cx - (sp.types.length * 34);
      for (const ty of sp.types) { ctx.fillStyle = TYPES.color[ty]; this._roundRect(ctx, bx, cy + 78, 62, 20, 6); ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = "700 12px 'Segoe UI',sans-serif"; ctx.fillText(ty.toUpperCase(), bx + 31, cy + 92); bx += 70; }
    }
    // description of highlighted
    const sp = SPECIES[STARTERS[this.starterSel]];
    ctx.fillStyle = "#3a4560"; ctx.font = "500 16px 'Segoe UI', system-ui, sans-serif"; ctx.textAlign = "center";
    this._wrapCenter(ctx, sp.entry, BW / 2, 400, 560, 22);
    ctx.fillStyle = "#8894a8"; ctx.font = "600 14px 'Segoe UI',sans-serif";
    ctx.fillText("← → choose · Z confirm · X back", BW / 2, BH - 18);
  },

  _renderWin(ctx) {
    const t = this.overlay.t;
    const g = ctx.createLinearGradient(0, 0, 0, BH);
    g.addColorStop(0, "#ffe9a8"); g.addColorStop(1, "#ffb3c8");
    ctx.fillStyle = g; ctx.fillRect(0, 0, BW, BH);
    for (let i = 0; i < 40; i++) { const x = (i * 97 + t * 60) % BW, y = (i * 53 + t * 120) % BH; ctx.fillStyle = ["#ff5a3a", "#ffe36a", "#5ec46a", "#4aa8e0", "#f06fa6"][i % 5]; ctx.fillRect(x, y, 5, 9); }
    ctx.textAlign = "center"; ctx.fillStyle = "#7a3a10"; ctx.font = "800 52px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("CHAMPION!", BW / 2, 180);
    ctx.fillStyle = "#5a3a20"; ctx.font = "600 20px 'Segoe UI', system-ui, sans-serif";
    this._wrapCenter(ctx, `${this.state.name}, you bested every trainer of Route 1 and became Champion of the Frontier. Your partners stand proud beside you.`, BW / 2, 240, 560, 28);
    ctx.fillStyle = "#7a3a10"; ctx.font = "700 18px 'Segoe UI',sans-serif";
    const seen = Object.keys(this.state.caught).length;
    ctx.fillText(`Pokémon caught: ${seen}/${Object.keys(SPECIES).length}   ·   Press Z to keep exploring`, BW / 2, 360);
  },

  /* ---------- shared draw helpers ---------- */
  _roundRect(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); },
  _wrapCenter(ctx, text, cx, y, maxW, lh) {
    const words = String(text).split(" "); let line = "", yy = y, lines = [];
    for (const wd of words) { const test = line ? line + " " + wd : wd; if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = wd; } else line = test; }
    if (line) lines.push(line);
    for (const l of lines) { ctx.fillText(l, cx, yy); yy += lh; }
  },

  /* ---------- input ---------- */
  _bindKeys() {
    const map = e => {
      switch (e.code) {
        case "ArrowUp": case "KeyW": return "up";
        case "ArrowDown": case "KeyS": return "down";
        case "ArrowLeft": case "KeyA": return "left";
        case "ArrowRight": case "KeyD": return "right";
        case "Enter": case "KeyZ": case "Space": return "a";
        case "KeyX": case "Backspace": return "b";
        case "ShiftLeft": case "ShiftRight": return "run";
        case "Escape": case "Tab": case "KeyM": return "start";
      }
      return null;
    };
    window.addEventListener("keydown", e => {
      const k = map(e); if (!k) return;
      e.preventDefault();
      Sound.unlock();
      this._key(k, e.repeat);
    });
    window.addEventListener("keyup", e => {
      const k = map(e); if (!k) return;
      if (this.scene === "overworld" && (k === "up" || k === "down" || k === "left" || k === "right")) this.overworld.setDir(k, false);
      if (k === "run" && this.overworld) this.overworld.setRun(false);
      if (this.scene === "battle" && this.battle) this.battle.inputUp(k);
    });
  },

  _key(k, repeat) {
    const dir = k === "up" || k === "down" || k === "left" || k === "right";
    switch (this.scene) {
      case "title":
        if (repeat) return;
        if (k === "up" || k === "down") this.titleSel ^= 1;
        else if (k === "a") { if (this.titleSel === 1 && Save.has()) { this.continueGame(); } else { this.scene = "starter"; this.starterSel = 0; } }
        break;
      case "starter":
        if (repeat) return;
        if (k === "left") this.starterSel = (this.starterSel + 2) % 3;
        else if (k === "right") this.starterSel = (this.starterSel + 1) % 3;
        else if (k === "a") this.newGame(STARTERS[this.starterSel]);
        else if (k === "b") this.scene = "title";
        break;
      case "overworld":
        if (k === "run") { this.overworld.setRun(true); break; }
        if (dir) { this.overworld.setDir(k, true); break; }
        if (repeat) return;
        this.overworld.press(k);
        break;
      case "battle":
        if (repeat && k !== "a") return;
        this.battle.input(k);
        break;
      case "menu":
        if (repeat) return; this.menu.input(k); break;
      case "shop":
        if (repeat) return; this.shop.input(k); break;
      case "win":
        if (k === "a") { this.scene = "overworld"; Sound.music("route"); }
        break;
    }
  },

  _resize() {
    const scale = Math.min(window.innerWidth / BW, window.innerHeight / BH);
    this.canvas.style.width = Math.floor(BW * scale) + "px";
    this.canvas.style.height = Math.floor(BH * scale) + "px";
  },
};

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => Game.init());
  // expose for the console & tooling (the game itself uses the lexical bindings)
  window.Game = Game;
  window.PF = { U, TYPES, SPRITES, MOVES, ITEMS, SPECIES, Monster, Battle, WORLD, Save, Sound };
}
if (typeof module !== "undefined" && module.exports) module.exports = { Game, STARTERS };
