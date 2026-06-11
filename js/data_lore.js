/* ============================================================
   CLAUDERIM — data_lore.js
   Readable books and the deep history of the Shattered March.
   ============================================================ */
"use strict";

const BOOKS = {

  ember_treatise: {
    title: "On the First Ember",
    author: "Lampwright-Superior Edda Vel, Third Kindling",
    text:
`Before there were marches to shatter, there was the cold. Not winter — winter is the cold's polite cousin — but the Deep Dark, which existed before light and resents it still.

Into this came the First Ember. No scripture agrees on its origin. The Ashpriests say it fell; the Lampwrights say it was struck, the way all honest fires are struck, by labor; the mountain clans say it was stolen, and that the theft is still being repaid.

What is agreed is this: the Ember burned, and where it burned the Dark drew back, and in the space between flame and shadow there was room — for grass, for wolves, for kingdoms, for us.

The Ember does not burn forever. It gutters, as all fires gutter, and must be tended. This is the whole of the Lampwright creed and the whole of our history: someone must carry the light, trim the wick, and feed the flame — usually with themselves.

When you meet an Emberborn, be kind. They are kindling that learned to walk.`,
  },

  shattered_march: {
    title: "A History of the Shattered March",
    author: "Scribe Onnel, of the burned library of Emberfall",
    text:
`The realm of Clauderim was once a single kingdom, the March of Ald, stretching from the Cinder Coast to the Frostpeaks. It was held — not ruled, the old texts insist, *held*, the way one holds a door against weather — by the line of Ald, kings who took their crown beside the First Ember and gave a year of their life to it with every coronation.

Maerodric was the thirty-first of the line, and by every account the best of them: scholar, swordsman, builder of the aqueducts of Duskmere. It is important to remember that he was good. The Dark does not enter through wickedness; wickedness is too small a door.

When the Ember began to gutter in his reign, Maerodric did what no king before him dared: he refused to feed it. He had loved and buried three queens and two sons, and he reasoned — and his reasoning, the survivors agree, was beautiful — that a fire which eats kings is not a hearth but a tyrant.

He sealed the Ember in the deep vault of his citadel, to ration its light like grain in famine.

Light, rationed, is darkness with a schedule.

The March shattered in a single generation. The roads forgot each other. The dead grew restless, having lost the light that told them which way was down. And Maerodric — who had locked himself in with his hoarded flame — grew pale, then strange, then quiet.

The Citadel of Hollows still stands at the heart of the realm. Its gates are locked from the inside.`,
  },

  wardens_book: {
    title: "The Four Wardens",
    author: "unsigned; found nailed to a waystone",
    text:
`When the King turned hoarder, four of his great servants took what they could carry of the old power and fled the Citadel. Each carried a Sigil — a word of the Old Tongue made solid — believing they were saving the language of light from a miser king.

KORVASH the Sentinel carried VAL, the Unmoved Word, to the barrows of the Heartlands, and stood guard over the honored dead until standing was all he remembered how to do.

VASK, the king's own wet-nurse, carried SUTH, the Keeping Word, into the Mire. She meant to keep it safe. The Mire taught her that keeping and devouring are the same word in its grammar.

HROLGAR, Marshal of the North, carried KYR, the Still Word, to the Frostpeaks. He spoke it once to halt an avalanche and liked the silence so much he has been making more of it ever since.

VELMORA, the court chaplain, carried THUR, the Answering Fire, to the Ashlands, where she preaches to the cinders. The cinders have begun preaching back.

Four words, four Wardens, four hundred years. They do not age. They do not yield. They are waiting, the waystone-prophets say, for someone with a stronger claim — and the only claim the Old Tongue honors is victory.`,
  },

  emberborn_book: {
    title: "Concerning the Emberborn",
    author: "Lampwright Serah, annotations in a younger hand",
    text:
`They wake at shrines, always at shrines, with ash on the tongue and no memory of arriving. The brand on the wrist is a spark in a circle: the mark the Ember puts on debts it intends to collect.

The Emberborn do not die as others die. Cut one down and the body unravels into sparks; the shrine breathes in; and the pilgrim wakes again at the last flame they knelt to, lighter by everything they carried in their soul's purse. (The embers they dropped remain where they fell, for a while. Grief is retrievable, if you are quick.)

Why does the Ember make them? My order has three theories and I will give you the true one: a guttering fire throws sparks. That is all they are — sparks thrown from a dying flame, landing in the cold grass of the world, refusing, briefly, magnificently, to go out.

Each spark carries the fire's last question: *should I burn again, or may I finally rest?*

The Emberborn walk until they answer it. Be kind to them. The answer is heavier than it looks, and one of them will have to carry it all the way down to the vault where the Pale King sits with his hoarded light, and decide — for the flame, for the Dark, for all of us — which silence comes next.`,
  },

  old_tongue_primer: {
    title: "A Primer of the Old Tongue",
    author: "compiled for the patient by Chaplain Velmora, before her departure",
    text:
`The Old Tongue is not spoken; it is *meant*. The mouth merely cooperates.

It has no word for "maybe." It has fourteen words for "stand." It is the language the Ember used when it first argued with the Dark, and every word of it still carries the heat of that argument.

A mortal throat can hold perhaps four words before it begins to char. Choose carefully.

VAL — Unmoved. The word a mountain thinks at an avalanche. Spoken well, it makes your footing an axiom and the world's a rumor; everything not-you is invited, forcefully, to leave.

SUTH — That-which-keeps. A wet word, a root word. It does not take life so much as it corrects an imbalance in who deserves it.

KYR — The stillness between heartbeats. The most dangerous word, because it is the most comfortable. Hrolgar has been inside one syllable of it for two hundred years.

THUR — Fire-that-answers. The Ember's own name for itself when it is angry. Do not say it indoors.

There is a fifth word, the texts insist, that the line of Ald kept for coronations: the word for "enough." No one living has heard it. The Pale King swallowed it, the story goes, and that is why nothing has been enough since.`,
  },

  bestiary: {
    title: "A Pilgrim's Bestiary",
    author: "Hunter Ralka of Emberfall, margins by many hands",
    text:
`WOLVES. Honest work. They circle left; step right. The big grey direwolves of the deep forest do not circle — they have skipped to the conclusion.

BANDITS. The March's surplus soldiery, gone feral. Watch the ones with shields; watch the quiet ones more. Their archers will not wait politely for you to finish.

THE HOLLOWED. The walking dead are not angry; that is the worst of it. They continue. Silver offends them. Take their heads or take your leave.

MIRE-THINGS. Everything in the fen is leeches in some arrangement or other. Carry antidote. The big horrors burn well, which is the Mire's one act of fairness.

FROST TROLLS. They knit shut. You must out-write their mending with fire or fury. Do not duel one at dusk; do not duel two ever.

WISPS AND WRAITHS. Grief with weather inside it. Blades pass half through; flame and silver speak their language. If you hear a bell underwater, leave the water.

ASH IMPS. Sparks with opinions. They die of frost like anyone's argument dies of evidence.

PALE KNIGHTS. The Citadel guard, still on duty, four hundred years past their last order. They fight like the textbook the rest of us only skimmed. Bow first. Then kill them, if you can.`,
  },

  duskmere_book: {
    title: "Duskmere, or: How to Live in a Swamp",
    author: "Elder Mosswick, for the village children",
    text:
`The fen was here first. Remember that and it will mostly let you alone.

Rules. Walk the plank-roads. Wax your boots and your patience. If the water goes quiet, the water is listening. Glowcaps mark the safe paths — the Mire grows its own lanterns, which tells you it wants visitors, which should worry you more than it does.

We catch eels, cut peat, and bury our dead twice — once for custom, once for certainty.

Of the Matron: she was a woman once, the king's own nurse, who came carrying a holy word and nowhere to put it. The fen offered. The fen always offers. Now she keeps her children below the chapel-water, and on still nights you can hear the Drowned Bell counting them.

Do not pity her loudly. Sound carries strangely on the water, and pity, to a mother, sounds very much like a child crying.`,
  },

  frosthollow_book: {
    title: "Songs of Frosthollow",
    author: "transcribed from chief Eirik's hall, with the boasting left in",
    text:
`We were the Marshal's people, the spear-hand of the March, and when the Marshal walked into the high snow with his hammer and his word of power, we did not follow. This is our shame and our survival; we keep both polished.

The song of the Last Charge: Hrolgar spoke the Still Word at the battle of the White Pass, and both armies stopped — mid-stride, mid-scream, spears hanging in the air like icicles — and in that stillness he walked between the ranks and wept, the song says, because it was the first quiet he had heard in forty years of war. Then he chose to keep it.

The armies stand there yet, the high shepherds swear, two thousand men frozen an arm's length from each other's throats, snow drifting up their spears. The Pass sings when the wind is right.

We hew our pines, brew our mead, and do not climb past the third cairn. The cold above the third cairn is not weather. It is a king's house, and we were not invited.`,
  },

  alchemy_primer: {
    title: "The Honest Mortar",
    author: "Maren of Emberfall, alchemist; second printing, fewer poisonings",
    text:
`Alchemy is cooking that fights back.

GLOWCAP drinks light and gives it kindly: base of every honest remedy. MARROWROOT is the body's own stubbornness, dug up — pair it with glowcap for the crimson draughts. MIREWEED is a small poison, and small poisons teach the blood to argue: hence the antidotes, hence the green draughts of vigor.

GHOST FERN, picked unseen, steadies the mind for the azure brews. WOLFSBANE I sell only to people I dislike. EMBERBLOOM holds an opinion of fire; TROLL FAT holds an opinion of everything — render the two together for salves and for the cinder-bombs the wall-guard pretends not to buy.

Brew at a proper bench. Brewing in a helmet over a campfire is not alchemy, it is soup with consequences.

And mind the first law of the mortar: the land grows a remedy within a mile of every ill it invents. The Mire makes mireweed; the ash makes emberbloom. The world is trying to apologize. Let it.`,
  },

  undermarch_book: {
    title: "What Holds the March Up",
    author: "fragments of a Lampwright survey, bound out of order",
    text:
`Ask a farmer what holds the March up and he will say: the ground. Ask a miner and she will go quiet, stand you a drink, and change the subject. Buy her a second drink and she will tell you about the Undermarch.

The realm is a roof. Beneath it runs a second country — drowned roads, root-halls, the cellars of cities that were old when Ald was young. The Great Sink east of the crossroads is its only honest door; the dishonest doors are everywhere, and open downward.

Our order kept way-lamps down there once. Not to light the road — there is no road — but because the deep dark is the Old Dark's cellar, and a lamp in a cellar is a sentence in an argument. The lamps went cold in the Shattering. The argument, presumably, was lost.

One more thing, found written on the survey's last page in a different hand:

He is still down there. The first one. The king who went down to argue. We heard him through the stone, on the long watches — not words, just warmth, pacing. Whatever you do at the bottom of the world, do it respectfully. You will be standing in the middle of the oldest conversation there is.`,
  },

  citadel_book: {
    title: "The Vault Beneath the Hollows",
    author: "final page of the Citadel chamberlain's ledger, recovered scorched",
    text:
`Day 11,309 of the Rationing.

His Majesty took the lamp-count again today. Four hundred lamps in the Citadel; he permits six lit. He says the Ember thanks him for his thrift. He has begun saying what the Ember thinks the way other men report the weather.

The court is thinner. I do not mean fewer — I mean *thinner*. Lysa the cupbearer stood against the window at dusk and I could read the heraldry of the far wall through her shoulders.

He is not cruel. I write this in case someone someday weighs him: he is not cruel, he never was. He sits in the vault with the Ember in his lap like a man holding the last bird of a vanished species, and he cannot feed it, because the only food it takes is the thing he has too much love and too little courage to give.

The word for what he hoards is not light. I have seen it through the vault door's seam.

The word for what he hoards is ending. A good one. Everyone's.

I am going down to knock. If the knocking stops`,
  },
};
for (const id in BOOKS) BOOKS[id].id = id;
