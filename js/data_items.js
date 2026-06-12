/* ============================================================
   CLAUDERIM — data_items.js
   Item database: weapons, armor, shields, consumables,
   ingredients, materials, keys — plus crafting recipes
   and loot tables. Every item carries its lore.
   ============================================================ */
"use strict";

/*
  Weapon scaling letters -> stat multiplier. Final damage:
    base * (1 + Σ scale[stat] * (stat - 8) * 0.035) * skill * perks
*/
const SCALE_MULT = { S: 1.0, A: 0.75, B: 0.55, C: 0.38, D: 0.22, E: 0.08 };

const ITEMS = {

  /* =================== WEAPONS — ONE-HANDED =================== */

  rusted_sword: {
    name: "Rusted Sword", type: "weapon", wclass: "1h", skill: "onehand",
    dmg: 11, spd: 1.5, reach: 52, stam: 11, poiseDmg: 14, weight: 3, value: 8, rarity: "common",
    scale: { str: "D", fin: "D" },
    lore: "A blade that outlived its bearer, and will outlive you. The rust remembers rain that fell before the Ember dimmed."
  },
  iron_sword: {
    name: "Iron Sword", type: "weapon", wclass: "1h", skill: "onehand",
    dmg: 16, spd: 1.5, reach: 54, stam: 12, poiseDmg: 16, weight: 4, value: 40, rarity: "common",
    scale: { str: "C", fin: "C" },
    lore: "Standard issue of the March-wardens. Honest iron, asking only a steady hand."
  },
  steel_sword: {
    name: "Steel Longsword", type: "weapon", wclass: "1h", skill: "onehand",
    dmg: 23, spd: 1.45, reach: 56, stam: 13, poiseDmg: 18, weight: 5, value: 130, rarity: "fine",
    scale: { str: "C", fin: "B" },
    lore: "Forged in Emberfall when the bellows still sang. Its balance forgives mistakes its edge does not."
  },
  silvered_blade: {
    name: "Silvered Blade", type: "weapon", wclass: "1h", skill: "onehand",
    dmg: 25, spd: 1.5, reach: 56, stam: 13, poiseDmg: 17, weight: 4, value: 320, rarity: "rare",
    scale: { str: "D", fin: "B" }, bonusVs: "undead",
    lore: "Quenched in moonwater by the Lampwrights of old. The hollowed dead flinch from its light."
  },
  ember_brand: {
    name: "Ember Brand", type: "weapon", wclass: "1h", skill: "onehand",
    dmg: 21, spd: 1.45, reach: 56, stam: 14, poiseDmg: 18, weight: 5, value: 700, rarity: "unique",
    scale: { str: "C", fin: "C" }, edmg: { fire: 9 },
    lore: "A shard of the First Ember sleeps in the fuller. It does not burn its bearer — only everything the bearer regrets."
  },
  iron_axe: {
    name: "Iron Axe", type: "weapon", wclass: "1h", skill: "onehand",
    dmg: 19, spd: 1.2, reach: 48, stam: 15, poiseDmg: 24, weight: 5, value: 45, rarity: "common",
    scale: { str: "B", fin: "E" },
    lore: "It split wood for thirty winters and men for three. The handle is worn to the shape of grief."
  },
  bearded_axe: {
    name: "Bearded War-Axe", type: "weapon", wclass: "1h", skill: "onehand",
    dmg: 26, spd: 1.15, reach: 50, stam: 16, poiseDmg: 28, weight: 6, value: 180, rarity: "fine",
    scale: { str: "B", fin: "E" },
    lore: "Frosthollow steel, hooked to drag shields down and hopes with them."
  },
  iron_mace: {
    name: "Iron Mace", type: "weapon", wclass: "1h", skill: "onehand",
    dmg: 21, spd: 1.1, reach: 46, stam: 16, poiseDmg: 32, weight: 6, value: 50, rarity: "common",
    scale: { str: "B", fin: "E" },
    lore: "Subtle as a sermon. The Ashpriests favored maces; flesh forgives, bone does not."
  },
  morningstar: {
    name: "Morningstar", type: "weapon", wclass: "1h", skill: "onehand",
    dmg: 28, spd: 1.05, reach: 47, stam: 17, poiseDmg: 36, weight: 7, value: 210, rarity: "fine",
    scale: { str: "B", fin: "E" },
    lore: "Named for the dawn it promises and the night it delivers."
  },
  bone_dagger: {
    name: "Bone Dagger", type: "weapon", wclass: "dagger", skill: "onehand",
    dmg: 8, spd: 2.4, reach: 38, stam: 7, poiseDmg: 7, weight: 1, value: 12, rarity: "common",
    scale: { str: "E", fin: "B" }, sneakMult: 3,
    lore: "Carved from a warden's femur by something that admired wardens very much."
  },
  steel_dirk: {
    name: "Steel Dirk", type: "weapon", wclass: "dagger", skill: "onehand",
    dmg: 13, spd: 2.4, reach: 40, stam: 8, poiseDmg: 8, weight: 1, value: 90, rarity: "fine",
    scale: { str: "E", fin: "A" }, sneakMult: 4,
    lore: "The Duskmere fishers gut eels with these. The eels of Duskmere are not small, and not always eels."
  },
  mirefang: {
    name: "Mirefang", type: "weapon", wclass: "dagger", skill: "onehand",
    dmg: 14, spd: 2.5, reach: 40, stam: 8, poiseDmg: 8, weight: 1, value: 600, rarity: "unique",
    scale: { str: "E", fin: "A" }, sneakMult: 4, edmg: { poison: 6 },
    lore: "A tooth of the Matron, set in blackened silver. It weeps when held, though never for you."
  },
  iron_spear: {
    name: "Iron Spear", type: "weapon", wclass: "spear", skill: "onehand",
    dmg: 17, spd: 1.3, reach: 74, stam: 13, poiseDmg: 15, weight: 4, value: 55, rarity: "common",
    scale: { str: "D", fin: "B" },
    lore: "Reach is a kind of mercy: the enemy dies a little farther from your face."
  },
  warden_pike: {
    name: "Warden's Pike", type: "weapon", wclass: "spear", skill: "onehand",
    dmg: 24, spd: 1.25, reach: 80, stam: 14, poiseDmg: 18, weight: 5, value: 240, rarity: "rare",
    scale: { str: "C", fin: "B" },
    lore: "The barrow-wardens were buried standing, pikes raised, so the dark would have to climb."
  },

  /* =================== WEAPONS — TWO-HANDED =================== */

  woodsman_axe: {
    name: "Woodsman's Greataxe", type: "weapon", wclass: "2h", skill: "twohand", twoHanded: true,
    dmg: 30, spd: 0.85, reach: 62, stam: 24, poiseDmg: 48, weight: 10, value: 70, rarity: "common",
    scale: { str: "B", fin: "E" },
    lore: "It knows nothing of war. It knows that everything falls the same direction: down."
  },
  greatsword: {
    name: "March Greatsword", type: "weapon", wclass: "2h", skill: "twohand", twoHanded: true,
    dmg: 36, spd: 0.9, reach: 70, stam: 25, poiseDmg: 44, weight: 11, value: 260, rarity: "fine",
    scale: { str: "B", fin: "D" },
    lore: "Too heavy for a man, they said, so the March bred bigger men, and then the March ran out of men."
  },
  hrolgars_maul: {
    name: "Hrolgar's Maul", type: "weapon", wclass: "2h", skill: "twohand", twoHanded: true,
    dmg: 44, spd: 0.7, reach: 60, stam: 32, poiseDmg: 70, weight: 16, value: 900, rarity: "unique",
    scale: { str: "A", fin: "E" }, edmg: { frost: 10 },
    lore: "The Frost-Tyrant's hammer, cold to the marrow. It remembers the shape of every gate it has opened."
  },
  pale_claymore: {
    name: "Pale Claymore", type: "weapon", wclass: "2h", skill: "twohand", twoHanded: true,
    dmg: 40, spd: 0.95, reach: 72, stam: 24, poiseDmg: 46, weight: 10, value: 1100, rarity: "unique",
    scale: { str: "B", fin: "B" }, edmg: { shock: 8 },
    lore: "Forged from the Citadel's portcullis by a king who feared visitors. Now it visits."
  },
  aldsbane: {
    name: "Aldsbane", type: "weapon", wclass: "2h", skill: "twohand", twoHanded: true,
    dmg: 43, spd: 0.92, reach: 74, stam: 25, poiseDmg: 50, weight: 11, value: 1600, rarity: "unique",
    scale: { str: "B", fin: "B" }, edmg: { shock: 7, fire: 7 },
    lore: "The First-Kindled's own blade, left in the deep when he went down to argue with the Dark in person. The argument, by all evidence, continues."
  },
  twinned_temper: {
    name: "Twinned Temper", type: "weapon", wclass: "1h", skill: "onehand",
    dmg: 26, spd: 1.5, reach: 56, stam: 13, poiseDmg: 19, weight: 5, value: 1200, rarity: "unique",
    scale: { str: "C", fin: "B" }, edmg: { fire: 6, frost: 6 },
    lore: "Bram's masterpiece: a blade quenched twice, once in glacier-melt and once in ember-bath. The two tempers have never agreed about anything, including whom to cut."
  },
  stillsong: {
    name: "Stillsong", type: "weapon", wclass: "1h", skill: "onehand",
    dmg: 27, spd: 1.55, reach: 56, stam: 12, poiseDmg: 18, weight: 4, value: 1300, rarity: "unique",
    scale: { str: "D", fin: "A" }, edmg: { frost: 8 },
    lore: "Carried at the White Pass by a soldier whose name the song forgot. It makes no sound when swung — the quiet goes ahead of the edge, and arrives first."
  },
  undertow: {
    name: "Undertow", type: "weapon", wclass: "1h", skill: "onehand",
    dmg: 24, spd: 1.65, reach: 54, stam: 11, poiseDmg: 16, weight: 4, value: 1100, rarity: "unique",
    scale: { str: "E", fin: "A" }, edmg: { frost: 5 }, leech: 0.08,
    lore: "Captain Veyra's cutlass, which drank with her crew for thirty years and never learned to stop. What it takes from others, it gives to the hand that holds it."
  },

  /* =================== BOWS =================== */

  hunting_bow: {
    name: "Hunting Bow", type: "bow", skill: "archery", twoHanded: true,
    dmg: 13, spd: 1.0, stam: 9, poiseDmg: 8, weight: 3, value: 30, rarity: "common",
    scale: { fin: "B" },
    lore: "Yew and gut-string and patience. Mostly patience."
  },
  composite_bow: {
    name: "Composite Bow", type: "bow", skill: "archery", twoHanded: true,
    dmg: 20, spd: 1.0, stam: 11, poiseDmg: 10, weight: 3, value: 160, rarity: "fine",
    scale: { fin: "A" },
    lore: "Horn, sinew and three kinds of glue, one of which the fletcher refused to name."
  },
  wraithwood_bow: {
    name: "Wraithwood Bow", type: "bow", skill: "archery", twoHanded: true,
    dmg: 26, spd: 1.1, stam: 11, poiseDmg: 10, weight: 2, value: 750, rarity: "unique",
    scale: { fin: "S" }, edmg: { frost: 5 },
    lore: "Cut from a tree that grows only where someone drowned. The arrows arrive slightly before they are loosed."
  },

  /* =================== STAVES (cast focus) =================== */

  ashen_staff: {
    name: "Ashen Staff", type: "staff", skill: "destruction", twoHanded: false,
    dmg: 6, spd: 1.2, reach: 50, stam: 8, poiseDmg: 8, weight: 3, value: 90, rarity: "common",
    scale: { wil: "B" }, spellPower: 1.12,
    lore: "Charred driftwood from the Cinder Coast. It hums when pointed at anything flammable, which is everything."
  },
  occult_scepter: {
    name: "Occult Scepter", type: "staff", skill: "destruction", twoHanded: false,
    dmg: 9, spd: 1.2, reach: 50, stam: 8, poiseDmg: 8, weight: 3, value: 420, rarity: "rare",
    scale: { wil: "A" }, spellPower: 1.28,
    lore: "Recovered from the Drowned Bell. The previous owner is still looking for it. Listen, on quiet nights."
  },
  stormcaller: {
    name: "Stormcaller", type: "staff", skill: "destruction", twoHanded: false,
    dmg: 11, spd: 1.2, reach: 50, stam: 8, poiseDmg: 9, weight: 3, value: 950, rarity: "unique",
    scale: { wil: "S" }, spellPower: 1.42,
    lore: "Caldus carved it from a pine the lightning loved too much. It does not channel storms; it gossips with them."
  },

  /* =================== SHIELDS =================== */

  wooden_shield: {
    name: "Wooden Shield", type: "shield", skill: "block",
    block: 38, stability: 30, weight: 3, value: 15, rarity: "common",
    lore: "A door, demoted."
  },
  iron_kite: {
    name: "Iron Kite Shield", type: "shield", skill: "block",
    block: 55, stability: 45, weight: 6, value: 80, rarity: "common",
    lore: "Carried by the wall-guard of Emberfall. The dents form a map of bad days survived."
  },
  tower_shield: {
    name: "Tower Shield", type: "shield", skill: "block",
    block: 72, stability: 62, weight: 11, value: 260, rarity: "fine",
    lore: "Less a shield than a portable disagreement."
  },
  warden_aegis: {
    name: "Warden's Aegis", type: "shield", skill: "block",
    block: 68, stability: 70, weight: 8, value: 800, rarity: "unique", edef: { fire: 15, frost: 15 },
    lore: "Korvash bore this when he still had a name worth defending. The boss of the shield is an ember, sealed in glass, still warm."
  },

  /* =================== ARMOR — LIGHT =================== */

  rag_hood:   { name: "Pilgrim's Hood", type: "armor", slot: "head", kind: "light", armor: 2, weight: 1, value: 5, rarity: "common",
    lore: "It keeps off the rain and the pity of strangers." },
  rag_tunic:  { name: "Pilgrim's Tunic", type: "armor", slot: "body", kind: "light", armor: 4, weight: 2, value: 8, rarity: "common",
    lore: "Ash-stained linen. Whoever wore it walked a long way to die where you woke." },
  rag_boots:  { name: "Pilgrim's Wraps", type: "armor", slot: "legs", kind: "light", armor: 2, weight: 1, value: 4, rarity: "common",
    lore: "The road is recorded in every fray." },
  leather_cap:   { name: "Leather Cap", type: "armor", slot: "head", kind: "light", armor: 5, weight: 1, value: 25, rarity: "common",
    lore: "Boiled in wax and stubbornness." },
  leather_jack:  { name: "Leather Jack", type: "armor", slot: "body", kind: "light", armor: 9, weight: 4, value: 45, rarity: "common",
    lore: "Hunter's armor. Smells of pine, smoke, and narrow escapes." },
  leather_boots: { name: "Leather Boots", type: "armor", slot: "legs", kind: "light", armor: 5, weight: 2, value: 30, rarity: "common",
    lore: "Quiet soles for loud work." },
  mirewalker_cowl: { name: "Mirewalker Cowl", type: "armor", slot: "head", kind: "light", armor: 7, weight: 1, value: 140, rarity: "fine", edef: { poison: 20 },
    lore: "Waxed against the Mire's breath. The fen takes those who breathe deep." },
  mirewalker_coat: { name: "Mirewalker Coat", type: "armor", slot: "body", kind: "light", armor: 13, weight: 4, value: 220, rarity: "fine", edef: { poison: 25 },
    lore: "Eel-leather, triple-stitched. Duskmere's elders are buried in these — the ground there does not always keep what it is given." },
  mirewalker_waders: { name: "Mirewalker Waders", type: "armor", slot: "legs", kind: "light", armor: 7, weight: 2, value: 150, rarity: "fine", edef: { poison: 20 },
    lore: "Tall boots for short prayers." },
  shade_hood: { name: "Shade Hood", type: "armor", slot: "head", kind: "light", armor: 8, weight: 1, value: 400, rarity: "rare", sneakBonus: 10,
    lore: "Woven from dusk itself, the weavers claimed. Customs inspectors disagreed and were not seen again." },
  shade_garb: { name: "Shade Garb", type: "armor", slot: "body", kind: "light", armor: 15, weight: 3, value: 600, rarity: "rare", sneakBonus: 15,
    lore: "The seams are sewn with shadow-thread that frays in lamplight." },
  shade_treads: { name: "Shade Treads", type: "armor", slot: "legs", kind: "light", armor: 8, weight: 1, value: 420, rarity: "rare", sneakBonus: 10,
    lore: "They make no sound. Neither, eventually, do their owners." },

  /* =================== ARMOR — HEAVY =================== */

  iron_helm:   { name: "Iron Helm", type: "armor", slot: "head", kind: "heavy", armor: 9, weight: 4, value: 60, rarity: "common",
    lore: "The world becomes a bright slit. So does the future." },
  iron_cuirass:{ name: "Iron Cuirass", type: "armor", slot: "body", kind: "heavy", armor: 17, weight: 12, value: 110, rarity: "common",
    lore: "March-pattern plate. The smiths of Emberfall stamp each breastplate with a small flame, for luck. The luck is not transferable." },
  iron_greaves:{ name: "Iron Greaves", type: "armor", slot: "legs", kind: "heavy", armor: 9, weight: 6, value: 70, rarity: "common",
    lore: "Heavy enough to anchor a man against wind, water, and good advice." },
  steel_helm:   { name: "Steel Helm", type: "armor", slot: "head", kind: "heavy", armor: 13, weight: 4, value: 200, rarity: "fine",
    lore: "Crested with a wolf, because wolves at least run in packs." },
  steel_plate:  { name: "Steel Plate", type: "armor", slot: "body", kind: "heavy", armor: 24, weight: 13, value: 380, rarity: "fine",
    lore: "Articulated Emberfall plate. Wearing it feels like being believed in." },
  steel_greaves:{ name: "Steel Greaves", type: "armor", slot: "legs", kind: "heavy", armor: 13, weight: 7, value: 240, rarity: "fine",
    lore: "Each step rings like a small bell tolling for somebody else." },
  frostplate_helm: { name: "Frostplate Helm", type: "armor", slot: "head", kind: "heavy", armor: 16, weight: 5, value: 520, rarity: "rare", edef: { frost: 25 },
    lore: "Hrolgar's housecarls wore these. Frozen breath rimes the visor in shapes resembling prayer." },
  frostplate_cuirass: { name: "Frostplate Cuirass", type: "armor", slot: "body", kind: "heavy", armor: 28, weight: 14, value: 880, rarity: "rare", edef: { frost: 30 },
    lore: "Quenched in glacier-melt under a moonless sky. It is always cold, and never as cold as its first owner became." },
  frostplate_greaves: { name: "Frostplate Greaves", type: "armor", slot: "legs", kind: "heavy", armor: 16, weight: 8, value: 560, rarity: "rare", edef: { frost: 25 },
    lore: "The Tyrant's men marched through blizzards singing. The songs are lost; the greaves endure." },
  pale_crown: { name: "Pale Crown", type: "armor", slot: "head", kind: "heavy", armor: 18, weight: 3, value: 1500, rarity: "unique", edef: { shock: 25, fire: 15 },
    lore: "Maerodric's circlet. It weighs little and costs everything. Kings have always known this and worn it anyway."
  },

  /* =================== AMULETS / RINGS =================== */

  ember_amulet: { name: "Amulet of Embers", type: "trinket", slot: "trinket", weight: 0, value: 300, rarity: "rare",
    bonus: { hpRegen: 0.6 },
    lore: "A coal that never cools, wired in copper. Hold it to your chest and your blood remembers being warm." },
  drowned_amulet: { name: "Amulet of the Drowned Bell", type: "trinket", slot: "trinket", weight: 0, value: 500, rarity: "unique",
    bonus: { magRegen: 1.4, maxMag: 20 },
    lore: "It chimes once, very softly, whenever someone in the world forgives someone else. It is almost always silent." },
  wolf_ring: { name: "Wolfblood Ring", type: "trinket", slot: "trinket", weight: 0, value: 350, rarity: "rare",
    bonus: { stamRegen: 4 },
    lore: "Bandit chieftains pass this ring down by combat. Technically, you inherited it." },
  warden_seal: { name: "Warden's Seal", type: "trinket", slot: "trinket", weight: 0, value: 450, rarity: "rare",
    bonus: { poise: 20, maxHp: 15 },
    lore: "An oath, cast in lead. Oaths are heavier than they look." },
  ring_deep: { name: "Ring of the Deep", type: "trinket", slot: "trinket", weight: 0, value: 700, rarity: "unique",
    bonus: { stamRegen: 5, maxHp: 12 },
    lore: "Worn smooth by four hundred years of a dead king turning it on a dead finger. It remembers how to be patient, and lends the knack." },
  circlet_first: { name: "Circlet of the First", type: "armor", slot: "head", kind: "light", armor: 12, weight: 1, value: 1400, rarity: "unique", edef: { shock: 20, fire: 20 },
    lore: "Ald's coronal, a ring of cold gold and one ember-bead. Thirty-one kings refused to wear it after him; they said it listened." },
  passwarden_cloak: { name: "Passwarden's Cloak", type: "armor", slot: "body", kind: "light", armor: 14, weight: 3, value: 800, rarity: "rare", edef: { frost: 35 },
    lore: "Pulled gently from a frozen shoulder at the White Pass. Four hundred winters could not get through it; whoever wore it died of something else entirely." },
  champions_ring: { name: "Spark-Champion's Ring", type: "trinket", slot: "trinket", weight: 0, value: 900, rarity: "unique",
    bonus: { stamRegen: 4, maxHp: 10, poise: 10 },
    lore: "Brann's prize for those who outlast his Gauntlet. The band is forge-slag from a hundred broken blades — everything that didn't survive, holding together the one that did." },

  /* =================== CONSUMABLES =================== */

  // The Ember Flask is the estus analogue and is NOT an inventory item; it lives on the player.
  small_hp_potion: { name: "Crimson Draught", type: "consumable", weight: 0.3, value: 25, rarity: "common",
    use: { hp: 35 }, lore: "Bitter as regret, warm as forgiveness." },
  big_hp_potion: { name: "Crimson Philter", type: "consumable", weight: 0.4, value: 70, rarity: "fine",
    use: { hp: 80 }, lore: "Maren's strongest brew. She will not say what the third ingredient is, only that it volunteered." },
  stam_potion: { name: "Verdant Draught", type: "consumable", weight: 0.3, value: 20, rarity: "common",
    use: { stam: 60 }, lore: "Tastes of crushed grass and second chances." },
  mag_potion: { name: "Azure Draught", type: "consumable", weight: 0.3, value: 30, rarity: "common",
    use: { mag: 50 }, lore: "Cold on the tongue, loud in the mind." },
  antidote: { name: "Pale Antidote", type: "consumable", weight: 0.2, value: 30, rarity: "common",
    use: { cure: "poison" }, lore: "Mire-cures for mire-ills. The fen poisons you; the fen sells you the remedy. The fen does well for itself." },
  warming_salve: { name: "Warming Salve", type: "consumable", weight: 0.2, value: 30, rarity: "common",
    use: { cure: "frost", buff: { id: "warm", dur: 60, frostRes: 40 } }, lore: "Smear it on and the cold becomes a rumor." },
  bread: { name: "Hard Bread", type: "consumable", weight: 0.3, value: 4, rarity: "common",
    use: { hp: 8 }, lore: "Bake it once, eat it forever." },
  dried_meat: { name: "Dried Meat", type: "consumable", weight: 0.3, value: 8, rarity: "common",
    use: { hp: 14 }, lore: "Of uncertain animal and certain age." },
  honey_mead: { name: "Frosthollow Mead", type: "consumable", weight: 0.5, value: 15, rarity: "common",
    use: { hp: 10, stam: 25 }, lore: "Brewed strong enough to argue with the cold and win." },
  ember_shard: { name: "Ember Shard", type: "consumable", weight: 0, value: 100, rarity: "rare",
    use: { embers: 200 }, lore: "A splinter of warmth from the First Flame. Crush it, and borrowed light becomes yours." },
  ember_core: { name: "Ember Core", type: "consumable", weight: 0, value: 400, rarity: "rare",
    use: { embers: 800 }, lore: "It beats, very slowly, like the heart of something patient." },
  fire_bomb: { name: "Cinder Bomb", type: "consumable", weight: 0.5, value: 35, rarity: "common",
    use: { throw: { dmg: 30, dtype: "fire", radius: 60 } }, lore: "Clay, pitch, and a strong opinion." },
  raw_venison: { name: "Raw Venison", type: "consumable", weight: 0.5, value: 6, rarity: "common",
    use: { hp: 5 }, lore: "Eat it raw if you must. The deer would consider it poor manners twice over." },
  rabbit_meat: { name: "Rabbit Meat", type: "consumable", weight: 0.2, value: 4, rarity: "common",
    use: { hp: 4 }, lore: "Fast food, formerly." },
  seared_venison: { name: "Seared Venison", type: "consumable", weight: 0.5, value: 22, rarity: "common",
    use: { hp: 42, buff: { id: "hearty", dur: 90, stamRegen: 6 } },
    lore: "Cooked over a real fire until the fat sings. For a while afterward, the road feels shorter." },
  hunters_skewer: { name: "Hunter's Skewer", type: "consumable", weight: 0.3, value: 12, rarity: "common",
    use: { hp: 22, stam: 30 }, lore: "Ralka's recipe: meat, stick, patience, no questions about the meat." },
  marsh_stew: { name: "Marsh Stew", type: "consumable", weight: 0.5, value: 28, rarity: "common",
    use: { hp: 30, mag: 25, cure: "poison" },
    lore: "A Duskmere kindness: everything the fen throws at you, boiled until it apologizes." },

  /* =================== INGREDIENTS (alchemy) =================== */

  glowcap: { name: "Glowcap", type: "ingredient", weight: 0.1, value: 8, rarity: "common",
    lore: "A mushroom that hoards lamplight and releases it slowly, like a grudge." },
  emberbloom: { name: "Emberbloom", type: "ingredient", weight: 0.1, value: 18, rarity: "fine",
    lore: "It flowers only in ash. Hope is a weed; this is its cousin." },
  frostmoss: { name: "Frostmoss", type: "ingredient", weight: 0.1, value: 10, rarity: "common",
    lore: "Blue-white and bitter. Grows where winter rests its hand too long." },
  marrowroot: { name: "Marrowroot", type: "ingredient", weight: 0.1, value: 9, rarity: "common",
    lore: "Dig it at dusk and it screams politely." },
  mireweed: { name: "Mireweed", type: "ingredient", weight: 0.1, value: 7, rarity: "common",
    lore: "The Mire's smallest ambassador. Handle with gloves and low expectations." },
  wolfsbane: { name: "Wolfsbane", type: "ingredient", weight: 0.1, value: 12, rarity: "common",
    lore: "Pretty, purple, and profoundly unfriendly." },
  ghost_fern: { name: "Ghost Fern", type: "ingredient", weight: 0.1, value: 20, rarity: "fine",
    lore: "Visible only out of the corner of the eye. Pick it without looking. Good luck." },
  troll_fat: { name: "Troll Fat", type: "ingredient", weight: 0.4, value: 25, rarity: "fine",
    lore: "Render of frost troll. Burns slow, smells worse, heals strangely." },

  /* =================== MATERIALS =================== */

  iron_ore: { name: "Iron Ore", type: "material", weight: 1, value: 12, rarity: "common",
    lore: "The bones of the March, dug up and asked to fight." },
  steel_ingot: { name: "Steel Ingot", type: "material", weight: 1, value: 45, rarity: "fine",
    lore: "Iron, educated." },
  leather_strips: { name: "Leather Strips", type: "material", weight: 0.2, value: 6, rarity: "common",
    lore: "Everything is held together by these, including, arguably, the kingdom." },
  wolf_pelt: { name: "Wolf Pelt", type: "material", weight: 1, value: 14, rarity: "common",
    lore: "Warm, grey, and recently of a differing opinion." },
  silver_dust: { name: "Silver Dust", type: "material", weight: 0.1, value: 40, rarity: "rare",
    lore: "Ground moonlight. The dead find it impolite." },
  frost_crystal: { name: "Frost Crystal", type: "material", weight: 0.3, value: 60, rarity: "rare",
    lore: "A moment of deep winter, paused." },
  ember_residue: { name: "Ember Residue", type: "material", weight: 0.1, value: 50, rarity: "rare",
    lore: "What remains when something refuses to stop burning." },
  tide_pearl: { name: "Tideglass Pearl", type: "material", weight: 0.1, value: 55, rarity: "rare",
    lore: "The sea makes these of whatever it regrets. The Lampwrights prize them for enchanting; the tide always wants them back." },
  salt_cod: { name: "Salt Cod", type: "consumable", weight: 0.3, value: 9, rarity: "common",
    use: { hp: 16, stam: 10 }, lore: "The coast's answer to every question, including several nobody asked." },

  /* =================== FISHING =================== */
  fishing_rod: { name: "Fishing Rod", type: "tool", weight: 2, value: 40, rarity: "common",
    lore: "Hazel, horsehair, and a hook of honest iron. The March's waters keep more than fish, but they start with fish." },
  river_perch: { name: "River Perch", type: "consumable", weight: 0.3, value: 8, rarity: "common",
    use: { hp: 10 }, lore: "Speckled gold and stubborn to the last. The lakes of the Heartlands are full of opinions like this one." },
  mire_eel: { name: "Mire Eel", type: "consumable", weight: 0.4, value: 12, rarity: "common",
    use: { hp: 8, mag: 12 }, lore: "Duskmere's daily bread, if bread fought back. Petra would approve of your technique, or say so anyway." },
  frost_char: { name: "Frost Char", type: "consumable", weight: 0.4, value: 14, rarity: "common",
    use: { hp: 12, stam: 12 }, lore: "It swims under the ice all winter and tastes like the patience that takes." },
  silver_herring: { name: "Silver Herring", type: "consumable", weight: 0.2, value: 7, rarity: "common",
    use: { hp: 8 }, lore: "The sea's small change." },
  tide_grouper: { name: "Tide Grouper", type: "consumable", weight: 0.8, value: 35, rarity: "fine",
    use: { hp: 24, stam: 20 }, lore: "A fish the size of a grudge. The wreckers' lamps never fooled these — nothing fools a grouper twice." },
  grilled_catch: { name: "Grilled Catch", type: "consumable", weight: 0.3, value: 20, rarity: "common",
    use: { hp: 34, buff: { id: "hearty", dur: 60, stamRegen: 4 } },
    lore: "Any fish, honest fire, a little salt if the coast owes you. The oldest good meal there is." },
  eel_stew: { name: "Duskmere Eel Stew", type: "consumable", weight: 0.5, value: 30, rarity: "common",
    use: { hp: 28, mag: 30, cure: "poison" },
    lore: "The fen poisons you; the fen feeds you the cure in a bowl. The fen does well for itself." },

  /* =================== KEYS & QUEST ITEMS =================== */

  sigil_grave: { name: "Sigil of the Grave", type: "key", weight: 0, value: 0, rarity: "unique",
    lore: "VAL — the Old Tongue word for 'unmoved.' Korvash held it for four hundred years. He is unmoved no longer." },
  sigil_mire: { name: "Sigil of the Mire", type: "key", weight: 0, value: 0, rarity: "unique",
    lore: "SUTH — 'that which keeps.' The Matron kept her children, her hunger, and this. Now it keeps you." },
  sigil_frost: { name: "Sigil of the Frost", type: "key", weight: 0, value: 0, rarity: "unique",
    lore: "KYR — 'the stillness between heartbeats.' Hrolgar froze a war mid-charge to learn this word." },
  sigil_ash: { name: "Sigil of the Ash", type: "key", weight: 0, value: 0, rarity: "unique",
    lore: "THUR — 'fire that answers.' Velmora preached to the Ember for a century before it spoke back. It said this." },
  citadel_key: { name: "Hollow Citadel Key", type: "key", weight: 0, value: 0, rarity: "unique",
    lore: "Black iron, warm to the touch. The Pale King locked his gates from the inside, which tells you everything." },
  crypt_key: { name: "Crypt Key", type: "key", weight: 0, value: 0, rarity: "rare",
    lore: "Tobbe keeps it under the bar, next to the good mead and the bad memories." },
  medicine_parcel: { name: "Sealed Medicine", type: "key", weight: 1, value: 0, rarity: "fine",
    lore: "Maren's fever-cure, wax-sealed against the cold and the curious. Frosthollow is waiting." },
  drowned_bell_clapper: { name: "Bell Clapper", type: "key", weight: 2, value: 0, rarity: "rare",
    lore: "Torn from the Drowned Bell. Without it the chapel is finally, mercifully, silent." },
  pass_warhorn: { name: "War-Horn of the Pass", type: "key", weight: 2, value: 0, rarity: "unique",
    lore: "The Hymnkeeper held it for four hundred years, never sounding it — a held breath made of brass. The charge it was meant to signal is still waiting, an arm's length from the enemy." },

  /* =================== MISC =================== */

  gold: { name: "Gold Marks", type: "currency", weight: 0, value: 1, rarity: "common",
    lore: "Stamped with the Pale King's face. He no longer accepts them either." },
  old_bone: { name: "Old Bone", type: "material", weight: 0.3, value: 3, rarity: "common",
    lore: "Somebody's. Probably nobody you knew." },
  torch: { name: "Torch", type: "tool", weight: 1, value: 6, rarity: "common",
    lore: "Push back the dark a little. The dark does not mind; it is patient." },
};

