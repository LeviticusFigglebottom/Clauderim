/* ============================================================
   CLAUDERIM — data_perks.js
   Skill definitions (Skyrim-style: level by use, 0-100) and
   perk trees. Perk points are earned every 10 levels of any
   skill plus on character level-up.
   ============================================================ */
"use strict";

/*
  Skill xp curve: xpToNext(level) = 80 + level * 14.
  Skills grant passive efficacy by level (see Combat/Player) and
  gate perks. Each perk: { id, name, req (skill lvl), desc, ... }
*/
const SKILL_DEFS = {
  onehand: {
    name: "One-Handed", attr: "str",
    desc: "Blades, axes, maces and spears wielded in one hand.",
    perks: [
      { id: "oh_1", name: "Swordskin", req: 10, desc: "+15% one-handed damage." },
      { id: "oh_2", name: "Bleeding Edge", req: 25, desc: "Light attacks have 20% chance to cause bleeding." },
      { id: "oh_3", name: "Duelist's Tempo", req: 45, desc: "One-handed attacks cost 25% less stamina." },
      { id: "oh_4", name: "Red Harvest", req: 70, desc: "+30% one-handed damage; heavy attacks stagger harder." },
    ],
  },
  twohand: {
    name: "Two-Handed", attr: "str",
    desc: "Greatswords, greataxes and mauls that ask for both hands and the whole heart.",
    perks: [
      { id: "th_1", name: "Mountain Stance", req: 10, desc: "+15% two-handed damage." },
      { id: "th_2", name: "Wide Arc", req: 25, desc: "Two-handed swings reach 20% further." },
      { id: "th_3", name: "Breaker", req: 45, desc: "+60% poise damage with two-handed weapons." },
      { id: "th_4", name: "Avalanche", req: 70, desc: "+30% two-handed damage; heavy attacks knock enemies back." },
    ],
  },
  archery: {
    name: "Archery", attr: "fin",
    desc: "The bow: patience with a string on it.",
    perks: [
      { id: "ar_1", name: "Hawkeye", req: 10, desc: "+15% bow damage." },
      { id: "ar_2", name: "Steady Draw", req: 25, desc: "Drawing a bow slows time slightly while aiming." },
      { id: "ar_3", name: "Pinning Shot", req: 45, desc: "Fully drawn shots stagger and slow enemies." },
      { id: "ar_4", name: "Heartseeker", req: 70, desc: "+30% bow damage; 15% chance of critical (×2.5)." },
    ],
  },
  block: {
    name: "Block", attr: "end",
    desc: "The shield is an answer. Sometimes it is the whole conversation.",
    perks: [
      { id: "bl_1", name: "Shield Wall", req: 10, desc: "Blocking absorbs 15% more damage." },
      { id: "bl_2", name: "Riposte", req: 25, desc: "Parry window widened by 50%." },
      { id: "bl_3", name: "Unmoored Strength", req: 45, desc: "Blocking costs 30% less stamina." },
      { id: "bl_4", name: "Bulwark", req: 70, desc: "Blocked hits can no longer break your guard while stamina remains." },
    ],
  },
  lightarmor: {
    name: "Light Armor", attr: "fin",
    desc: "Leathers and shadow-weave. Speed is armor that weighs nothing.",
    perks: [
      { id: "la_1", name: "Wind Courier", req: 10, desc: "+20% armor from light armor pieces." },
      { id: "la_2", name: "Unburdened", req: 25, desc: "Light armor weighs half as much." },
      { id: "la_3", name: "Slipstream", req: 45, desc: "Dodge rolls cost 20% less stamina in light armor." },
      { id: "la_4", name: "Ghostskin", req: 70, desc: "+40% armor from light armor; rolls gain longer invulnerability." },
    ],
  },
  heavyarmor: {
    name: "Heavy Armor", attr: "end",
    desc: "Plate and resolve. Become the thing that does not move.",
    perks: [
      { id: "ha_1", name: "Iron Habit", req: 10, desc: "+20% armor from heavy armor pieces." },
      { id: "ha_2", name: "Load Bearer", req: 25, desc: "Heavy armor weighs 35% less." },
      { id: "ha_3", name: "Juggernaut", req: 45, desc: "+30 poise while wearing heavy chest armor." },
      { id: "ha_4", name: "Citadel Self", req: 70, desc: "+40% armor from heavy armor; immune to small staggers." },
    ],
  },
  destruction: {
    name: "Destruction", attr: "wil",
    desc: "Fire, frost and storm — the Ember's three tempers.",
    perks: [
      { id: "de_1", name: "Kindled Mind", req: 10, desc: "+15% destruction damage." },
      { id: "de_2", name: "Cheap Fuel", req: 25, desc: "Destruction spells cost 25% less magicka." },
      { id: "de_3", name: "Elemental Scholar", req: 45, desc: "Burn, chill and shock effects last twice as long." },
      { id: "de_4", name: "Conflagrant", req: 70, desc: "+30% destruction damage; bolt impacts gain splash." },
    ],
  },
  restoration: {
    name: "Restoration", attr: "wil",
    desc: "The gentler grammar of the old light.",
    perks: [
      { id: "re_1", name: "Warm Hands", req: 10, desc: "+25% healing received from spells." },
      { id: "re_2", name: "Conserved Light", req: 25, desc: "Restoration spells cost 25% less magicka." },
      { id: "re_3", name: "Second Wind", req: 45, desc: "Healing spells also restore 20 stamina." },
      { id: "re_4", name: "Undimmed", req: 70, desc: "Once per rest, survive a killing blow at 1 HP." },
    ],
  },
  sneak: {
    name: "Sneak", attr: "fin",
    desc: "Be the rumor, not the news.",
    perks: [
      { id: "sn_1", name: "Soft Step", req: 10, desc: "30% harder to detect while crouched." },
      { id: "sn_2", name: "Knife Logic", req: 25, desc: "Sneak attacks with daggers deal ×6 damage." },
      { id: "sn_3", name: "Dusk Sibling", req: 45, desc: "Nearly invisible while crouched and motionless in darkness." },
      { id: "sn_4", name: "Throatwriter", req: 70, desc: "All sneak attacks deal +50% damage." },
    ],
  },
  smithing: {
    name: "Smithing", attr: "str",
    desc: "Iron is a question. The forge is where you answer it.",
    perks: [
      { id: "sm_1", name: "Apprentice Hammer", req: 10, desc: "Unlock steel smelting and steel gear." },
      { id: "sm_2", name: "Honing Sense", req: 25, desc: "Crafted weapons gain +10% damage." },
      { id: "sm_3", name: "Master Fittings", req: 45, desc: "Crafted armor gains +15% rating." },
      { id: "sm_4", name: "Moonwright", req: 70, desc: "Unlock silvered forging." },
    ],
  },
  alchemy: {
    name: "Alchemy", attr: "wil",
    desc: "The land is a cabinet of cures and cruelties; learn which shelf is which.",
    perks: [
      { id: "al_1", name: "Field Brewer", req: 10, desc: "Brewed potions are 25% stronger." },
      { id: "al_2", name: "Thrifty Mortar", req: 25, desc: "20% chance to not consume ingredients." },
      { id: "al_3", name: "Iron Gut", req: 45, desc: "+25% poison resistance." },
      { id: "al_4", name: "Panacea", req: 70, desc: "Brewed potions are 50% stronger and weigh nothing." },
    ],
  },
  speech: {
    name: "Speech", attr: "wil",
    desc: "The March runs on iron and embers, but it turns on words.",
    perks: [
      { id: "sp_1", name: "Haggler", req: 10, desc: "Buy for 10% less, sell for 10% more." },
      { id: "sp_2", name: "Silver Tongue", req: 25, desc: "Unlock persuasion in conversation." },
      { id: "sp_3", name: "Market Presence", req: 45, desc: "Buy for 20% less, sell for 20% more." },
      { id: "sp_4", name: "Old Tongue Cadence", req: 70, desc: "Edicts recharge 20% faster — even power listens to delivery." },
    ],
  },
  enchanting: {
    name: "Enchanting", attr: "wil",
    desc: "The Lampwright's third craft: teaching embers to live in things.",
    perks: [
      { id: "en_1", name: "Kindled Sigils", req: 10, desc: "Enchantments are 25% stronger." },
      { id: "en_2", name: "Thrifty Flame", req: 25, desc: "Enchanting costs half the embers." },
      { id: "en_3", name: "Twin Brand", req: 45, desc: "Weapons may carry a second enchantment." },
      { id: "en_4", name: "Lampwright's Heir", req: 70, desc: "Enchantments are 50% stronger." },
    ],
  },
};

