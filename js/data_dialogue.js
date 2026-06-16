/* ============================================================
   CLAUDERIM — data_dialogue.js
   NPC definitions and dialogue trees.

   Node: { text: string | fn(player)->string,
           choices: [{ text, next, cond?, action?, cls? }] }
   entry: ordered [{ cond, node }] — first passing condition wins.
   Helper shorthands used in actions:
     QS = QuestSys (quests.js), UI (ui.js), G (state.js)
   ============================================================ */
"use strict";

const NPC_DEFS = {
  serah: {
    name: "Serah the Lampwright", town: "emberfall", role: "guide",
    look: { body: "#7a5c30", trim: "#e8cf9a", hair: "#d8d0c0" },
    shop: { stock: ["torch", "small_hp_potion", "ember_shard"], spells: ["frost_spike", "spark_lash", "venom_bolt", "lesser_heal", "cleanse", "stoneskin", "ward", "lantern_orb"] },
    bark: ["The lamps are low tonight.", "Kneel to every shrine you pass.", "The light looks after its own."],
  },
  bram: {
    name: "Bram the Smith", town: "emberfall", role: "smith",
    look: { body: "#5a4633", trim: "#8a6a3a", hair: "#3a3026" },
    shop: { stock: ["iron_sword", "iron_axe", "iron_mace", "iron_spear", "march_falchion", "iron_helm", "iron_cuirass", "iron_greaves", "iron_kite", "wooden_shield", "iron_ore", "leather_strips", "steel_ingot"] },
    bark: ["Mind the sparks.", "Good steel argues back.", "Ore\u2019s scarce. Bring me ore."],
  },
  maren: {
    name: "Maren the Alchemist", town: "emberfall", role: "alchemist",
    look: { body: "#3e5247", trim: "#9ad6a0", hair: "#6a4a30" },
    shop: { stock: ["small_hp_potion", "big_hp_potion", "stam_potion", "mag_potion", "antidote", "warming_salve", "glowcap", "marrowroot", "mireweed", "fire_bomb"] },
    bark: "Don't touch the blue ones.",
  },
  tobbe: {
    name: "Tobbe the Innkeeper", town: "emberfall", role: "innkeeper",
    look: { body: "#6a4a3a", trim: "#c8a878", hair: "#8a7050" },
    shop: { stock: ["bread", "dried_meat", "honey_mead"] },
    bark: ["Warm hearth, cold mead, thick walls.", "Mind the floorboard. It screams.", "No brawling. The chairs are older than you."],
  },
  ralka: {
    name: "Ralka the Huntress", town: "emberfall", role: "hunter",
    look: { body: "#4a5238", trim: "#a8b888", hair: "#2c2620" },
    shop: { stock: ["hunting_bow", "boar_spear", "leather_cap", "leather_jack", "leather_boots", "dried_meat", "wolf_pelt"] },
    bark: "Wind's from the barrows. Bad hunting.",
  },
  mosswick: {
    name: "Elder Mosswick", town: "duskmere", role: "elder",
    look: { body: "#44503c", trim: "#7d9460", hair: "#c8c8c0" },
    bark: "Walk the planks, stranger.",
  },
  petra: {
    name: "Petra the Fisher", town: "duskmere", role: "merchant",
    look: { body: "#3c4a50", trim: "#88a8b0", hair: "#5a4a3a" },
    shop: { stock: ["antidote", "mireweed", "glowcap", "dried_meat", "steel_dirk", "fen_cleaver", "mirewalker_cowl", "mirewalker_coat", "mirewalker_waders", "torch", "fishing_rod"] },
    bark: "Eels are biting. Bite back.",
  },
  eirik: {
    name: "Chief Eirik", town: "frosthollow", role: "chief",
    look: { body: "#5a6470", trim: "#c8d8e0", hair: "#b89860" },
    bark: "Don't climb past the third cairn.",
  },
  sigrun: {
    name: "Sigrun the Healer", town: "frosthollow", role: "healer",
    look: { body: "#705a5a", trim: "#e0c8c8", hair: "#e8e0d0" },
    shop: { stock: ["small_hp_potion", "big_hp_potion", "warming_salve", "frostmoss", "troll_fat", "honey_mead", "rimebrand", "frostplate_helm"] },
    bark: "Keep your blood moving, southerner.",
  },
  senn: {
    name: "Quartermaster Senn", town: "strand", role: "castaway",
    look: { body: "#4a5a60", trim: "#c9a86a", hair: "#3a302a" },
    shop: { stock: ["salt_cod", "antidote", "torch", "tide_pearl", "tide_harpoon", "hunting_bow", "leather_strips", "fishing_rod"] },
    bark: ["Keep above the tide line after dark.", "The PENNY was a good ship. Is. Was.", "The sea returns everything but apologies."],
  },
  brann: {
    name: "Brann the Pitmaster", town: "gauntlet", role: "pitmaster",
    look: { body: "#5d4632", trim: "#c4502a", hair: "#2c2620" },
    bark: ["Blood warms faster than mead.", "The sand drinks first. Pit rules.", "Give the ravens a show."],
  },
  caldus: {
    name: "Caldus the Unlit", town: "watchtower", role: "hermit",
    look: { body: "#3a3a44", trim: "#8888a8", hair: "#909090" },
    shop: { spells: ["fireball", "glacial_burst", "soul_lance", "greater_heal", "ember_sprite", "conjure_shade"] },
    bark: "...",
  },
};
for (const id in NPC_DEFS) NPC_DEFS[id].id = id;

