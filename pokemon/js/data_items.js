/* ============================================================
   POCKET FRONTIER — data_items.js
   Bag items: balls, potions and status cures. Each carries the
   fields the battle engine and shop both read.
     kind: 'ball' | 'heal' | 'cure' | 'revive'
     amount   HP restored (heal)
     bonus    catch multiplier (ball)
     cures    status a cure removes ('any' = all)
   ============================================================ */
"use strict";

const ITEMS = {
  pokeball:    { name: "Poké Ball",   kind: "ball", bonus: 1.0, price: 200,  battle: "wild", desc: "A device for catching wild Pokémon, thrown at a foe." },
  greatball:   { name: "Great Ball",  kind: "ball", bonus: 1.5, price: 600,  battle: "wild", desc: "A good Ball with a higher catch rate than a Poké Ball." },
  ultraball:   { name: "Ultra Ball",  kind: "ball", bonus: 2.0, price: 1200, battle: "wild", desc: "An ultra-performance Ball with an even higher catch rate." },

  potion:      { name: "Potion",      kind: "heal", amount: 20,   price: 100,  battle: true, desc: "Restores 20 HP to a single Pokémon." },
  superpotion: { name: "Super Potion",kind: "heal", amount: 50,   price: 300,  battle: true, desc: "Restores 50 HP to a single Pokémon." },
  hyperpotion: { name: "Hyper Potion",kind: "heal", amount: 120,  price: 800,  battle: true, desc: "Restores 120 HP to a single Pokémon." },
  fullrestore: { name: "Full Restore",kind: "heal", amount: 9999, cures: "any", price: 1500, battle: true, desc: "Fully restores HP and cures any status of one Pokémon." },

  antidote:    { name: "Antidote",    kind: "cure", cures: "psn", price: 100, battle: true, desc: "Cures a poisoned Pokémon." },
  burnheal:    { name: "Burn Heal",   kind: "cure", cures: "brn", price: 250, battle: true, desc: "Cools a burned Pokémon, curing the burn." },
  iceheal:     { name: "Ice Heal",    kind: "cure", cures: "frz", price: 250, battle: true, desc: "Thaws a frozen Pokémon." },
  awakening:   { name: "Awakening",   kind: "cure", cures: "slp", price: 250, battle: true, desc: "Wakes a sleeping Pokémon." },
  paralyzeheal:{ name: "Paralyze Heal",kind: "cure", cures: "par", price: 200, battle: true, desc: "Frees a paralyzed Pokémon." },
  fullheal:    { name: "Full Heal",   kind: "cure", cures: "any", price: 600, battle: true, desc: "Cures any status condition." },

  revive:      { name: "Revive",      kind: "revive", price: 1500, battle: false, desc: "Revives a fainted Pokémon to half its max HP." },
};

if (typeof module !== "undefined" && module.exports) module.exports = { ITEMS };
