/* ============================================================
   POCKET FRONTIER — types.js
   The full eighteen-type effectiveness chart and per-type colours.
   Values are the real ones: 2 super-effective, 0.5 resisted,
   0 immune; anything unlisted is neutral (1x).
   ============================================================ */
"use strict";

const TYPES = {

  color: {
    normal: "#9a9a82", fire: "#f0803a", water: "#5a94f0", electric: "#f6cf30",
    grass: "#67c94a", ice: "#8fd6d6", fighting: "#c0302a", poison: "#a63fa6",
    ground: "#dcbe5a", flying: "#9fb0f0", psychic: "#f85a86", bug: "#9fb018",
    rock: "#b39a36", ghost: "#6a5596", dragon: "#6a38f0", dark: "#6a5648",
    steel: "#b3b3cf", fairy: "#ee92ac",
  },

  // short two/three letter tags for the compact type badge
  tag: {
    normal: "NOR", fire: "FIR", water: "WTR", electric: "ELE", grass: "GRS",
    ice: "ICE", fighting: "FGT", poison: "PSN", ground: "GRD", flying: "FLY",
    psychic: "PSY", bug: "BUG", rock: "RCK", ghost: "GHO", dragon: "DRG",
    dark: "DRK", steel: "STL", fairy: "FAI",
  },

  // chart[attacker] = { defender: multiplier } for every non-neutral pair
  chart: {
    normal:   { rock: 0.5, steel: 0.5, ghost: 0 },
    fire:     { grass: 2, ice: 2, bug: 2, steel: 2, fire: 0.5, water: 0.5, rock: 0.5, dragon: 0.5 },
    water:    { fire: 2, ground: 2, rock: 2, water: 0.5, grass: 0.5, dragon: 0.5 },
    electric: { water: 2, flying: 2, electric: 0.5, grass: 0.5, dragon: 0.5, ground: 0 },
    grass:    { water: 2, ground: 2, rock: 2, fire: 0.5, grass: 0.5, poison: 0.5, flying: 0.5, bug: 0.5, dragon: 0.5, steel: 0.5 },
    ice:      { grass: 2, ground: 2, flying: 2, dragon: 2, fire: 0.5, water: 0.5, ice: 0.5, steel: 0.5 },
    fighting: { normal: 2, ice: 2, rock: 2, dark: 2, steel: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, fairy: 0.5, ghost: 0 },
    poison:   { grass: 2, fairy: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0 },
    ground:   { fire: 2, electric: 2, poison: 2, rock: 2, steel: 2, grass: 0.5, bug: 0.5, flying: 0 },
    flying:   { grass: 2, fighting: 2, bug: 2, electric: 0.5, rock: 0.5, steel: 0.5 },
    psychic:  { fighting: 2, poison: 2, psychic: 0.5, steel: 0.5, dark: 0 },
    bug:      { grass: 2, psychic: 2, dark: 2, fire: 0.5, fighting: 0.5, poison: 0.5, flying: 0.5, ghost: 0.5, steel: 0.5, fairy: 0.5 },
    rock:     { fire: 2, ice: 2, flying: 2, bug: 2, fighting: 0.5, ground: 0.5, steel: 0.5 },
    ghost:    { psychic: 2, ghost: 2, dark: 0.5, normal: 0 },
    dragon:   { dragon: 2, steel: 0.5, fairy: 0 },
    dark:     { psychic: 2, ghost: 2, fighting: 0.5, dark: 0.5, fairy: 0.5 },
    steel:    { ice: 2, rock: 2, fairy: 2, fire: 0.5, water: 0.5, electric: 0.5, steel: 0.5 },
    fairy:    { fighting: 2, dragon: 2, dark: 2, fire: 0.5, poison: 0.5, steel: 0.5 },
  },

  // multiplier of a single attacking type vs one defending type
  vs(atk, def) {
    const row = TYPES.chart[atk];
    if (!row) return 1;
    return def in row ? row[def] : 1;
  },

  // multiplier of an attacking type vs a defender that may have two types
  effective(atk, defTypes) {
    let m = 1;
    for (const d of defTypes) m *= TYPES.vs(atk, d);
    return m;
  },

  // battle flavour line for an effectiveness multiplier
  blurb(m) {
    if (m === 0) return "It doesn't affect the foe…";
    if (m >= 4) return "It's monstrously effective!";
    if (m > 1) return "It's super effective!";
    if (m > 0 && m < 1) return "It's not very effective…";
    return "";
  },
};

if (typeof module !== "undefined" && module.exports) module.exports = { TYPES };