/* ------------------------------------------------------------ */

const DIALOGUES = {

  /* ============ SERAH — main quest spine ============ */
  serah: {
    entry: [
      { cond: p => G.flags.ending_chosen && QS.stage("mq_ember") === 999 && !G.flags.serah_post, node: "post_end" },
      { cond: p => QS.stage("mq_ember") === 0, node: "mq_intro" },
      { cond: p => QS.stage("sq_glowcaps") === 1, node: "glowcaps_done" },
      { cond: p => QS.stage("sq_lamps") === 1, node: "lamps_done" },
      { cond: p => QS.stage("mq_ember") === 4, node: "pre_end" },
      { cond: p => QS.sigilCount() >= 4 && QS.stage("mq_ember") === 2, node: "all_sigils" },
      { cond: () => true, node: "hub" },
    ],
    nodes: {
      mq_intro: {
        text: "So. The shrine breathes out one more spark. Slowly, Emberborn — the first hour is the worst, and the rest are no feast either. I am Serah, last Lampwright of this March, and I have been waiting at this flame for someone exactly as unlucky as you.",
        choices: [
          { text: "What am I? What is this brand?", next: "mq_brand" },
          { text: "Waiting for me? Why?", next: "mq_why" },
        ],
      },
      mq_brand: {
        text: "A debt-mark. The First Ember is dying, and a dying fire throws sparks — you are one. You will not stay dead; the shrines will breathe you back, lighter each time by whatever embers you carried. Spend them well, and kneel to every shrine you pass.",
        choices: [{ text: "Why was I made? (continue)", next: "mq_why" }],
      },
      mq_why: {
        text: "Because the Ember has one question left and no throat to ask it with. It lies hoarded in the Citadel of Hollows, behind gates the Pale King sealed with the Old Tongue. Four Wardens fled that court four hundred years ago, each carrying a Sigil — a word of power. Claim all four and the gates will know you for a king's better.",
        choices: [
          { text: "Where do I find the Wardens?", next: "mq_where" },
        ],
      },
      mq_where: {
        text: "Korvash stands his barrow in the eastern Heartlands. Vask waits below the Mire, south past Duskmere. Hrolgar keeps the high snow north of Frosthollow. Velmora preaches to the cinders in the western Ashlands. I have marked your map. Go armed, go rested, and go knowing they were heroes once. It will not help, but they deserve it.",
        choices: [
          { text: "I'll begin. (Start: The Guttering)", next: "hub_first", action: () => { QS.advance("mq_ember"); } },
        ],
      },
      hub_first: {
        text: "One more thing — my lantern is nearly dry, and a Lampwright without light is just a woman with opinions. If you find glowcaps on your road, I can render their shine into that flask of yours.",
        choices: [
          { text: "I'll keep an eye out. (Quest: The Lampwright's Request)", next: null, action: () => QS.start("sq_glowcaps") },
          { text: "No time for mushrooms.", next: null },
        ],
      },
      all_sigils: {
        text: "Four words. I can feel them from here, like standing too near a forge. The Citadel of Hollows will open for you now — it is the dark keep at the heart of the March. Emberborn... when you reach the vault, the Ember will ask its question. Whatever you answer, answer it for more than yourself.",
        choices: [{ text: "I understand.", next: null }],
      },
      pre_end: {
        text: "The King is dead, then. I felt the lamps gutter at noon, all of them at once, like the world blinking. Only the question is left now. Go and answer it. And — thank you. Whichever silence you choose, thank you.",
        choices: [{ text: "Goodbye, Serah.", next: null }],
      },
      post_end: {
        text: "*Serah studies you the way one studies a lamp that should have gone out and didn't.* So. You answered, and the world is still here, and so are you — which no scripture of my order ever predicted, by the way. Walk it. Finish what's unfinished. And when the question starts asking itself again — and it will, it always does — any shrine knows the way down to the next cycle.",
        choices: [{ text: "I'll keep walking.", next: "hub", action: () => { G.flags.serah_post = true; } }],
      },
      glowcaps_done: {
        text: "Glowcaps! And barely bruised. Watch — a little oil, a little patience... there. Your flask drinks deeper now. The light looks after those who carry it.",
        choices: [{ text: "(Receive flask upgrade)", next: "hub", action: () => QS.complete("sq_glowcaps") }],
      },
      hub: {
        text: "The lamps hold, Emberborn. What do you need of me?",
        choices: [
          { text: "Trade. (Spells & supplies)", next: null, action: () => UI.openShop("serah") },
          { text: "Tell me of the Wardens again.", next: "mq_where_repeat" },
          { text: "Is there other work for the light?", next: "lamps_ask", cond: () => QS.stage("sq_lamps") === -1 && QS.stage("mq_ember") >= 1 },
          { text: "What is this place?", next: "lore_town" },
          { text: "Nothing. Keep your light.", next: null },
        ],
      },
      lamps_ask: {
        text: "There is, if your legs are braver than your sense. My order kept way-lamps in the Undermarch once — the drowned country under the realm. The Great Sink swallows the road east of the crossroads; that's the door. Three lamps stand cold down there. Carry my fire to them, and the dark beneath every floor in the March gets a little politer.",
        choices: [
          { text: "I'll carry it down. (Quest: A Lamp for the Deep)", next: null, action: () => { QS.start("sq_lamps"); World.revealPoi("undermarch"); } },
          { text: "Under the world? No.", next: null },
        ],
      },
      lamps_done: {
        text: "I felt them at dusk — three new stars under my feet. Four hundred years that dark went unanswered, and you answered it with my own fire. Here. The order would want you to have this; I want you to have this; for once everyone agrees.",
        choices: [{ text: "(Receive reward)", next: "hub", action: () => QS.complete("sq_lamps") }],
      },
      mq_where_repeat: {
        text: "Korvash — barrows, east Heartlands. Vask — under the Mire, south past Duskmere. Hrolgar — the Frostpeaks, north past Frosthollow. Velmora — the western Ashlands. Their shrines are marked on your map. Rest before each. They will not chase you far from their charges, but they will not tire, either.",
        choices: [{ text: "Thank you.", next: "hub" }],
      },
      lore_town: {
        text: "Emberfall — last walled town of the March. Bram keeps the forge, Maren the stillroom, Tobbe the inn, Ralka the walls. We are a small fire in a large night, and we are very careful with our fuel.",
        choices: [{ text: "Back.", next: "hub" }],
      },
    },
  },

  /* ============ BRAM ============ */
  bram: {
    entry: [
      { cond: p => QS.stage("sq_steel") === 1, node: "steel_done" },
      { cond: p => QS.stage("sq_masterpiece") === 2, node: "master_done" },
      { cond: () => true, node: "hub" },
    ],
    nodes: {
      hub: {
        text: "Forge is hot, hammer's willing. Need work done, or just warming your hands?",
        choices: [
          { text: "Show me your wares.", next: null, action: () => UI.openShop("bram") },
          { text: "Let me use the forge.", next: null, action: () => UI.openCraft("smith") },
          { text: "Any work for me?", next: "steel_ask", cond: () => QS.stage("sq_steel") === -1 },
          { text: "You look like a man with an unfinished thought.", next: "master_ask", cond: () => QS.stage("sq_masterpiece") === -1 && QS.stage("sq_steel") === 999 },
          { text: "Just warming my hands.", next: null },
        ],
      },
      master_ask: {
        text: "...Aye. Twenty years I've dreamed one blade: quenched twice, once in deep frost, once in living ember. Two tempers in one steel, arguing forever, never settling — that's what an edge IS, friend. I need two frost crystals from where the trolls sleep, and two measures of ember residue from the burning dead out west. I'm too old for either errand and too proud to say so twice.",
        choices: [
          { text: "Frost and fire. I'll fetch both. (Quest: The Twinned Temper)", next: null, action: () => QS.start("sq_masterpiece") },
          { text: "Dreams are cheap. Steel isn't.", next: null },
        ],
      },
      master_done: {
        text: "Both tempers... both! Stand back — no, further— *The forge roars twice, once white, once blue, and Bram lifts a blade that hums two notes at once.* Forty years of nails and horseshoes for this one hour. The Twinned Temper. It was never going to hang on a wall.",
        choices: [{ text: "(Receive the Twinned Temper)", next: "hub", action: () => QS.complete("sq_masterpiece") }],
      },
      steel_ask: {
        text: "Aye, as it happens. I'm down to nails and apologies — the ore wagons stopped coming when the roads went feral. Four good lumps of iron ore and I'll pay coin and better. There's old workings in the hills, and the bandits squat on a seam east of here.",
        choices: [
          { text: "I'll fetch your ore. (Quest: Steel for Emberfall)", next: null, action: () => QS.start("sq_steel") },
          { text: "Not my trade.", next: null },
        ],
      },
      steel_done: {
        text: "That's the music — good ore, heavy with intent. Give me a breath... there. Steel, and a blade of it. Emberfall pattern, like my master made, and his made, back when the March was a march and not a memory.",
        choices: [{ text: "(Receive reward)", next: "hub", action: () => QS.complete("sq_steel") }],
      },
    },
  },

  /* ============ MAREN ============ */
  maren: {
    entry: [{ cond: () => true, node: "hub" }],
    nodes: {
      hub: {
        text: "Mind the threshold, the floor's seen three explosions and holds a grudge. Buying, brewing, or bleeding?",
        choices: [
          { text: "Buying.", next: null, action: () => UI.openShop("maren") },
          { text: "Brewing. (Use the alchemy bench)", next: null, action: () => UI.openCraft("alchemy") },
          { text: "Heard of any work?", next: "delivery_ask", cond: () => QS.stage("sq_delivery") === -1 },
          { text: "You look troubled. (Ask after her neighbour)", next: "hollow_ask", cond: () => QS.stage("sq_hollowing") === -1 },
          { text: "About Edrin — I've decided.", next: "hollow_choice", cond: () => QS.stage("sq_hollowing") === 1 },
          { text: "Bleeding, but it can wait.", next: null },
        ],
      },
      hollow_ask: {
        text: "Edrin, two doors down. He's hollowing. You know the word? The Ember leaves a man slow — a finger of warmth at a time — until one morning the body keeps walking and nobody's home in it. His wife's been on my step since the thaw, begging a cure. There is no cure. There is a draught — ghost-fern, two stems, from the wet dark of the Mire — that blunts the cold and buys him lucid days. That is all medicine can offer here, and I'll not pretend otherwise. Will you fetch the fern?",
        choices: [
          { text: "I'll bring the ghost-fern. (Quest: The Hollowing)", next: "hollow_yes" },
          { text: "That's a healer's errand, not mine.", next: null },
        ],
      },
      hollow_yes: {
        text: "Two stems. It grows where the Mire keeps its older griefs — pale fronds, no shadow under them. Go gently. And… prepare yourself. Edrin asked me something, in a clear hour. I won't repeat it until you're back. It isn't a question I'll answer for him, or for you.",
        choices: [{ text: "(Set out for the Mire)", next: null, action: () => QS.start("sq_hollowing") }],
      },
      hollow_choice: {
        text: "The draught's ready; it'll dull the leaving for a while. But here's what Edrin asked, lucid as you or I: a clean end, now, by a steady hand, before he turns and his fingers forget which throats are his family's. His wife doesn't know he asked. So. Three doors out of this, and none of them open onto morning. Choose, and own it.",
        choices: [
          { text: "Give him the draught. Let him have the days that are left.", next: null,
            action: p => { p.gold += 220; p.addRep("march", 2); G.flags.hollow_prolonged = true;
              G.msg("You gave Edrin the draught. His wife pressed every coin in the house on you, weeping her thanks. He has weeks now — lucid, fading, his.", "good");
              QS.complete("sq_hollowing"); } },
          { text: "Grant the mercy he asked for.", next: null,
            action: p => { p.gainEmbers(280); p.addItem("big_hp_potion", 1); G.flags.hollow_mercy = true;
              G.msg("It was quick, and he thanked you with the last warmth in him. His wife will hate you, and Maren will not. You carry his keeping a while.", "ember");
              QS.complete("sq_hollowing"); } },
          { text: "This isn't mine to decide. (Walk away)", next: null,
            action: p => { p.gainEmbers(60); p.addRep("march", -1); G.flags.hollow_refused = true;
              G.msg("You left the choice on Maren's bench. Someone will make it, or the hollow will make it for them. You don't ask which.", "bad");
              QS.complete("sq_hollowing"); } },
        ],
      },
      delivery_ask: {
        text: "Work — yes, and urgent. Fever's gone through Frosthollow like a rumor, and Sigrun's shelves are bare. I've a parcel sealed and ready, but the mountain road eats couriers. You look... durable. Repeatedly durable, if the stories about your kind are true.",
        choices: [
          { text: "I'll carry it north. (Quest: A Cold Delivery)", next: "delivery_yes" },
          { text: "Find another courier.", next: null },
        ],
      },
      delivery_yes: {
        text: "Bless you. Here — wax-sealed against cold, damp, and curiosity. Sigrun keeps the healer's hut in Frosthollow, north past the pines, up where the air gets honest. Don't open it. The third ingredient is shy.",
        choices: [{ text: "(Take the parcel)", next: null, action: p => { QS.start("sq_delivery"); p.addItem("medicine_parcel", 1); } }],
      },
    },
  },

  /* ============ TOBBE ============ */
  tobbe: {
    entry: [
      { cond: p => QS.stage("sq_crypt") === 1, node: "crypt_done" },
      { cond: () => true, node: "hub" },
    ],
    nodes: {
      hub: {
        text: "Welcome to the Guttered Candle — warm hearth, cold mead, thick walls, in that order of importance. What'll it be?",
        choices: [
          { text: "Food and drink.", next: null, action: () => UI.openShop("tobbe") },
          { text: "A bed. (Rest until morning — 10 gold)", next: "rest", cond: p => p.gold >= 10 },
          { text: "Surely the crypt-clearer drinks and sleeps free here.", next: "rest_free", cls: "persuade",
            cond: p => p.canPersuade() && QS.stage("sq_crypt") === 999 },
          { text: "You look like a man with a problem.", next: "crypt_ask", cond: () => QS.stage("sq_crypt") === -1 },
          { text: "Nothing tonight.", next: null },
        ],
      },
      rest: {
        text: "Top of the stairs, second door. Mind the floorboard that screams — no, that's its name, we've given up fixing it.",
        choices: [{ text: "(Sleep until morning)", next: null, action: p => { p.gold -= 10; G.restAtInn(); } }],
      },
      rest_free: {
        text: "*Tobbe opens his mouth, closes it, and slides the key across the bar.* ...Aye. Aye, fair's fair — quiet floorboards cost less than quiet dead. House rate for you is nothing, forever. Just stop saying it so LOUD, you'll give every sellsword in the March ideas.",
        choices: [{ text: "(Sleep until morning — free)", next: null, action: p => { p.gainSkill("speech", 20); G.restAtInn(); } }],
      },
      crypt_ask: {
        text: "...You can hear it too, can't you. The scratching. Under the cellar. The old crypt runs beneath half the town, and lately the tenants have been — active. I've the key, the guard won't go, and Serah says you're harder to discourage than most. Permanently harder.",
        choices: [
          { text: "Give me the key. (Quest: Whispers Below)", next: "crypt_yes" },
          { text: "Hire an exorcist.", next: null },
        ],
      },
      crypt_yes: {
        text: "The stair's behind the inn, under the cellar hatch. Six of them at least, by the sound of the scratching — thin the dead down there and drinks are free for a season. Here. Key's cold, isn't it? It's always cold.",
        choices: [{ text: "(Take the crypt key)", next: null, action: p => { QS.start("sq_crypt"); p.addItem("crypt_key", 1); } }],
      },
      crypt_done: {
        text: "It's quiet. Gods, I'd forgotten what the quiet sounds like. Here — this was grandda's. He carried it in the Warden's day and it's done nothing under my floor but rust slower than it should. He'd want it working.",
        choices: [{ text: "(Receive reward)", next: "hub", action: () => QS.complete("sq_crypt") }],
      },
    },
  },

  /* ============ RALKA ============ */
  ralka: {
    entry: [
      { cond: p => QS.stage("sq_wolves") === 1, node: "wolves_done" },
      { cond: p => QS.stage("sq_hunt") === 1, node: "hunt_done" },
      { cond: () => true, node: "hub" },
    ],
    nodes: {
      hub: {
        text: "You walk too loud, southlander. Half the March heard you coming and the other half smelled you. What?",
        choices: [
          { text: "Trade.", next: null, action: () => UI.openShop("ralka") },
          { text: "Any bounties?", next: "wolves_ask", cond: () => QS.stage("sq_wolves") === -1 },
          { text: "Teach me the hunter's trade.", next: "hunt_ask", cond: () => QS.stage("sq_hunt") === -1 && QS.stage("sq_wolves") >= 1 },
          { text: "Teach me to walk quieter.", next: "sneak_tip" },
          { text: "Nothing.", next: null },
        ],
      },
      hunt_ask: {
        text: "The trade? The trade is patience and a clean shot, and knowing that a deer fed and fire-cooked is worth three eaten raw in the rain. Bring me three cuts of fresh venison — the red deer run the meadows and the Greywood. Spook them and they're gone; they hear like the dead owe them money.",
        choices: [
          { text: "Three cuts. Done. (Quest: The Old Ways)", next: null, action: () => QS.start("sq_hunt") },
          { text: "I buy my meat.", next: null },
        ],
      },
      hunt_done: {
        text: "Fresh, clean, field-dressed — there's hope for you. Now watch: coals, not flame; fat side down; turn it when it sings. Any campfire in the March will do this for you. Sit. Eat. The road keeps.",
        choices: [{ text: "(Receive reward)", next: "hub", action: () => QS.complete("sq_hunt") }],
      },
      wolves_ask: {
        text: "Wolves. The packs come down bolder every season — they've learned the wall has more gaps than guards. Eight grey hides and the town pays. They circle left, so you step right; the big ones don't circle, so you pray.",
        choices: [
          { text: "Eight wolves. Done. (Quest: Wolves at the Gate)", next: null, action: () => QS.start("sq_wolves") },
          { text: "I don't kill dogs.", next: null },
        ],
      },
      sneak_tip: {
        text: "Crouch low, move slow, stay dark, stay behind. A blade in the back is worth six in the front — that's not cowardice, that's arithmetic. And take the soft boots. Plate mail sneaking is a war drum apologizing.",
        choices: [{ text: "Noted.", next: "hub" }],
      },
      wolves_done: {
        text: "Eight, and clean kills by the look of your edge. The wall sleeps easier. Here's the coin — and take the spare bow. I made it for my brother. He won't mind. He's a barrow now, east of here.",
        choices: [
          { text: "Eight wolves at town rates? The guild charges per fang.", next: "wolves_haggle", cls: "persuade", cond: p => p.canPersuade() },
          { text: "(Receive reward)", next: "hub", action: () => QS.complete("sq_wolves") },
        ],
      },
      wolves_haggle: {
        text: "*Ralka stares at you the way she stares at weather.* ...There is no guild. There is no per-fang. But that was brazen enough to be worth watching. Sixty extra, and we never speak of the guild again.",
        choices: [{ text: "(Receive the bounty, plus sixty)", next: "hub",
          action: p => { QS.complete("sq_wolves"); p.gold += 60; p.gainSkill("speech", 20); G.msg("+60 gold, talked up", "good"); } }],
      },
    },
  },

  /* ============ MOSSWICK ============ */
  mosswick: {
    entry: [
      { cond: p => QS.stage("sq_bell") === 1, node: "bell_done" },
      { cond: () => true, node: "hub" },
    ],
    nodes: {
      hub: {
        text: "Plank-walker. You've the look of someone the Mire hasn't decided about yet. Sit. The fen hears better than it sees, so speak soft.",
        choices: [
          { text: "Tell me of the Mire.", next: "lore_mire" },
          { text: "Something troubles this village.", next: "bell_ask", cond: () => QS.stage("sq_bell") === -1 },
          { text: "Tell me of the Matron.", next: "lore_vask", cond: () => QS.stage("mq_ember") >= 1 },
          { text: "Stay dry, elder.", next: null },
        ],
      },
      lore_mire: {
        text: "The fen was here first; we are tolerated, not welcomed. Walk the planks. Wax your boots. If the water goes quiet, the water is listening. We bury our dead twice here — once for custom, once for certainty — and lately, certainty has been... underperforming.",
        choices: [{ text: "Go on.", next: "hub" }],
      },
      bell_ask: {
        text: "The Drowned Bell. The old chapel sank in my grandmother's day, bell and all, and a sunken bell should hold its tongue. It has begun to ring on windless nights — and our twice-buried sit up in their graves to listen. Something below pulls the rope. I am too old to swim and too wise to want to.",
        choices: [
          { text: "I'll silence it. (Quest: The Drowned Bell)", next: "bell_yes" },
          { text: "Let it ring.", next: null },
        ],
      },
      bell_yes: {
        text: "The chapel lies south of the village — follow the glowcaps, then follow the silence; the fen goes quiet around it the way a crowd quiets around a fight. Take antidote. Take silver if you have it. And if you hear singing under the bell — that is not the bell's business, nor yours.",
        choices: [{ text: "(Mark the sunken chapel)", next: null, action: () => { QS.start("sq_bell"); World.revealPoi("chapel"); } }],
      },
      lore_vask: {
        text: "You hunt the Matron. I won't stop you — but know her: she nursed the Pale King himself at her breast, and when the court fell she carried the Keeping Word here because a nurse keeps, it is all she knows. The fen heard the word and liked it. Now she keeps her children below the water. Some of them were ours. Strike true, spark-bearer. Mothers do not die of half measures.",
        choices: [{ text: "I'll remember.", next: "hub" }],
      },
      bell_done: {
        text: "The night the bell stopped, every dog in Duskmere slept till noon. You've the clapper? Give it here — we'll bury it a third time, for certainty, and this time certainty will hold. Take the pale bow. It was fished from the chapel before my time, and it has been waiting for hands that don't shake.",
        choices: [{ text: "(Receive reward)", next: "hub", action: () => QS.complete("sq_bell") }],
      },
    },
  },

  /* ============ PETRA ============ */
  petra: {
    entry: [{ cond: () => true, node: "hub" }],
    nodes: {
      hub: {
        text: "Fresh eel, waxed leathers, and remedies for everything the fen does to strangers. Mostly the leathers and remedies, in your case.",
        choices: [
          { text: "Show me.", next: null, action: () => UI.openShop("petra") },
          { text: "What do eels go for these days?", next: "smalltalk" },
          { text: "Another time.", next: null },
        ],
      },
      smalltalk: {
        text: "Depends on the eel. The honest ones, three marks. The ones with too many opinions about being caught, those we throw back. The fen has rules and the first rule is: don't keep what watches you back.",
        choices: [{ text: "Wise.", next: "hub" }],
      },
    },
  },

  /* ============ EIRIK ============ */
  eirik: {
    entry: [
      { cond: p => QS.stage("sq_pass") === 2, node: "pass_done" },
      { cond: () => true, node: "hub" },
    ],
    nodes: {
      hub: {
        text: "A southerner, above the snowline, on purpose. Sit by the fire, then — stupidity that determined deserves warming. I am Eirik. This hollow is mine to keep.",
        choices: [
          { text: "Tell me of the Frost-Tyrant.", next: "lore_hrolgar", cond: () => QS.stage("mq_ember") >= 1 },
          { text: "What should I know about the peaks?", next: "lore_peaks" },
          { text: "Sing me the whole song of White Pass.", next: "pass_ask", cond: () => QS.stage("sq_pass") === -1 },
          { text: "Stay warm, chief.", next: null },
        ],
      },
      pass_ask: {
        text: "*Eirik is quiet a long moment, then sets down his cup.* The verses we don't sing for guests: my forefathers stand in that snow. Two thousand men, ours and theirs, an arm's length apart, held mid-charge by the Tyrant's word — and the herald walks their lines still, the Hymnkeeper, horn raised, waiting four hundred years for permission to sound it. East of the keep road. If you've the steel... cut the herald down, take the horn, and blow the charge at the great cairn. Let them finish. Let them rest. Either way it ends.",
        choices: [
          { text: "I'll dismiss the armies. (Quest: The Song of the Pass)", next: null, action: () => { QS.start("sq_pass"); World.revealPoi("white_pass"); } },
          { text: "Some songs should stay unfinished.", next: null },
        ],
      },
      pass_done: {
        text: "*You tell him. The hall goes still; even the fire listens.* One note, and then quiet... A quiet that CHOSE to be quiet — not the Tyrant's, ours. *He pulls an old blade from beneath the high seat.* Stillsong. My forefather's. He stands at rest in that snow because of you; he'd want this carried by whoever ended his watch.",
        choices: [{ text: "(Receive Stillsong)", next: "hub", action: () => QS.complete("sq_pass") }],
      },
      lore_hrolgar: {
        text: "Hrolgar. My line carried his banners once — spear-hand of the March, the Marshal of the North. He spoke the Still Word at White Pass and stopped a battle like a held breath... then decided the whole world was improved by stopping. He keeps the high keep past the third cairn. Bring fire. Bring more fire than that. And if he offers you the quiet — and he will, he offers everyone the quiet — keep talking.",
        choices: [{ text: "I'll bring fire.", next: "hub" }],
      },
      lore_peaks: {
        text: "Cold first, trolls second, regret third. The trolls knit shut, so burn them as you go. Wear fur or wear frostplate, drink mead, keep moving. The cold above the third cairn is not weather — it is a king's house, and the door is always open, which is the worst thing about it.",
        choices: [{ text: "Understood.", next: "hub" }],
      },
    },
  },

  /* ============ SIGRUN ============ */
  sigrun: {
    entry: [
      { cond: p => QS.stage("sq_delivery") === 0 && p.hasItem("medicine_parcel", 1), node: "delivery_done" },
      { cond: () => true, node: "hub" },
    ],
    nodes: {
      hub: {
        text: "In, in — you're letting the winter audit my shelves. Sit. Drink something warm. Now: salves, draughts, or sympathy? The first two cost money.",
        choices: [
          { text: "Salves and draughts.", next: null, action: () => UI.openShop("sigrun") },
          { text: "How fares the village?", next: "smalltalk" },
          { text: "Just passing through.", next: null },
        ],
      },
      delivery_done: {
        text: "That seal — that's Maren's wax! Give it here, give it — oh, bless her crooked ladles, it's all here. Fever-bark, ember-salt, the shy ingredient. You've carried spring up a mountain, southerner. Frosthollow doesn't forget.",
        choices: [{ text: "(Hand over the parcel)", next: "hub", action: p => { p.removeItem("medicine_parcel", 1); QS.complete("sq_delivery"); } }],
      },
      smalltalk: {
        text: "Cold, fevered, and stubborn — the village, and also everyone in it. We'll outlast the winter. We always do. Outlasting is the entire local art form.",
        choices: [{ text: "Keep at it.", next: "hub" }],
      },
    },
  },

  /* ============ CALDUS ============ */
  brann: {
    entry: [
      { cond: p => QS.stage("sq_arena") === 1, node: "champion" },
      { cond: () => true, node: "hub" },
    ],
    nodes: {
      hub: {
        text: "Welcome to the Gauntlet, pilgrim. Rules are short: I light the brazier, the sand fills with teeth, and you stop being boring. Survivors get embers. Champions get remembered.",
        choices: [
          { text: "How does it work?", next: "rules" },
          { text: "Who are you?", next: "lore_brann" },
          { text: "Pay me double for wave five and I'll make it look good.", next: "persuade_purse", cls: "persuade",
            cond: p => p.canPersuade() && QS.stage("sq_arena") === -1 },
          { text: "Light it. (Quest: The Gauntlet of Sparks)", next: "start", cond: () => QS.stage("sq_arena") === -1 },
          { text: "Another time.", next: null },
        ],
      },
      rules: {
        text: "The brazier at the pit's heart starts a wave. Clear the sand, claim your embers, breathe, light it again. Each wave bites harder than the last. Die, and the shrine takes you home like always — embers in the sand stay in the sand. Five waves makes you a champion. Past five... past five I start betting against you.",
        choices: [{ text: "Understood.", next: "hub" }],
      },
      lore_brann: {
        text: "Frosthollow-born, Emberfall-banished, pit-raised. I fought in this sand twenty years before I bought it. Now I sell the only honest thing the March has left: a fight with rules.",
        choices: [{ text: "Fair enough.", next: "hub" }],
      },
      persuade_purse: {
        text: "*Brann squints, then barks a laugh.* You've got a pit-crier's tongue on you. Fine — double gold on the champion's purse, and you'd BETTER bleed entertainingly.",
        choices: [{ text: "Watch me. (Quest: The Gauntlet of Sparks — purse doubled)", next: null,
          action: p => { QS.start("sq_arena"); G.flags.gauntlet_double = true; p.gainSkill("speech", 25); } }],
      },
      start: {
        text: "Ha! Brazier's at the pit's heart — light it when your nerve's ready. And pilgrim: the crowd is two ravens and me, but give us a show anyway.",
        choices: [{ text: "(Begin)", next: null, action: () => QS.start("sq_arena") }],
      },
      champion: {
        text: "FIVE. *He spits into the brazier, which is how pit-folk applaud.* Twenty years I've watched that sand eat better-armored fools. A champion's due, as promised" + "—" + "and the pit's open to you whenever the road feels too polite.",
        choices: [{ text: "(Receive the champion's due)", next: "hub",
          action: p => { QS.complete("sq_arena"); if (G.flags.gauntlet_double) { p.gold += 300; G.msg("Brann doubles the purse, as persuaded. +300 gold", "good"); } } }],
      },
    },
  },

  senn: {
    entry: [
      { cond: p => QS.stage("sq_tide") === 2, node: "tide_done" },
      { cond: p => QS.stage("sq_pearls") === 1, node: "pearls_done" },
      { cond: () => true, node: "hub" },
    ],
    nodes: {
      hub: {
        text: "Quartermaster Senn, of the GLAD PENNY — the ship you can see the ribs of, there, where the sand keeps her. Trade if you like; I salvage more than I can eat. And keep above the tide line after dark, pilgrim. The watch below is... diligent.",
        choices: [
          { text: "Trade.", next: null, action: () => UI.openShop("senn") },
          { text: "What happened to your ship?", next: "lore_wreck" },
          { text: "The watch below?", next: "tide_ask", cond: () => QS.stage("sq_tide") === -1 },
          { text: "Need anything gathered?", next: "pearls_ask", cond: () => QS.stage("sq_pearls") === -1 && QS.stage("sq_tide") >= 1 },
          { text: "Mind the tide, Quartermaster.", next: null },
        ],
      },
      lore_wreck: {
        text: "Wreckers' lamps on the headland, a reef where the chart said channel, and the PENNY opened like a purse. I came ashore holding the ledger. Thirty-one others came ashore holding nothing... and then, three weeks later, they came ashore anyway. The sea doesn't keep what it drowns. Everyone knows that, and everyone is wrong about what it means.",
        choices: [{ text: "Go on.", next: "hub" }],
      },
      tide_ask: {
        text: "*She looks at the water a long time.* My crew. The Tidelost. They walk the strand at low tide, still on duty, because drowned captains keep command — and Veyra is down there with the whole watch-bill in her fist. They cannot dismiss themselves, pilgrim. Someone has to relieve the watch. Put the crew down kindly, and then... then the Captain. Tell her the ledger's balanced. She'll know my hand.",
        choices: [
          { text: "I'll relieve the watch. (Quest: The Tidelost Crew)", next: null, action: () => QS.start("sq_tide") },
          { text: "The sea's business is the sea's.", next: null },
        ],
      },
      tide_done: {
        text: "*You tell her how the Captain went down the second time — easier than the first, you'd swear it.* ...Aye. She held them at stations four hundred fathoms past the end of the world, because nobody ever told her to stand down. You did. *She pulls Undertow's empty scabbard from the salvage pile and gives you the gold meant for the crew's last wages.* Spend it on the living, hey?",
        choices: [{ text: "(Receive reward)", next: "hub", action: () => QS.complete("sq_tide") }],
      },
      pearls_ask: {
        text: "Tideglass pearls. The sea makes them of whatever it regrets, and after a wreck like ours the surf is rich with regret. The Lampwrights pay handsomely — they bind workings with them. Four good pearls and I can buy passage somewhere the water doesn't know my name.",
        choices: [
          { text: "Four pearls, then. (Quest: Salt and Silver)", next: null, action: () => QS.start("sq_pearls") },
          { text: "Harvest your own regrets.", next: null },
        ],
      },
      pearls_done: {
        text: "Four — and clean ones. That's passage, with enough left over for this: take the rest of my pearl-pouch and the salvage coin. If you're working altars with them, work one for me. Something that keeps a person above the water line.",
        choices: [{ text: "(Receive reward)", next: "hub", action: () => QS.complete("sq_pearls") }],
      },
    },
  },

  caldus: {
    entry: [
      { cond: p => QS.stage("sq_blooms") === 1, node: "blooms_done" },
      { cond: p => QS.stage("sq_echo") === 1, node: "echo_done" },
      { cond: () => true, node: "hub" },
    ],
    nodes: {
      hub: {
        text: "...Company. How novel. I am Caldus, called the Unlit, because I gave my flame away and the name stuck better than the reasons. You may browse my failures. Some of them are for sale.",
        choices: [
          { text: "Show me your spells.", next: null, action: () => UI.openShop("caldus") },
          { text: "Why 'the Unlit'?", next: "lore_caldus" },
          { text: "Do you need anything out here?", next: "blooms_ask", cond: () => QS.stage("sq_blooms") === -1 },
          { text: "What do you know of the Undermarch?", next: "echo_ask", cond: () => QS.stage("sq_echo") === -1 && QS.stage("sq_blooms") === 999 },
          { text: "Enjoy the solitude.", next: null },
        ],
      },
      echo_ask: {
        text: "More than is healthy. When the line of Ald began, the first king did not take a throne — he took a torch, and went down through the Great Sink to argue with the Dark in person. He never came up. Something of him still paces the deep root of the realm: not a ghost, an *echo* — a flame that has forgotten everything except the argument. It has been burning, alone, in the dark, for an age. I think it should be allowed to stop. Wouldn't you want to be?",
        choices: [
          { text: "I'll put the First-Kindled to rest. (Quest: The First-Kindled)", next: null, action: () => { QS.start("sq_echo"); World.revealPoi("undermarch"); } },
          { text: "Let old fires keep their grudges.", next: null },
        ],
      },
      echo_done: {
        text: "*Caldus listens to the whole telling without interrupting, which may be a first.* So even the first fire wanted permission to rest. It only needed someone strong enough to grant it. Remember that, pilgrim — when your own flame asks. Remember someone has to be strong enough.",
        choices: [{ text: "(Receive reward)", next: "hub", action: () => QS.complete("sq_echo") }],
      },
      lore_caldus: {
        text: "I was an Ashpriest. Velmora's best pupil, which is to say her most flammable. I left when the congregation began preaching to the cinders and the cinders began answering with demands. Fire that answers is scripture; fire that interrupts is a tyrant with better lighting.",
        choices: [{ text: "Hm.", next: "hub" }],
      },
      blooms_ask: {
        text: "Need? No. Want — three emberblooms, from the deep ash where my old congregation chants. I intend to teach a flower to argue with the dark. It will fail, of course. Everything I plant fails. But it fails a little further from the dark each season, and that is the entire history of civilization in a pot.",
        choices: [
          { text: "Three emberblooms. Fine. (Quest: Ash and Blossom)", next: null, action: () => QS.start("sq_blooms") },
          { text: "Argue with the dark yourself.", next: null },
        ],
      },
      blooms_done: {
        text: "Warm, rooted, and furious — perfect specimens. Here, the scepter. I pulled it from the Drowned Bell's parish in my adventuring days and we have disagreed ever since. It argues better than flowers. Mind its moods, and never apologize to it. It can smell apology.",
        choices: [{ text: "(Receive reward)", next: "hub", action: () => QS.complete("sq_blooms") }],
      },
    },
  },
};
