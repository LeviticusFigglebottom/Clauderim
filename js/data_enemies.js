/* ============================================================
   CLAUDERIM — data_enemies.js
   Bestiary: common foes, elites, and the five great Wardens.
   Behavior logic lives in entities.js; this is the data.
   ============================================================ */
"use strict";

/*
  Enemy schema:
    hp, dmg, spd (px/s), r (collision radius), reach,
    windup/strike/recover (attack timing, seconds),
    poise (stagger threshold), poiseDmg (dealt per hit),
    armor, resist { fire, frost, shock, poison } (percent),
    aggro / deaggro (ranges, px), embers (souls on kill),
    behavior: 'melee' | 'lunger' | 'archer' | 'caster' | 'swarm'
    proj (for ranged), tags, look { shape, body, trim, size }
    loot: [{ w, id, n:[a,b] } | { w, gold:[a,b] } | { w }] (empty w = nothing)
*/
const ENEMY_TYPES = {

  /* ---------------- harmless wildlife (huntable) ---------------- */
  deer: {
    name: "Red Deer", hp: 16, dmg: 0, spd: 215, r: 12, reach: 0,
    windup: 1, strike: 1, recover: 1, poise: 5, poiseDmg: 0,
    armor: 0, aggro: 200, deaggro: 520, embers: 5, behavior: "flee",
    tags: ["beast", "critter"], look: { shape: "beast", body: "#8a6a48", trim: "#5d4631", size: 1.1, antlers: true },
    loot: [{ w: 6, id: "raw_venison", n: [1, 2] }, { w: 3, id: "leather_strips", n: [1, 2] }, { w: 1, id: "wolf_pelt", n: [1, 1] }],
    voice: "squelch",
  },
  rabbit: {
    name: "Marsh Hare", hp: 6, dmg: 0, spd: 230, r: 7, reach: 0,
    windup: 1, strike: 1, recover: 1, poise: 2, poiseDmg: 0,
    armor: 0, aggro: 150, deaggro: 420, embers: 2, behavior: "flee",
    tags: ["beast", "critter"], look: { shape: "beast", body: "#9a8a70", trim: "#c8bca8", size: 0.55 },
    loot: [{ w: 8, id: "rabbit_meat", n: [1, 1] }, { w: 2 }],
    voice: "squelch",
  },

  /* ---------------- beasts ---------------- */
  wolf: {
    name: "Grey Wolf", hp: 28, dmg: 9, spd: 150, r: 12, reach: 30,
    windup: 0.35, strike: 0.1, recover: 0.5, poise: 15, poiseDmg: 10,
    armor: 0, aggro: 240, deaggro: 480, embers: 14, behavior: "lunger",
    tags: ["beast"], look: { shape: "beast", body: "#6e6a63", trim: "#46433e", size: 1 },
    loot: [{ w: 5, id: "wolf_pelt", n: [1, 1] }, { w: 2, id: "dried_meat", n: [1, 1] }, { w: 3 }],
    voice: "growl",
  },
  dire_wolf: {
    name: "Dire Wolf", hp: 60, dmg: 16, spd: 165, r: 15, reach: 34,
    windup: 0.3, strike: 0.1, recover: 0.45, poise: 30, poiseDmg: 16,
    armor: 2, aggro: 280, deaggro: 520, embers: 38, behavior: "lunger",
    tags: ["beast"], look: { shape: "beast", body: "#4a463f", trim: "#2c2a26", size: 1.35 },
    loot: [{ w: 5, id: "wolf_pelt", n: [1, 2] }, { w: 2, id: "dried_meat", n: [1, 2] }, { w: 2 }],
    voice: "growl",
  },
  mire_leech: {
    name: "Mire Leech", hp: 22, dmg: 7, spd: 90, r: 11, reach: 26,
    windup: 0.4, strike: 0.1, recover: 0.6, poise: 5, poiseDmg: 6,
    armor: 0, aggro: 180, deaggro: 360, embers: 11, behavior: "swarm",
    edmg: { poison: 4 },
    tags: ["beast", "mire"], look: { shape: "blob", body: "#4d5a3a", trim: "#33402a", size: 0.8 },
    loot: [{ w: 4, id: "mireweed", n: [1, 2] }, { w: 4 }],
    voice: "squelch",
  },
  bog_horror: {
    name: "Bog Horror", hp: 95, dmg: 20, spd: 75, r: 20, reach: 46,
    windup: 0.6, strike: 0.15, recover: 0.8, poise: 60, poiseDmg: 30,
    armor: 4, resist: { poison: 80, fire: -25 }, aggro: 220, deaggro: 420,
    embers: 70, behavior: "melee", edmg: { poison: 8 },
    tags: ["beast", "mire"], look: { shape: "blob", body: "#3f5236", trim: "#222e1d", size: 1.7 },
    loot: [{ w: 4, id: "mireweed", n: [2, 3] }, { w: 2, id: "marrowroot", n: [1, 2] }, { w: 1, id: "ember_shard", n: [1, 1] }],
    voice: "squelch",
  },
  frost_troll: {
    name: "Frost Troll", hp: 140, dmg: 26, spd: 110, r: 22, reach: 50,
    windup: 0.55, strike: 0.12, recover: 0.7, poise: 80, poiseDmg: 45,
    armor: 6, resist: { frost: 80, fire: -30 }, aggro: 260, deaggro: 500,
    embers: 110, behavior: "melee", regen: 3,
    tags: ["beast", "frost"], look: { shape: "beast", body: "#bcc8cc", trim: "#7e8d94", size: 1.9 },
    loot: [{ w: 5, id: "troll_fat", n: [1, 2] }, { w: 2, id: "frost_crystal", n: [1, 1] }, { w: 1 }],
    voice: "roar",
  },
  ash_imp: {
    name: "Ash Imp", hp: 30, dmg: 11, spd: 130, r: 10, reach: 0,
    windup: 0.5, strike: 0.1, recover: 0.7, poise: 8, poiseDmg: 8,
    armor: 0, resist: { fire: 90, frost: -40 }, aggro: 300, deaggro: 520,
    embers: 24, behavior: "caster",
    proj: { dmg: 10, dtype: "fire", speed: 320, color: "#ff7a2a", cd: 1.8 },
    tags: ["fire"], look: { shape: "wisp", body: "#d8531f", trim: "#7a2408", size: 0.85 },
    loot: [{ w: 3, id: "ember_residue", n: [1, 1] }, { w: 2, id: "emberbloom", n: [1, 1] }, { w: 4 }],
    voice: "hiss",
  },

  gloomcrawler: {
    name: "Gloomcrawler", hp: 64, dmg: 15, spd: 175, r: 14, reach: 34,
    windup: 0.32, strike: 0.1, recover: 0.5, poise: 22, poiseDmg: 14,
    armor: 3, resist: { poison: 100, shock: -25 }, aggro: 300, deaggro: 999,
    embers: 60, behavior: "lunger", edmg: { poison: 6 },
    tags: ["beast", "deep"], look: { shape: "crawler", body: "#3a3644", trim: "#7a6a9a", size: 1.2 },
    loot: [{ w: 4, id: "ghost_fern", n: [1, 1] }, { w: 2, id: "silver_dust", n: [1, 1] }, { w: 4 }],
    voice: "hiss",
  },
  mire_hag: {
    name: "Mire Hag", hp: 58, dmg: 14, spd: 95, r: 13, reach: 0,
    windup: 0.85, strike: 0.1, recover: 0.7, poise: 18, poiseDmg: 10,
    armor: 1, resist: { poison: 100, fire: -20 }, aggro: 330, deaggro: 560,
    embers: 52, behavior: "caster",
    proj: { dmg: 13, dtype: "poison", speed: 300, color: "#9be09b", cd: 2.6 },
    tags: ["human", "mire"], look: { shape: "humanoid", body: "#4a5240", trim: "#7d9460", size: 0.95, weapon: "staff", hunched: true },
    loot: [{ w: 4, id: "mireweed", n: [1, 2] }, { w: 2, id: "ghost_fern", n: [1, 1] }, { w: 2, gold: [6, 20] }, { w: 2 }],
    voice: "whisper",
  },
  ash_revenant: {
    name: "Ash Revenant", hp: 105, dmg: 23, spd: 120, r: 15, reach: 48,
    windup: 0.45, strike: 0.11, recover: 0.55, poise: 55, poiseDmg: 30,
    armor: 7, resist: { fire: 100, frost: -30, poison: 100 }, aggro: 280, deaggro: 999,
    embers: 95, behavior: "melee", edmg: { fire: 9 },
    tags: ["undead", "fire"], look: { shape: "humanoid", body: "#4a3430", trim: "#ff7a2a", size: 1.15, weapon: "sword", ember: true },
    loot: [{ w: 4, id: "ember_residue", n: [1, 2] }, { w: 2, id: "emberbloom", n: [1, 1] }, { w: 1, id: "ember_shard", n: [1, 1] }, { w: 2 }],
    voice: "moan",
  },

  /* ---------------- men ---------------- */
  bandit: {
    name: "March Bandit", hp: 45, dmg: 13, spd: 115, r: 12, reach: 42,
    windup: 0.42, strike: 0.1, recover: 0.55, poise: 25, poiseDmg: 14,
    armor: 3, aggro: 260, deaggro: 480, embers: 30, behavior: "melee",
    canBlock: 0.25,
    tags: ["human"], look: { shape: "humanoid", body: "#6b5340", trim: "#8a2f2f", size: 1, weapon: "sword" },
    loot: [{ w: 4, gold: [4, 18] }, { w: 2, id: "small_hp_potion", n: [1, 1] }, { w: 1, id: "leather_strips", n: [1, 2] }, { w: 3 }],
    voice: "man",
  },
  bandit_archer: {
    name: "Bandit Archer", hp: 34, dmg: 12, spd: 110, r: 12, reach: 0,
    windup: 0.7, strike: 0.1, recover: 0.6, poise: 15, poiseDmg: 10,
    armor: 1, aggro: 340, deaggro: 560, embers: 28, behavior: "archer",
    proj: { dmg: 12, dtype: "phys", speed: 480, color: "#cbb78a", cd: 2.2 },
    tags: ["human"], look: { shape: "humanoid", body: "#5d4f3c", trim: "#3e6647", size: 0.95, weapon: "bow" },
    loot: [{ w: 4, gold: [4, 16] }, { w: 2, id: "stam_potion", n: [1, 1] }, { w: 3 }],
    voice: "man",
  },
  bandit_brute: {
    name: "Bandit Brute", hp: 90, dmg: 22, spd: 95, r: 15, reach: 56,
    windup: 0.6, strike: 0.13, recover: 0.75, poise: 55, poiseDmg: 40,
    armor: 6, aggro: 260, deaggro: 480, embers: 65, behavior: "melee",
    tags: ["human"], look: { shape: "humanoid", body: "#4f4338", trim: "#7a4a20", size: 1.3, weapon: "axe2h" },
    loot: [{ w: 4, gold: [10, 32] }, { w: 1, id: "woodsman_axe", n: [1, 1] }, { w: 2, id: "honey_mead", n: [1, 1] }, { w: 2 }],
    voice: "man",
  },
  cult_acolyte: {
    name: "Cinder Acolyte", hp: 50, dmg: 14, spd: 105, r: 12, reach: 0,
    windup: 0.8, strike: 0.1, recover: 0.7, poise: 20, poiseDmg: 10,
    armor: 2, resist: { fire: 60 }, aggro: 320, deaggro: 540, embers: 48, behavior: "caster",
    proj: { dmg: 15, dtype: "fire", speed: 360, color: "#ff8c3a", cd: 2.4 },
    tags: ["human", "fire"], look: { shape: "humanoid", body: "#6e3420", trim: "#d8531f", size: 1, weapon: "staff" },
    loot: [{ w: 3, id: "emberbloom", n: [1, 1] }, { w: 2, id: "mag_potion", n: [1, 1] }, { w: 2, gold: [8, 25] }, { w: 2 }],
    voice: "man",
  },

  /* ---------------- the dead ---------------- */
  hollow_thrall: {
    name: "Hollow Thrall", hp: 32, dmg: 10, spd: 80, r: 12, reach: 38,
    windup: 0.55, strike: 0.12, recover: 0.7, poise: 18, poiseDmg: 12,
    armor: 1, resist: { poison: 100, frost: 30 }, aggro: 200, deaggro: 999,
    embers: 22, behavior: "melee",
    tags: ["undead"], look: { shape: "humanoid", body: "#7d8278", trim: "#54584f", size: 0.95, weapon: "sword" },
    loot: [{ w: 4, id: "old_bone", n: [1, 2] }, { w: 2, gold: [2, 10] }, { w: 4 }],
    voice: "moan",
  },
  barrow_sentinel: {
    name: "Barrow Sentinel", hp: 75, dmg: 18, spd: 90, r: 14, reach: 46,
    windup: 0.5, strike: 0.12, recover: 0.6, poise: 50, poiseDmg: 26,
    armor: 8, resist: { poison: 100, frost: 40 }, aggro: 220, deaggro: 999,
    embers: 55, behavior: "melee", canBlock: 0.4,
    tags: ["undead"], look: { shape: "humanoid", body: "#8d9288", trim: "#b8a468", size: 1.1, weapon: "sword", shield: true },
    loot: [{ w: 3, id: "old_bone", n: [1, 2] }, { w: 2, gold: [8, 24] }, { w: 1, id: "silver_dust", n: [1, 1] }, { w: 3 }],
    voice: "moan",
  },
  grave_wisp: {
    name: "Grave Wisp", hp: 26, dmg: 13, spd: 120, r: 10, reach: 0,
    windup: 0.6, strike: 0.1, recover: 0.5, poise: 5, poiseDmg: 6,
    armor: 0, resist: { poison: 100, phys: 30, frost: 50 }, aggro: 280, deaggro: 999,
    embers: 30, behavior: "caster",
    proj: { dmg: 11, dtype: "frost", speed: 300, color: "#bfeaff", cd: 2.0 },
    tags: ["undead", "spirit"], look: { shape: "wisp", body: "#cfe6ea", trim: "#8fb8c0", size: 0.8 },
    loot: [{ w: 3, id: "ghost_fern", n: [1, 1] }, { w: 2, id: "silver_dust", n: [1, 1] }, { w: 4 }],
    voice: "whisper",
  },
  wraith: {
    name: "Drowned Wraith", hp: 110, dmg: 24, spd: 130, r: 14, reach: 44,
    windup: 0.45, strike: 0.1, recover: 0.55, poise: 35, poiseDmg: 22,
    armor: 2, resist: { poison: 100, phys: 40, frost: 60, fire: -20 }, aggro: 300, deaggro: 999,
    embers: 130, behavior: "lunger", edmg: { frost: 8 },
    tags: ["undead", "spirit"], look: { shape: "wisp", body: "#9fb6c8", trim: "#5a7484", size: 1.4 },
    loot: [{ w: 3, id: "silver_dust", n: [1, 2] }, { w: 2, id: "frost_crystal", n: [1, 1] }, { w: 1, id: "ember_core", n: [1, 1] }],
    voice: "whisper",
  },
  thawed_soldier: {
    name: "Thawed Soldier", hp: 70, dmg: 17, spd: 95, r: 13, reach: 46,
    windup: 0.5, strike: 0.12, recover: 0.6, poise: 45, poiseDmg: 24,
    armor: 9, resist: { frost: 100, poison: 100, fire: -25 }, edmg: { frost: 6 },
    aggro: 240, deaggro: 999, embers: 58, behavior: "melee", canBlock: 0.35,
    tags: ["undead", "frost"], look: { shape: "humanoid", body: "#aebfc8", trim: "#6d8290", size: 1.05, weapon: "sword", shield: true },
    loot: [{ w: 3, id: "frostmoss", n: [1, 2] }, { w: 2, gold: [8, 26] }, { w: 1, id: "frost_crystal", n: [1, 1] }, { w: 3 }],
    voice: "moan",
  },
  hymnkeeper: {
    name: "The Hymnkeeper", hp: 320, dmg: 26, spd: 105, r: 17, reach: 54,
    windup: 0.5, strike: 0.12, recover: 0.5, poise: 130, poiseDmg: 34,
    armor: 10, resist: { frost: 100, poison: 100, fire: -20 }, edmg: { frost: 10 },
    aggro: 300, deaggro: 999, embers: 700, behavior: "melee", canBlock: 0.3,
    drops: [["pass_warhorn", 1]], dropsOnce: true,
    tags: ["undead", "frost"], look: { shape: "humanoid", body: "#c4d2da", trim: "#8a9aa8", size: 1.6, weapon: "sword2h", banner: true },
    loot: [{ w: 1, id: "frost_crystal", n: [2, 3] }],
    voice: "whisper",
  },
  tidelost_drowned: {
    name: "Tidelost Drowned", hp: 55, dmg: 15, spd: 90, r: 13, reach: 42,
    windup: 0.55, strike: 0.12, recover: 0.65, poise: 30, poiseDmg: 18,
    armor: 3, resist: { poison: 100, frost: 60, fire: -20 }, edmg: { frost: 4 },
    aggro: 230, deaggro: 999, embers: 44, behavior: "melee",
    tags: ["undead", "tide"], look: { shape: "humanoid", body: "#5d7a78", trim: "#3a5250", size: 1, weapon: "sword", kelp: true },
    loot: [{ w: 4, gold: [5, 22] }, { w: 2, id: "tide_pearl", n: [1, 1] }, { w: 2, id: "salt_cod", n: [1, 2] }, { w: 3 }],
    voice: "squelch",
  },
  wrecker: {
    name: "Wrecker", hp: 48, dmg: 14, spd: 118, r: 12, reach: 44,
    windup: 0.4, strike: 0.1, recover: 0.5, poise: 25, poiseDmg: 16,
    armor: 2, aggro: 270, deaggro: 480, embers: 34, behavior: "melee", canBlock: 0.2,
    tags: ["human", "tide"], look: { shape: "humanoid", body: "#4f5a5d", trim: "#8a6a3a", size: 1, weapon: "axe" },
    loot: [{ w: 4, gold: [6, 24] }, { w: 2, id: "torch", n: [1, 1] }, { w: 1, id: "tide_pearl", n: [1, 1] }, { w: 3 }],
    voice: "man",
  },
  captain_veyra: {
    name: "Captain Veyra, the Tidelost", hp: 360, dmg: 27, spd: 125, r: 16, reach: 52,
    windup: 0.42, strike: 0.1, recover: 0.45, poise: 140, poiseDmg: 30,
    armor: 7, resist: { poison: 100, frost: 70, fire: -15 }, edmg: { frost: 8 },
    aggro: 320, deaggro: 999, embers: 850, behavior: "lunger",
    drops: [["undertow", 1]], dropsOnce: true,
    tags: ["undead", "tide"], look: { shape: "humanoid", body: "#6d8a88", trim: "#c9a86a", size: 1.5, weapon: "sword", hat: true },
    loot: [{ w: 1, id: "tide_pearl", n: [2, 3] }],
    voice: "whisper",
  },
  pale_knight: {
    name: "Pale Knight", hp: 130, dmg: 26, spd: 105, r: 14, reach: 50,
    windup: 0.45, strike: 0.11, recover: 0.55, poise: 70, poiseDmg: 32,
    armor: 14, resist: { poison: 100, shock: 30 }, aggro: 280, deaggro: 999,
    embers: 160, behavior: "melee", canBlock: 0.5, edmg: { shock: 6 },
    tags: ["undead"], look: { shape: "humanoid", body: "#c8c4bc", trim: "#7a7468", size: 1.15, weapon: "sword", shield: true },
    loot: [{ w: 3, gold: [20, 60] }, { w: 1, id: "steel_ingot", n: [1, 2] }, { w: 1, id: "ember_shard", n: [1, 1] }, { w: 2 }],
    voice: "moan",
  },

  /* =====================================================
     THE WARDENS — boss encounters
     pattern kinds handled in entities.js boss logic:
       swing  — wide melee arc
       slam   — heavy aoe at self, leaves shockwave ring
       charge — rush at player
       volley — radial / aimed projectiles
       summon — call adds
       breath — elemental cone
     ===================================================== */

  boss_korvash: {
    name: "Korvash", title: "the Hollowed Sentinel",
    boss: true, hp: 520, dmg: 28, spd: 95, r: 22, reach: 64,
    windup: 0.6, strike: 0.14, recover: 0.6, poise: 200, poiseDmg: 50,
    armor: 12, resist: { poison: 100, frost: 40 },
    aggro: 400, deaggro: 9999, embers: 1500,
    look: { shape: "humanoid", body: "#8d9288", trim: "#c9a86a", size: 2.1, weapon: "sword2h", shield: true },
    patterns: [
      { kind: "swing", cd: 2.2, range: 90 },
      { kind: "charge", cd: 6, minRange: 140, dmgMult: 1.3 },
      { kind: "slam", cd: 8, range: 80, radius: 110, dmgMult: 1.5 },
    ],
    phase2: {
      at: 0.5, spdMult: 1.25, announce: "The Sentinel remembers his oath.",
      addPatterns: [{ kind: "volley", cd: 7, count: 8, proj: { dmg: 14, dtype: "frost", speed: 280, color: "#bfeaff" } }],
    },
    drops: [["sigil_grave", 1], ["warden_aegis", 1], ["ember_core", 1]],
    grantsEdict: "val",
    voice: "moan",
    intro: "KORVASH, THE HOLLOWED SENTINEL",
  },

  boss_vask: {
    name: "Mother Vask", title: "Matron of the Mire",
    boss: true, hp: 620, dmg: 24, spd: 80, r: 26, reach: 70,
    windup: 0.55, strike: 0.15, recover: 0.7, poise: 240, poiseDmg: 40,
    armor: 6, resist: { poison: 100, fire: -30, frost: 30 }, edmg: { poison: 10 },
    aggro: 420, deaggro: 9999, embers: 2100,
    look: { shape: "blob", body: "#46583c", trim: "#7d9460", size: 2.6 },
    patterns: [
      { kind: "swing", cd: 2.4, range: 95 },
      { kind: "volley", cd: 5, count: 6, aimed: true, proj: { dmg: 12, dtype: "poison", speed: 260, color: "#9be09b", arcSpread: 0.5 } },
      { kind: "summon", cd: 12, type: "mire_leech", count: 3, max: 5 },
    ],
    phase2: {
      at: 0.45, spdMult: 1.3, announce: "The Mire rises with its Matron.",
      addPatterns: [{ kind: "slam", cd: 7, range: 90, radius: 140, dmgMult: 1.2, leaves: "poison_pool" }],
    },
    drops: [["sigil_mire", 1], ["mirefang", 1], ["ember_core", 1]],
    grantsEdict: "suth",
    voice: "squelch",
    intro: "MOTHER VASK, MATRON OF THE MIRE",
  },

  boss_hrolgar: {
    name: "Hrolgar", title: "the Frost-Tyrant",
    boss: true, hp: 760, dmg: 34, spd: 100, r: 24, reach: 72,
    windup: 0.65, strike: 0.14, recover: 0.65, poise: 300, poiseDmg: 60,
    armor: 18, resist: { frost: 100, fire: -20, poison: 100 }, edmg: { frost: 12 },
    aggro: 420, deaggro: 9999, embers: 3000,
    look: { shape: "humanoid", body: "#bcc8cc", trim: "#5a7484", size: 2.3, weapon: "maul" },
    patterns: [
      { kind: "swing", cd: 2.4, range: 100 },
      { kind: "slam", cd: 6, range: 90, radius: 130, dmgMult: 1.4, leaves: "frost_field" },
      { kind: "charge", cd: 8, minRange: 160, dmgMult: 1.4 },
    ],
    phase2: {
      at: 0.5, spdMult: 1.2, announce: "The blizzard kneels to its king.",
      addPatterns: [
        { kind: "breath", cd: 9, range: 240, arc: 1.0, dmg: 30, dtype: "frost" },
        { kind: "volley", cd: 7, count: 10, proj: { dmg: 13, dtype: "frost", speed: 300, color: "#bfeaff" } },
      ],
    },
    drops: [["sigil_frost", 1], ["hrolgars_maul", 1], ["frost_crystal", 3]],
    grantsEdict: "kyr",
    voice: "roar",
    intro: "HROLGAR, THE FROST-TYRANT",
  },

  boss_velmora: {
    name: "Velmora", title: "the Ashpriest",
    boss: true, hp: 680, dmg: 26, spd: 115, r: 18, reach: 56,
    windup: 0.5, strike: 0.12, recover: 0.5, poise: 180, poiseDmg: 35,
    armor: 8, resist: { fire: 100, frost: -30, poison: 100 }, edmg: { fire: 14 },
    aggro: 460, deaggro: 9999, embers: 3400,
    look: { shape: "humanoid", body: "#6e3420", trim: "#ff8c3a", size: 1.8, weapon: "staff" },
    patterns: [
      { kind: "volley", cd: 3.5, count: 3, aimed: true, proj: { dmg: 16, dtype: "fire", speed: 380, color: "#ff7a2a", arcSpread: 0.35 } },
      { kind: "breath", cd: 7, range: 220, arc: 1.1, dmg: 28, dtype: "fire" },
      { kind: "swing", cd: 2.6, range: 80 },
    ],
    phase2: {
      at: 0.5, spdMult: 1.25, announce: "The Ember answers her in tongues of flame.",
      addPatterns: [
        { kind: "slam", cd: 8, range: 100, radius: 150, dmgMult: 1.3, dtype: "fire", leaves: "fire_field" },
        { kind: "summon", cd: 14, type: "ash_imp", count: 2, max: 4 },
      ],
    },
    drops: [["sigil_ash", 1], ["ember_brand", 1], ["ember_core", 2]],
    grantsEdict: "thur",
    voice: "hiss",
    intro: "VELMORA, THE ASHPRIEST",
  },

  boss_maerodric: {
    name: "Maerodric", title: "the Pale King",
    boss: true, hp: 1100, dmg: 36, spd: 120, r: 22, reach: 78,
    windup: 0.5, strike: 0.12, recover: 0.5, poise: 350, poiseDmg: 55,
    armor: 20, resist: { shock: 80, poison: 100, frost: 40, fire: 40 }, edmg: { shock: 12 },
    aggro: 500, deaggro: 9999, embers: 8000,
    look: { shape: "humanoid", body: "#d8d4cc", trim: "#9ab0d8", size: 2.2, weapon: "sword2h", crown: true },
    patterns: [
      { kind: "swing", cd: 1.9, range: 105 },
      { kind: "charge", cd: 6, minRange: 150, dmgMult: 1.3 },
      { kind: "volley", cd: 5, count: 5, aimed: true, proj: { dmg: 18, dtype: "shock", speed: 460, color: "#cfe0ff", arcSpread: 0.4 } },
      { kind: "slam", cd: 7, range: 95, radius: 130, dmgMult: 1.4, dtype: "shock" },
    ],
    phase2: {
      at: 0.5, spdMult: 1.35, announce: "The Pale King sheds his crown. Beneath it: the dark.",
      addPatterns: [
        { kind: "breath", cd: 8, range: 260, arc: 1.2, dmg: 34, dtype: "shock" },
        { kind: "summon", cd: 16, type: "pale_knight", count: 2, max: 2 },
        { kind: "volley", cd: 6, count: 14, proj: { dmg: 14, dtype: "shock", speed: 320, color: "#cfe0ff" } },
      ],
    },
    drops: [["pale_crown", 1], ["pale_claymore", 1]],
    voice: "whisper",
    intro: "MAERODRIC, THE PALE KING",
  },

  /* hidden superboss of the Undermarch */
  boss_echo: {
    name: "Echo of Ald", title: "the First-Kindled",
    boss: true, hp: 940, dmg: 32, spd: 125, r: 20, reach: 70,
    windup: 0.48, strike: 0.12, recover: 0.45, poise: 320, poiseDmg: 50,
    armor: 14, resist: { fire: 60, shock: 60, poison: 100, frost: 30 }, edmg: { fire: 8, shock: 8 },
    aggro: 460, deaggro: 9999, embers: 6000,
    look: { shape: "wisp", body: "#e8cf9a", trim: "#8a6a3a", size: 2.0, crown: true },
    patterns: [
      { kind: "swing", cd: 1.8, range: 95 },
      { kind: "volley", cd: 4.5, count: 4, aimed: true, proj: { dmg: 16, dtype: "fire", speed: 420, color: "#ffc060", arcSpread: 0.45 } },
      { kind: "charge", cd: 6, minRange: 140, dmgMult: 1.3 },
      { kind: "slam", cd: 7.5, range: 95, radius: 125, dmgMult: 1.3, dtype: "fire", leaves: "fire_field" },
    ],
    phase2: {
      at: 0.5, spdMult: 1.3, announce: "The first flame remembers how it argued with the Dark.",
      addPatterns: [
        { kind: "breath", cd: 8, range: 250, arc: 1.15, dmg: 32, dtype: "fire" },
        { kind: "summon", cd: 13, type: "grave_wisp", count: 3, max: 4 },
        { kind: "volley", cd: 6, count: 12, proj: { dmg: 13, dtype: "shock", speed: 340, color: "#cfe0ff" } },
      ],
    },
    drops: [["aldsbane", 1], ["circlet_first", 1], ["ember_core", 2]],
    voice: "whisper",
    intro: "ECHO OF ALD, THE FIRST-KINDLED",
  },

  /* mini-boss */
  bell_wraith: {
    name: "Warden of the Drowned Bell",
    boss: true, mini: true, hp: 260, dmg: 26, spd: 135, r: 16, reach: 50,
    windup: 0.45, strike: 0.1, recover: 0.5, poise: 120, poiseDmg: 28,
    armor: 4, resist: { poison: 100, phys: 35, frost: 70, fire: -20 }, edmg: { frost: 10 },
    aggro: 360, deaggro: 9999, embers: 800,
    look: { shape: "wisp", body: "#9fb6c8", trim: "#46606e", size: 1.8 },
    patterns: [
      { kind: "swing", cd: 2.0, range: 80 },
      { kind: "volley", cd: 5, count: 8, proj: { dmg: 12, dtype: "frost", speed: 300, color: "#bfeaff" } },
      { kind: "charge", cd: 7, minRange: 120, dmgMult: 1.3 },
    ],
    drops: [["drowned_amulet", 1], ["drowned_bell_clapper", 1]],
    voice: "whisper",
    intro: "WARDEN OF THE DROWNED BELL",
  },
};
for (const id in ENEMY_TYPES) ENEMY_TYPES[id].id = id;