/* Every item gets its id injected for convenience. */
for (const id in ITEMS) ITEMS[id].id = id;

/* =================== SMITHING RECIPES =================== */
const RECIPES_SMITH = [
  { out: "iron_sword",     mats: { iron_ore: 2, leather_strips: 1 }, skillReq: 0 },
  { out: "iron_axe",       mats: { iron_ore: 2, leather_strips: 1 }, skillReq: 0 },
  { out: "iron_mace",      mats: { iron_ore: 3 }, skillReq: 0 },
  { out: "iron_spear",     mats: { iron_ore: 2, leather_strips: 1 }, skillReq: 0 },
  { out: "iron_helm",      mats: { iron_ore: 2 }, skillReq: 0 },
  { out: "iron_cuirass",   mats: { iron_ore: 4, leather_strips: 2 }, skillReq: 5 },
  { out: "iron_greaves",   mats: { iron_ore: 3, leather_strips: 1 }, skillReq: 5 },
  { out: "iron_kite",      mats: { iron_ore: 3, leather_strips: 1 }, skillReq: 5 },
  { out: "steel_ingot",    mats: { iron_ore: 2, ember_residue: 0 }, skillReq: 10, note: "smelt" },
  { out: "steel_sword",    mats: { steel_ingot: 2, leather_strips: 1 }, skillReq: 15 },
  { out: "bearded_axe",    mats: { steel_ingot: 2, leather_strips: 1 }, skillReq: 15 },
  { out: "morningstar",    mats: { steel_ingot: 3 }, skillReq: 20 },
  { out: "greatsword",     mats: { steel_ingot: 4, leather_strips: 2 }, skillReq: 25 },
  { out: "steel_helm",     mats: { steel_ingot: 2, leather_strips: 1 }, skillReq: 20 },
  { out: "steel_plate",    mats: { steel_ingot: 5, leather_strips: 2 }, skillReq: 30 },
  { out: "steel_greaves",  mats: { steel_ingot: 3, leather_strips: 1 }, skillReq: 25 },
  { out: "tower_shield",   mats: { steel_ingot: 4, iron_ore: 2 }, skillReq: 30 },
  { out: "silvered_blade", mats: { steel_ingot: 2, silver_dust: 3 }, skillReq: 40 },
  { out: "leather_jack",   mats: { wolf_pelt: 3, leather_strips: 2 }, skillReq: 0 },
  { out: "leather_cap",    mats: { wolf_pelt: 1, leather_strips: 1 }, skillReq: 0 },
  { out: "leather_boots",  mats: { wolf_pelt: 2, leather_strips: 1 }, skillReq: 0 },
  { out: "leather_strips", mats: { wolf_pelt: 1 }, skillReq: 0 },
];

