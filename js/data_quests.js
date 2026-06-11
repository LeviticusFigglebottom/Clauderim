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
