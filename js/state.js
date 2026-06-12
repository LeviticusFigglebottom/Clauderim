/* ============================================================
   CLAUDERIM — state.js
   Global game state singleton. Every system reads/writes G.
   ============================================================ */
"use strict";

const G = {
  // 'title' | 'chargen' | 'play' | 'menu' | 'dialogue' | 'shrine' |
  // 'station' | 'dead' | 'ending' | 'help'
  state: "title",
  prevState: "title",

  canvas: null,
  ctx: null,
  W: 1280,
  H: 720,

  seed: 0,            // world seed (fixed per save)
  cycle: 0,           // NG+ depth: how many times the Ember has asked
  player: null,
  map: null,          // current active map object
  maps: {},           // mapId -> generated map (interiors cached)
  overworld: null,

  entities: [],       // enemies, npcs, props with behavior (current map)
  projectiles: [],
  particles: [],
  floats: [],         // floating damage numbers / texts
  corpsePile: [],     // fading corpses

  camera: { x: 0, y: 0, shake: 0, shakeMag: 0 },

  // world clock: hour in [0,24), advances continuously
  time: { day: 1, hour: 8.5 },
  weather: { kind: "clear", t: 0, next: 60, intensity: 0 },

  // persistent world flags
  flags: {},            // arbitrary story/npc flags
  openedChests: {},     // chestId -> true
  slainBosses: {},      // bossId -> true
  discoveredShrines: {},// shrineId -> true
  discoveredPois: {},   // poiId -> true (map markers)
  lostEmbers: null,     // { mapId, x, y, amount } — souls dropped on death

  bossFight: null,      // active boss entity or null
  gauntletActive: false,
  pendingTransition: null,

  // settings
  settings: {
    music: true,
    sfx: true,
    screenShake: true,
    showDamage: true,
  },

  // runtime
  dt: 0,
  elapsed: 0,
  frame: 0,
  paused: false,
  slowmo: 0,            // seconds of time-dilation remaining (Edict of KYR)
  hitstop: 0,           // frozen impact frames
  slowmoAim: false,     // Steady Draw perk while drawing a bow
  viewMode: "fp",       // "fp" first-person | "top" top-down — V toggles
  saveSlot: 1,

  /* ---------- messaging ---------- */
  msg(text, cls = "") {
    const log = U.el("msg-log");
    if (!log) return;
    const line = U.mk("div", "msg-line " + cls, U.esc(text));
    log.prepend(line);
    while (log.children.length > 6) log.removeChild(log.lastChild);
    setTimeout(() => line.classList.add("fade"), 4200);
    setTimeout(() => line.remove(), 5600);
  },

  banner(title, sub = "") {
    const b = U.el("area-banner");
    b.innerHTML = U.esc(title) + (sub ? `<div class="sub">${U.esc(sub)}</div>` : "");
    b.classList.remove("hidden");
    // restart animation
    b.style.animation = "none";
    void b.offsetWidth;
    b.style.animation = "";
  },

  questToast(title, sub = "") {
    const t = U.el("quest-toast");
    t.innerHTML = U.esc(title) + (sub ? `<div class="sub">${U.esc(sub)}</div>` : "");
    t.classList.remove("hidden");
    t.style.animation = "none";
    void t.offsetWidth;
    t.style.animation = "";
  },

  float(x, y, text, color = "#fff", size = 14) {
    if (!G.settings.showDamage) return;
    G.floats.push({ x, y, text, color, size, t: 0, life: 0.9, vy: -42 });
  },

  shake(mag, dur = 0.25) {
    if (!G.settings.screenShake) return;
    G.camera.shake = Math.max(G.camera.shake, dur);
    G.camera.shakeMag = Math.max(G.camera.shakeMag, mag);
  },

  setState(s) {
    G.prevState = G.state;
    G.state = s;
  },

  // returns 0..1 darkness factor by world clock (0 = noon, 1 = deep night)
  darkness() {
    const h = G.time.hour;
    let d;
    if (h >= 7 && h <= 17) d = 0;
    else if (h > 17 && h < 21) d = (h - 17) / 4;       // dusk
    else if (h >= 21 || h <= 4) d = 1;                 // night
    else d = 1 - (h - 4) / 3;                          // dawn 4-7
    // the world remembers your answer at the vault
    if (G.flags.ending_chosen === "kindle") d *= 0.85;        // the lamps burn warmer
    else if (G.flags.ending_chosen === "dark") d = Math.min(1, d * 1.08); // the dusk leans in
    return d;
  },
};
