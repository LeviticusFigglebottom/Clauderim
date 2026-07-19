/* ============================================================
   POCKET FRONTIER — battle.js
   The turn engine. It owns the fight's state and, for every
   player action, resolves the whole turn (foe AI included) into
   an ordered list of *events* the UI plays back one at a time:

     {t:'text', s}                        a line for the battle log
     {t:'anim', kind, atk}                play a move animation
     {t:'hp', side}                        tween that side's HP bar
     {t:'status', side} / {t:'statusHeal'}
     {t:'stat', side}                      flash a stat-change puff
     {t:'faint', side}
     {t:'sendout', side}                   a fresh foe slides in
     {t:'exp'} {t:'levelup'} {t:'learn'} {t:'learnFull'} {t:'evolve'}
     {t:'ball', shakes, caught}
     {t:'end', result}

   This keeps every rule here and every pixel in battle_ui.js.
   ============================================================ */
"use strict";

const BALLS = {
  pokeball:  { name: "Poké Ball", bonus: 1.0 },
  greatball: { name: "Great Ball", bonus: 1.5 },
  ultraball: { name: "Ultra Ball", bonus: 2.0 },
};

class Battle {
  constructor(party, foe, opts) {
    opts = opts || {};
    this.party = party;                 // array of the player's Monsters
    this.pi = party.findIndex(m => !m.fainted);
    if (this.pi < 0) this.pi = 0;
    this.foe = foe;                     // active enemy Monster
    this.trainer = opts.trainer || null; // { name, party:[Monster], prize } or null (wild)
    this.foeIdx = 0;
    this.isWild = !this.trainer;
    this.bag = opts.bag || null;        // reference to player's bag for item use
    this.over = false;
    this.result = null;                 // win / lose / caught / ran
    this.turn = 0;
    this.runTries = 0;
    this.awaitSwitch = false;           // set when the player's mon fainted mid-turn
    this.pendingLearn = null;           // {mon, move} awaiting a replace decision
    for (const m of this.party) m.resetStages();
    this.foe.resetStages();
  }

  get active() { return this.party[this.pi]; }
  get alive() { return this.party.some(m => !m.fainted); }

  /* ============================================================
     PUBLIC ACTIONS  — each returns an event list
     ============================================================ */

  playerMove(moveIdx) {
    const ev = [];
    const me = this.active;
    if (me.pp[moveIdx] <= 0) { ev.push({ t: "text", s: "No PP left for that move!" }); return ev; }
    me.pp[moveIdx]--;
    this._resolveTurn(ev, { kind: "move", moveIdx });
    return ev;
  }

  playerSwitch(idx) {
    const ev = [];
    if (idx === this.pi || this.party[idx].fainted) return ev;
    const old = this.active;
    ev.push({ t: "text", s: `${old.name}, come back!` });
    ev.push({ t: "recall", side: "player" });
    this.pi = idx;
    this.active.resetStages();
    ev.push({ t: "sendout", side: "player" });
    ev.push({ t: "text", s: `Go, ${this.active.name}!` });
    // switching uses the turn — the foe gets a free move
    this._foeTurn(ev);
    this._endOfTurn(ev);
    return ev;
  }

  playerItem(item, targetIdx) {
    const ev = [];
    if (item.kind === "ball") { this._throwBall(ev, item); return ev; }
    if (item.kind === "heal") {
      const mon = this.party[targetIdx == null ? this.pi : targetIdx];
      const before = mon.hp;
      mon.hp = Math.min(mon.maxHp, mon.hp + item.amount);
      ev.push({ t: "text", s: `You used one ${item.name}.` });
      ev.push({ t: "hp", side: mon === this.active ? "player" : "none" });
      ev.push({ t: "text", s: `${mon.name} recovered ${mon.hp - before} HP!` });
    } else if (item.kind === "cure") {
      const mon = this.party[targetIdx == null ? this.pi : targetIdx];
      mon.status = null; mon.sleepTurns = 0;
      ev.push({ t: "text", s: `${mon.name} was cured!` });
      ev.push({ t: "statusHeal", side: mon === this.active ? "player" : "none" });
    }
    this._foeTurn(ev);
    this._endOfTurn(ev);
    return ev;
  }

