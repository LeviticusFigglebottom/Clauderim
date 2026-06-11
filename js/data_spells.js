/* ============================================================
   CLAUDERIM — data_spells.js
   Spell schools (Destruction / Restoration) and the Edicts of
   the Old Tongue — words of power earned from the Wardens.
   ============================================================ */
"use strict";

/*
  Spell schema:
    cost      magicka
    cast      cast time (s)
    kind      'bolt' | 'self' | 'nova' | 'ward'
    dmg/heal  base magnitude (scaled by Will & perks)
    dtype     element for bolts
    speed     projectile speed
    radius    aoe radius (nova / bolt impact)
    skill     governing skill (xp on cast)
    learn     how acquired: 'start' | vendor gold cost | drop
*/
const SPELLS = {
  firebolt: {
    name: "Firebolt", school: "destruction", skill: "destruction",
    cost: 14, cast: 0.35, kind: "bolt", dmg: 18, dtype: "fire", speed: 460, radius: 0,
    color: "#ff8c3a", learn: "start",
    desc: "A dart of borrowed flame. The Ember lends; the Ember always collects.",
  },
  frost_spike: {
    name: "Frost Spike", school: "destruction", skill: "destruction",
    cost: 16, cast: 0.4, kind: "bolt", dmg: 15, dtype: "frost", speed: 420, radius: 0, slow: 2.2,
    color: "#9ad6ff", price: 120,
    desc: "Winter, sharpened to a point. Chills the marrow and slows the step.",
  },
  spark_lash: {
    name: "Spark Lash", school: "destruction", skill: "destruction",
    cost: 13, cast: 0.22, kind: "bolt", dmg: 13, dtype: "shock", speed: 640, radius: 0, magBurn: 10,
    color: "#cfe0ff", price: 150,
    desc: "Lightning taught to heel. Burns the mind of casters struck.",
  },
  fireball: {
    name: "Fireball", school: "destruction", skill: "destruction",
    cost: 34, cast: 0.6, kind: "bolt", dmg: 38, dtype: "fire", speed: 380, radius: 70,
    color: "#ff6a1a", price: 400,
    desc: "The Ashpriests' favorite argument. Few rebuttals survive it.",
  },
  glacial_burst: {
    name: "Glacial Burst", school: "destruction", skill: "destruction",
    cost: 40, cast: 0.7, kind: "nova", dmg: 30, dtype: "frost", radius: 130, slow: 3,
    color: "#bfeaff", price: 520,
    desc: "Exhale the deep cold. Everything near you remembers the glacier.",
  },
  soul_lance: {
    name: "Soul Lance", school: "destruction", skill: "destruction",
    cost: 30, cast: 0.5, kind: "bolt", dmg: 34, dtype: "shock", speed: 720, radius: 0, pierce: true,
    color: "#b9a8ff", price: 700,
    desc: "A nail of pure will, driven through whatever stands in the way of your intent.",
  },

  lesser_heal: {
    name: "Mend Wounds", school: "restoration", skill: "restoration",
    cost: 22, cast: 0.7, kind: "self", heal: 30,
    color: "#ffe9a8", learn: "start",
    desc: "Close the flesh. The scars remain; scars are how the body keeps its journal.",
  },
  greater_heal: {
    name: "Renewal", school: "restoration", skill: "restoration",
    cost: 45, cast: 1.0, kind: "self", heal: 75,
    color: "#fff2c0", price: 450,
    desc: "Warmth floods the limbs like a remembered kindness.",
  },
  stoneskin: {
    name: "Stoneskin", school: "restoration", skill: "restoration",
    cost: 30, cast: 0.6, kind: "self", buff: { id: "stoneskin", dur: 45, armor: 40 },
    color: "#cfc4a8", price: 300,
    desc: "The flesh takes counsel from the mountain and grows opinionated about blades.",
  },
  cleanse: {
    name: "Cleanse", school: "restoration", skill: "restoration",
    cost: 18, cast: 0.5, kind: "self", cure: ["poison", "burn", "frost"],
    color: "#d8ffd8", price: 220,
    desc: "Burn out the rot with a whisper of the old light.",
  },
  ward: {
    name: "Ember Ward", school: "restoration", skill: "restoration",
    cost: 26, cast: 0.4, kind: "self", buff: { id: "ward", dur: 12, spellShield: 60 },
    color: "#ffd9a0", price: 380,
    desc: "A skin of warm light that drinks hostile sorcery.",
  },
};
for (const id in SPELLS) SPELLS[id].id = id;

/*
  Edicts — words of the Old Tongue, the realm's "shouts".
  Earned from Warden bosses through the main quest. Long cooldowns,
  battle-turning effects.
*/
const EDICTS = {
  val: {
    name: "VAL — Unmoved Word", key: "1",
    cooldown: 28,
    kind: "force",  // cone knockback + stagger
    range: 180, arc: 1.5, dmg: 18, knock: 320,
    color: "#cfe8ff",
    desc: "Speak the word the barrows speak. The world is briefly persuaded that you are the only fixed thing in it; everything else is thrown.",
    source: "Claimed from Korvash, the Hollowed Sentinel.",
  },
  suth: {
    name: "SUTH — Keeping Word", key: "2",
    cooldown: 45,
    kind: "drain",  // aoe damage + lifesteal
    range: 150, dmg: 26, heal: 0.8,
    color: "#9be09b",
    desc: "The Mire's word. What lives near you is asked, firmly, to live a little less — and the difference is yours to keep.",
    source: "Claimed from Vask, Matron of the Mire.",
  },
  kyr: {
    name: "KYR — Still Word", key: "3",
    cooldown: 60,
    kind: "time",   // slow time
    dur: 5, factor: 0.35,
    color: "#bfd4ff",
    desc: "The stillness between heartbeats, stretched wide enough to walk through. The world slows; you do not.",
    source: "Claimed from Hrolgar, the Frost-Tyrant.",
  },
  thur: {
    name: "THUR — Answering Fire", key: "4",
    cooldown: 40,
    kind: "breath", // fire cone over time
    range: 220, arc: 1.1, dmg: 55, burn: 4,
    color: "#ff7a2a",
    desc: "Call, and the First Ember answers through your throat. What it says is brief, ancient, and on fire.",
    source: "Claimed from Velmora, the Ashpriest.",
  },
};
for (const id in EDICTS) EDICTS[id].id = id;
