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
    G.canvas = U.el("game");
    G.ctx = G.canvas.getContext("2d");
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
    G.flags = {}; G.openedChests = {}; G.slainBosses = {};
    G.discoveredShrines = {}; G.discoveredPois = {};
    G.lostEmbers = null; G.maps = {}; G.overworld = null; G.bossFight = null;
    G.time = { day: 1, hour: 8.5 };
    G.weather = { kind: "clear", t: 0, next: 70, intensity: 0 };
    Render.chunkCache.clear();
    Render.minimapCanvas = null;

    G.player = new Player(name, originId);
    const ow = World.getMap("overworld");
    const first = ow.shrines.find(s => s.id === "first_shrine");
    G.player.x = first.x + 20; G.player.y = first.y + 26;
    G.player.respawn = { map: "overworld", x: first.x + 20, y: first.y + 26, shrine: "first_shrine" };
    G.discoveredShrines.first_shrine = true;

    QS.start("mq_ember");

    U.hide("chargen-screen");
    U.hide("title-screen");
    U.show("hud-dom");
    this.enterMap("overworld", G.player.x, G.player.y, true);
    G.setState("play");
    G.banner("THE SHATTERED MARCH", "the Ember gutters · the March remembers");
    G.msg("You wake with ash on your tongue. A woman in lamplight watches you. [E] to speak, [Tab] for your pack.", "good");
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
    this.enterMap(mapId, G.player.x, G.player.y, true);
    G.setState("play");
    G.banner(World.regionNameAt(G.map, G.player.x, G.player.y));
    G.msg("The shrine breathes you back. Welcome again, Emberborn.", "ember");
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
    let best = null, bestD = 1e9;
    const consider = (x, y, range, kind, obj, prompt) => {
      const d = U.dist(p.x, p.y, x, y);
      if (d < range && d < bestD) { bestD = d; best = { kind, obj, prompt }; }
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
      } else {
        consider(st.x, st.y, 46, "station", st, st.kind === "smith" ? "Use the forge" : "Use the alchemy bench");
      }
    }
    if (map.graves) {
      for (const g of map.graves) {
        if (!G.flags["searched_" + g.id]) consider(g.x, g.y, 40, "grave", g, "Search the grave");
      }
    }
    if (G.lostEmbers && G.lostEmbers.mapId === map.id) {
      consider(G.lostEmbers.x, G.lostEmbers.y, 40, "embers", G.lostEmbers, "Reclaim your lost embers");
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
      case "station": UI.openCraft(t.obj.kind === "campfire" ? "cook" : t.obj.kind); break;
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

  /* ---------------- world clock & weather ---------------- */

  updateClock(dt) {
    G.time.hour += dt / 30; // one game hour per 30 real seconds
    if (G.time.hour >= 24) { G.time.hour -= 24; G.time.day++; G.msg("Day " + G.time.day + " breaks over the March.", ""); }

    const w = G.weather;
    w.t += dt;
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
    let dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    G.dt = dt;
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
      Render.draw();
      UI.updateBossBar();
    }

    Input.endFrame();
  },

  handleMetaKeys() {
    if (G.state === "play") {
      if (Input.pressed("menu")) UI.openMenu("inventory");
      else if (Input.pressed("map")) UI.openMenu("map");
      else if (Input.pressed("journal")) UI.openMenu("quests");
      else if (Input.pressed("character")) UI.openMenu("character");
      else if (Input.pressed("pause")) UI.openMenu("system");
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

    // corpses age out
    for (let i = G.corpsePile.length - 1; i >= 0; i--) {
      G.corpsePile[i].t += dt;
      if (G.corpsePile[i].t > 10) G.corpsePile.splice(i, 1);
    }

    // quests poll
    if (G.frame % 30 === 0) QS.update();

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
    if (G.state === "play") {
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
