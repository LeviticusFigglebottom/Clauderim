/* ============================================================
   POCKET FRONTIER — world.js
   The overworld: a hand-drawn tile map of Meadowlink Town and
   Route 1, plus its NPCs, trainers, signs, wild-encounter table
   and the coordinates that matter (start, heal, gate).

   Tile legend:
     .  grass field      g  tall grass (encounters)
     p  path             t  tree (solid)        r  rock (solid)
     w  water (solid)    f  fence (solid)       F  flowers
     C  center wall      c  center DOOR (heal)
     M  mart wall        m  mart DOOR (shop)
     b  house wall       d  house DOOR (talk)
     s  sign (talk)      G  gate / route exit
   ============================================================ */
"use strict";

const WORLD = {
  rows: [
    "tttttttttttttttttttttttttt",
    "t........................t",
    "t..gggg.........gggg.....t",
    "t..gggg....GG...gggg.....t",
    "t..gggg....pp...gggg.....t",
    "t..........pp............t",
    "t...ttt....pp.....ttt....t",
    "t...ttt....pp..ww..tt....t",
    "t..........pp..ww........t",
    "t.... gggggg...gggggg....t".replace(" ", "."),
    "t....gggggg....gggggg....t",
    "t.......F....F......F....t",
    "t..bb.......ss.......bb..t",
    "t..bd.......ss.......bd..t",
    "t........................t",
    "t..CC..............MM....t",
    "t..Cc..............Mm....t",
    "t.......F......F.........t",
    "t.........@..............t",
    "tttttttttttttttttttttttttt",
  ],

  solid: new Set(["t", "w", "r", "f", "C", "M", "b"]),
  encounterTile: "g",
  start: { x: 10, y: 18, dir: "up" },
  gate: { x: 11, y: 3 },                  // stepping here after the Champion falls = victory

  // signs & doors keyed "x,y"
  signs: {
    "12,12": "MEADOWLINK TOWN — “Where every journey begins.”",
    "13,12": "ROUTE 1 ahead. Tall grass is home to wild Pokémon!",
    "3,13": "SETH'S HOUSE. The door is locked.",
    "21,13": "GARA'S HOUSE. Nobody seems to be home.",
  },

  // interactive people (talk on facing). A `trainer` block makes them fight.
  npcs: [
    { x: 9, y: 17, dir: "up", color: "#c85a3a", hair: "#3a2a20", name: "Prof. Elm-Wood",
      lines: ["Welcome to the world of POCKET FRONTIER!",
              "That partner at your side was your first choice — treat it well.",
              "Tall grass hides wild Pokémon. Weaken them, then throw a Ball!"] },

    { x: 8, y: 8, dir: "down", color: "#3a6ac8", hair: "#2a2a2a", name: "Youngster Kip",
      trainer: { sight: 4, intro: "Hey! You've got Pokémon too? Let's battle!",
                 defeat: "Aw, you're strong! I need to train more.",
                 prize: 240, party: [["nibblet", 6], ["chirplet", 7]] },
      lines: ["You beat me fair and square. Route 1 is all yours!"] },

    { x: 17, y: 9, dir: "left", color: "#2a8a5a", hair: "#5a3a20", name: "Bug Catcher No",
      trainer: { sight: 4, intro: "My bugs will chew right through you!",
                 defeat: "Nooo! My precious bugs!",
                 prize: 200, party: [["grubbit", 6], ["grubbit", 7], ["lumoth", 9]] },
      lines: ["Bugs are the best. You'll see one day."] },

    { x: 11, y: 5, dir: "down", color: "#8a3ac8", hair: "#e0d040", name: "Rival Ash-Lyn",
      trainer: { sight: 0, intro: "There you are! Let's see who trained harder. No holding back!",
                 defeat: "Not bad… you really are something. I'll be back!",
                 prize: 600, rival: true },
      lines: ["Go on ahead — the Champion's waiting at the gate. Show them what we've got!"] },

    { x: 11, y: 4, dir: "down", color: "#d0a020", hair: "#20304a", name: "Champion Vera",
      trainer: { sight: 0, champion: true, intro: "So you've made it to the gate. Only a true partner-trainer passes here. Come!",
                 defeat: "Magnificent. The road beyond is yours, Champion.",
                 prize: 2000, party: [["skytalon", 16], ["torrentoise", 16], ["voltmastiff", 17]] },
      lines: ["The frontier beyond is vast. Go well, Champion."] },
  ],

  // weighted wild table for Route 1's tall grass
  encounters: [
    { w: 30, species: "nibblet", min: 3, max: 6 },
    { w: 24, species: "chirplet", min: 3, max: 6 },
    { w: 18, species: "grubbit", min: 2, max: 5 },
    { w: 14, species: "zappup", min: 4, max: 7 },
    { w: 9, species: "goobloop", min: 4, max: 7 },
    { w: 4, species: "pebblit", min: 5, max: 8 },
    { w: 1, species: "drakeling", min: 6, max: 9 },
  ],
  encounterRate: 0.11,          // per step in tall grass

  get W() { return WORLD.rows[0].length; },
  get H() { return WORLD.rows.length; },
  tile(x, y) {
    if (y < 0 || y >= WORLD.rows.length || x < 0 || x >= WORLD.rows[0].length) return "t";
    return WORLD.rows[y][x];
  },
  isSolid(x, y, occupied) {
    const c = WORLD.tile(x, y);
    if (WORLD.solid.has(c)) return true;
    if (occupied && occupied.some(n => n.x === x && n.y === y)) return true;
    return false;
  },
  rollEncounter() {
    const e = U.weighted(WORLD.encounters);
    return { species: e.species, level: U.randi(e.min, e.max) };
  },
};

// integrity: every row the same width, start tile walkable
(function validate() {
  const w = WORLD.rows[0].length;
  for (const r of WORLD.rows) if (r.length !== w) throw new Error("world: ragged map row (" + r.length + "≠" + w + "): " + r);
})();

if (typeof module !== "undefined" && module.exports) module.exports = { WORLD };