  playerRun() {
    const ev = [];
    if (this.trainer) { ev.push({ t: "text", s: "There's no running from a Trainer battle!" }); return ev; }
    this.runTries++;
    const a = this.active.eff("spe"), b = this.foe.eff("spe");
    const odds = b <= a ? 1 : (Math.floor((a * 128) / b) + 30 * this.runTries) / 256;
    if (U.rng() < odds) {
      ev.push({ t: "text", s: "Got away safely!" });
      this.over = true; this.result = "ran";
      ev.push({ t: "end", result: "ran" });
    } else {
      ev.push({ t: "text", s: "Couldn't get away!" });
      this._foeTurn(ev);
      this._endOfTurn(ev);
    }
    return ev;
  }

  // called by UI after the player picks a replacement for a fainted mon
  switchAfterFaint(idx) {
    const ev = [];
    this.pi = idx;
    this.active.resetStages();
    this.awaitSwitch = false;
    ev.push({ t: "sendout", side: "player" });
    ev.push({ t: "text", s: `Go, ${this.active.name}!` });
    return ev;
  }

  /* ============================================================
     TURN RESOLUTION
     ============================================================ */

  _resolveTurn(ev, playerAction) {
    this.turn++;
    // foe chooses
    const foeMoveIdx = this._foeChoose();
    const pMove = MOVES[this.active.moves[playerAction.moveIdx]];
    const fMove = MOVES[this.foe.moves[foeMoveIdx]];
    const pPrio = pMove.prio || 0, fPrio = fMove.prio || 0;

    let playerFirst;
    if (pPrio !== fPrio) playerFirst = pPrio > fPrio;
    else {
      const ps = this.active.eff("spe"), fs = this.foe.eff("spe");
      playerFirst = ps !== fs ? ps > fs : U.rng() < 0.5;
    }

    const doP = () => this._useMove(ev, this.active, this.foe, playerAction.moveIdx, "player");
    const doF = () => this._useMove(ev, this.foe, this.active, foeMoveIdx, "foe");

    if (playerFirst) {
      doP();
      if (!this._checkFaints(ev)) doF();
    } else {
      doF();
      if (!this._checkFaints(ev)) doP();
    }
    this._checkFaints(ev);
    if (!this.over && !this.awaitSwitch) this._endOfTurn(ev);
  }

  _foeTurn(ev) {
    if (this.over || this.foe.fainted) return;
    const idx = this._foeChoose();
    this._useMove(ev, this.foe, this.active, idx, "foe");
    this._checkFaints(ev);
  }

