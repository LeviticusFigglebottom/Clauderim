/* ============================================================
   POCKET FRONTIER — data_moves.js
   The move library. Every move carries real mechanics and a
   Pokédex-style description shown when you hover it in battle.

   cat:  'physical' | 'special' | 'status'
   acc:  0-100, or true = never miss
   pp:   base power points
   prio: turn priority (default 0)
   Optional effect fields, resolved in battle.js:
     effect {status, chance}          inflict brn/psn/par/slp/frz/tox
     stat   {who:'self'|'foe', mods:{atk:-1,...}, chance}
     drain  fraction of damage healed
     recoil fraction of damage taken back
     flinch chance to flinch
     crit   'high' (boosted crit ratio)
     multi  [min,max] hits
     heal   fraction of max HP restored (status moves)
   ============================================================ */
"use strict";

const MOVES = {

  /* ---- Normal ---- */
  tackle:      { name: "Tackle", type: "normal", cat: "physical", power: 40, acc: 100, pp: 35, desc: "A full-body charge that slams into the target." },
  scratch:     { name: "Scratch", type: "normal", cat: "physical", power: 40, acc: 100, pp: 35, desc: "Hard, pointed claws rake the target." },
  quickattack: { name: "Quick Attack", type: "normal", cat: "physical", power: 40, acc: 100, pp: 30, prio: 1, desc: "So fast it almost always strikes first." },
  bodyslam:    { name: "Body Slam", type: "normal", cat: "physical", power: 85, acc: 100, pp: 15, effect: { status: "par", chance: 30 }, desc: "A heavy tackle that may leave the foe paralyzed." },
  takedown:    { name: "Take Down", type: "normal", cat: "physical", power: 90, acc: 85, pp: 20, recoil: 0.25, desc: "A reckless charge that also hurts the user." },
  doubleedge:  { name: "Double-Edge", type: "normal", cat: "physical", power: 120, acc: 100, pp: 15, recoil: 0.33, desc: "A life-risking tackle. It badly hurts the user too." },
  slam:        { name: "Slam", type: "normal", cat: "physical", power: 80, acc: 75, pp: 20, desc: "Strikes the foe with a long tail or vine." },
  growl:       { name: "Growl", type: "normal", cat: "status", acc: 100, pp: 40, stat: { who: "foe", mods: { atk: -1 } }, desc: "A cute cry that lowers the foe's Attack." },
  tailwhip:    { name: "Tail Whip", type: "normal", cat: "status", acc: 100, pp: 30, stat: { who: "foe", mods: { def: -1 } }, desc: "Wags its tail to lower the foe's Defense." },
  leer:        { name: "Leer", type: "normal", cat: "status", acc: 100, pp: 30, stat: { who: "foe", mods: { def: -1 } }, desc: "A sharp glare that lowers the foe's Defense." },
  screech:     { name: "Screech", type: "normal", cat: "status", acc: 85, pp: 40, stat: { who: "foe", mods: { def: -2 } }, desc: "A grating cry that harshly lowers Defense." },
  harden:      { name: "Harden", type: "normal", cat: "status", acc: true, pp: 30, stat: { who: "self", mods: { def: 1 } }, desc: "Stiffens the body to raise Defense." },
  defensecurl: { name: "Defense Curl", type: "normal", cat: "status", acc: true, pp: 40, stat: { who: "self", mods: { def: 1 } }, desc: "Curls up to raise Defense." },
  swordsdance: { name: "Swords Dance", type: "normal", cat: "status", acc: true, pp: 20, stat: { who: "self", mods: { atk: 2 } }, desc: "A frenzied dance that sharply raises Attack." },
  howl:        { name: "Howl", type: "normal", cat: "status", acc: true, pp: 40, stat: { who: "self", mods: { atk: 1 } }, desc: "Howls to raise its spirit and Attack." },
  agility:     { name: "Agility", type: "normal", cat: "status", acc: true, pp: 30, stat: { who: "self", mods: { spe: 2 } }, desc: "Relaxes the body to sharply raise Speed." },
  recover:     { name: "Recover", type: "normal", cat: "status", acc: true, pp: 10, heal: 0.5, desc: "Restores up to half the user's max HP." },

  /* ---- Fire ---- */
  ember:       { name: "Ember", type: "fire", cat: "special", power: 40, acc: 100, pp: 25, effect: { status: "brn", chance: 10 }, desc: "A small flame that may burn the foe." },
  flamethrower:{ name: "Flamethrower", type: "fire", cat: "special", power: 90, acc: 100, pp: 15, effect: { status: "brn", chance: 10 }, desc: "A searing blast that may leave a burn." },
  firefang:    { name: "Fire Fang", type: "fire", cat: "physical", power: 65, acc: 95, pp: 15, effect: { status: "brn", chance: 10 }, flinch: 10, desc: "Fiery fangs that may burn or make the foe flinch." },
  firespin:    { name: "Fire Spin", type: "fire", cat: "special", power: 35, acc: 85, pp: 15, effect: { status: "brn", chance: 8 }, desc: "Traps the foe in a vortex of flame." },
  willowisp:   { name: "Will-O-Wisp", type: "fire", cat: "status", acc: 85, pp: 15, effect: { status: "brn", chance: 100 }, desc: "Sinister flames that are sure to burn the foe." },

  /* ---- Water ---- */
  watergun:    { name: "Water Gun", type: "water", cat: "special", power: 40, acc: 100, pp: 25, desc: "Squirts water to strike the foe." },
  bubble:      { name: "Bubble", type: "water", cat: "special", power: 40, acc: 100, pp: 30, stat: { who: "foe", mods: { spe: -1 }, chance: 10 }, desc: "A spray of bubbles that may cut the foe's Speed." },
  aquajet:     { name: "Aqua Jet", type: "water", cat: "physical", power: 40, acc: 100, pp: 20, prio: 1, desc: "Lunges at the foe faster than the eye can see." },
  surf:        { name: "Surf", type: "water", cat: "special", power: 90, acc: 100, pp: 15, desc: "A towering wave crashes down on the foe." },
  withdraw:    { name: "Withdraw", type: "water", cat: "status", acc: true, pp: 40, stat: { who: "self", mods: { def: 1 } }, desc: "Pulls into a shell to raise Defense." },
  aquatail:    { name: "Aqua Tail", type: "water", cat: "physical", power: 90, acc: 90, pp: 10, desc: "Swings a tail like a vicious tide." },

  /* ---- Grass ---- */
  vinewhip:    { name: "Vine Whip", type: "grass", cat: "physical", power: 45, acc: 100, pp: 25, desc: "Whips the foe with slender, whip-like vines." },
  razorleaf:   { name: "Razor Leaf", type: "grass", cat: "physical", power: 55, acc: 95, pp: 25, crit: "high", desc: "Sharp-edged leaves. Cuts land critical hits often." },
  absorb:      { name: "Absorb", type: "grass", cat: "special", power: 20, acc: 100, pp: 25, drain: 0.5, desc: "Drains the foe, healing the user by half the damage." },
  megadrain:   { name: "Mega Drain", type: "grass", cat: "special", power: 40, acc: 100, pp: 15, drain: 0.5, desc: "A stronger drain that heals the user." },
  gigadrain:   { name: "Giga Drain", type: "grass", cat: "special", power: 75, acc: 100, pp: 10, drain: 0.5, desc: "A potent drain that restores much of the user's HP." },
  growth:      { name: "Growth", type: "grass", cat: "status", acc: true, pp: 20, stat: { who: "self", mods: { atk: 1, spa: 1 } }, desc: "Forces the body to grow, raising Attack and Sp. Atk." },
  sleeppowder: { name: "Sleep Powder", type: "grass", cat: "status", acc: 75, pp: 15, effect: { status: "slp", chance: 100 }, desc: "Scatters a spore that puts the foe to sleep." },
  seedbomb:    { name: "Seed Bomb", type: "grass", cat: "physical", power: 80, acc: 100, pp: 15, desc: "Rains hard-shelled seeds down on the foe." },

  /* ---- Electric ---- */
  thundershock:{ name: "Thunder Shock", type: "electric", cat: "special", power: 40, acc: 100, pp: 30, effect: { status: "par", chance: 10 }, desc: "A jolt that may paralyze the foe." },
  thunderbolt: { name: "Thunderbolt", type: "electric", cat: "special", power: 90, acc: 100, pp: 15, effect: { status: "par", chance: 10 }, desc: "A strong jolt that may leave the foe paralyzed." },
  spark:       { name: "Spark", type: "electric", cat: "physical", power: 65, acc: 100, pp: 20, effect: { status: "par", chance: 30 }, desc: "A charged tackle that often paralyzes." },
  thunderwave: { name: "Thunder Wave", type: "electric", cat: "status", acc: 90, pp: 20, effect: { status: "par", chance: 100 }, desc: "A weak jolt that is sure to paralyze the foe." },

  /* ---- Ice ---- */
  iceshard:    { name: "Ice Shard", type: "ice", cat: "physical", power: 40, acc: 100, pp: 30, prio: 1, desc: "Hurls a chunk of ice that always strikes first." },
  icebeam:     { name: "Ice Beam", type: "ice", cat: "special", power: 90, acc: 100, pp: 10, effect: { status: "frz", chance: 10 }, desc: "A frozen beam that may freeze the foe solid." },
  powdersnow:  { name: "Powder Snow", type: "ice", cat: "special", power: 40, acc: 100, pp: 25, effect: { status: "frz", chance: 10 }, desc: "A chilling snow that may freeze the foe." },

  /* ---- Fighting ---- */
  karatechop:  { name: "Karate Chop", type: "fighting", cat: "physical", power: 50, acc: 100, pp: 25, crit: "high", desc: "A chopping strike with a high critical-hit rate." },
  brickbreak:  { name: "Brick Break", type: "fighting", cat: "physical", power: 75, acc: 100, pp: 15, desc: "A swift chop that shatters the foe's guard." },
  lowkick:     { name: "Low Kick", type: "fighting", cat: "physical", power: 60, acc: 100, pp: 20, desc: "A sweeping kick to the foe's legs." },

  /* ---- Poison ---- */
  poisonsting: { name: "Poison Sting", type: "poison", cat: "physical", power: 15, acc: 100, pp: 35, effect: { status: "psn", chance: 30 }, desc: "A toxic barb that may poison the foe." },
  sludge:      { name: "Sludge", type: "poison", cat: "special", power: 65, acc: 100, pp: 20, effect: { status: "psn", chance: 30 }, desc: "Hurls filth that may poison the foe." },
  acid:        { name: "Acid", type: "poison", cat: "special", power: 40, acc: 100, pp: 30, stat: { who: "foe", mods: { spd: -1 }, chance: 10 }, desc: "Sprays acid that may lower Sp. Def." },
  toxic:       { name: "Toxic", type: "poison", cat: "status", acc: 90, pp: 10, effect: { status: "psn", chance: 100 }, desc: "A dose of poison that badly hurts the foe." },

  /* ---- Ground ---- */
  mudslap:     { name: "Mud-Slap", type: "ground", cat: "special", power: 20, acc: 100, pp: 10, stat: { who: "foe", mods: { acc: -1 } }, desc: "Slings mud to damage and blind the foe." },
  earthquake:  { name: "Earthquake", type: "ground", cat: "physical", power: 100, acc: 100, pp: 10, desc: "A violent shaking that strikes everything around." },
  bulldoze:    { name: "Bulldoze", type: "ground", cat: "physical", power: 60, acc: 100, pp: 20, stat: { who: "foe", mods: { spe: -1 } }, desc: "Stomps the ground, lowering the foe's Speed." },

  /* ---- Flying ---- */
  gust:        { name: "Gust", type: "flying", cat: "special", power: 40, acc: 100, pp: 35, desc: "Whips up a gust of wind to strike the foe." },
  peck:        { name: "Peck", type: "flying", cat: "physical", power: 35, acc: 100, pp: 35, desc: "Jabs the foe with a sharp beak or horn." },
  wingattack:  { name: "Wing Attack", type: "flying", cat: "physical", power: 60, acc: 100, pp: 35, desc: "Strikes with wings spread wide." },
  aerialace:   { name: "Aerial Ace", type: "flying", cat: "physical", power: 60, acc: true, pp: 20, desc: "A blindingly fast strike that never misses." },

  /* ---- Psychic ---- */
  confusion:   { name: "Confusion", type: "psychic", cat: "special", power: 50, acc: 100, pp: 25, desc: "A weak telekinetic blast." },
  psybeam:     { name: "Psybeam", type: "psychic", cat: "special", power: 65, acc: 100, pp: 20, desc: "A peculiar ray fired from the mind." },
  psychic:     { name: "Psychic", type: "psychic", cat: "special", power: 90, acc: 100, pp: 10, stat: { who: "foe", mods: { spd: -1 }, chance: 10 }, desc: "A strong force that may lower Sp. Def." },

  /* ---- Bug ---- */
  bugbite:     { name: "Bug Bite", type: "bug", cat: "physical", power: 60, acc: 100, pp: 20, desc: "Bites hard with sharp mandibles." },
  strugglebug: { name: "Struggle Bug", type: "bug", cat: "special", power: 50, acc: 100, pp: 20, stat: { who: "foe", mods: { spa: -1 } }, desc: "Resists with a shriek, lowering the foe's Sp. Atk." },
  pinmissile:  { name: "Pin Missile", type: "bug", cat: "physical", power: 25, acc: 95, pp: 20, multi: [2, 5], desc: "Fires stiff spikes two to five times in a row." },

  /* ---- Rock ---- */
  rockthrow:   { name: "Rock Throw", type: "rock", cat: "physical", power: 50, acc: 90, pp: 15, desc: "Hurls a heavy rock at the foe." },
  rockslide:   { name: "Rock Slide", type: "rock", cat: "physical", power: 75, acc: 90, pp: 10, flinch: 30, desc: "Boulders rain down and may make the foe flinch." },

  /* ---- Ghost ---- */
  lick:        { name: "Lick", type: "ghost", cat: "physical", power: 30, acc: 100, pp: 30, effect: { status: "par", chance: 30 }, desc: "A spooky lick that may paralyze the foe." },
  shadowsneak: { name: "Shadow Sneak", type: "ghost", cat: "physical", power: 40, acc: 100, pp: 30, prio: 1, desc: "Extends a shadow to strike first." },
  shadowball:  { name: "Shadow Ball", type: "ghost", cat: "special", power: 80, acc: 100, pp: 15, stat: { who: "foe", mods: { spd: -1 }, chance: 20 }, desc: "Hurls a shadowy blob that may lower Sp. Def." },

  /* ---- Dragon ---- */
  dragonbreath:{ name: "Dragon Breath", type: "dragon", cat: "special", power: 60, acc: 100, pp: 20, effect: { status: "par", chance: 30 }, desc: "A fierce breath that may paralyze the foe." },
  dragonclaw:  { name: "Dragon Claw", type: "dragon", cat: "physical", power: 80, acc: 100, pp: 15, desc: "Slashes with huge, sharp claws." },
  twister:     { name: "Twister", type: "dragon", cat: "special", power: 40, acc: 100, pp: 20, flinch: 20, desc: "A dragon-cloaked tornado that may cause flinching." },

  /* ---- Dark ---- */
  bite:        { name: "Bite", type: "dark", cat: "physical", power: 60, acc: 100, pp: 25, flinch: 30, desc: "Bites with fangs; may make the foe flinch." },
  crunch:      { name: "Crunch", type: "dark", cat: "physical", power: 80, acc: 100, pp: 15, stat: { who: "foe", mods: { def: -1 }, chance: 20 }, desc: "Crunches with sharp fangs; may lower Defense." },

  /* ---- Steel ---- */
  metalclaw:   { name: "Metal Claw", type: "steel", cat: "physical", power: 50, acc: 95, pp: 35, stat: { who: "self", mods: { atk: 1 }, chance: 20 }, desc: "Rakes with steel claws; may raise the user's Attack." },

  /* ---- Fairy ---- */
  fairywind:   { name: "Fairy Wind", type: "fairy", cat: "special", power: 40, acc: 100, pp: 30, desc: "Stirs up a fairy wind to strike the foe." },
  drainingkiss:{ name: "Draining Kiss", type: "fairy", cat: "special", power: 50, acc: 100, pp: 10, drain: 0.75, desc: "A draining kiss that heals most of the damage dealt." },
};

if (typeof module !== "undefined" && module.exports) module.exports = { MOVES };