/* biome spawn tables for the overworld: picked by World spawner */
const SPAWN_TABLES = {
  heartlands: [
    { w: 5, id: "wolf", pack: [2, 3] },
    { w: 4, id: "bandit", pack: [1, 2] },
    { w: 2, id: "bandit_archer", pack: [1, 1] },
    { w: 1, id: "bandit_brute", pack: [1, 1] },
    { w: 3, id: "deer", pack: [1, 2] },
    { w: 2, id: "rabbit", pack: [1, 3] },
  ],
  forest: [
    { w: 5, id: "wolf", pack: [2, 4] },
    { w: 2, id: "dire_wolf", pack: [1, 1] },
    { w: 3, id: "bandit", pack: [1, 2] },
    { w: 1, id: "hollow_thrall", pack: [1, 2] },
    { w: 3, id: "deer", pack: [1, 2] },
    { w: 2, id: "rabbit", pack: [1, 2] },
  ],
  mire: [
    { w: 5, id: "mire_leech", pack: [2, 4] },
    { w: 3, id: "bog_horror", pack: [1, 1] },
    { w: 2, id: "hollow_thrall", pack: [1, 2] },
    { w: 1, id: "grave_wisp", pack: [1, 1] },
    { w: 2, id: "mire_hag", pack: [1, 1] },
    { w: 1, id: "rabbit", pack: [1, 2] },
  ],
  frostpeaks: [
    { w: 4, id: "dire_wolf", pack: [1, 2] },
    { w: 3, id: "frost_troll", pack: [1, 1] },
    { w: 2, id: "grave_wisp", pack: [1, 2] },
    { w: 2, id: "bandit", pack: [1, 2] },
    { w: 2, id: "deer", pack: [1, 2] },
  ],
  ashlands: [
    { w: 5, id: "ash_imp", pack: [2, 3] },
    { w: 3, id: "cult_acolyte", pack: [1, 2] },
    { w: 2, id: "hollow_thrall", pack: [2, 3] },
    { w: 1, id: "bandit_brute", pack: [1, 1] },
    { w: 2, id: "ash_revenant", pack: [1, 1] },
  ],
  whitepass: [
    { w: 6, id: "thawed_soldier", pack: [1, 2] },
    { w: 3, id: "grave_wisp", pack: [1, 2] },
    { w: 1, id: "frost_troll", pack: [1, 1] },
  ],
  coast: [
    { w: 5, id: "tidelost_drowned", pack: [1, 3] },
    { w: 3, id: "wrecker", pack: [1, 2] },
    { w: 2, id: "rabbit", pack: [1, 2] },
  ],
};

/* the Gauntlet of Sparks: wave composition (cycles, elites scale beyond) */
const GAUNTLET_WAVES = [
  [["wolf", 4]],
  [["bandit", 3], ["bandit_archer", 1]],
  [["hollow_thrall", 4], ["barrow_sentinel", 1]],
  [["dire_wolf", 2], ["bandit_brute", 2], ["mire_hag", 1]],
  [["pale_knight", 2], ["wraith", 1]],
];