/* =================== COOKING (campfires & hearths) =================== */
const RECIPES_COOK = [
  { out: "seared_venison", mats: { raw_venison: 1 }, skillReq: 0 },
  { out: "hunters_skewer", mats: { rabbit_meat: 2 }, skillReq: 0 },
  { out: "marsh_stew",     mats: { mireweed: 1, dried_meat: 1, glowcap: 1 }, skillReq: 0 },
  { out: "dried_meat",     mats: { raw_venison: 1, wolfsbane: 0 }, skillReq: 0, note: "smoke" },
  { out: "grilled_catch",  mats: { river_perch: 1 }, skillReq: 0 },
  { out: "grilled_catch",  mats: { frost_char: 1 }, skillReq: 0 },
  { out: "grilled_catch",  mats: { silver_herring: 2 }, skillReq: 0 },
  { out: "eel_stew",       mats: { mire_eel: 1, mireweed: 1 }, skillReq: 0 },
];

/* what bites where: weighted fish tables by biome (B.* ids) */
const FISH_TABLES = {
  0: [{ w: 6, id: "river_perch" }, { w: 1, id: "mire_eel" }],
  1: [{ w: 6, id: "river_perch" }],
  2: [{ w: 6, id: "mire_eel" }, { w: 1, id: "river_perch" }],
  3: [{ w: 6, id: "frost_char" }],
  4: [{ w: 1, id: "river_perch" }],
  5: [{ w: 5, id: "silver_herring" }, { w: 2, id: "tide_grouper" }, { w: 1, id: "salt_cod" }],
};

