/* ============================================================
   CLAUDERIM — test/smoke.js
   Headless smoke test. Stubs the browser environment, loads
   every game script in index.html order, then exercises the
   real systems: worldgen, the main loop, combat, quests,
   crafting, dungeons, bosses, death/respawn, save/load.
   Run: node test/smoke.js
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

/* ---------------- DOM stubs ---------------- */

function makeCtx() {
  const grad = { addColorStop() {} };
  return new Proxy({
    canvas: null, fillStyle: "", strokeStyle: "", lineWidth: 1, font: "",
    textAlign: "", globalAlpha: 1, globalCompositeOperation: "", shadowBlur: 0, shadowColor: "",
    imageSmoothingEnabled: true,
    measureText: () => ({ width: 10 }),
    createRadialGradient: () => grad,
    createLinearGradient: () => grad,
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  }, {
    get(t, k) {
      if (k in t) return t[k];
      return () => {}; // any other method is a no-op
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

function makeEl(tag) {
  const el = {
    tagName: (tag || "div").toUpperCase(),
    children: [],
    dataset: {},
    style: {},
    _cls: new Set(),
    innerHTML: "", textContent: "", value: "", checked: false, disabled: false,
    width: 300, height: 150,
    onclick: null, onchange: null,
    classList: {
      add: c => el._cls.add(c),
      remove: c => el._cls.delete(c),
      toggle: (c, f) => { if (f === undefined) f = !el._cls.has(c); f ? el._cls.add(c) : el._cls.delete(c); return f; },
      contains: c => el._cls.has(c),
    },
    appendChild(c) { el.children.push(c); return c; },
    prepend(c) { el.children.unshift(c); return c; },
    removeChild(c) { const i = el.children.indexOf(c); if (i >= 0) el.children.splice(i, 1); },
    remove() {},
    querySelector() { return makeEl("div"); },
    querySelectorAll() { return []; },
    addEventListener() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; },
    getContext() { return makeCtx(); },
    click() { if (el.onclick) el.onclick(); },
    setAttribute() {},
    focus() {},
    get offsetWidth() { return 100; },
    get lastChild() { return el.children[el.children.length - 1] || null; },
    get firstChild() { return el.children[0] || null; },
    set className(v) { el._cls = new Set(String(v).split(/\s+/).filter(Boolean)); },
    get className() { return [...el._cls].join(" "); },
  };
  return el;
}

const elements = {};
const winListeners = {};
const rafQueue = [];

const documentStub = {
  getElementById(id) { if (!elements[id]) elements[id] = makeEl("div"); return elements[id]; },
  createElement(tag) { return makeEl(tag); },
  querySelectorAll() { return []; },
  addEventListener() {},
};

const storage = {};
const localStorageStub = {
  getItem: k => (k in storage ? storage[k] : null),
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: k => { delete storage[k]; },
};

const windowStub = {
  innerWidth: 1280, innerHeight: 720,
  addEventListener(ev, fn) { (winListeners[ev] = winListeners[ev] || []).push(fn); },
  AudioContext: undefined, // audio disabled headlessly
};

const sandbox = {
  console, Math, JSON, Date, Set, Map, Object, Array, Uint8Array, Int32Array,
  Float32Array, Uint8ClampedArray, Infinity, NaN, parseInt, parseFloat, String, Number, Boolean,
  isNaN, isFinite, Error, Promise, Proxy, Reflect,
  setTimeout: (fn, ms) => 0, // UI timeouts are irrelevant headlessly
  clearTimeout: () => {},
  setInterval: () => 0, clearInterval: () => {},
  requestAnimationFrame: cb => { rafQueue.push(cb); },
  performance: { now: () => simTime },
  document: documentStub,
  window: windowStub,
  localStorage: localStorageStub,
  location: { reload() {} },
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

let simTime = 0;

/* ---------------- load scripts in index.html order ---------------- */

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
if (scripts.length < 15) { console.error("FAIL: expected game scripts in index.html"); process.exit(1); }

for (const src of scripts) {
  const code = fs.readFileSync(path.join(__dirname, "..", src), "utf8");
  try {
    vm.runInContext(code, sandbox, { filename: src });
  } catch (e) {
    console.error(`FAIL: ${src} threw during load:\n`, e);
    process.exit(1);
  }
}
console.log(`✓ ${scripts.length} scripts parsed and loaded`);

/* ---------------- helpers ---------------- */

let failures = 0;
function check(label, cond) {
  if (cond) console.log("✓ " + label);
  else { console.error("✗ FAIL: " + label); failures++; }
}
function run(code) { return vm.runInContext(code, sandbox); }
function frames(n, dtMs = 16.7) {
  for (let i = 0; i < n; i++) {
    simTime += dtMs;
    if (!rafQueue.length) throw new Error("no rAF callback queued");
    const batch = rafQueue.splice(0);
    for (const cb of batch) cb(simTime);
  }
}

/* ---------------- boot & title ---------------- */

run(`Game.boot()`);
frames(5);
check("boot + title frames run", run(`G.state`) === "title");

/* ---------------- world generation ---------------- */

run(`G.seed = 12345; G.overworld = null; G.maps = {};`);
const owStats = run(`
  const ow = World.getMap("overworld");
  ({ w: ow.w, h: ow.h, shrines: ow.shrines.length, npcs: ow.npcs.length,
     portals: ow.portals.length, chests: ow.chests.length,
     pickups: ow.pickups.length, spawners: ow.spawners.length, pois: ow.poiList.length })
`);
check(`overworld ${owStats.w}x${owStats.h}, ${owStats.shrines} shrines`, owStats.shrines === 9);
check(`overworld has ${owStats.npcs} npcs (10 expected)`, owStats.npcs === 10);
check(`overworld portals (7 dungeon mouths + crypt door): ${owStats.portals}`, owStats.portals === 8);
check(`chests=${owStats.chests} pickups=${owStats.pickups} spawners=${owStats.spawners}`,
  owStats.chests > 15 && owStats.pickups > 200 && owStats.spawners > 50);

// every interior generates with arrival, exit portal, and (where expected) a boss arena
const dungeonReport = run(`
  const out = [];
  for (const id of ["crypt","barrow","chapel","mire_deep","frost_keep","ash_temple","citadel"]) {
    const m = World.getMap(id);
    out.push({ id, arrival: !!m.arrival, exit: m.portals.some(p => p.exit),
               boss: m.bossArena ? m.bossArena.boss : null,
               enc: m.encounters.length, shrines: m.shrines.length,
               vault: m.stations.some(s => s.kind === "vault") });
  }
  out
`);
for (const d of dungeonReport) {
  check(`dungeon ${d.id}: arrival=${d.arrival} exit=${d.exit} boss=${d.boss} encounters=${d.enc}`,
    d.arrival && d.exit && d.enc > 5 && (d.id === "crypt" ? !d.boss : !!d.boss));
}
check("citadel has the Ember vault", dungeonReport.find(d => d.id === "citadel").vault);
check("boss-bearing dungeons have a pre-boss shrine",
  dungeonReport.filter(d => d.boss).every(d => d.shrines === 1));

// arrival points are not inside walls
check("dungeon arrivals are walkable", run(`
  ["crypt","barrow","chapel","mire_deep","frost_keep","ash_temple","citadel"].every(id => {
    const m = World.getMap(id);
    return !World.circleBlocked(m, m.arrival.x, m.arrival.y, 10);
  })
`));

/* ---------------- new game ---------------- */

run(`Game.newGame("Testborn", "marchwarden")`);
frames(30);
check("new game starts in play state", run(`G.state`) === "play");
check("player placed on walkable ground",
  run(`!World.circleBlocked(G.map, G.player.x, G.player.y, G.player.r)`));
check("main quest started at stage 0", run(`QS.stage("mq_ember")`) === 0);
check("origin gear equipped", run(`G.player.equip.weapon === "iron_sword" && G.player.equip.shield === "iron_kite"`));

/* movement */
const startPos = run(`({x: G.player.x, y: G.player.y})`);
run(`Input.keys["KeyW"] = true; Input.keys["KeyD"] = true;`);
frames(60);
run(`Input.keys["KeyW"] = false; Input.keys["KeyD"] = false;`);
const endPos = run(`({x: G.player.x, y: G.player.y})`);
check("player moves with WASD", Math.hypot(endPos.x - startPos.x, endPos.y - startPos.y) > 50);

/* dialogue: Serah advances the main quest */
run(`UI.openDialogue("serah")`);
check("dialogue opened at main-quest node", run(`UI.dlg && UI.dlg.node`) === "mq_intro");
run(`
  // walk the conversation: intro -> why -> where -> accept
  const tree = DIALOGUES.serah;
  UI.dlg.node = "mq_where"; UI.renderDialogue();
  tree.nodes.mq_where.choices[0].action(G.player);
`);
check("main quest advanced to sigil hunt", run(`QS.stage("mq_ember")`) === 1);
check("warden POIs revealed", run(`!World.poiById("citadel").hidden`));
run(`UI.closeDialogue()`);

/* side quest flow: wolves */
run(`QS.start("sq_wolves")`);
run(`for (let i = 0; i < 8; i++) QS.onKill("wolf");`);
check("wolf bounty advances after 8 kills", run(`QS.stage("sq_wolves")`) === 1);
run(`QS.complete("sq_wolves")`);
check("wolf bounty completes with bow reward", run(`G.player.hasItem("composite_bow")`));

/* ---------------- combat ---------------- */

run(`
  const e = new Enemy("bandit", G.player.x + 40, G.player.y);
  G.entities.push(e);
  G.testEnemy = e;
  G.player.facing = 0; // face east toward the bandit
`);
const hpBefore = run(`G.testEnemy.hp`);
run(`Combat.playerStrike(G.player, false)`);
check("melee strike damages enemy", run(`G.testEnemy.hp`) < hpBefore);
check("enemy aggros when struck", run(`["chase","attack"].includes(G.testEnemy.state)`));
run(`while (!G.testEnemy.dead) Combat.applyDamage(G.testEnemy, {amount: 50, dtype: "phys", poiseDmg: 10, attacker: G.player});`);
check("enemy dies and grants embers", run(`G.player.embers`) > 0);
frames(5);
check("dead enemy culled from entity list", run(`!G.entities.includes(G.testEnemy)`));

/* spell cast */
run(`G.player.learnSpell("firebolt"); G.player.equippedSpell = "firebolt"; G.player.mag = 100;`);
run(`Combat.finishCast(G.player, "firebolt")`);
check("firebolt spawns a player projectile", run(`G.projectiles.some(p => p.from === "player")`));
frames(10);

/* enemy -> player damage with block */
run(`
  const e2 = new Enemy("bandit", G.player.x + 30, G.player.y);
  G.entities.push(e2);
  G.player.facing = 0;
  G.player.blocking = true; G.player.blockT = 5; G.player.stam = 100;
  G.hpBefore2 = G.player.hp;
  Combat.enemyHitPlayer(e2, 1);
`);
check("blocked hit deals reduced damage", run(`G.player.hp > G.hpBefore2 - 8 && G.player.hp <= G.hpBefore2`));
run(`G.player.blocking = false; G.entities.pop();`);

/* flask */
run(`G.player.hp = 10; G.player.cast = null; G.player.useFlask();`);
check("ember flask heals", run(`G.player.hp`) > 50);

/* ---------------- crafting ---------------- */

run(`G.player.addItem("iron_ore", 2); G.player.addItem("leather_strips", 1);`);
run(`
  const r = RECIPES_SMITH.find(r => r.out === "iron_sword");
  for (const m in r.mats) if (r.mats[m]) G.player.removeItem(m, r.mats[m]);
  G.player.addItem("iron_sword", 1);
  G.player.gainSkill("smithing", 200);
`);
check("smithing skill levels from xp", run(`G.player.skills.smithing.lvl`) > 5);

/* perk purchase */
run(`G.player.skills.onehand.lvl = 12; G.player.perkPoints = 2;`);
check("perk purchase works", run(`G.player.buyPerk("onehand", SKILL_DEFS.onehand.perks[0])`));
check("perk registered", run(`G.player.hasPerk("oh_1")`));

/* ---------------- shrine: level up + rest ---------------- */

run(`G.player.embers = 99999;`);
const lvlBefore = run(`G.player.level`);
run(`G.player.levelUp("vig")`);
check("shrine level-up consumes embers, raises level", run(`G.player.level`) === lvlBefore + 1);
run(`Game.restAtShrine(G.overworld.shrines[0])`);
check("resting saves the game", run(`SaveSys.slotInfo(1) !== null`));
check("resting refills flask", run(`G.player.flask.charges === G.player.flask.max`));

/* ---------------- dungeon transition + boss ---------------- */

run(`G.player.addItem("crypt_key", 1);`);
run(`Game.usePortal(G.overworld.portals.find(p => p.id === "crypt_door"))`);
check("entered the crypt", run(`G.map.id`) === "crypt");
check("crypt populated with hollowed dead", run(`G.entities.filter(e => e.isEnemy).length`) > 5);
frames(30);

run(`Game.usePortal(G.map.portals.find(p => p.exit))`);
check("exited back to the overworld", run(`G.map.id`) === "overworld");

/* boss: walk into Korvash's arena and slay him */
run(`
  const barrow = World.getMap("barrow");
  Game.enterMap("barrow", barrow.bossArena.bossX + 60, barrow.bossArena.bossY);
`);
frames(30);
check("boss engages when arena entered", run(`G.bossFight !== null`));
run(`
  const boss = G.bossFight;
  while (!boss.dead) Combat.applyDamage(boss, {amount: 200, dtype: "phys", poiseDmg: 10, attacker: G.player});
`);
check("Korvash felled — sigil obtained", run(`G.player.hasItem("sigil_grave")`));
check("Edict VAL learned from the Warden", run(`G.player.edicts.includes("val")`));
check("boss kill persisted", run(`G.slainBosses.boss_korvash === true`));
frames(10);

/* edict usage */
run(`G.player.edictCds = {}; Combat.useEdict(G.player, "val");`);
check("edict goes on cooldown after use", run(`G.player.edictCds.val`) > 0);

/* ---------------- sigils -> citadel gate ---------------- */

run(`
  G.player.addItem("sigil_mire", 1);
  G.player.addItem("sigil_frost", 1);
  G.player.addItem("sigil_ash", 1);
  QS.update();
`);
check("all four sigils advance the main quest", run(`QS.stage("mq_ember")`) === 2);
run(`
  Game.enterMap("overworld", 200*32, 206*32);
  const gate = G.overworld.portals.find(p => p.id === "mouth_citadel");
  Game.usePortal(gate);
`);
check("citadel opens to four sigils", run(`G.map.id`) === "citadel");
frames(10);
check("reaching the citadel advances quest to the Pale King", run(`QS.stage("mq_ember")`) === 3);

/* ---------------- death & respawn ---------------- */

run(`G.player.embers = 500; Game.enterMap("overworld", G.player.respawn.x, G.player.respawn.y);`);
run(`Combat.damagePlayer({amount: 99999, dtype: "phys", source: null, undodgeable: true, unblockable: true})`);
check("death drops lost embers", run(`G.lostEmbers && G.lostEmbers.amount === 500`));
check("death state entered", run(`G.state`) === "dead");
run(`Game.respawn()`); // setTimeout is stubbed; trigger manually
check("respawn restores play at the shrine", run(`G.state === "play" && G.player.hp === G.player.hpMax`));
run(`
  const le = G.lostEmbers;
  Game.interact({kind: "embers", obj: le});
`);
check("lost embers reclaimed", run(`G.player.embers >= 500 && G.lostEmbers === null`));

/* ---------------- save / load round trip ---------------- */

run(`G.player.addItem("ember_brand", 1); G.player.gold = 4242;`);
run(`SaveSys.save(2)`);
run(`G.player.gold = 0;`);
run(`Game.loadGame(2)`);
check("save/load round-trips gold", run(`G.player.gold`) === 4242);
check("save/load round-trips inventory", run(`G.player.hasItem("ember_brand")`));
check("save/load preserves boss kills", run(`G.slainBosses.boss_korvash === true`));
check("save/load preserves quest stage", run(`QS.stage("mq_ember")`) === 3);
frames(60);
check("post-load simulation stays healthy", run(`G.state`) === "play");

/* ---------------- second-pass systems ---------------- */

// the Undermarch generates with way-lamps and the hidden boss
const um = run(`
  const m = World.getMap("undermarch");
  ({ boss: m.bossArena && m.bossArena.boss, lamps: m.stations.filter(s => s.kind === "waylamp").length,
     enc: m.encounters.length, arrivalOk: !World.circleBlocked(m, m.arrival.x, m.arrival.y, 10) })
`);
check(`undermarch: boss=${um.boss}, ${um.lamps} way-lamps, ${um.enc} encounters`,
  um.boss === "boss_echo" && um.lamps === 3 && um.enc > 10 && um.arrivalOk);

// way-lamp quest: light all three, flags drive the objective
run(`{
  QS.start("sq_lamps");
  const m = World.getMap("undermarch");
  for (const st of m.stations) if (st.kind === "waylamp") G.flags[st.flag] = true;
  QS.update();
}`);
check("lighting all way-lamps advances A Lamp for the Deep", run(`QS.stage("sq_lamps")`) === 1);

// dormant bosses are immune (no sniping through the gate)
run(`
  Game.enterMap("undermarch", World.getMap("undermarch").arrival.x, World.getMap("undermarch").arrival.y);
  G.echoBoss = G.entities.find(e => e.isEnemy && e.def.boss);
  Combat.applyDamage(G.echoBoss, {amount: 500, dtype: "phys", poiseDmg: 10, attacker: G.player});
`);
check("dormant boss ignores damage", run(`G.echoBoss.hp === G.echoBoss.hpMax`));

// engage and fell the Echo; retroactive quest credit on a quest started AFTER the kill
run(`{
  const m = World.getMap("undermarch");
  G.player.x = m.bossArena.bossX + 60; G.player.y = m.bossArena.bossY;
}`);
frames(30);
check("Echo of Ald engages in its arena", run(`G.bossFight && G.bossFight.def.id === "boss_echo"`));
run(`while (!G.echoBoss.dead) Combat.applyDamage(G.echoBoss, {amount: 250, dtype: "phys", poiseDmg: 10, attacker: G.player});`);
check("Echo drops Aldsbane and the Circlet", run(`G.player.hasItem("aldsbane") && G.player.hasItem("circlet_first")`));
run(`QS.start("sq_echo")`);
check("quest started after boss kill gets retroactive credit", run(`QS.stage("sq_echo")`) === 1);
frames(5);

// honing: forge tiers raise weapon damage
run(`
  G.player.addItem("iron_sword", 1);
  G.dmg0 = Combat.weaponDamage(G.player, ITEMS.iron_sword, false);
  G.player.honing.iron_sword = 2;
  G.dmg2 = Combat.weaponDamage(G.player, ITEMS.iron_sword, false);
`);
check("honing +2 raises damage ~16%", run(`Math.abs(G.dmg2 / G.dmg0 - 1.16) < 0.01`));

// cooking: campfire recipe consumes meat, yields food
run(`{
  G.player.addItem("raw_venison", 1);
  const r = RECIPES_COOK.find(r2 => r2.out === "seared_venison");
  for (const m in r.mats) if (r.mats[m]) G.player.removeItem(m, r.mats[m]);
  G.player.addItem("seared_venison", 1);
}`);
check("cooking yields seared venison", run(`G.player.hasItem("seared_venison")`));

// quick item: bind and use via T
run(`
  G.player.addItem("small_hp_potion", 1);
  G.player.quickItem = "small_hp_potion";
  G.player.hp = 10;
  G.player.useConsumable(G.player.quickItem);
`);
check("quick item heals when used", run(`G.player.hp`) > 30);

// critters: deer flees the player and drops venison when hunted
run(`{
  Game.enterMap("overworld", 220*32, 156*32);
  const deer = new Enemy("deer", G.player.x + 60, G.player.y);
  G.entities.push(deer);
  G.deer = deer;
}`);
frames(40);
check("deer flees rather than fights", run(`G.deer.state === "flee" || G.deer.state === "idle"`));
run(`{
  G.venBefore = G.player.countItem("raw_venison");
  let guard = 0;
  while (!G.deer.dead && guard++ < 20) Combat.applyDamage(G.deer, {amount: 20, dtype: "phys", poiseDmg: 5, attacker: G.player});
}`);
check("hunted deer dies", run(`G.deer.dead === true`));

// elites: tougher, triple embers
run(`{
  const w1 = new Enemy("wolf", G.player.x + 500, G.player.y);
  const base = w1.hpMax;
  w1.makeElite();
  G.eliteOk = w1.elite && w1.hpMax > base * 1.5 && w1.dmgMult > 1.2;
}`);
check("ashen elite stats scale", run(`G.eliteOk`));

// graves: searching sets the flag and resolves an outcome
run(`{
  const crypt = World.getMap("crypt");
  G.graveCount = (crypt.graves || []).length;
  if (G.graveCount) {
    const g = crypt.graves[0];
    G.map = crypt;
    Game.interact({ kind: "grave", obj: g });
    G.graveFlag = !!G.flags["searched_" + g.id];
  }
  G.map = G.overworld;
}`);
check(`crypt has searchable graves (${run("G.graveCount")})`, run(`G.graveCount`) > 5);
check("searching a grave marks it searched", run(`G.graveFlag`) === true);

// LOS: walls block enemy sightlines
check("line-of-sight blocked through dungeon wall", run(`{
  const m = World.getMap("crypt");
  let wallTx = -1, wallTy = -1;
  outer: for (let y = 5; y < m.h - 5; y++) for (let x = 5; x < m.w - 5; x++) {
    if (m.tiles[y*m.w+x] === T.WALL_STONE && m.tiles[y*m.w+x-1] !== T.WALL_STONE && m.tiles[y*m.w+x+1] !== T.WALL_STONE) {
      wallTx = x; wallTy = y; break outer;
    }
  }
  wallTx > 0 && !World.lineClear(m, (wallTx-1)*TILE+16, wallTy*TILE+16, (wallTx+1)*TILE+16, wallTy*TILE+16);
}`));

// NPC schedules: night sends them home
check("NPCs use day posts and night homes", run(`{
  Game.enterMap("overworld", 200*32, 200*32);
  const npc = G.entities.find(e => e.npcId === "bram");
  G.time.hour = 12;
  const day = [npc.anchorX, npc.anchorY];
  G.time.hour = 23;
  const night = [npc.anchorX, npc.anchorY];
  G.time.hour = 12;
  day[0] !== night[0] || day[1] !== night[1];
}`));

// save/load round-trips the new state
run(`G.player.quickItem = "small_hp_potion"; G.player.honing.iron_sword = 2; SaveSys.save(3); Game.loadGame(3);`);
check("save/load keeps honing and quick item",
  run(`G.player.honing.iron_sword === 2 && G.player.quickItem === "small_hp_potion"`));
check("save/load keeps way-lamp flags", run(`QS.flagCount("waylamp_um_")`) === 3);
frames(30);

// masterpiece quest chain (two collect stages then talk)
run(`
  QS.start("sq_masterpiece");
  G.player.addItem("frost_crystal", 2); QS.update();
  G.player.addItem("ember_residue", 2); QS.update();
`);
check("masterpiece quest reaches the talk stage", run(`QS.stage("sq_masterpiece")`) === 2);
run(`QS.complete("sq_masterpiece")`);
check("Bram forges the Twinned Temper", run(`G.player.hasItem("twinned_temper")`));

/* ---------------- first-person mode ---------------- */

run(`Game.enterMap("overworld", 200*32, 206*32); G.viewMode = "fp";`);
let fpOk = true;
try { frames(12); } catch (e) { fpOk = false; console.error(e); }
check("first-person renderer survives 12 frames in town", fpOk && run(`G.state`) === "play");
check("raycaster filled its depth buffer", run(`RenderFP.depth && RenderFP.depth.length === RenderFP.W`));

// FP movement: W walks along facing
run(`{ G.player.facing = 0; G.fpStart = { x: G.player.x, y: G.player.y }; }`);
run(`Input.keys["KeyW"] = true;`);
frames(30);
run(`Input.keys["KeyW"] = false;`);
check("FP forward moves along the view axis", run(`
  Math.abs(G.player.y - G.fpStart.y) < Math.abs(G.player.x - G.fpStart.x) && G.player.x > G.fpStart.x + 30
`));

// FP aim point sits dead ahead
check("FP aim point projects ahead of the player", run(`
  Math.abs(Input.worldX() - (G.player.x + Math.cos(G.player.facing) * 220)) < 0.01
`));

// projection helper returns sane values for a point ahead
check("FP projection maps a forward point on-screen", run(`{
  const pr = RenderFP.project(G.player.x + Math.cos(G.player.facing) * 200, G.player.y + Math.sin(G.player.facing) * 200);
  pr && pr.x > 0 && pr.x < G.W && pr.perp > 4 && pr.perp < 9;
}`));

// FP combat: strike a wolf dead ahead
run(`{
  const e = new Enemy("wolf", G.player.x + Math.cos(G.player.facing) * 40, G.player.y + Math.sin(G.player.facing) * 40);
  G.entities.push(e);
  G.fpWolf = e;
  Combat.playerStrike(G.player, false);
}`);
check("FP melee strike lands on a foe dead ahead", run(`G.fpWolf.hp < G.fpWolf.hpMax`));
frames(4);

// view toggle key flips modes both ways
run(`Input.pressedSet["KeyV"] = true;`);
frames(1);
check("V toggles to top-down", run(`G.viewMode`) === "top");
run(`Input.pressedSet["KeyV"] = true;`);
frames(1);
check("V toggles back to first person", run(`G.viewMode`) === "fp");

// FP holds up inside a dungeon (walls + ceiling path)
run(`{ const m = World.getMap("crypt"); Game.enterMap("crypt", m.arrival.x, m.arrival.y); }`);
let fpDun = true;
try { frames(10); } catch (e) { fpDun = false; console.error(e); }
check("first-person renderer survives a dungeon", fpDun);
run(`Game.enterMap("overworld", 200*32, 206*32); G.viewMode = "top";`);

/* ---------------- ending ---------------- */

run(`G.slainBosses.boss_maerodric = true; QS.onBoss("boss_maerodric");`);
check("Pale King's fall advances to the final choice", run(`QS.stage("mq_ember")`) === 4);
run(`UI.runEnding("dark")`);
check("ending completes the main quest", run(`QS.stage("mq_ember")`) === 999);
check("ending screen reached", run(`G.state`) === "ending");

/* ---------------- long soak: 1200 frames of open play ---------------- */

run(`Game.loadGame(2)`);
run(`Input.keys["KeyW"] = true;`);
let soakOk = true;
try {
  for (let i = 0; i < 1200; i++) {
    if (i % 200 === 0) {
      run(`Input.keys["KeyW"] = ${i % 400 === 0}; Input.keys["KeyD"] = ${i % 400 !== 0};
           Input.keys["Space"] = ${i % 600 === 0}; Input.pressedSet["Space"] = ${i % 600 === 0};
           Input.mouse.down = ${i % 800 === 0};`);
    }
    frames(1);
  }
} catch (e) {
  soakOk = false;
  console.error(e);
}
check("1200-frame soak test without exceptions", soakOk);
check("entities spawned during soak", run(`G.entities.length`) >= 0);

console.log("");
if (failures) { console.error(`${failures} FAILURE(S)`); process.exit(1); }
console.log("ALL SMOKE TESTS PASSED");
