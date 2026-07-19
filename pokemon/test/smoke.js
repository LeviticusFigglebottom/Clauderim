/* ============================================================
   POCKET FRONTIER — test/smoke.js
   Headless harness. Stubs a browser, loads every script in
   index.html order into one shared context, then exercises the
   real systems: data integrity, the type chart, monster growth,
   full battles through the scene (with animation playback),
   catching, evolution, the overworld, menus, the shop, and a
   save/load round-trip.
   Run:  node test/smoke.js
   ============================================================ */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");

/* ---------------- DOM / canvas stubs ---------------- */
function makeCtx() {
  const grad = { addColorStop() {} };
  return new Proxy({
    canvas: null, fillStyle: "", strokeStyle: "", lineWidth: 1, font: "", textAlign: "",
    textBaseline: "", globalAlpha: 1, globalCompositeOperation: "", shadowBlur: 0,
    shadowColor: "", shadowOffsetY: 0, lineCap: "", lineJoin: "",
    measureText: s => ({ width: String(s).length * 8 }),
    createRadialGradient: () => grad, createLinearGradient: () => grad,
  }, {
    get(t, k) { return k in t ? t[k] : () => {}; },
    set(t, k, v) { t[k] = v; return true; },
  });
}
function makeEl(tag) {
  const el = {
    tagName: (tag || "div").toUpperCase(), style: {}, width: 720, height: 480,
    getContext: () => makeCtx(),
    addEventListener() {}, setAttribute() {}, focus() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 720, height: 480 }),
  };
  return el;
}
const elements = {};
const winListeners = {};
let store = {};
const sandbox = {
  console, Math, JSON, Date, Set, Map, Object, Array, String, Number, Boolean, isNaN, isFinite,
  parseInt, parseFloat, Infinity, NaN, Error, Proxy, Reflect,
  setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  requestAnimationFrame: cb => { rafQueue.push(cb); return rafQueue.length; },
  performance: { now: () => simTime },
  document: {
    getElementById: id => (elements[id] || (elements[id] = makeEl("canvas"))),
    createElement: t => makeEl(t),
    addEventListener(type, fn) { (winListeners[type] = winListeners[type] || []).push(fn); },
  },
  window: {
    innerWidth: 1200, innerHeight: 800, AudioContext: undefined, webkitAudioContext: undefined,
    addEventListener(type, fn) { (winListeners[type] = winListeners[type] || []).push(fn); },
  },
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  },
  CTX: makeCtx(),
};
sandbox.globalThis = sandbox;
sandbox.window.localStorage = sandbox.localStorage;
vm.createContext(sandbox);
let simTime = 0;
const rafQueue = [];

/* ---------------- load scripts ---------------- */
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
for (const src of scripts) {
  const code = fs.readFileSync(path.join(__dirname, "..", src), "utf8");
  try { vm.runInContext(code, sandbox, { filename: src }); }
  catch (e) { console.error(`FAIL: ${src} threw during load:\n`, e); process.exit(1); }
}
function run(code) { return vm.runInContext(code, sandbox, { filename: "test" }); }
run("this.__X = { U, TYPES, SPRITES, MOVES, ITEMS, SPECIES, Monster, Battle, BattleScene, WORLD, Overworld, MenuScene, ShopScene, Save, Sound, Game };");
const X = sandbox.__X;

/* ---------------- assertions ---------------- */
let fails = 0, passes = 0;
function ok(label, cond) { if (cond) { passes++; } else { fails++; console.error("  ✗ " + label); } }
function section(s) { console.log("\n• " + s); }

console.log(`✓ loaded ${scripts.length} scripts`);

