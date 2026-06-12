/* ============================================================
   CLAUDERIM — data_quests.js
   Quest definitions. Runtime state machine lives in quests.js.

   Objective kinds:
     talk    { npc }              — advanced by dialogue action
     kill    { enemy, count }     — any matching kill
     collect { item, count }      — checked against inventory
     reach   { poi }              — proximity to a POI id
     boss    { boss }             — specific boss slain
     sigils  { count }            — sigil key-items held
     flag    { flag }             — story flag set
   ============================================================ */
"use strict";

const QUESTS = {

  /* ================= MAIN QUEST ================= */
  mq_ember: {
    name: "The Guttering", type: "main",
    stages: [
      {
        journal: "I woke at a cold shrine, branded as Emberborn. A woman who calls herself Serah the Lampwright watched me rise. I should hear what she has to say.",
        objective: { kind: "talk", npc: "serah", hint: "Speak with Serah the Lampwright" },
      },
      {
        journal: "Serah says the First Ember is dying behind the locked gates of the Citadel of Hollows, hoarded by the Pale King. The gate answers only to the Old Tongue: I must claim the four Sigils held by the Wardens — Korvash in the Heartland barrows, Vask beneath the Mire, Hrolgar on the Frostpeaks, Velmora in the Ashlands. Their shrines will mark my map.",
        objective: { kind: "sigils", count: 4, hint: "Claim the four Sigils from the Wardens" },
      },
      {
        journal: "Four words burn on my tongue. The gates of the Citadel of Hollows will open to them now. The Pale King is waiting — he has been waiting four hundred years.",
        objective: { kind: "reach", poi: "citadel", hint: "Enter the Citadel of Hollows" },
      },
      {
        journal: "I stand within the Citadel. Somewhere below, in the deep vault, Maerodric sits with the hoarded Ember. One of us will decide what the light does next.",
        objective: { kind: "boss", boss: "boss_maerodric", hint: "Defeat Maerodric, the Pale King" },
      },
      {
        journal: "The Pale King is dead, and the First Ember lies bare before me, small as a sparrow's heart. It asks the question it has asked every spark it ever threw: burn again, or rest. The answer is mine to give, at the Ember's vault.",
        objective: { kind: "flag", flag: "ending_chosen", hint: "Approach the First Ember and choose" },
      },
    ],
    rewards: {},
  },

  /* ================= SIDE QUESTS ================= */

  sq_glowcaps: {
    name: "The Lampwright's Request", type: "side",
    stages: [
      {
        journal: "Serah's lantern is failing. She asked me to gather five glowcap mushrooms — they grow in dark woods and the fringes of the Mire — so she can render their light into oil.",
        objective: { kind: "collect", item: "glowcap", count: 5, hint: "Gather Glowcaps (need 5)" },
      },
      {
        journal: "I have the glowcaps. Serah will want them.",
        objective: { kind: "talk", npc: "serah", hint: "Bring the glowcaps to Serah" },
      },
    ],
    rewards: { flaskUp: 1, embers: 150 },
    rewardText: "Serah rendered the glowcap light into your Ember Flask. +1 flask charge.",
  },

  sq_steel: {
    name: "Steel for Emberfall", type: "side",
    stages: [
      {
        journal: "Bram the smith is down to nails and apologies. He'll pay for four lumps of iron ore — there are old workings and rockfaces in the hills, and bandits hoard it too.",
        objective: { kind: "collect", item: "iron_ore", count: 4, hint: "Collect Iron Ore (need 4)" },
      },
      {
        journal: "My pack clinks with ore. Bram is waiting at his forge.",
        objective: { kind: "talk", npc: "bram", hint: "Deliver the ore to Bram" },
      },
    ],
    rewards: { gold: 120, items: [["steel_sword", 1]] },
    rewardText: "Bram pressed a steel longsword into your hands, still warm from the forge.",
  },

  sq_wolves: {
    name: "Wolves at the Gate", type: "side",
    stages: [
      {
        journal: "Ralka, Emberfall's huntress, has a bounty: the wolf packs grow bold and the wall-guard grows thin. Eight wolves, any grey hide will do.",
        objective: { kind: "kill", enemy: "wolf", count: 8, hint: "Slay wolves (0/8)" },
      },
      {
        journal: "Eight wolves lie still. Ralka pays on proof, and the proof is on my blade.",
        objective: { kind: "talk", npc: "ralka", hint: "Return to Ralka for the bounty" },
      },
    ],
    rewards: { gold: 150, items: [["composite_bow", 1]] },
    rewardText: "Ralka paid the bounty and threw in her spare composite bow. 'Earn it,' she said.",
  },

  sq_crypt: {
    name: "Whispers Below", type: "side",
    stages: [
      {
        journal: "Tobbe the innkeeper hears scratching under his cellar floor — the old crypt beneath Emberfall has woken. He gave me the key and a look that said 'please'. Thin the hollowed dead below the inn.",
        objective: { kind: "kill", enemy: "hollow_thrall", count: 6, hint: "Destroy hollow thralls in the crypt (0/6)" },
      },
      {
        journal: "The crypt is quiet again, or at least quieter. Tobbe owes me a drink and a debt.",
        objective: { kind: "talk", npc: "tobbe", hint: "Tell Tobbe the crypt is cleared" },
      },
    ],
    rewards: { gold: 100, items: [["silvered_blade", 1]] },
    rewardText: "Tobbe dug an heirloom from under the floorboards: a silvered blade. 'Grandda's. He'd want it working.'",
  },

  sq_delivery: {
    name: "A Cold Delivery", type: "side",
    stages: [
      {
        journal: "Fever stalks Frosthollow and their healer is out of remedies. Maren sealed a parcel of medicine and trusted me with the mountain road north. Sigrun is waiting.",
        objective: { kind: "talk", npc: "sigrun", hint: "Deliver the medicine to Sigrun in Frosthollow" },
      },
    ],
    rewards: { gold: 200, embers: 200 },
    rewardText: "Sigrun took the parcel with shaking hands. Frosthollow will see spring.",
  },

  sq_bell: {
    name: "The Drowned Bell", type: "side",
    stages: [
      {
        journal: "Elder Mosswick says the Drowned Bell has begun ringing on windless nights, and the village's twice-buried dead are sitting up to listen. Something in the sunken chapel is pulling the rope. Silence it.",
        objective: { kind: "boss", boss: "bell_wraith", hint: "Silence whatever rings the Drowned Bell" },
      },
      {
        journal: "The bell-warden is unmade and the clapper is in my pack. Mosswick can sleep — they all can.",
        objective: { kind: "talk", npc: "mosswick", hint: "Bring word (and the clapper) to Mosswick" },
      },
    ],
    rewards: { gold: 180, items: [["wraithwood_bow", 1]] },
    rewardText: "Mosswick buried the clapper a third time — 'for certainty' — and gave you a bow of pale wraithwood.",
  },

  sq_hunt: {
    name: "The Old Ways", type: "side",
    stages: [
      {
        journal: "Ralka says the wall-guard live on hard bread and harder opinions, and it shows in their aim. Bring her three cuts of fresh venison — the red deer run the Heartlands and the wood — and she'll show me the old hunter's fire-craft.",
        objective: { kind: "collect", item: "raw_venison", count: 3, hint: "Hunt red deer for venison (need 3)" },
      },
      {
        journal: "Three good cuts, field-dressed. Ralka will want them while they're fresh.",
        objective: { kind: "talk", npc: "ralka", hint: "Bring the venison to Ralka" },
      },
    ],
    rewards: { gold: 150, embers: 100, items: [["seared_venison", 2]] },
    rewardText: "Ralka seared the venison over coals and split it with you. 'Any campfire will do it. Now you know.'",
  },

  sq_masterpiece: {
    name: "The Twinned Temper", type: "side",
    stages: [
      {
        journal: "Bram has dreamed for years of a blade quenched twice — once in deep frost, once in living ember. He needs two frost crystals; the trolls of the high snow carry winter in their fat, and the crystals form where they sleep.",
        objective: { kind: "collect", item: "frost_crystal", count: 2, hint: "Gather Frost Crystals (need 2)" },
      },
      {
        journal: "The frost is bottled. Now the fire: two measures of ember residue, scraped from the burning things of the Ashlands.",
        objective: { kind: "collect", item: "ember_residue", count: 2, hint: "Gather Ember Residue (need 2)" },
      },
      {
        journal: "Frost in one hand, fire in the other. Bram's forge is waiting, and so is his life's work.",
        objective: { kind: "talk", npc: "bram", hint: "Bring both tempers to Bram" },
      },
    ],
    rewards: { items: [["twinned_temper", 1]], embers: 200 },
    rewardText: "Bram quenched the blade twice and wept once. 'The Twinned Temper. Take it — it was never going to hang on a wall.'",
  },

  sq_lamps: {
    name: "A Lamp for the Deep", type: "side",
    stages: [
      {
        journal: "Serah says the Lampwrights once kept way-lamps burning even in the Undermarch — the drowned-dark beneath the realm, where the Great Sink swallows the light east of the crossroads. Three lamps stand cold down there. Carry her fire to them.",
        objective: { kind: "flags", prefix: "waylamp_um_", count: 3, hint: "Light the way-lamps in the Undermarch (0/3)", targetPoi: "undermarch" },
      },
      {
        journal: "Three flames burn under the world where no flame has burned in living memory. Serah will feel them from her lamp-house, but she'll want to hear it said aloud.",
        objective: { kind: "talk", npc: "serah", hint: "Tell Serah the deep lamps burn" },
      },
    ],
    rewards: { items: [["ember_core", 1]], embers: 300 },
    rewardText: "Serah closed her eyes. 'Three lights in the Undermarch. The dark down there just got a little politer.'",
  },

  sq_echo: {
    name: "The First-Kindled", type: "side",
    stages: [
      {
        journal: "Caldus, over bitter tea: when the line of Ald began, the first king went down into the Undermarch to argue with the Dark in person — and never came up. Something of him still burns down there, at the deep root of the realm. Caldus believes it should be allowed to stop.",
        objective: { kind: "boss", boss: "boss_echo", hint: "Put the Echo of Ald to rest in the Undermarch" },
      },
      {
        journal: "The Echo is quiet. The first argument is over, four hundred kings too late. Caldus will want to know how it ended.",
        objective: { kind: "talk", npc: "caldus", hint: "Bring word to Caldus" },
      },
    ],
    rewards: { embers: 1200, gold: 400 },
    rewardText: "Caldus was silent a long time. 'So even the first fire wanted permission to rest. Remember that, when yours asks.'",
  },

  sq_pass: {
    name: "The Song of the Pass", type: "side",
    stages: [
      {
        journal: "Eirik finally sang the whole song: two thousand men stand frozen at the White Pass, an arm's length from each other's throats, held by Hrolgar's Still Word for four hundred years. Something walks their lines — the Hymnkeeper, the herald who never got to sound the charge. Eirik wants his ancestors dismissed from duty. Cut down the Hymnkeeper and take the war-horn it has carried all this time.",
        objective: { kind: "kill", enemy: "hymnkeeper", count: 1, hint: "Fell the Hymnkeeper at the White Pass (0/1)", targetPoi: "white_pass" },
      },
      {
        journal: "The Hymnkeeper is down and the war-horn is in my hands, cold as the day it was raised. There is a great cairn between the frozen lines. The charge was never sounded; the soldiers were never released. Sound it now.",
        objective: { kind: "flag", flag: "pass_at_rest", hint: "Sound the war-horn at the great cairn", targetPoi: "white_pass" },
      },
      {
        journal: "I blew the horn between the armies, and the wind through two thousand frozen spears sang one long note — and then, for the first time in four hundred years, the Pass was quiet. Eirik should hear how it ended.",
        objective: { kind: "talk", npc: "eirik", hint: "Tell Eirik the Pass is at rest" },
      },
    ],
    rewards: { items: [["stillsong", 1]], embers: 600 },
    rewardText: "Eirik wept without apology and gave you Stillsong — 'It was my forefather's. He'd want it carried by whoever ended his watch.'",
  },

  sq_arena: {
    name: "The Gauntlet of Sparks", type: "side",
    stages: [
      {
        journal: "Brann the Pitmaster keeps a fighting pit south of the crossroads, and pays in embers for entertainment. Light the brazier, hold the sand, and survive five waves of whatever he lets in.",
        objective: { kind: "flag", flag: "gauntlet_w5", hint: "Survive five waves in the Gauntlet", targetPoi: "gauntlet" },
      },
      {
        journal: "Five waves, and the sand is mine. Brann owes me a champion's due.",
        objective: { kind: "talk", npc: "brann", hint: "Claim your prize from Brann" },
      },
    ],
    rewards: { items: [["champions_ring", 1]], gold: 300 },
    rewardText: "Brann slid the Spark-Champion's Ring across the rail. 'Forge-slag of a hundred broken blades. Wear what didn't survive you.'",
  },

  sq_tide: {
    name: "The Tidelost Crew", type: "side",
    stages: [
      {
        journal: "Quartermaster Senn's drowned crew still stand their watch off the Tidelost Strand, walking ashore at low tide with their orders unfinished. She asked me to relieve the watch — six of the Tidelost, put down kindly.",
        objective: { kind: "kill", enemy: "tidelost_drowned", count: 6, hint: "Relieve the Tidelost watch (0/6)", targetPoi: "strand" },
      },
      {
        journal: "The crew is dismissed. Their captain is not — Veyra holds the wreck of the GLAD PENNY, keeping a four-hundred-fathom watch nobody ordered her to keep. Tell her the ledger's balanced. With steel, most likely.",
        objective: { kind: "kill", enemy: "captain_veyra", count: 1, hint: "Stand down Captain Veyra at the wreck (0/1)", targetPoi: "strand" },
      },
      {
        journal: "The Captain went down a second time — easier than the first, I'd swear it. Senn will want to know the watch is over.",
        objective: { kind: "talk", npc: "senn", hint: "Tell Senn the watch is relieved" },
      },
    ],
    rewards: { gold: 350, embers: 400 },
    completeFlag: "tide_at_rest",
    rewardText: "Senn paid out the crew's last wages — to you, the only one left on the books.",
  },

  sq_pearls: {
    name: "Salt and Silver", type: "side",
    stages: [
      {
        journal: "Senn wants four tideglass pearls from the surf line — passage money, she says, to somewhere the water doesn't know her name. The sea makes pearls of whatever it regrets, and this coast is rich with regret.",
        objective: { kind: "collect", item: "tide_pearl", count: 4, hint: "Gather Tideglass Pearls (need 4)", targetPoi: "strand" },
      },
      {
        journal: "Four pearls, cold as the deep they came from. Senn is waiting above the tide line.",
        objective: { kind: "talk", npc: "senn", hint: "Bring the pearls to Senn" },
      },
    ],
    rewards: { gold: 220, items: [["tide_pearl", 3]], embers: 200 },
    rewardText: "Senn kept four pearls for passage and pressed the rest of her pouch on you — 'Work an altar with them. Something that floats.'",
  },

  sq_blooms: {
    name: "Ash and Blossom", type: "side",
    stages: [
      {
        journal: "Caldus the Unlit, the hermit of the watchtower, wants three emberblooms from the Ashlands. He says he is going to teach a flower to argue with the dark. Hermits.",
        objective: { kind: "collect", item: "emberbloom", count: 3, hint: "Gather Emberblooms (need 3)" },
      },
      {
        journal: "Three emberblooms, still warm. Caldus awaits in his tower.",
        objective: { kind: "talk", npc: "caldus", hint: "Bring the emberblooms to Caldus" },
      },
    ],
    rewards: { items: [["occult_scepter", 1]], embers: 250 },
    rewardText: "Caldus pressed his old scepter on you. 'It argues better than flowers. Mind its moods.'",
  },
};
for (const id in QUESTS) QUESTS[id].id = id;
