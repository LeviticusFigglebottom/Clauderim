/* ============================================================
   CLAUDERIM — main.js
   Boot, the game-state machine, the main loop, map
   transitions, interaction scanning, death & respawn,
   world clock and weather.
   ============================================================ */
"use strict";

const Game = {

  /* ---------------- boot ---------------- */

  boot() {
    G.loadSettings();
    G.canvas = U.el("game");
    G.ctx = G.canvas.getContext("2d");
    RenderFP.applySettings();
    Input.init(G.canvas);
    Render.init();
    UI.init();
    this.fitScreen();
    window.addEventListener("resize", () => this.fitScreen());
    Music.setMood("title");

    this.last = performance.now();
    requestAnimationFrame(t => this.loop(t));
  },

  fitScreen() {
    const root = U.el("game-root");
    const s = Math.min(window.innerWidth / G.W, window.innerHeight / G.H);
    root.style.transform = `translate(-50%, -50%) scale(${s})`;
  },

  /* ---------------- session starts ---------------- */

  newGame(name, originId) {
    G.seed = (U.hashStr(name) ^ 0x5EED1) >>> 0;
    G.cycle = 0;
    G.flags = {}; G.openedChests = {}; G.slainBosses = {};
    G.discoveredShrines = {}; G.discoveredPois = {};
    G.lostEmbers = null; G.maps = {}; G.overworld = null; G.bossFight = null;
    G.gauntletActive = false;
    G.time = { day: 1, hour: 8.5 };
    G.weather = { kind: "clear", t: 0, next: 70, intensity: 0 };
    Render.chunkCache.clear();
    Render.minimapCanvas = null;

    G.bounties = [];
    G.birds = [];
    G.fishing = null;
    G.player = new Player(name, originId);
    const ow = World.getMap("overworld");
    this.refreshBounties();
    const first = ow.shrines.find(s => s.id === "first_shrine");
    G.player.x = first.x + 20; G.player.y = first.y + 26;
    G.player.respawn = { map: "overworld", x: first.x + 20, y: first.y + 26, shrine: "first_shrine" };
    G.discoveredShrines.first_shrine = true;

    QS.start("mq_ember");

    U.hide("chargen-screen");
    U.hide("title-screen");
    U.show("hud-dom");
    this.enterMap("overworld", G.player.x, G.player.y, true);
    G.viewMode = "fp";
    G.setState("play");
    G.banner("THE SHATTERED MARCH", "the Ember gutters · the March remembers");
    G.msg("You wake with ash on your tongue. A woman in lamplight watches you. [E] to speak, [Tab] for your pack.", "good");
    G.msg("Click to capture the mouse and look around — [V] toggles the top-down view.", "");
    G.tip("belt", "Gear and potions you gather slot onto your belt — wheel or [ ] to choose a slot, T to use it.");
    G.tip("favorites", "Press Z for favorites — star anything in your pack or spellbook to reach it fast.");
    if (G.player.spells.length) G.tip("spell", "Q casts your equipped spell. Change it in the Magic tab, or slot it on your belt.");
    this.lastRegion = "";
  },

  loadGame(slot) {
    const mapId = SaveSys.load(slot);
    if (!mapId) { G.msg("That ember has gone cold (load failed).", "bad"); return; }
    Render.chunkCache.clear();
    Render.minimapCanvas = null;
    U.hide("title-screen");
    U.hide("chargen-screen");
    U.hide("station-screen");
    U.hide("ending-screen");
    U.show("hud-dom");
    if (!G.bounties || !G.bounties.length) this.refreshBounties();
    this.enterMap(mapId, G.player.x, G.player.y, true);
    G.setState("play");
    G.banner(World.regionNameAt(G.map, G.player.x, G.player.y));
    G.msg("The shrine breathes you back. Welcome again, Emberborn.", "ember");
    this.lastRegion = "";
  },

  /* ---------------- the next cycle (NG+) ---------------- */

  newCycle() {
    const p = G.player;
    G.cycle = (G.cycle || 0) + 1;
    // the March renews: world state resets, the pilgrim endures
    G.flags = {}; G.openedChests = {}; G.slainBosses = {};
    G.discoveredShrines = { first_shrine: true };
    G.discoveredPois = {};
    G.lostEmbers = null; G.maps = {}; G.overworld = null; G.bossFight = null;
    G.gauntletActive = false;
    G.bounties = [];
    G.fishing = null;
    G.time = { day: 1, hour: 8.5 };
    G.weather = { kind: "clear", t: 0, next: 70, intensity: 0 };
    Render.chunkCache.clear();
    Render.minimapCanvas = null;
    this.refreshBounties();

    // the cycle reclaims its tokens; your strength, gear and words remain
    for (const key of ["sigil_grave", "sigil_mire", "sigil_frost", "sigil_ash",
      "crypt_key", "citadel_key", "medicine_parcel", "pass_warhorn", "drowned_bell_clapper"]) {
      while (p.hasItem(key)) p.removeItem(key, 1);
    }
    p.quests = {};
    p.hp = p.hpMax; p.stam = p.stamMax; p.mag = p.magMax;
    p.flask.charges = p.flask.max;
    p.status = {}; p.buffs = {}; p.undimmedUsed = false;
    QS.start("mq_ember");

    const ow = World.getMap("overworld");
    const first = ow.shrines.find(s => s.id === "first_shrine");
    p.respawn = { map: "overworld", x: first.x + 20, y: first.y + 26, shrine: "first_shrine" };
    U.show("hud-dom");
    this.enterMap("overworld", first.x + 20, first.y + 26, true);
    G.setState("play");
    G.banner("CYCLE " + U.roman(G.cycle + 1), "the Ember gutters again · the March does not remember — you do");
    G.msg("The shrine breathes you out once more. The world is harder this time; so are you.", "ember");
    Music.setMood("world");
    SaveSys.save(G.saveSlot);
    this.lastRegion = "";
  },

  /* ---------------- map transitions ---------------- */

  enterMap(id, x, y, keepBanner) {
    G.bossFight = null;
    UI.hideBossBar();
    G.map = World.getMap(id);
    G.player.x = x; G.player.y = y;
    Spawn.populate(G.map);
    G.camera.x = U.clamp(x - G.W / 2, 0, G.map.w * TILE - G.W);
    G.camera.y = U.clamp(y - G.H / 2, 0, G.map.h * TILE - G.H);
    Music.setMood(G.map.outdoor ? "world" : "dungeon");
    if (!keepBanner) G.banner(G.map.name);
    QS.update();
  },

  usePortal(portal) {
    const p = G.player;
    if (portal.lockedBy === "crypt_key") {
      if (!p.hasItem("crypt_key")) { G.msg("Locked. The innkeeper keeps the crypt key.", "bad"); Sfx.play("deny"); return; }
      if (!G.flags["unlocked_" + portal.id]) { G.flags["unlocked_" + portal.id] = true; G.msg("The crypt key turns. Cold air exhales.", ""); }
    } else if (portal.lockedBy === "sigils") {
      if (QS.sigilCount() < 4) {
        G.msg(`The gates of the Citadel ignore you. Four words open them; you hold ${QS.sigilCount()}.`, "bad");
        Sfx.play("deny");
        return;
      }
      if (!G.flags["unlocked_" + portal.id]) {
        G.flags["unlocked_" + portal.id] = true;
        G.banner("VAL · SUTH · KYR · THUR", "the gates remember their language");
      }
    }
    Sfx.play("door");
    if (portal.exit) {
      // leaving an interior: return to overworld at the dungeon mouth
      const poi = World.poiById(portal.toPoi);
      this.enterMap("overworld", poi.tx * TILE + 16, (poi.ty + 2) * TILE + 16);
    } else {
      const dest = World.getMap(portal.to);
      this.enterMap(portal.to, dest.arrival.x, dest.arrival.y + 20);
    }
  },

  fastTravel(mapId, shrineId) {
    const m = World.getMap(mapId);
    const s = m.shrines.find(q => q.id === shrineId);
    if (!s) return;
    G.time.hour += 1.5;
    this.enterMap(mapId, s.x + 18, s.y + 24);
    G.msg("You walk the ember-paths between flames.", "ember");
  },

  /* ---------------- shrine rites ---------------- */

  restAtShrine(s) {
    const p = G.player;
    p.hp = p.hpMax; p.stam = p.stamMax; p.mag = p.magMax;
    p.flask.charges = p.flask.max;
    p.status = {}; p.undimmedUsed = false;
    p.respawn = { map: G.map.id, x: s.x + 18, y: s.y + 24, shrine: s.id };
    World.restReset();
    Spawn.populate(G.map);
    G.time.hour += 1;
    Sfx.play("shrine");
    FX.burst(s.x, s.y - 20, "#ff8c3a", 26, 120);
    G.banner("RESTED", "the flask is full · the slain return");
    this.refreshBounties();
    SaveSys.save(G.saveSlot);
    G.msg("The world is saved. (slot " + G.saveSlot + ")", "good");
  },

  /* ---------------- death & respawn ---------------- */

  onPlayerDeath() {
    const p = G.player;
    if (G.state === "dead") return;
    p.dead = true;
    p.statsDeaths++;
    Sfx.play("death");
    Music.setMood("title");

    // drop embers where you fell (overwriting any previous drop)
    if (G.lostEmbers && G.lostEmbers.amount > 0) {
      G.msg(`${U.fmt(G.lostEmbers.amount)} lost embers fade forever.`, "bad");
    }
    G.lostEmbers = p.embers > 0 ? { mapId: G.map.id, x: p.x, y: p.y, amount: p.embers } : null;
    p.embers = 0;
    G.tip("death", "Your embers stay where you fell. Reclaim them on your next run — but fall again first and they gutter out for good.");

    G.setState("dead");
    const ds = U.el("death-screen");
    U.el("death-sub").textContent = G.lostEmbers
      ? `${U.fmt(G.lostEmbers.amount)} embers smolder where you fell.`
      : "The shrine breathes in.";
    ds.classList.remove("hidden");
    requestAnimationFrame(() => ds.classList.add("on"));

    setTimeout(() => this.respawn(), 3600);
  },

  respawn() {
    if (G.state !== "dead") return; // the timer may outlive a state change
    const p = G.player;
    p.dead = false;
    p.hp = p.hpMax; p.stam = p.stamMax; p.mag = p.magMax;
    p.flask.charges = p.flask.max;
    p.status = {}; p.buffs = {}; p.atk = null; p.cast = null; p.draw = null;
    p.staggerT = 0; p.undimmedUsed = false;
    G.bossFight = null;
    UI.hideBossBar();
    World.restReset();
    this.enterMap(p.respawn.map, p.respawn.x, p.respawn.y);
    const ds = U.el("death-screen");
    ds.classList.remove("on");
    ds.classList.add("hidden");
    G.setState("play");
    G.banner("THE SHRINE BREATHES OUT");
    SaveSys.save(G.saveSlot);
  },

  /* ---------------- interaction scan ---------------- */

  findInteractable() {
    const p = G.player, map = G.map;
    const fp = G.viewMode === "fp";
    let best = null, bestD = 1e9;
    const consider = (x, y, range, kind, obj, prompt) => {
      const d = U.dist(p.x, p.y, x, y);
      if (d >= range + (fp ? 26 : 0)) return;
      let score = d;
      if (fp) {
        // first person: you interact with what you're LOOKING at
        const rel = Math.abs(U.angDiff(p.facing, U.angTo(p.x, p.y, x, y)));
        if (rel > 0.95 && d > 36) return; // behind you and not underfoot
        score = d * (0.45 + rel);
      }
      if (score < bestD) { bestD = score; best = { kind, obj, prompt }; }
    };
    for (const s of map.shrines) consider(s.x, s.y, 52, "shrine", s, "Kneel at the " + s.name);
    for (const e of G.entities) {
      if (e instanceof NPC) consider(e.x, e.y, 52, "npc", e, "Speak with " + e.def.name);
    }
    for (const c of map.chests) {
      if (!G.openedChests[c.id]) consider(c.x, c.y, 46, "chest", c, "Open chest");
    }
    for (const pk of map.pickups) {
      if (!pk.taken) consider(pk.x, pk.y, 40, "pickup", pk, (pk.vein ? "Mine " : "Gather ") + ITEMS[pk.item].name);
    }
    for (const pt of map.portals) consider(pt.x, pt.y, 48, "portal", pt, pt.exit ? pt.name : "Enter " + pt.name);
    for (const st of map.stations) {
      if (st.kind === "vault") {
        if (G.slainBosses.boss_maerodric) consider(st.x, st.y, 56, "vault", st, "Approach the First Ember");
      } else if (st.kind === "well") {
        consider(st.x, st.y, 46, "well", st, "Drink from the well");
      } else if (st.kind === "campfire") {
        consider(st.x, st.y, 46, "station", st, "Cook at the fire");
      } else if (st.kind === "waylamp") {
        if (!G.flags[st.flag]) consider(st.x, st.y, 46, "waylamp", st, "Light the cold way-lamp");
      } else if (st.kind === "passcairn") {
        if (!G.flags.pass_at_rest) consider(st.x, st.y, 50, "passcairn", st, "Sound the charge at the great cairn");
      } else if (st.kind === "gauntlet") {
        if (!G.gauntletActive) consider(st.x, st.y, 50, "gauntlet", st, `Light the brazier — wave ${(G.flags.gauntlet_wave || 0) + 1}`);
      } else if (st.kind === "enchant") {
        consider(st.x, st.y, 46, "station", st, "Work the Lampwright's altar");
      } else if (st.kind === "board") {
        consider(st.x, st.y, 46, "board", st, "Read the Wardens' Ledger");
      } else if (st.kind === "secret") {
        if (!G.flags["searched_" + st.id]) {
          const what = st.look === "crack" ? "the cracked wall" : st.look === "scorch" ? "the scorched ground" : "the odd cairn";
          consider(st.x, st.y, 42, "secret", st, "Search " + what);
        }
      } else {
        consider(st.x, st.y, 46, "station", st, st.kind === "smith" ? "Use the forge" : "Use the alchemy bench");
      }
    }
    if (map.graves) {
      for (const g of map.graves) {
        if (!G.flags["searched_" + g.id]) consider(g.x, g.y, 40, "grave", g, "Search the grave");
      }
    }
    if (map.statues) {
      for (const st of map.statues) {
        if (!G.flags["searched_" + st.id]) consider(st.x, st.y, 40, "statue", st, "Search the frozen soldier");
      }
    }
    if (G.lostEmbers && G.lostEmbers.mapId === map.id) {
      consider(G.lostEmbers.x, G.lostEmbers.y, 40, "embers", G.lostEmbers, "Reclaim your lost embers");
    }
    // last resort: a quiet shore and a rod in the pack
    if (!best && p.hasItem("fishing_rod") && !G.fishing) {
      const bx = p.x + Math.cos(p.facing) * 60, by = p.y + Math.sin(p.facing) * 60;
      const t = World.tileAt(map, (bx / TILE) | 0, (by / TILE) | 0);
      if (t === T.WATER || t === T.DEEPWATER) {
        best = { kind: "fish", obj: { x: bx, y: by }, prompt: "Cast a line" };
      }
    }
    return best;
  },

  interact(t) {
    const p = G.player;
    switch (t.kind) {
      case "shrine": {
        const s = t.obj;
        if (!G.discoveredShrines[s.id]) {
          G.discoveredShrines[s.id] = true;
          G.questToast("SHRINE DISCOVERED", s.name);
          Sfx.play("shrine");
        }
        p.respawn = { map: G.map.id, x: s.x + 18, y: s.y + 24, shrine: s.id };
        UI.openShrine(s);
        break;
      }
      case "npc": UI.openDialogue(t.obj.npcId); break;
      case "chest": {
        const c = t.obj;
        G.openedChests[c.id] = true;
        Sfx.play("chest");
        const table = LOOT[c.tier];
        const rolls = c.tier === "chest_rare" ? 3 : 2;
        for (let i = 0; i < rolls; i++) {
          const roll = U.weighted(Math.random, table);
          if (roll.gold) {
            const g = U.randi(Math.random, roll.gold[0], roll.gold[1]);
            p.gold += g;
            G.msg(`Found ${g} gold`, "good");
          } else if (roll.id) {
            const n = roll.n ? U.randi(Math.random, roll.n[0], roll.n[1]) : 1;
            p.addItem(roll.id, n);
            G.msg(`Found ${ITEMS[roll.id].name}${n > 1 ? " ×" + n : ""}`, "good");
          }
        }
        break;
      }
      case "pickup": {
        const pk = t.obj;
        pk.taken = true;
        p.addItem(pk.item, pk.n || 1);
        if (ITEMS[pk.item].type === "ingredient") p.gainSkill("alchemy", 3);
        Sfx.play("pickup");
        G.msg(`+ ${ITEMS[pk.item].name}${(pk.n || 1) > 1 ? " ×" + pk.n : ""}`, "");
        break;
      }
      case "portal": this.usePortal(t.obj); break;
      case "station": {
        if (t.obj.kind === "enchant") UI.openEnchant();
        else UI.openCraft(t.obj.kind === "campfire" ? "cook" : t.obj.kind);
        break;
      }
      case "vault": UI.openEndingChoice(); break;
      case "well": {
        p.heal(12);
        delete p.status.burn;
        Sfx.play("drink");
        G.msg("Cold, clean well-water. The March still has its small mercies.", "good");
        break;
      }
      case "waylamp": {
        G.flags[t.obj.flag] = true;
        G.map.lights.push({ x: t.obj.x, y: t.obj.y, r: 150, color: "255,190,110", flicker: true });
        Sfx.play("shrine");
        FX.burst(t.obj.x, t.obj.y - 14, "#ffc060", 22, 110);
        const lit = QS.flagCount("waylamp_um_");
        G.questToast("WAY-LAMP LIT", lit + " of 3 burn in the deep");
        break;
      }
      case "statue": {
        const st = t.obj;
        G.flags["searched_" + st.id] = true;
        Sfx.play("door");
        const roll = Math.random();
        if (!G.flags.pass_at_rest && roll < 0.28) {
          G.msg("The ice cracks. The soldier finishes a four-hundred-year-old stride.", "bad");
          // the statue steps out of itself
          const tx = (st.x / TILE) | 0, ty = (st.y / TILE) | 0;
          if (World.decoAtTile(G.map, tx, ty) === D.FROZEN) G.map.deco[ty * G.map.w + tx] = D.NONE;
          const e = new Enemy("thawed_soldier", st.x, st.y + 20);
          e.enterChase();
          G.entities.push(e);
          FX.burst(st.x, st.y, "#bfeaff", 18, 110);
          Sfx.play("moan");
        } else if (roll < 0.62 || G.flags.pass_at_rest && roll < 0.5) {
          if (!G.flags.found_passwarden && Math.random() < 0.07) {
            G.flags.found_passwarden = true;
            p.addItem("passwarden_cloak", 1);
            G.msg("Beneath the rime: the Passwarden's Cloak, warm as the day it failed to matter.", "good");
          } else {
            const finds = [["gold", U.randi(Math.random, 12, 50)], ["frost_crystal", 1], ["silver_dust", 1], ["frostmoss", 2]];
            const f = finds[(Math.random() * finds.length) | 0];
            p.addItem(f[0], f[1]);
            G.msg(f[0] === "gold" ? `Frozen purse: ${f[1]} gold` : `Recovered: ${ITEMS[f[0]].name}${f[1] > 1 ? " ×" + f[1] : ""}`, "good");
          }
        } else {
          G.msg("A face under the ice, mid-shout. You leave it its dignity.", "");
        }
        break;
      }
      case "passcairn": {
        if (!p.hasItem("pass_warhorn")) {
          G.msg("The cairn waits for a signal four hundred years overdue. You have no horn to sound.", "bad");
          Sfx.play("deny");
          break;
        }
        p.removeItem("pass_warhorn", 1);
        G.flags.pass_at_rest = true;
        Sfx.play("edict");
        G.shake(6, 0.8);
        G.banner("THE CHARGE SOUNDS", "and two thousand spears come to rest");
        G.msg("One long note. The wind through the frozen lines sings it back — and then, at last, quiet.", "good");
        FX.ring(t.obj.x, t.obj.y, 300, "#bfeaff");
        QS.update();
        break;
      }
      case "gauntlet": this.startGauntletWave(); break;
      case "fish": this.startFishing(t.obj.x, t.obj.y); break;
      case "board": UI.openBoard(); break;
      case "secret": {
        const st = t.obj;
        G.flags["searched_" + st.id] = true;
        Sfx.play("chest");
        FX.burst(st.x, st.y, "#ffd9a0", 16, 130);
        const roll = U.weighted(Math.random, LOOT[st.tier] || LOOT.chest_fine);
        if (roll.gold) { const g = U.randi(Math.random, roll.gold[0], roll.gold[1]); p.gold += g; G.msg(`A hidden cache — ${g} gold.`, "good"); }
        else if (roll.id) { const n = roll.n ? U.randi(Math.random, roll.n[0], roll.n[1]) : 1; p.addItem(roll.id, n); G.msg(`A hidden cache — ${ITEMS[roll.id].name}${n > 1 ? " ×" + n : ""}.`, "good"); }
        p.gainEmbers(40);
        G.tip("secret", "The March hides its kindnesses. Watch for ground that doesn't match — cracked walls, odd cairns, scorched earth.");
        break;
      }
      case "grave": {
        const g = t.obj;
        G.flags["searched_" + g.id] = true;
        Sfx.play("door");
        const roll = Math.random();
        if (roll < 0.40) {
          const finds = [["old_bone", 2], ["silver_dust", 1], ["gold", U.randi(Math.random, 8, 40)], ["ember_shard", 1]];
          const f = finds[(Math.random() * finds.length) | 0];
          p.addItem(f[0], f[1]);
          G.msg(f[0] === "gold" ? `Grave goods: ${f[1]} gold` : `Grave goods: ${ITEMS[f[0]].name}${f[1] > 1 ? " ×" + f[1] : ""}`, "good");
        } else if (roll < 0.72) {
          G.msg("Dust, roots, and somebody's patience. Nothing more.", "");
        } else {
          G.msg("The grave was not empty. It is now.", "bad");
          const ang = Math.random() * TAU;
          const e = new Enemy("hollow_thrall", g.x + Math.cos(ang) * 30, g.y + Math.sin(ang) * 30);
          e.enterChase();
          G.entities.push(e);
          FX.burst(g.x, g.y, "#7d8278", 16, 100);
        }
        break;
      }
      case "embers": {
        p.gainEmbers(t.obj.amount);
        G.lostEmbers = null;
        Sfx.play("shrine");
        G.questToast("EMBERS RECLAIMED", U.fmt(t.obj.amount) + " returned to you");
        break;
      }
    }
  },

  /* ---------------- fishing ---------------- */

  startFishing(bx, by) {
    G.fishing = { x: bx, y: by, t: 0, biteAt: 2 + Math.random() * 4, state: "wait" };
    Sfx.play("splash");
    G.msg("The line settles. Wait for the bite — [E] to strike, move to give up.", "");
    const p = G.player;
    p.blocking = false; p.draw = null; p.atk = null;
  },

  updateFishing(dt) {
    const f = G.fishing;
    if (!f) return;
    const p = G.player;
    // movement, combat or harm reels in empty
    if (p.moving || p.atk || p.rollT > 0 || p.dead || p.flashT > 0.1) {
      G.fishing = null;
      G.msg("The line comes back empty.", "");
      return;
    }
    f.t += dt;
    if (f.state === "wait" && f.t >= f.biteAt) {
      f.state = "bite";
      f.t = 0;
      Sfx.play("bite");
      G.float(f.x, f.y - 14, "!", "#ffe9a8", 22);
      FX.ring(f.x, f.y, 18, "#bcd8e8");
    } else if (f.state === "bite" && f.t > 0.9) {
      f.state = "wait";
      f.t = 0;
      f.biteAt = 1.5 + Math.random() * 3.5;
    }
    if (Input.pressed("interact")) {
      if (f.state === "bite") {
        // the catch
        p.statsFish++;
        const roll = Math.random();
        if (roll < 0.07) {
          // the water keeps more than fish
          const tr = Math.random();
          if (tr < 0.5) { const g = U.randi(Math.random, 15, 60); p.gold += g; G.msg(`The hook brings up a drowned purse: ${g} gold.`, "good"); }
          else if (tr < 0.9) { p.addItem("tide_pearl", 1); G.msg("A tideglass pearl, cold and regretful.", "good"); }
          else { p.addItem("ember_shard", 1); G.msg("Something warm from somewhere deep: an ember shard.", "good"); }
        } else {
          const b = World.biomeAtPx(G.map, f.x, f.y);
          const table = FISH_TABLES[b] || FISH_TABLES[5];
          const fish = U.weighted(Math.random, table);
          p.addItem(fish.id, 1);
          G.msg(`Caught: ${ITEMS[fish.id].name}`, "good");
        }
        Sfx.play("pickup");
        FX.burst(f.x, f.y, "#bcd8e8", 14, 90);
        G.fishing = null;
      } else {
        G.fishing = null;
        G.msg("Too eager. The water keeps its counsel.", "");
        Sfx.play("deny");
      }
    }
  },

  /* ---------------- the Wardens' Ledger (radiant bounties) ---------------- */

  genBounty() {
    const cyc = G.cycle || 0;
    const mult = 1 + 0.6 * cyc;
    const kindRoll = Math.random();
    const uid = "b" + Date.now() + (Math.random() * 1e5 | 0);
    if (kindRoll < 0.5) {
      const culls = [
        ["wolf", "the Heartlands", 6], ["bandit", "the roads", 5], ["hollow_thrall", "the old graves", 6],
        ["mire_leech", "the Mire", 7], ["ash_imp", "the Ashlands", 6], ["dire_wolf", "the Greywood", 3],
        ["thawed_soldier", "the White Pass", 4], ["tidelost_drowned", "the Strand", 5], ["grave_wisp", "the barrows", 4],
      ];
      const c = culls[(Math.random() * culls.length) | 0];
      return { uid, kind: "cull", enemy: c[0], region: c[1], need: c[2], progress: 0,
        gold: Math.round(c[2] * 18 * mult), embers: Math.round(c[2] * 14 * mult), taken: false, claimed: false };
    } else if (kindRoll < 0.82) {
      const gathers = [["glowcap", 6], ["mireweed", 6], ["frostmoss", 5], ["iron_ore", 5], ["emberbloom", 4], ["tide_pearl", 2]];
      const g = gathers[(Math.random() * gathers.length) | 0];
      return { uid, kind: "gather", item: g[0], need: g[1], progress: 0,
        gold: Math.round(g[1] * 16 * mult), embers: Math.round(g[1] * 10 * mult), taken: false, claimed: false };
    }
    return { uid, kind: "elite", need: 1, progress: 0,
      gold: Math.round(130 * mult), embers: Math.round(160 * mult), taken: false, claimed: false };
  },

  refreshBounties() {
    if (!G.bounties) G.bounties = [];
    // contracts in progress stay pinned; the rest turn over
    G.bounties = G.bounties.filter(b => b.taken && !b.claimed);
    while (G.bounties.length < 3) G.bounties.push(this.genBounty());
  },

  onBountyKill(typeId, elite) {
    if (!G.bounties) return;
    for (const b of G.bounties) {
      if (!b.taken || b.claimed) continue;
      if (b.kind === "cull" && b.enemy === typeId && b.progress < b.need) {
        b.progress++;
        G.msg(`Ledger: ${ENEMY_TYPES[typeId].name} ${b.progress}/${b.need}`, "good");
        if (b.progress >= b.need) G.questToast("CONTRACT FULFILLED", "the Ledger will pay");
      } else if (b.kind === "elite" && elite && b.progress < b.need) {
        b.progress++;
        G.questToast("CONTRACT FULFILLED", "an ashen one, crossed off");
      }
    }
  },

  bountyText(b) {
    if (b.kind === "cull") return `Cull ${b.need} × ${ENEMY_TYPES[b.enemy].name} — ${b.region}`;
    if (b.kind === "gather") return `Deliver ${b.need} ${ITEMS[b.item].name}`;
    return "Put down an ashen elite — any road, any land";
  },

  /* ---------------- birds (the sky is alive) ---------------- */

  updateBirds(dt) {
    if (!G.birds) G.birds = [];
    const p = G.player;
    if (G.map && G.map.outdoor && G.darkness() < 0.55 && G.birds.length < 2 && Math.random() < dt * 0.05) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      G.birds.push({
        x: p.x - dir * 900, y: p.y - 200 - Math.random() * 400,
        vx: dir * (40 + Math.random() * 30), vy: (Math.random() - 0.5) * 8,
        n: 3 + (Math.random() * 3 | 0), phase: Math.random() * TAU, alt: 3 + Math.random() * 1.5,
      });
    }
    for (let i = G.birds.length - 1; i >= 0; i--) {
      const b = G.birds[i];
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.phase += dt * 9;
      if (!G.map || !G.map.outdoor || U.dist(b.x, b.y, p.x, p.y) > 1600) G.birds.splice(i, 1);
    }
  },

  /* ---------------- the Gauntlet of Sparks ---------------- */

  startGauntletWave() {
    const wave = (G.flags.gauntlet_wave || 0) + 1;
    const set = GAUNTLET_WAVES[(wave - 1) % GAUNTLET_WAVES.length];
    const cycle = Math.floor((wave - 1) / GAUNTLET_WAVES.length);
    G.gauntletActive = true;
    this.gauntletWave = wave;
    this.gauntletMembers = [];
    const cx = 15 * TILE + 16, cy = 14 * TILE + 16;
    let spawned = 0;
    for (const pair of set) {
      for (let i = 0; i < pair[1]; i++) {
        const ang = Math.random() * TAU;
        const r = (4 + Math.random() * 3.5) * TILE;
        const ex = cx + Math.cos(ang) * r, ey = cy + Math.sin(ang) * r;
        if (World.circleBlocked(G.map, ex, ey, 14)) continue;
        const e = new Enemy(pair[0], ex, ey);
        // deeper waves cycle harder: tougher stock, more ashen
        if (cycle > 0) { e.hpMax = Math.round(e.hpMax * (1 + cycle * 0.35)); e.hp = e.hpMax; e.dmgMult *= 1 + cycle * 0.2; }
        if (Math.random() < Math.min(0.6, cycle * 0.25 + (wave > 5 ? 0.15 : 0))) e.makeElite();
        e.enterChase();
        G.entities.push(e);
        this.gauntletMembers.push(e);
        spawned++;
      }
    }
    Sfx.play("roar");
    G.shake(4, 0.3);
    G.banner("WAVE " + wave, spawned + " enter the sand");
    Music.setMood("boss");
  },

  updateGauntlet() {
    if (!G.gauntletActive) return;
    if (!G.map || G.map.id !== "gauntlet" || G.state === "dead") {
      // leaving (or dying out of) the pit forfeits the wave
      G.gauntletActive = false;
      this.gauntletMembers = [];
      return;
    }
    this.gauntletMembers = this.gauntletMembers.filter(e => !e.dead);
    if (this.gauntletMembers.length === 0) {
      G.gauntletActive = false;
      const wave = this.gauntletWave;
      G.flags.gauntlet_wave = wave;
      const cycle = Math.floor((wave - 1) / GAUNTLET_WAVES.length);
      const purse = Math.round(120 * wave * (1 + cycle * 0.5));
      G.player.gainEmbers(purse);
      G.questToast("WAVE " + wave + " CLEARED", "+" + U.fmt(purse) + " embers — the brazier waits");
      Sfx.play("victory");
      Music.setMood("dungeon");
      if (wave >= 5 && !G.flags.gauntlet_w5) { G.flags.gauntlet_w5 = true; QS.update(); }
    }
  },

  /* ---------------- world clock & weather ---------------- */

  updateClock(dt) {
    G.time.hour += dt / 30; // one game hour per 30 real seconds
    if (G.time.hour >= 24) { G.time.hour -= 24; G.time.day++; G.msg("Day " + G.time.day + " breaks over the March.", ""); }

    const w = G.weather;
    w.t += dt;
    // storms argue with the sky
    G.lightning = Math.max(0, G.lightning - dt);
    if (w.kind === "rain" && w.intensity > 0.65 && G.map && G.map.outdoor && Math.random() < dt * 0.05) {
      G.lightning = 0.14 + Math.random() * 0.1;
      setTimeout(() => Sfx.play("thunder"), 250 + Math.random() * 900);
      G.shake(3, 0.3);
    }
    // intensity ramps toward target
    w.intensity = U.approach(w.intensity, w.kind === "clear" ? 0 : 1, dt * 0.3);
    if (w.t >= w.next) {
      w.t = 0; w.next = 60 + Math.random() * 120;
      const b = World.biomeAtPx(G.map, G.player ? G.player.x : 0, G.player ? G.player.y : 0);
      let opts;
      if (b === B.FROST) opts = [["clear", 3], ["snow", 5], ["fog", 2]];
      else if (b === B.MIRE) opts = [["clear", 2], ["fog", 4], ["rain", 4]];
      else if (b === B.ASHLAND) opts = [["clear", 3], ["ashfall", 5], ["fog", 1]];
      else opts = [["clear", 6], ["rain", 3], ["fog", 1]];
      const pick = U.weighted(Math.random, opts.map(o => ({ w: o[1], k: o[0] })));
      if (pick.k !== w.kind) { w.kind = pick.k; w.intensity = 0; }
    }
  },

  /* ---------------- the loop ---------------- */

  loop(t) {
    requestAnimationFrame(tt => this.loop(tt));
    const tLoop0 = performance.now();
    let dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    G.dt = dt;
    G.rdt = dt; // real frame dt — survives hit-stop, for render-side easing
    G.elapsed += dt;
    G.frame++;

    /* global key handling */
    this.handleMetaKeys();

    // hit-stop: a frozen beat of impact (world halts, rendering continues)
    if (G.hitstop > 0) {
      G.hitstop -= dt;
      dt = 0;
    }

    if (G.state === "play" || G.state === "dialogue" || G.state === "dead") {
      if (dt > 0) this.updateWorld(dt);
    }
    if (G.state !== "title" && G.state !== "chargen" && G.map) {
      this.updateCamera(dt);
      if (G.viewMode === "fp" && G.player) RenderFP.draw();
      else Render.draw();
      UI.updateBossBar();
    }

    // photo mode: this frame rendered clean — capture and hand it over
    if (G.photoHide) {
      G.photoHide = false;
      try {
        const url = G.canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = url;
        a.download = `clauderim_${Date.now()}.png`;
        a.click();
        G.msg("Vista captured.", "good");
      } catch (e) { G.msg("The light refused to be kept.", "bad"); }
    }
    if (G.state === "play" && Input.pressed("photo")) {
      G.photoHide = true; // next..this frame? next frame renders clean, then saves
      Sfx.play("shutter");
    }

    G.frameMsAll = (G.frameMsAll || 8) * 0.92 + (performance.now() - tLoop0) * 0.08;
    Input.endFrame();
  },

  /* ---------------- random encounters ---------------- */

  // a loud, unmissable heads-up that something just kicked off
  encounterAlert(title, sub, col) {
    G.banner(title, sub);
    G.questToast(title, sub);
    G.encAlertT = 5;           // HUD pulse window (render reads G.encAlertT)
    G.encAlertCol = col || "#d89090";
    Sfx.play("roar");
    G.shake(6, 0.45);
    G.msg(`⚔ ${title} — ${sub}`, "bad");
  },

  tickEncounters(dt) {
    const p = G.player;
    if (G.encAlertT) G.encAlertT = Math.max(0, G.encAlertT - dt);
    if (!p || p.dead || G.state !== "play" || !G.map.outdoor || G.bossFight) return;
    if (World.nearSafeZone(G.map, p.x, p.y, 80)) return;     // never at the town gate
    if (G.encCd === undefined) G.encCd = U.randf(Math.random, 60, 110);
    G.encCd -= dt;
    if (G.encCd > 0) return;
    G.encCd = U.randf(Math.random, 80, 150);
    // don't pile a new event onto an existing brawl
    let chasing = 0;
    for (const e of G.entities) if (e.isEnemy && !e.dead && e.state === "chase") chasing++;
    if (chasing > 2) return;
    this.spawnEncounter();
  },

  spawnEncounter() {
    const p = G.player, map = G.map;
    const key = BIOME_TABLE_KEYS[World.biomeAtPx(map, p.x, p.y)] || "heartlands";
    const table = (SPAWN_TABLES[key] || SPAWN_TABLES.heartlands).filter(r => {
      const def = ENEMY_TYPES[r.id];
      return def && def.behavior !== "flee" && !(def.tags && def.tags.includes("critter"));
    });
    if (!table.length) return;
    const pickEnemy = () => U.weighted(Math.random, table).id;
    const ring = (count, dist, elite) => {
      let made = 0;
      for (let n = 0; n < count; n++) {
        for (let tries = 0; tries < 8; tries++) {
          const a = Math.random() * TAU, rr = dist + Math.random() * 60;
          const ex = p.x + Math.cos(a) * rr, ey = p.y + Math.sin(a) * rr;
          if (World.circleBlocked(map, ex, ey, 14)) continue;
          const e = new Enemy(pickEnemy(), ex, ey);
          e.homeX = ex; e.homeY = ey;
          if (elite) e.makeElite();
          e.enterChase();
          G.entities.push(e);
          made++;
          break;
        }
      }
      return made;
    };

    // standing tilts the odds: the disliked are ambushed; the well-regarded find allies;
    // a road faction you've sided with leaves you be — and the one you crossed comes collecting
    const rep = p.getRep("march");
    const rf = G.flags.road_faction;
    const kind = U.weighted(Math.random, [
      { w: Math.max(1, 5 + (rep < 0 ? 3 : 0) - (rf === "ashcoat" ? 2 : 0)), t: "ambush" },
      { w: 2, t: "miniboss" },
      { w: 3 + (rep > 4 ? 3 : 0) + (rf && rf !== "none" ? 1 : 0), t: "skirmish" },
    ]).t;

    if (kind === "miniboss") {
      ring(1, 200, true);
      this.encounterAlert("AN ASHEN CHAMPION", "Something out there burns brighter — and meaner.", "#ff7a3a");
    } else if (kind === "skirmish") {
      ring(U.randi(Math.random, 3, 4), 170, false);                         // the bandits
      const guards = U.randi(Math.random, 2, 3);
      for (let n = 0; n < guards; n++) G.entities.push(new Ally("guard", 45, 1.4));  // March-guards, blades already out
      this.encounterAlert("A SKIRMISH", "March-guards and bandits, blade to blade. Pick a side or pass.", "#cbb78a");
    } else {
      ring(U.randi(Math.random, 3, 4), 150, false);
      // a crossed faction's reprisal is clearly named so it never reads as a random mob
      if (rf === "levy") this.encounterAlert("ASHCOAT REPRISAL", "The free company hasn't forgotten whose writ you signed.", "#c08a3a");
      else if (rf === "ashcoat") this.encounterAlert("LEVY PATROL", "Wardens' levy on the road — and they carry a writ with your name on it.", "#a8b0c0");
      else this.encounterAlert("AMBUSH", "Steel from the brush — they were waiting for you.", "#d89090");
    }
  },

  handleMetaKeys() {
    if (G.state === "play" && Input.pressed("toggleview")) {
      G.viewMode = G.viewMode === "fp" ? "top" : "fp";
      if (G.viewMode !== "fp" && document.exitPointerLock) document.exitPointerLock();
      G.msg(G.viewMode === "fp"
        ? "First person. Click to capture the mouse — V returns to top-down."
        : "Top-down view. V returns to first person.", "");
      Sfx.play("ui");
    }
    if (G.state === "play") {
      if (Input.pressed("menu")) UI.openMenu("inventory");
      else if (Input.pressed("map")) UI.openMenu("map");
      else if (Input.pressed("journal")) UI.openMenu("quests");
      else if (Input.pressed("character")) UI.openMenu("character");
      else if (Input.pressed("favorites")) UI.openFavorites();
      else if (Input.pressed("pause")) UI.openMenu("system");
    } else if (G.state === "favorites") {
      if (Input.pressed("pause") || Input.pressed("favorites")) UI.closeFavorites();
      else for (let n = 1; n <= 9; n++) if (Input.pressedRaw("Digit" + n)) { UI.favSelect(n); break; }
    } else if (G.state === "menu") {
      if (Input.pressed("pause") || Input.pressed("menu")) UI.closeMenu();
      else if (Input.pressed("map")) { UI.menuTab = "map"; UI.renderMenu(); }
      else if (Input.pressed("journal")) { UI.menuTab = "quests"; UI.renderMenu(); }
    } else if (G.state === "dialogue") {
      if (Input.pressed("pause")) UI.closeDialogue();
    } else if (G.state === "shrine") {
      if (Input.pressed("pause")) UI.closeShrine();
    } else if (G.state === "station") {
      if (Input.pressed("pause")) UI.closeStation();
    } else if (G.state === "help") {
      if (Input.pressed("pause")) U.el("help-close").click();
    }
  },

  updateWorld(dt) {
    const p = G.player;
    if (!p) return;

    G.slowmo = Math.max(0, G.slowmo - dt);
    this.updateClock(dt);

    if (G.state === "play") p.update(dt);

    // entities (only near the player, for scale)
    const aimScale = G.slowmoAim && p.draw ? 0.55 : 1;
    for (let i = G.entities.length - 1; i >= 0; i--) {
      const e = G.entities[i];
      if (e.dead) { G.entities.splice(i, 1); continue; }
      if (e.isEnemy && U.dist2(e.x, e.y, p.x, p.y) > 1300 * 1300) continue;
      e.update(e.isEnemy ? dt * aimScale : dt);
    }

    Projectile.update(dt);
    FX.update(dt);
    World.updateSpawners(dt);
    this.tickEncounters(dt);

    // corpses age out
    for (let i = G.corpsePile.length - 1; i >= 0; i--) {
      G.corpsePile[i].t += dt;
      if (G.corpsePile[i].t > 10) G.corpsePile.splice(i, 1);
    }

    // quests poll
    if (G.frame % 30 === 0) QS.update();
    if (G.frame % 10 === 0) this.updateGauntlet();
    this.updateFishing(dt);
    this.updateBirds(dt);

    // ambient life: fireflies, drifting embers, frost glints, marsh spores
    this.ambientT = (this.ambientT || 0) - dt;
    if (this.ambientT <= 0 && G.particles.length < 480) {
      this.ambientT = 0.22;
      const cx = G.camera.x + Math.random() * G.W, cy = G.camera.y + Math.random() * G.H;
      const b = G.map.outdoor ? World.biomeAtPx(G.map, cx, cy) : -1;
      const dark = G.darkness();
      let col = null, vy = 0, glow = false;
      if (!G.map.outdoor && G.map.ambient === "undermarch") { col = "rgba(150,170,220,0.5)"; vy = -7; glow = true; }
      else if (b === B.ASHLAND) { col = "rgba(255,140,60,0.7)"; vy = -16; glow = true; }
      else if ((b === B.HEART || b === B.FOREST) && dark > 0.45 && Math.random() < 0.8) { col = "rgba(190,230,130,0.9)"; vy = -4; glow = true; }
      else if (b === B.MIRE && dark > 0.3) { col = "rgba(150,210,170,0.6)"; vy = -6; glow = true; }
      else if (b === B.FROST && dark < 0.4 && Math.random() < 0.4) { col = "rgba(255,255,255,0.8)"; vy = 4; }
      if (col) {
        G.particles.push({
          x: cx, y: cy, vx: (Math.random() - 0.5) * 14, vy,
          life: 2.5 + Math.random() * 2.5, t: 0, color: col,
          size: 1.4 + Math.random() * 1.4, drag: 0, glow, wander: true,
        });
      }
    }

    // music mood by context
    if (G.frame % 90 === 0 && !G.bossFight && G.state === "play") {
      if (G.map.outdoor) {
        Music.setMood(World.nearSafeZone(G.map, p.x, p.y, 0) ? "town" : "world");
      } else {
        Music.setMood("dungeon");
      }
    }

    // region banner
    if (G.frame % 45 === 0 && G.map.outdoor && G.state === "play") {
      const rn = World.regionNameAt(G.map, p.x, p.y);
      if (rn !== this.lastRegion) {
        if (this.lastRegion) G.banner(rn.toUpperCase());
        this.lastRegion = rn;
      }
    }

    // interact prompt
    if (G.state === "play" && !G.fishing) {
      const it = this.findInteractable();
      const prompt = U.el("interact-prompt");
      if (it) {
        prompt.innerHTML = `<b>E</b>${U.esc(it.prompt)}`;
        prompt.classList.remove("hidden");
        if (Input.pressed("interact")) this.interact(it);
      } else {
        prompt.classList.add("hidden");
      }
    }
  },

  updateCamera(dt) {
    const p = G.player, map = G.map;
    if (!p || !map) return;
    const tx = U.clamp(p.x - G.W / 2, 0, Math.max(0, map.w * TILE - G.W));
    const ty = U.clamp(p.y - G.H / 2, 0, Math.max(0, map.h * TILE - G.H));
    G.camera.x = U.lerp(G.camera.x, tx, Math.min(1, 6 * dt));
    G.camera.y = U.lerp(G.camera.y, ty, Math.min(1, 6 * dt));
    if (G.camera.shake > 0) {
      G.camera.shake -= dt;
      const m = G.camera.shakeMag * (G.camera.shake > 0 ? G.camera.shake : 0) * 4;
      G.camera.x += (Math.random() - 0.5) * m;
      G.camera.y += (Math.random() - 0.5) * m;
      if (G.camera.shake <= 0) G.camera.shakeMag = 0;
    }
  },
};

/* attached to G for use from data files / dialogue actions */
G.restAtInn = function () {
  const p = G.player;
  p.hp = p.hpMax; p.stam = p.stamMax; p.mag = p.magMax;
  p.status = {};
  p.flask.charges = p.flask.max;
  p.undimmedUsed = false;
  G.time.hour = 8;
  G.time.day++;
  World.restReset();
  UI.closeDialogue();
  Spawn.populate(G.map);
  Sfx.play("shrine");
  G.banner("YOU SLEEP UNTIL MORNING", "day " + G.time.day);
};
G.onPlayerDeath = function () { Game.onPlayerDeath(); };

window.addEventListener("DOMContentLoaded", () => Game.boot());