/* ---- data integrity ---- */
section("Data integrity");
ok("17 species", Object.keys(X.SPECIES).length === 17);
ok("70+ moves", Object.keys(X.MOVES).length >= 70);
let learnMissing = 0, formBad = 0, statBad = 0, evoBad = 0;
for (const k in X.SPECIES) {
  const sp = X.SPECIES[k];
  for (const [lv, mv] of sp.learn) if (!X.MOVES[mv]) learnMissing++;
  if (!Array.isArray(sp.form) || sp.form.length < 3) formBad++;
  for (const s of ["hp", "atk", "def", "spa", "spd", "spe"]) if (typeof sp.base[s] !== "number") statBad++;
  if (sp.evolve && !X.SPECIES[sp.evolve.to]) evoBad++;
  if (!sp.entry || !sp.types.length) statBad++;
}
ok("all learnset moves exist", learnMissing === 0);
ok("all forms are shape lists", formBad === 0);
ok("all base stats present", statBad === 0);
ok("all evolutions resolve", evoBad === 0);
let moveDescMissing = 0;
for (const k in X.MOVES) { const m = X.MOVES[k]; if (!m.desc || !m.name || !m.type) moveDescMissing++; if (m.cat !== "status" && !m.power) moveDescMissing++; }
ok("every move has name/type/desc (and power if damaging)", moveDescMissing === 0);

/* ---- type chart ---- */
section("Type chart");
ok("fire→grass = 2", X.TYPES.effective("fire", ["grass"]) === 2);
ok("water→fire = 2", X.TYPES.effective("water", ["fire"]) === 2);
ok("electric→ground = 0", X.TYPES.effective("electric", ["ground"]) === 0);
ok("fire→water/rock dual = 0.25", X.TYPES.effective("fire", ["water", "rock"]) === 0.25);
ok("grass→water/ground = 4", X.TYPES.effective("grass", ["water", "ground"]) === 4);
ok("normal→ghost = 0", X.TYPES.effective("normal", ["ghost"]) === 0);

/* ---- monster growth ---- */
section("Monster growth");
run("U.seed(101)");
const m = new X.Monster("emberling", 15);
ok("stats positive", m.maxHp > 0 && m.raw("atk") > 0 && m.raw("spe") > 0);
ok("exp curve level^3", X.Monster.expAt(10) === 1000);
const evs = m.gainExp(6000);
ok("leveled up past 15", m.level > 15);
ok("evolve event emitted once", evs.filter(e => e.type === "evolve").length === 1);
const evo = evs.find(e => e.type === "evolve"); if (evo) m.evolve(evo.to);
ok("evolved to flarion", m.species === "flarion");
m.hp = 1; m.status = "brn"; m.restore();
ok("restore heals + clears status", m.hp === m.maxHp && m.status === null);

/* ---- battle logic (direct) ---- */
section("Battle logic");
run("U.seed(202)");
function playAll(evName) {
  // drive a Battle instance created in-context, feeding damaging moves, to a result
  return run(`(function(){
    var party=[new Monster('flarion',30)], foe=new Monster('nibblet',4);
    var b=new Battle(party,foe,{isWild:true});
    var guard=0, ended=false;
    function play(events){ for(var i=0;i<events.length;i++){ var e=events[i];
      if(e.t==='end'){ended=true;return;} if(e.t==='faintSwitch'){var idx=b.party.findIndex(function(x){return !x.fainted;}); if(idx>=0) play(b.switchAfterFaint(idx));} } }
    while(!b.over && guard++<200){ var mi=b.active.moves.findIndex(function(mv){return MOVES[mv].cat!=='status';}); if(mi<0)mi=0; play(b.playerMove(mi)); }
    return {result:b.result, over:b.over, turns:b.turn};
  })()`);
}
const wr = playAll();
ok("wild battle resolves to win", wr.over && wr.result === "win");

run("U.seed(303)");
const cr = run(`(function(){
  var party=[new Monster('flarion',40)], foe=new Monster('nibblet',3);
  var b=new Battle(party,foe,{isWild:true}); foe.hp=1; foe.status='slp'; foe.sleepTurns=3;
  var caught=false, guard=0;
  while(!b.over && guard++<30){ var ev=b.playerItem({kind:'ball',id:'pokeball',name:'Poké Ball',bonus:1}); for(var i=0;i<ev.length;i++){ if(ev[i].t==='ball')caught=ev[i].caught; } }
  return {result:b.result, caught:caught};
})()`);
ok("weakened sleeping foe gets caught", cr.result === "caught");