  // one creature uses one move against the other
  _useMove(ev, atk, def, moveIdx, side) {
    if (atk.fainted) return;
    const other = side === "player" ? "foe" : "player";
    const move = MOVES[atk.moves[moveIdx]];

    // pre-move status gates
    if (atk.status === "frz") {
      if (U.rng() < 0.2 || move.type === "fire") { atk.status = null; ev.push({ t: "statusHeal", side }); ev.push({ t: "text", s: `${atk.name} thawed out!` }); }
      else { ev.push({ t: "text", s: `${atk.name} is frozen solid!` }); return; }
    }
    if (atk.status === "slp") {
      if (atk.sleepTurns > 0) { atk.sleepTurns--; ev.push({ t: "text", s: `${atk.name} is fast asleep.` }); return; }
      atk.status = null; ev.push({ t: "statusHeal", side }); ev.push({ t: "text", s: `${atk.name} woke up!` });
    }
    if (atk.status === "par" && U.rng() < 0.25) { ev.push({ t: "text", s: `${atk.name} is paralyzed! It can't move!` }); return; }
    if (atk._flinch) { atk._flinch = false; ev.push({ t: "text", s: `${atk.name} flinched and couldn't move!` }); return; }

    ev.push({ t: "text", s: `${side === "foe" ? "The foe's " : ""}${atk.name} used ${move.name}!` });
    ev.push({ t: "anim", kind: atk.moves[moveIdx], mtype: move.type, cat: move.cat, atk: side });

    // accuracy
    if (move.acc !== true) {
      const accS = STAGE_MULT[String(U.clamp(atk.stages.acc - def.stages.eva, -6, 6))];
      if (U.rng() * 100 > move.acc * accS) {
        ev.push({ t: "text", s: `${atk.name}'s attack missed!` });
        return;
      }
    }

    if (move.cat === "status") { this._applyStatusMove(ev, atk, def, move, side, other); return; }

    // damage
    const eff = TYPES.effective(move.type, def.types);
    if (eff === 0) { ev.push({ t: "text", s: `It doesn't affect ${def.name}…` }); return; }

    const hits = move.multi ? U.randi(move.multi[0], move.multi[1]) : 1;
    let totalDealt = 0, lastCrit = false;
    for (let h = 0; h < hits; h++) {
      if (def.fainted) break;
      const crit = U.rng() < (move.crit === "high" ? 0.125 : 0.0625);
      let dmg = this._damage(atk, def, move, crit, eff);
      dmg = Math.min(dmg, def.hp);
      def.hp -= dmg; totalDealt += dmg; lastCrit = lastCrit || crit;
      ev.push({ t: "hp", side: other });
    }
    if (move.multi) ev.push({ t: "text", s: `Hit ${hits} time${hits > 1 ? "s" : ""}!` });
    if (lastCrit) ev.push({ t: "text", s: "A critical hit!" });
    const blurb = TYPES.blurb(eff);
    if (blurb) ev.push({ t: "text", s: blurb });

    // secondary effects (skip if target fainted)
    if (!def.fainted) {
      if (move.effect && U.rng() * 100 < move.effect.chance) this._inflict(ev, def, move.effect.status, other);
      if (move.stat && U.rng() * 100 < (move.stat.chance || 100)) this._statChange(ev, move.stat.who === "self" ? atk : def, move.stat.mods, move.stat.who === "self" ? side : other);
      if (move.flinch && U.rng() * 100 < move.flinch && !def.fainted) def._flinch = true;
    }
    // drain / recoil
    if (move.drain && totalDealt > 0) {
      const heal = Math.max(1, Math.floor(totalDealt * move.drain));
      atk.hp = Math.min(atk.maxHp, atk.hp + heal);
      ev.push({ t: "hp", side });
      ev.push({ t: "text", s: `${def.name} had its energy drained!` });
    }
    if (move.recoil && totalDealt > 0) {
      const hurt = Math.max(1, Math.floor(totalDealt * move.recoil));
      atk.hp = Math.max(0, atk.hp - hurt);
      ev.push({ t: "hp", side });
      ev.push({ t: "text", s: `${atk.name} is hit by recoil!` });
    }
  }

  _applyStatusMove(ev, atk, def, move, side, other) {
    if (move.heal) {
      if (atk.hp >= atk.maxHp) { ev.push({ t: "text", s: "But it failed!" }); return; }
      const before = atk.hp;
      atk.hp = Math.min(atk.maxHp, atk.hp + Math.floor(atk.maxHp * move.heal));
      ev.push({ t: "hp", side });
      ev.push({ t: "text", s: `${atk.name} regained ${atk.hp - before} HP!` });
      return;
    }
    if (move.effect) {
      const eff = TYPES.effective(move.type, def.types);
      if (eff === 0 && move.type !== "normal") { ev.push({ t: "text", s: `It doesn't affect ${def.name}…` }); return; }
      this._inflict(ev, def, move.effect.status, other);
      return;
    }
    if (move.stat) {
      const who = move.stat.who === "self" ? atk : def;
      this._statChange(ev, who, move.stat.mods, move.stat.who === "self" ? side : other);
      return;
    }
    ev.push({ t: "text", s: "But nothing happened!" });
  }

  _inflict(ev, mon, status, side) {
    if (mon.status) return;                              // already statused
    // type immunities
    if (status === "brn" && mon.types.includes("fire")) return;
    if (status === "frz" && mon.types.includes("ice")) return;
    if ((status === "psn") && (mon.types.includes("poison") || mon.types.includes("steel"))) return;
    if (status === "par" && mon.types.includes("electric")) return;
    mon.status = status;
    if (status === "slp") mon.sleepTurns = U.randi(1, 3);
    const line = {
      brn: "was burned!", psn: "was poisoned!", par: "is paralyzed! It may be unable to move!",
      slp: "fell asleep!", frz: "was frozen solid!",
    }[status];
    ev.push({ t: "status", side, status });
    ev.push({ t: "text", s: `${mon.name} ${line}` });
  }