/* =================== WEAPON HONING (forge) ===================
   Per-tier costs; +8% weapon damage per tier, max +3.        */
const HONE_TIERS = [
  { gold: 60,  mats: { iron_ore: 2 } },
  { gold: 180, mats: { steel_ingot: 2 } },
  { gold: 420, mats: { silver_dust: 1, ember_residue: 1 } },
];

/* =================== ENCHANTING (Lampwright altars) ===========
   Embers power the working; materials shape it. Potency scales
   with the Enchanting skill and its perks. Slots: 'weapon'
   applies to weapons/bows/staves, 'armor' to armor/shields.   */
const ENCHANTS = {
  flamebrand: {
    name: "Flamebrand", slot: "weapon", edmg: { fire: 7 },
    mats: { ember_residue: 2 }, embers: 280,
    desc: "The edge remembers the forge and holds a grudge.",
  },
  frostbrand: {
    name: "Frostbrand", slot: "weapon", edmg: { frost: 7 },
    mats: { frost_crystal: 1, frostmoss: 2 }, embers: 280,
    desc: "A sliver of the White Pass quiet, set in steel.",
  },
  stormbrand: {
    name: "Stormbrand", slot: "weapon", edmg: { shock: 7 },
    mats: { silver_dust: 2 }, embers: 320,
    desc: "It gossips with the sky, the way Stormcaller taught.",
  },
  venombrand: {
    name: "Venombrand", slot: "weapon", edmg: { poison: 6 },
    mats: { mireweed: 3, ghost_fern: 1 }, embers: 260,
    desc: "The Mire's smallest ambassador, given a blade for a desk.",
  },
  hungering: {
    name: "Hungering", slot: "weapon", leech: 0.1,
    mats: { tide_pearl: 2 }, embers: 420,
    desc: "What it takes from others it gives to the hand that holds it. The Tidelost knew this working well — too well.",
  },
  grave_oath: {
    name: "Grave-Oath", slot: "weapon", bonusVs: "undead",
    mats: { silver_dust: 3, old_bone: 2 }, embers: 300,
    desc: "Moonlight, sworn against the restless. The dead find it more than impolite.",
  },
  warding: {
    name: "Warding", slot: "armor", edef: { fire: 12, frost: 12, shock: 12, poison: 12 },
    mats: { ghost_fern: 2, tide_pearl: 1 }, embers: 320,
    desc: "A lattice of lamplight under the surface, turning all four tempers aside.",
  },
  stonehide: {
    name: "Stonehide", slot: "armor", armor: 8,
    mats: { troll_fat: 2, iron_ore: 2 }, embers: 260,
    desc: "The mountain's opinion of blades, made portable.",
  },
  emberheart: {
    name: "Emberheart", slot: "armor", maxHp: 22,
    mats: { emberbloom: 2, ember_residue: 1 }, embers: 360,
    desc: "A coal sewn over the breastbone. The blood remembers being warm.",
  },
  deepcurrent: {
    name: "Deepcurrent", slot: "armor", maxMag: 26,
    mats: { tide_pearl: 2, glowcap: 2 }, embers: 360,
    desc: "The mind runs deeper, the way water under ice runs deeper.",
  },
  swiftblood: {
    name: "Swiftblood", slot: "armor", stamRegen: 5,
    mats: { marrowroot: 3, wolf_pelt: 1 }, embers: 300,
    desc: "Wolf-lessons, written into the weave: the second wind arrives first.",
  },
};
for (const id in ENCHANTS) ENCHANTS[id].id = id;