const ATTR_DEFS = {
  vig: { name: "Vigor",     desc: "+14 max health per point" },
  end: { name: "Endurance", desc: "+9 max stamina, +3 equip load per point" },
  mnd: { name: "Mind",      desc: "+11 max magicka per point" },
  str: { name: "Strength",  desc: "Scales heavy weapon damage; +1 equip load" },
  fin: { name: "Finesse",   desc: "Scales light weapon & bow damage" },
  wil: { name: "Will",      desc: "Scales spell power and resistances" },
};

/* Character origins (chargen classes) */
const ORIGINS = {
  marchwarden: {
    name: "March-Warden", tag: "sword & shield",
    desc: "You held a wall that no longer exists. Discipline survived the masonry. Begins with sword, shield and iron plate — slow, but very hard to convince to die.",
    attrs: { vig: 12, end: 11, mnd: 8, str: 12, fin: 9, wil: 8 },
    skills: { onehand: 15, block: 15, heavyarmor: 15 },
    gear: { weapon: "iron_sword", shield: "iron_kite", head: "iron_helm", body: "iron_cuirass", legs: "iron_greaves" },
    items: [["small_hp_potion", 2], ["bread", 2]],
  },
  hexen: {
    name: "Hexen of the Coast", tag: "fire & will",
    desc: "You traded your name to a tide-cult for three words of fire and kept the receipt. Begins with staff and firebolt — fragile, but the Ember listens when you speak.",
    attrs: { vig: 9, end: 8, mnd: 13, str: 8, fin: 9, wil: 13 },
    skills: { destruction: 20, restoration: 10, alchemy: 10 },
    gear: { weapon: "ashen_staff", head: "rag_hood", body: "rag_tunic", legs: "rag_boots" },
    items: [["mag_potion", 3], ["small_hp_potion", 1]],
    spells: ["firebolt", "lesser_heal", "frost_spike"],
  },
  stray: {
    name: "Duskmere Stray", tag: "knife & shadow",
    desc: "The Mire raised you, which is to say it tried to eat you and failed. Begins with dagger, bow and quiet feet — strike unseen or not at all.",
    attrs: { vig: 10, end: 10, mnd: 8, str: 8, fin: 14, wil: 8 },
    skills: { sneak: 20, onehand: 10, archery: 15 },
    gear: { weapon: "bone_dagger", ranged: "hunting_bow", head: "leather_cap", body: "leather_jack", legs: "leather_boots" },
    items: [["small_hp_potion", 2], ["antidote", 2], ["dried_meat", 2]],
  },
  hewer: {
    name: "Frosthollow Hewer", tag: "great blade",
    desc: "You felled pines beyond the snow line until something began felling them back. Begins with greataxe and furs — every swing is a closing argument.",
    attrs: { vig: 13, end: 12, mnd: 7, str: 14, fin: 8, wil: 6 },
    skills: { twohand: 20, heavyarmor: 5, smithing: 10 },
    gear: { weapon: "woodsman_axe", head: "leather_cap", body: "leather_jack", legs: "iron_greaves" },
    items: [["honey_mead", 3], ["dried_meat", 2], ["warming_salve", 1]],
  },
};