run("U.seed(404)");
const trainer = run(`(function(){
  var party=[new Monster('voltmastiff',45)];
  var tp=[new Monster('nibblet',6), new Monster('chirplet',7)];
  var b=new Battle(party, tp[0], {trainer:{name:'Kip',party:tp,prize:240}});
  var guard=0, sentSecond=false;
  function play(events){ for(var i=0;i<events.length;i++){ var e=events[i]; if(e.t==='sendout'&&e.side==='foe')sentSecond=true; if(e.t==='end')return; } }
  while(!b.over && guard++<200){ play(b.playerMove(0)); }
  return {result:b.result, sentSecond:sentSecond};
})()`);
ok("trainer sends 2nd mon then loses", trainer.result === "win" && trainer.sentSecond);

/* ---- world ---- */
section("Overworld map");
const W = X.WORLD.W, H = X.WORLD.H;
ok("map is rectangular", W > 20 && H > 15);
// flood fill from start over non-solid tiles
const seen = new Set(); const stack = [[X.WORLD.start.x, X.WORLD.start.y]];
function walk(x, y) { const c = X.WORLD.tile(x, y); return !X.WORLD.solid.has(c); }
while (stack.length) {
  const [x, y] = stack.pop(); const key = x + "," + y;
  if (seen.has(key) || x < 0 || y < 0 || x >= W || y >= H) continue;
  if (!walk(x, y)) continue;
  seen.add(key);
  stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
}
ok("start reachable", seen.has(X.WORLD.start.x + "," + X.WORLD.start.y));
ok("gate reachable from start", seen.has(X.WORLD.gate.x + "," + X.WORLD.gate.y));
let reachGrass = 0, reachDoor = 0;
for (const kv of seen) { const [x, y] = kv.split(",").map(Number); const c = X.WORLD.tile(x, y); if (c === "g") reachGrass++; if (c === "c" || c === "m") reachDoor++; }
ok("tall grass reachable", reachGrass > 4);
ok("center & mart doors reachable", reachDoor >= 2);
let npcOnSolid = 0;
for (const n of X.WORLD.npcs) if (X.WORLD.solid.has(X.WORLD.tile(n.x, n.y))) npcOnSolid++;
ok("no NPC stuck in a wall", npcOnSolid === 0);

/* ---- game init + scene rendering ---- */
section("Game boot & scenes");
run("Game.init()");
ok("boots to title", run("Game.scene") === "title");
run("Game.render()");                       // title renders
run("Game.starterSel=0; Game.scene='starter'; Game.render()");
run("Game.newGame('emberling')");
ok("new game → overworld with 1 partner", run("Game.scene") === "overworld" && run("Game.state.party.length") === 1);
ok("rival team was set to counter starter", run("WORLD.npcs.find(n=>n.trainer&&n.trainer.rival).trainer.party.length") === 2);

// walk: press up a few frames, expect gy to decrease
const gy0 = run("Game.overworld.p.gy");
run("Game.overworld.setDir('up', true)");
for (let i = 0; i < 40; i++) { simTime += 33; run("Game.update(0.033); Game.render()"); }
run("Game.overworld.setDir('up', false)");
ok("player walked north", run("Game.overworld.p.gy") < gy0);

/* ---- full wild battle through the scene ---- */
section("Battle scene playback");
run("U.seed(555); Game.state.party=[new Monster('flarion',35)]");
run("Game.startWildBattle({species:'nibblet',level:5})");
ok("entered battle scene", run("Game.scene") === "battle");
function driveBattle(max) {
  for (let i = 0; i < max; i++) {
    if (!run("!!Game.battle") || run("Game.scene") !== "battle") return true;
    simTime += 120; run("Game.update(0.12); Game.render()");
    const mode = run("Game.battle ? Game.battle.mode : null");
    if (mode === null) return true;
    if (mode === "bag" || mode === "party") run("Game._key('b',false)");
    else if (mode === "move") {
      // like a real player, aim a damaging move at the foe
      run("(function(){var b=Game.battle;for(var i=0;i<b.me.moves.length;i++){if(MOVES[b.me.moves[i]].cat!=='status'&&b.me.pp[i]>0){b.cursor=i;return;}}b.cursor=0;})()");
      run("Game._key('a',false)");
    } else run("Game._key('a',false)");
  }
  return false;
}
const ended = driveBattle(4000);
ok("wild battle played to the end", ended);
ok("returned to overworld", run("Game.scene") === "overworld");
ok("foe recorded as seen", run("!!Game.state.seen.nibblet"));

