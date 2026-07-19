/* ============================================================
   POCKET FRONTIER — monster.js
   A single creature instance: its species, level, IVs, stats,
   moves & PP, status, in-battle stat stages, EXP and growth.
   Stats use the classic formula; growth is the medium-fast
   (level³) curve.
   ============================================================ */
"use strict";

const STAGE_MULT = { "-6": 2 / 8, "-5": 2 / 7, "-4": 2 / 6, "-3": 2 / 5, "-2": 2 / 4, "-1": 2 / 3, "0": 1, "1": 3 / 2, "2": 4 / 2, "3": 5 / 2, "4": 6 / 2, "5": 7 / 2, "6": 8 / 2 };

class Monster {
  constructor(speciesKey, level, opts) {
    opts = opts || {};
    this.species = speciesKey;
    this.level = level;
    this.ivs = opts.ivs || {
      hp: U.randi(0, 31), atk: U.randi(0, 31), def: U.randi(0, 31),
      spa: U.randi(0, 31), spd: U.randi(0, 31), spe: U.randi(0, 31),
    };
    this.exp = opts.exp != null ? opts.exp : Monster.expAt(level);
    this.nickname = opts.nickname || null;
    this.status = opts.status || null;          // brn / psn / par / slp / frz
    this.sleepTurns = opts.sleepTurns || 0;
    this.stages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 };
    this.moves = opts.moves ? opts.moves.slice() : this.defaultMoves();
    this.pp = opts.pp ? opts.pp.slice() : this.moves.map(m => MOVES[m].pp);
    this.maxpp = this.moves.map(m => MOVES[m].pp);
    this.hp = opts.hp != null ? opts.hp : this.maxHp;
  }

  /* ---------- identity ---------- */
  get data() { return SPECIES[this.species]; }
  get name() { return this.nickname || this.data.name; }
  get types() { return this.data.types; }

  /* ---------- stats ---------- */
  get maxHp() {
    const b = this.data.base.hp;
    return Math.floor((2 * b + this.ivs.hp) * this.level / 100) + this.level + 10;
  }
  // raw stat (no stage), key in atk/def/spa/spd/spe
  raw(key) {
    const b = this.data.base[key];
    return Math.floor((2 * b + this.ivs[key]) * this.level / 100) + 5;
  }
  // effective stat with stage + burn/paralysis in battle
  eff(key) {
    let v = this.raw(key) * STAGE_MULT[String(this.stages[key] || 0)];
    if (key === "atk" && this.status === "brn") v *= 0.5;
    if (key === "spe" && this.status === "par") v *= 0.5;
    return v;
  }
  get hpFrac() { return U.clamp(this.hp / this.maxHp, 0, 1); }
  get fainted() { return this.hp <= 0; }

  /* ---------- moves ---------- */
  defaultMoves() {
    const known = [];
    for (const [lv, mv] of this.data.learn) {
      if (lv <= this.level && !known.includes(mv)) known.push(mv);
    }
    return known.slice(-4);
  }
  knowsMove(mv) { return this.moves.includes(mv); }
  restore() {
    this.hp = this.maxHp;
    this.status = null; this.sleepTurns = 0;
    for (let i = 0; i < this.pp.length; i++) this.pp[i] = this.maxpp[i];
    this.resetStages();
  }
  resetStages() {
    for (const k in this.stages) this.stages[k] = 0;
  }

  /* ---------- growth ---------- */
  static expAt(level) { return level * level * level; }             // medium-fast
  get expThisLevel() { return Monster.expAt(this.level); }
  get expNextLevel() { return Monster.expAt(this.level + 1); }
  get expToNext() { return Math.max(0, this.expNextLevel - this.exp); }
  get expFrac() {
    const a = this.expThisLevel, b = this.expNextLevel;
    return U.clamp((this.exp - a) / (b - a), 0, 1);
  }

  // add exp, level up as needed. Returns an ordered list of events:
  //   {type:'level'}  {type:'move', move}  {type:'learnFull', move}  {type:'evolve', to}
  gainExp(amount) {
    const events = [];
    this.exp += amount;
    while (this.level < 100 && this.exp >= this.expNextLevel) {
      const beforeMax = this.maxHp;
      this.level++;
      this.hp += this.maxHp - beforeMax;                 // grow current HP with max
      events.push({ type: "level", level: this.level });
      for (const [lv, mv] of this.data.learn) {
        if (lv === this.level && !this.knowsMove(mv)) {
          if (this.moves.length < 4) {
            this.moves.push(mv); this.pp.push(MOVES[mv].pp); this.maxpp.push(MOVES[mv].pp);
            events.push({ type: "move", move: mv });
          } else {
            events.push({ type: "learnFull", move: mv });
          }
        }
      }
    }
    // one evolution check for the whole gain (the game re-checks after evolving)
    if (this.data.evolve && this.level >= this.data.evolve.level) {
      events.push({ type: "evolve", to: this.data.evolve.to });
    }
    return events;
  }

  // replace move at index (used by the "learn full" prompt)
  replaceMove(index, mv) {
    this.moves[index] = mv;
    this.pp[index] = MOVES[mv].pp;
    this.maxpp[index] = MOVES[mv].pp;
  }

  evolve(toKey) {
    this.species = toKey;
    // learn any level-1/"evolution" moves it now qualifies for and has room for
    for (const [lv, mv] of this.data.learn) {
      if (lv <= this.level && !this.knowsMove(mv) && this.moves.length < 4) {
        this.moves.push(mv); this.pp.push(MOVES[mv].pp); this.maxpp.push(MOVES[mv].pp);
      }
    }
    if (this.hp > this.maxHp) this.hp = this.maxHp;
  }

  /* ---------- persistence ---------- */
  toJSON() {
    return {
      species: this.species, level: this.level, ivs: this.ivs, exp: this.exp,
      nickname: this.nickname, status: this.status, sleepTurns: this.sleepTurns,
      moves: this.moves, pp: this.pp, hp: this.hp,
    };
  }
  static fromJSON(j) { return new Monster(j.species, j.level, j); }
}

if (typeof module !== "undefined" && module.exports) module.exports = { Monster, STAGE_MULT };