  _statChange(ev, mon, mods, side) {
    for (const k in mods) {
      const before = mon.stages[k];
      mon.stages[k] = U.clamp(before + mods[k], -6, 6);
      const delta = mon.stages[k] - before;
      const label = { atk: "Attack", def: "Defense", spa: "Sp. Atk", spd: "Sp. Def", spe: "Speed", acc: "accuracy", eva: "evasiveness" }[k];
      let word;
      if (delta === 0) word = mods[k] > 0 ? `${mon.name}'s ${label} won't go higher!` : `${mon.name}'s ${label} won't go lower!`;
      else if (delta >= 2) word = `${mon.name}'s ${label} sharply rose!`;
      else if (delta === 1) word = `${mon.name}'s ${label} rose!`;
      else if (delta === -1) word = `${mon.name}'s ${label} fell!`;
      else word = `${mon.name}'s ${label} harshly fell!`;
      if (delta !== 0) ev.push({ t: "stat", side, up: delta > 0 });
      ev.push({ t: "text", s: word });
    }
  }

  _damage(atk, def, move, crit, eff) {
    const A = move.cat === "physical" ? atk.eff("atk") : atk.eff("spa");
    const D = move.cat === "physical" ? def.eff("def") : def.eff("spd");
    const lvl = atk.level;
    let base = Math.floor(Math.floor(Math.floor((2 * lvl) / 5 + 2) * move.power * A / D) / 50) + 2;
    let mod = 1;
    if (atk.types.includes(move.type)) mod *= 1.5;      // STAB
    mod *= eff;
    if (crit) mod *= 1.5;
    mod *= U.randf(0.85, 1.0);
    let dmg = Math.floor(base * mod);
    if (eff > 0 && dmg < 1) dmg = 1;
    return dmg;
  }

  /* ---------- end of turn: burn / poison ticks ---------- */
  _endOfTurn(ev) {
    for (const [mon, side] of [[this.active, "player"], [this.foe, "foe"]]) {
      if (mon.fainted) continue;
      if (mon.status === "brn" || mon.status === "psn") {
        const dmg = Math.max(1, Math.floor(mon.maxHp / (mon.status === "brn" ? 16 : 8)));
        mon.hp = Math.max(0, mon.hp - dmg);
        ev.push({ t: "text", s: `${mon.name} is hurt by its ${mon.status === "brn" ? "burn" : "poison"}!` });
        ev.push({ t: "hp", side, tick: mon.status });
      }
    }
    this._checkFaints(ev);
  }

  /* ---------- faint handling / win-loss ---------- */
  // returns true if a faint interrupted the turn (so callers stop)
  _checkFaints(ev) {
    if (this.over) return true;
    if (this.foe.fainted) {
      ev.push({ t: "faint", side: "foe" });
      ev.push({ t: "text", s: `${this.isWild ? "The wild " : "The foe's "}${this.foe.name} fainted!` });
      this._awardExp(ev);
      // trainer with more mons?
      if (this.trainer && this.foeIdx < this.trainer.party.length - 1) {
        this.foeIdx++;
        this.foe = this.trainer.party[this.foeIdx];
        this.foe.resetStages();
        ev.push({ t: "text", s: `${this.trainer.name} sent out ${this.foe.name}!` });
        ev.push({ t: "sendout", side: "foe" });
        return true;
      }
      this.over = true;
      this.result = "win";
      if (this.trainer) {
        ev.push({ t: "text", s: `You defeated ${this.trainer.name}!` });
        if (this.trainer.prize) ev.push({ t: "text", s: `You got ₽${this.trainer.prize} for winning!` });
      }
      ev.push({ t: "end", result: "win" });
      return true;
    }
    if (this.active.fainted) {
      ev.push({ t: "faint", side: "player" });
      ev.push({ t: "text", s: `${this.active.name} fainted!` });
      if (!this.alive) {
        this.over = true; this.result = "lose";
        ev.push({ t: "text", s: "You have no more Pokémon that can fight!" });
        ev.push({ t: "end", result: "lose" });
      } else {
        this.awaitSwitch = true;                        // UI will prompt a switch
        ev.push({ t: "faintSwitch" });
      }
      return true;
    }
    return false;
  }