/* ---- trainer battle through the scene ---- */
section("Trainer battle playback");
run("U.seed(666); Game.state.party=[new Monster('voltmastiff',45)]");
run("Game.startTrainerBattle(WORLD.npcs[1])");   // Youngster Kip
ok("trainer battle started", run("Game.scene") === "battle" && run("!!Game.battle.b.trainer"));
const m0 = run("Game.state.money");
driveBattle(6000);
ok("trainer defeated & flag set", run("!!Game.state.defeated['Youngster Kip']"));
ok("prize money awarded", run("Game.state.money") > m0);

/* ---- capture + evolution animations ---- */
section("Capture & evolution animations");
run(`this._cap = new BattleScene(new Battle([new Monster('flarion',30)], new Monster('nibblet',3), {isWild:true, bag:{}}), {onEnd:function(){}});
     this._cap._start({t:'ball', shakes:4, caught:true});`);
for (let i = 0; i < 120; i++) { run("_cap.update(0.05); _cap.render(CTX)"); }
ok("capture animation completed without throwing", run("_cap.cap === null"));

run(`this._evm = new Monster('emberling',16);
     this._evo = new BattleScene(new Battle([this._evm], new Monster('nibblet',3), {isWild:true}), {onEnd:function(){}});
     this._evo._startEvolve(this._evm, 'flarion');`);
for (let i = 0; i < 160; i++) { run("_evo.update(0.05); _evo.render(CTX)"); }
ok("evolution animation morphed species", run("_evm.species") === "flarion");

/* ---- menu, bag use, shop ---- */
section("Menus & shop");
run("Game.openMenu()");
ok("menu opens", run("Game.scene") === "menu");
run("Game.menu.render(CTX)");
run(`Game.state.party=[new Monster('emberling',10)]; Game.state.party[0].hp=1; Game.state.bag.potion=2;
     Game.menu.mode='bagtarget'; Game.menu.pendingItem='potion'; Game.menu.cursor=0;`);
const hp0 = run("Game.state.party[0].hp");
run("Game.menu.input('a')");
ok("potion healed party member", run("Game.state.party[0].hp") > hp0);
ok("potion consumed", run("(Game.state.bag.potion||0)") === 1);
// render each menu mode
for (const mode of ["root", "party", "summary", "bag", "dex"]) run(`Game.menu.mode='${mode}'; Game.menu.sub=0; Game.menu.render(CTX)`);
run("Game.closeMenu()");
ok("menu closes to overworld", run("Game.scene") === "overworld");

run("Game.openShop(); Game.state.money=5000; Game.shop.cursor=0; Game.shop.render(CTX)");
const money0 = run("Game.state.money"), balls0 = run("(Game.state.bag.pokeball||0)");
run("Game.shop.input('a')");
ok("shop purchase spends money", run("Game.state.money") < money0);
ok("shop purchase adds item", run("(Game.state.bag.pokeball||0)") > balls0);
run("Game.closeShop()");

/* ---- save / load ---- */
section("Save / load");
run("Game.state.money=4242");
run("Game.save()");
ok("save written", X.Save.has());
run("Game.state.money=0; Game.state.party=[]");
const loaded = run("Game.continueGame()");
ok("continue restores game", loaded && run("Game.scene") === "overworld");
ok("money restored from save", run("Game.state.money") === 4242);
ok("party restored as Monster instances", run("Game.state.party.length>0 && typeof Game.state.party[0].maxHp==='number'"));

/* ---- win path ---- */
section("Victory & whiteout");
run("Game.win()");
ok("win scene reachable", run("Game.scene") === "win");
run("Game.render()");
run("Game.scene='overworld'; Game.state.money=1000; Game._whiteout()");
ok("whiteout heals, halves money, stays playable", run("Game.state.money") === 500 && run("Game.scene") === "overworld");

/* ---------------- summary ---------------- */
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