/* =================== ALCHEMY RECIPES =================== */
const RECIPES_ALCH = [
  { out: "small_hp_potion", mats: { marrowroot: 1, glowcap: 1 }, skillReq: 0 },
  { out: "stam_potion",     mats: { marrowroot: 1, mireweed: 1 }, skillReq: 0 },
  { out: "mag_potion",      mats: { glowcap: 1, ghost_fern: 1 }, skillReq: 5 },
  { out: "antidote",        mats: { mireweed: 2, glowcap: 1 }, skillReq: 5 },
  { out: "warming_salve",   mats: { troll_fat: 1, emberbloom: 1 }, skillReq: 10 },
  { out: "big_hp_potion",   mats: { marrowroot: 2, troll_fat: 1, glowcap: 1 }, skillReq: 20 },
  { out: "fire_bomb",       mats: { emberbloom: 1, troll_fat: 1 }, skillReq: 15 },
];

/* =================== LOOT TABLES =================== */
/* used by chests and enemy drops; entries: {w, id, n:[min,max]} or {w, gold:[min,max]} */
const LOOT = {
  chest_common: [
    { w: 5, gold: [10, 45] },
    { w: 3, id: "small_hp_potion", n: [1, 2] },
    { w: 2, id: "stam_potion", n: [1, 2] },
    { w: 2, id: "iron_ore", n: [1, 3] },
    { w: 2, id: "leather_strips", n: [1, 3] },
    { w: 1, id: "torch", n: [1, 1] },
    { w: 1, id: "bread", n: [1, 3] },
    { w: 1, id: "fire_bomb", n: [1, 2] },
  ],
  chest_fine: [
    { w: 4, gold: [40, 120] },
    { w: 2, id: "big_hp_potion", n: [1, 1] },
    { w: 2, id: "steel_ingot", n: [1, 2] },
    { w: 2, id: "ember_shard", n: [1, 1] },
    { w: 1, id: "mag_potion", n: [1, 2] },
    { w: 1, id: "silver_dust", n: [1, 2] },
    { w: 1, id: "composite_bow", n: [1, 1] },
    { w: 1, id: "steel_dirk", n: [1, 1] },
  ],
  chest_rare: [
    { w: 3, gold: [120, 300] },
    { w: 2, id: "ember_core", n: [1, 1] },
    { w: 2, id: "frost_crystal", n: [1, 2] },
    { w: 1, id: "ember_amulet", n: [1, 1] },
    { w: 1, id: "wolf_ring", n: [1, 1] },
    { w: 1, id: "warden_seal", n: [1, 1] },
    { w: 1, id: "occult_scepter", n: [1, 1] },
    { w: 1, id: "shade_garb", n: [1, 1] },
  ],
};