  _awardExp(ev) {
    const base = this.foe.data.xp;
    // classic-ish: base * level / 7, wild gets no trainer bonus
    const gain = Math.max(1, Math.floor((base * this.foe.level) / 7 * (this.trainer ? 1.5 : 1)));
    const mon = this.active;
    if (mon.fainted) return;
    ev.push({ t: "text", s: `${mon.name} gained ${gain} EXP. Points!` });
    const before = mon.exp;
    const events = mon.gainExp(gain);
    ev.push({ t: "exp", from: before, to: mon.exp, mon });
    for (const e of events) {
      if (e.type === "level") ev.push({ t: "levelup", level: e.level, mon });
      else if (e.type === "move") ev.push({ t: "learn", move: e.move, mon });
      else if (e.type === "learnFull") ev.push({ t: "learnFull", move: e.move, mon });
      else if (e.type === "evolve") ev.push({ t: "evolve", to: e.to, mon });
    }
  }

  /* ---------- capture ---------- */
  _throwBall(ev, ball) {
    ev.push({ t: "text", s: `You threw a ${ball.name}!` });
    if (this.trainer) {
      ev.push({ t: "ball", shakes: 0, caught: false, block: true });
      ev.push({ t: "text", s: "The Trainer blocked the Ball! Don't be a thief!" });
      this._foeTurn(ev); this._endOfTurn(ev);
      return;
    }
    const shakes = this._captureShakes(BALLS[ball.id] ? BALLS[ball.id].bonus : (ball.bonus || 1));
    const caught = shakes >= 4;
    ev.push({ t: "ball", shakes, caught });
    if (caught) {
      ev.push({ t: "text", s: `Gotcha! ${this.foe.name} was caught!` });
      this.over = true; this.result = "caught";
      ev.push({ t: "end", result: "caught" });
    } else {
      const msg = ["Oh no! It broke free!", "Aww! So close!", "Aargh! Almost had it!", "Shoot! It was so close too!"][shakes];
      ev.push({ t: "text", s: msg });
      this._foeTurn(ev); this._endOfTurn(ev);
    }
  }

  _captureShakes(bonus) {
    const foe = this.foe;
    const status = foe.status;
    const statusBonus = (status === "slp" || status === "frz") ? 2 : (status ? 1.5 : 1);
    const rate = foe.data.catch;
    const a = ((3 * foe.maxHp - 2 * foe.hp) * rate * bonus * statusBonus) / (3 * foe.maxHp);
    if (a >= 255) return 4;
    const b = Math.floor(65536 / Math.pow(255 / a, 0.1875));
    let shakes = 0;
    for (let i = 0; i < 4; i++) { if (Math.floor(U.rng() * 65536) < b) shakes++; else break; }
    return shakes;
  }

  /* ---------- foe AI ---------- */
  _foeChoose() {
    const foe = this.foe, tgt = this.active;
    let best = 0, bestScore = -1;
    for (let i = 0; i < foe.moves.length; i++) {
      if (foe.pp[i] <= 0) continue;
      const mv = MOVES[foe.moves[i]];
      let score;
      if (mv.cat === "status") {
        score = U.randf(6, 22);                          // sometimes set up / inflict
      } else {
        const eff = TYPES.effective(mv.type, tgt.types);
        const stab = foe.types.includes(mv.type) ? 1.5 : 1;
        score = mv.power * eff * stab + U.randf(0, 14);
        if (eff === 0) score = 0;
      }
      if (score > bestScore) { bestScore = score; best = i; }
    }
    // a little unpredictability
    if (U.rng() < 0.15) {
      const usable = foe.moves.map((_, i) => i).filter(i => foe.pp[i] > 0);
      if (usable.length) best = U.choice(usable);
    }
    return best;
  }
}

if (typeof module !== "undefined" && module.exports) module.exports = { Battle, BALLS };
