/* ============================================================
   CLAUDERIM — combat.js
   The damage pipeline both directions: scaling, mitigation,
   block/parry/guard-break, dodge i-frames, poise & stagger,
   sneak attacks, status effects, spells, bow fire, Edicts,
   loot and ember rewards.
   ============================================================ */
"use strict";

const Combat = {

  /* ====================================================
     PLAYER OFFENSE
     ==================================================== */

  weaponDamage(p, w, heavy) {
    let dmg = w.dmg;
    // forge honing: +8% per tier
    const tier = (p.honing && p.honing[w.id]) || 0;
    if (tier) dmg *= 1 + tier * 0.08;
    // attribute scaling
    if (w.scale) {
      let bonus = 0;
      for (const attr in w.scale) {
        bonus += (SCALE_MULT[w.scale[attr]] || 0) * Math.max(0, (p.attrs[attr] || 8) - 8) * 0.035;
      }
      dmg *= 1 + bonus;
    }
    // skill scaling
    const sk = p.skills[w.skill];
    if (sk) dmg *= 1 + sk.lvl * 0.005;
    // perks
    if (w.skill === "onehand") {
      if (p.hasPerk("oh_1")) dmg *= 1.15;
      if (p.hasPerk("oh_4")) dmg *= 1.3 / 1.15;
    } else if (w.skill === "twohand") {
      if (p.hasPerk("th_1")) dmg *= 1.15;
      if (p.hasPerk("th_4")) dmg *= 1.3 / 1.15;
    } else if (w.skill === "archery") {
      if (p.hasPerk("ar_1")) dmg *= 1.15;
      if (p.hasPerk("ar_4")) dmg *= 1.3 / 1.15;
    }
    if (heavy) dmg *= 1.65;
    return dmg;
  },

  playerStrike(p, heavy) {
    const w = p.weapon();
    const reach = (w ? w.reach : 34) * (w && w.skill === "twohand" && p.hasPerk("th_2") ? 1.2 : 1) + p.r;
    const arc = w && w.skill === "twohand" ? 2.4 : 1.9;
    const baseDmg = w ? this.weaponDamage(p, w, heavy) : 4 + p.attrs.str * 0.5;
    let poiseDmg = (w ? w.poiseDmg : 6) * (heavy ? 1.8 : 1);
    if (w && w.skill === "twohand" && p.hasPerk("th_3")) poiseDmg *= 1.6;
    if (w && p.hasPerk("oh_4") && w.skill === "onehand" && heavy) poiseDmg *= 1.5;

    FX.slash(p.x + Math.cos(p.facing) * reach * 0.55, p.y + Math.sin(p.facing) * reach * 0.55,
      p.facing, "#e8e0c8", reach * 0.9);

    let hitAny = false;
    for (const e of G.entities) {
      if (!e.isEnemy || e.dead) continue;
      const d = U.dist(p.x, p.y, e.x, e.y);
      if (d > reach + e.r) continue;
      const ad = Math.abs(U.angDiff(p.facing, U.angTo(p.x, p.y, e.x, e.y)));
      if (ad > arc / 2 && d > p.r + e.r + 6) continue;

      hitAny = true;
      let dmg = baseDmg;
      let sneak = false, crit = false;

      // sneak attack: enemy unaware
      if (e.state === "idle" || e.state === "patrol" || e.state === "return") {
        sneak = true;
        let mult = (w && w.sneakMult) || 2;
        if (w && w.wclass === "dagger" && p.hasPerk("sn_2")) mult = 6;
        if (p.hasPerk("sn_4")) mult *= 1.5;
        dmg *= mult;
        p.gainSkill("sneak", 18);
      }
      // bleed perk
      const edmg = Object.assign({}, w && w.edmg);
      if (w && w.skill === "onehand" && !heavy && p.hasPerk("oh_2") && Math.random() < 0.2) edmg.bleed = 5;

      this.applyDamage(e, {
        amount: dmg, dtype: "phys", edmg, poiseDmg, sneak, crit,
        attacker: p, bonusVs: w && w.bonusVs,
      });
      if (w) p.gainSkill(w.skill, heavy ? 9 : 6);
      else p.gainSkill("onehand", 3);

      // knockback on heavy 2h with Avalanche
      if (heavy && w && w.skill === "twohand" && p.hasPerk("th_4")) {
        const ang = U.angTo(p.x, p.y, e.x, e.y);
        World.moveCircle(G.map, e, Math.cos(ang) * 30, Math.sin(ang) * 30);
      }
    }
    if (hitAny) {
      Sfx.play("hit_flesh");
      G.shake(heavy ? 4 : 2, 0.12);
      if (heavy) G.hitstop = Math.max(G.hitstop || 0, 0.05); // a beat of weight on heavy connects
    }
  },

  playerShoot(p, power) {
    const bow = p.bow();
    if (!bow) return;
    if (p.stam < 1) { Sfx.play("deny"); return; }
    p.spendStam(bow.stam);
    let dmg = this.weaponDamage(p, bow, false) * power;
    let crit = false;
    if (p.hasPerk("ar_4") && Math.random() < 0.15) { crit = true; dmg *= 2.5; }
    const ang = U.angTo(p.x, p.y, Input.worldX(), Input.worldY()) + (1 - power) * (Math.random() - 0.5) * 0.25;
    Projectile.spawn({
      x: p.x + Math.cos(ang) * 16, y: p.y + Math.sin(ang) * 16,
      ang, speed: 560 * (0.7 + power * 0.3), dmg, dtype: "phys",
      color: "#e8dcb8", from: "player", r: 4, life: 1.6,
      slow: (power >= 0.99 && p.hasPerk("ar_3")) ? 2 : 0,
      sneak: false, crit, spell: null,
    });
    Sfx.play("bow");
  },

  projectileHit(pr, e) {
    const p = G.player;
    let info = {
      amount: pr.dmg, dtype: pr.dtype, edmg: {}, poiseDmg: 10, attacker: p,
      sneak: (e.state === "idle" || e.state === "patrol") && pr.dtype === "phys",
      crit: pr.crit,
    };
    if (info.sneak) { info.amount *= 2; p.gainSkill("sneak", 10); }
    if (pr.slow) info.edmg.frost = 0.01; // pin
    this.applyDamage(e, info);
    if (pr.spell) {
      p.gainSkill("destruction", 5);
      if (pr.slow) e.status.frost = Math.max(e.status.frost || 0, pr.slow * (p.hasPerk("de_3") ? 2 : 1));
      if (pr.dtype === "fire") e.status.burn = Math.max(e.status.burn || 0, 3 * (p.hasPerk("de_3") ? 2 : 1));
    } else {
      p.gainSkill("archery", 6);
      if (pr.slow) { e.status.frost = Math.max(e.status.frost || 0, pr.slow); e.staggerT = Math.max(e.staggerT, 0.5); }
    }
    if (pr.radius > 0) this.explode(pr);
  },

  explode(pr) {
    FX.burst(pr.x, pr.y, pr.color, 26, 200);
    FX.ring(pr.x, pr.y, pr.radius, pr.color);
    G.shake(5, 0.2);
    Sfx.play("explode");
    if (pr.from === "player") {
      for (const e of G.entities) {
        if (!e.isEnemy || e.dead || pr.hitSet.has(e)) continue;
        if (U.dist(pr.x, pr.y, e.x, e.y) < pr.radius + e.r) {
          this.applyDamage(e, { amount: pr.dmg * 0.7, dtype: pr.dtype, edmg: {}, poiseDmg: 16, attacker: G.player });
        }
      }
    } else {
      const p = G.player;
      if (p && !p.dead && U.dist(pr.x, pr.y, p.x, p.y) < pr.radius + p.r) {
        this.damagePlayer({ amount: pr.dmg * 0.7, dtype: pr.dtype, source: null });
      }
    }
  },

  /* ---- damage an enemy ---- */
  applyDamage(e, info) {
    const def = e.def;

    // a Warden unengaged is a Warden unharmed — no sniping bosses through their gates
    if (def.boss && !e.engaged) {
      G.float(e.x, e.y - e.r - 14, "unmoved", "#8a8378", 13);
      return;
    }

    let dmg = info.amount;

    // physical mitigation
    if (info.dtype === "phys") {
      const armor = def.armor || 0;
      dmg *= 50 / (50 + armor * 2.5);
      const physRes = (def.resist && def.resist.phys) || 0;
      dmg *= 1 - physRes / 100;
    } else {
      const res = (def.resist && def.resist[info.dtype]) || 0;
      dmg *= 1 - res / 100;
    }
    // tag bonuses (silvered vs undead)
    if (info.bonusVs && def.tags && def.tags.includes(info.bonusVs)) dmg *= 1.3;

    // shield-bearing enemies block frontal hits sometimes
    if (def.canBlock && !info.sneak && info.attacker && Math.random() < def.canBlock &&
        Math.abs(U.angDiff(e.facing, U.angTo(e.x, e.y, info.attacker.x, info.attacker.y))) < 1.1 &&
        e.state !== "attack" && e.staggerT <= 0) {
      dmg *= 0.25;
      Sfx.play("block");
      G.float(e.x, e.y - e.r - 8, "Blocked", "#a8b0c0", 12);
    }

    // elemental riders
    if (info.edmg) {
      for (const t in info.edmg) {
        const res = (def.resist && def.resist[t]) || 0;
        if (res >= 100) continue;
        if (t === "fire") e.status.burn = Math.max(e.status.burn || 0, 3);
        else if (t === "frost") e.status.frost = Math.max(e.status.frost || 0, 2.5);
        else if (t === "poison") e.status.poison = Math.max(e.status.poison || 0, 5);
        else if (t === "bleed") e.status.bleed = Math.max(e.status.bleed || 0, 4);
        else if (t === "shock") dmg += info.edmg[t] * (1 - res / 100);
      }
    }

    dmg = Math.max(1, Math.round(dmg));
    e.hp -= dmg;
    e.flashT = 0.12;
    e.lastHitBy = info.attacker;
    FX.blood(e.x, e.y, info.attacker ? U.angTo(info.attacker.x, info.attacker.y, e.x, e.y) : 0,
      def.tags && def.tags.includes("spirit") ? 0 : 6);
    if (def.tags && def.tags.includes("spirit")) FX.burst(e.x, e.y, def.look.body, 8, 90);

    const col = info.sneak ? "#ffd34a" : info.crit ? "#ff9a3a" : "#fff";
    G.float(e.x + (Math.random() - 0.5) * 10, e.y - e.r - 10, String(dmg), col, info.sneak || info.crit ? 17 : 13);

    // poise
    e.poise -= info.poiseDmg || 8;
    if (e.poise <= 0 && !def.boss) {
      e.poise = e.poiseMax;
      e.staggerT = Math.max(e.staggerT, 0.65);
      Sfx.play("stagger");
    } else if (e.poise <= 0 && def.boss) {
      e.poise = e.poiseMax;
      e.staggerT = Math.max(e.staggerT, 1.1);
      G.float(e.x, e.y - e.r - 24, "STAGGERED", "#ffd34a", 15);
      Sfx.play("stagger");
    }

    if (!def.boss) e.enterChase();

    if (e.hp <= 0) this.killEnemy(e);
  },

  killEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    const def = e.def;
    const p = G.player;
    Sfx.play("die_" + (def.voice || "growl"));
    FX.burst(e.x, e.y, def.look.body, 18, 140);
    G.corpsePile.push({ x: e.x, y: e.y, look: def.look, t: 0, facing: e.facing });
    if (e.encIdx !== undefined && G.map.encounters.length) G.map.encDead[e.encIdx] = true;

    if (p && !p.dead) {
      p.statsKills++;
      p.gainEmbers(Math.round((def.embers || 0) * (e.elite ? 3 : 1)));
      if (e.elite) G.msg(`The ashen ${def.name} crumbles.`, "ember");
      // loot: one weighted roll
      if (def.loot && def.loot.length) {
        const roll = U.weighted(Math.random, def.loot);
        if (roll.gold) {
          const g = U.randi(Math.random, roll.gold[0], roll.gold[1]);
          p.gold += g;
          G.msg(`Looted ${g} gold`, "");
        } else if (roll.id) {
          const n = roll.n ? U.randi(Math.random, roll.n[0], roll.n[1]) : 1;
          p.addItem(roll.id, n);
          G.msg(`Looted ${ITEMS[roll.id].name}${n > 1 ? " ×" + n : ""}`, "");
        }
      }
      // named foes carry guaranteed spoils
      if (def.drops && !def.boss) {
        for (const pair of def.drops) {
          if (def.dropsOnce && (p.hasItem(pair[0]) || G.flags["dropped_" + pair[0]])) continue;
          G.flags["dropped_" + pair[0]] = true;
          p.addItem(pair[0], pair[1]);
          G.msg(`Obtained ${ITEMS[pair[0]].name}`, "good");
        }
      }
      QS.onKill(def.id);
    }

    if (def.boss) this.bossFelled(e);
  },

  bossFelled(e) {
    const def = e.def;
    const p = G.player;
    G.bossFight = null;
    G.slainBosses[def.id] = true;
    UI.hideBossBar();
    Music.setMood(G.map.outdoor ? "world" : "dungeon");
    G.shake(10, 0.6);
    G.hitstop = Math.max(G.hitstop || 0, 0.22);
    G.banner(def.mini ? "FOE VANQUISHED" : "WARDEN FELLED", def.name + (def.title ? ", " + def.title : ""));
    Sfx.play("victory");

    if (p && !p.dead) {
      for (const pair of def.drops || []) {
        p.addItem(pair[0], pair[1]);
        G.msg(`Obtained ${ITEMS[pair[0]].name}`, "good");
      }
      if (def.grantsEdict) p.learnEdict(def.grantsEdict);
      QS.onBoss(def.id);
    }
  },

  /* ====================================================
     ENEMY OFFENSE → PLAYER DEFENSE
     ==================================================== */

  enemyHitPlayer(e, mult, dtypeOverride) {
    const p = G.player;
    if (!p || p.dead) return;
    const def = e.def;
    const d = U.dist(e.x, e.y, p.x, p.y);
    if (d > def.reach + p.r + 26) return;

    this.damagePlayer({
      amount: def.dmg * (mult || 1) * (e.dmgMult || 1),
      dtype: dtypeOverride || "phys",
      edmg: def.edmg,
      poiseDmg: def.poiseDmg,
      source: e,
    });
  },

  projectileHitPlayer(pr) {
    this.damagePlayer({ amount: pr.dmg, dtype: pr.dtype, source: null, projAng: Math.atan2(pr.vy, pr.vx) });
  },

  damagePlayer(info) {
    const p = G.player;
    if (!p || p.dead) return;

    // dodge i-frames
    if (p.iframes > 0 && !info.undodgeable) {
      G.float(p.x, p.y - 22, "dodged", "#b9d8a0", 12);
      return;
    }

    let dmg = info.amount;
    const srcAng = info.source ? U.angTo(p.x, p.y, info.source.x, info.source.y)
      : info.projAng !== undefined ? info.projAng + Math.PI : p.facing;

    // block / parry (frontal only)
    const facingSrc = Math.abs(U.angDiff(p.facing, srcAng)) < 1.0;
    if (p.blocking && facingSrc && !info.unblockable) {
      const sh = p.shield();
      const parryWindow = 0.18 * (p.hasPerk("bl_2") ? 1.5 : 1);
      if (p.blockT < parryWindow && info.source && !info.source.def.boss) {
        // PARRY
        info.source.staggerT = 1.6;
        info.source.poise = info.source.poiseMax;
        Sfx.play("parry");
        G.shake(4, 0.15);
        G.hitstop = Math.max(G.hitstop || 0, 0.09);
        FX.burst(p.x + Math.cos(srcAng) * 18, p.y + Math.sin(srcAng) * 18, "#ffe9a8", 18, 180);
        G.float(p.x, p.y - 26, "PARRY", "#ffe9a8", 16);
        p.gainSkill("block", 14);
        return;
      }
      let absorb = sh.block / 100;
      if (p.hasPerk("bl_1")) absorb = Math.min(0.97, absorb * 1.15);
      const stamCost = dmg * (1.4 - sh.stability / 100) * (p.hasPerk("bl_3") ? 0.7 : 1);
      if (p.stam >= stamCost) {
        p.spendStam(stamCost);
        dmg *= 1 - absorb;
        Sfx.play("block");
        FX.burst(p.x + Math.cos(srcAng) * 14, p.y + Math.sin(srcAng) * 14, "#cbb78a", 8, 100);
        p.gainSkill("block", 8);
      } else {
        // guard break
        p.spendStam(p.stam);
        if (p.hasPerk("bl_4")) {
          dmg *= 1 - absorb * 0.5;
          Sfx.play("block");
        } else {
          p.blocking = false;
          p.staggerT = 0.8;
          Sfx.play("guardbreak");
          G.float(p.x, p.y - 26, "GUARD BROKEN", "#d89090", 14);
        }
      }
    }

    // ward buff drinks spell damage
    if (p.buffs.ward && info.dtype !== "phys") {
      dmg *= 1 - p.buffs.ward.spellShield / 100;
    }

    // mitigation
    if (info.dtype === "phys") {
      dmg *= 80 / (80 + p.armorTotal());
      p.gainSkill(p.armorKindCount("heavy") >= 2 ? "heavyarmor" : "lightarmor", 5);
    } else {
      dmg *= 1 - p.resist(info.dtype) / 100;
    }

    // status riders
    if (info.edmg) {
      for (const t in info.edmg) {
        if (t === "poison" && Math.random() < 0.7) p.status.poison = Math.max(p.status.poison || 0, 5);
        if (t === "fire") p.status.burn = Math.max(p.status.burn || 0, 2.5);
        if (t === "frost") p.status.frost = Math.max(p.status.frost || 0, 2);
        if (t === "shock") dmg += info.edmg[t] * (1 - p.resist("shock") / 100);
      }
    }

    dmg = Math.max(1, Math.round(dmg));
    p.hp -= dmg;
    p.flashT = 0.15;
    G.shake(Math.min(8, 2 + dmg * 0.12), 0.2);
    Sfx.play("hurt");
    FX.blood(p.x, p.y, srcAng + Math.PI, 7);
    G.float(p.x, p.y - 24, String(dmg), "#ff6a5a", 14);

    // poise
    p.poise -= info.poiseDmg || 8;
    if (p.poise <= 0) {
      p.poise = p.poiseTotal();
      const small = (info.poiseDmg || 8) < 25;
      if (!(small && p.hasPerk("ha_4") && p.armorKindCount("heavy") >= 2)) {
        p.staggerT = Math.max(p.staggerT, 0.55);
        p.atk = null; p.cast = null; p.draw = null;
        G.slowmoAim = false;
      }
    }

    if (p.hp <= 0) {
      // Undimmed: cheat death once per rest
      if (p.hasPerk("re_4") && !p.undimmedUsed) {
        p.undimmedUsed = true;
        p.hp = 1;
        p.iframes = 1.2;
        G.msg("The old light refuses to release you. (Undimmed)", "good");
        FX.burst(p.x, p.y, "#ffe9a8", 30, 220);
        return;
      }
      p.hp = 0;
      G.onPlayerDeath();
    }
  },

  /* ====================================================
     STATUS EFFECTS (shared)
     ==================================================== */

  tickStatus(ent, dt) {
    const s = ent.status;
    if (!s) return;
    const isPlayer = ent === G.player;
    const hurt = (amt, col) => {
      if (isPlayer) {
        ent.hp -= amt * dt;
        if (ent.hp <= 0) { ent.hp = 0; G.onPlayerDeath(); }
      } else {
        ent.hp -= amt * dt;
        if (ent.hp <= 0 && !ent.dead) this.killEnemy(ent);
      }
      if (Math.random() < 6 * dt) FX.sparkle(ent.x, ent.y - 6, col);
    };
    if (s.burn > 0) { s.burn -= dt; hurt(6, "#ff8c3a"); }
    if (s.poison > 0) { s.poison -= dt; hurt(4, "#9be09b"); }
    if (s.bleed > 0) { s.bleed -= dt; hurt(5, "#c0392b"); }
    if (s.frost > 0) { s.frost -= dt; if (Math.random() < 3 * dt) FX.sparkle(ent.x, ent.y - 6, "#bfeaff"); }
  },

  /* ====================================================
     SPELLCASTING
     ==================================================== */

  spellCost(p, sp) {
    let c = sp.cost;
    if (sp.school === "destruction" && p.hasPerk("de_2")) c *= 0.75;
    if (sp.school === "restoration" && p.hasPerk("re_2")) c *= 0.75;
    return Math.round(c);
  },

  beginCast(p, spellId) {
    if (p.atk || p.cast || p.rollT > 0 || p.draw) return;
    const sp = SPELLS[spellId];
    const cost = this.spellCost(p, sp);
    if (p.mag < cost) { G.msg("Not enough magicka.", "bad"); Sfx.play("deny"); return; }
    p.blocking = false;
    p.cast = { spell: spellId, t: sp.cast };
    Sfx.play("cast_charge");
  },

  finishCast(p, spellId) {
    const sp = SPELLS[spellId];
    const cost = this.spellCost(p, sp);
    if (p.mag < cost) return;
    p.mag -= cost;
    p.gainSkill(sp.skill, 10);
    Sfx.play("cast");

    const power = this.spellPower(p, sp);

    if (sp.kind === "bolt") {
      const ang = U.angTo(p.x, p.y, Input.worldX(), Input.worldY());
      Projectile.spawn({
        x: p.x + Math.cos(ang) * 16, y: p.y + Math.sin(ang) * 16,
        ang, speed: sp.speed, dmg: sp.dmg * power, dtype: sp.dtype,
        color: sp.color, from: "player",
        radius: sp.radius * (p.hasPerk("de_4") ? 1 : 1) + (p.hasPerk("de_4") && !sp.radius ? 36 : 0),
        pierce: sp.pierce, slow: sp.slow || 0, spell: spellId, r: 6,
      });
    } else if (sp.kind === "nova") {
      FX.ring(p.x, p.y, sp.radius, sp.color);
      G.shake(4, 0.2);
      for (const e of G.entities) {
        if (!e.isEnemy || e.dead) continue;
        if (U.dist(p.x, p.y, e.x, e.y) < sp.radius + e.r) {
          const info = { amount: sp.dmg * power, dtype: sp.dtype, edmg: {}, poiseDmg: 14, attacker: p };
          this.applyDamage(e, info);
          if (sp.slow) e.status.frost = Math.max(e.status.frost || 0, sp.slow * (p.hasPerk("de_3") ? 2 : 1));
        }
      }
      p.gainSkill("destruction", 4);
    } else if (sp.kind === "self") {
      if (sp.heal) {
        p.heal(sp.heal * power);
        if (p.hasPerk("re_3")) p.stam = Math.min(p.stamMax, p.stam + 20);
      }
      if (sp.cure) for (const c of sp.cure) delete p.status[c];
      if (sp.buff) p.buffs[sp.buff.id] = Object.assign({ t: sp.buff.dur }, sp.buff);
      FX.burst(p.x, p.y, sp.color, 16, 90);
    }
  },

  spellPower(p, sp) {
    let pow = 1 + Math.max(0, p.attrs.wil - 8) * 0.045;
    const w = p.weapon();
    if (w && w.spellPower) pow *= w.spellPower;
    const sk = p.skills[sp.skill];
    if (sk) pow *= 1 + sk.lvl * 0.004;
    if (sp.school === "destruction" && p.hasPerk("de_1")) pow *= 1.15;
    if (sp.school === "destruction" && p.hasPerk("de_4")) pow *= 1.3 / 1.15;
    return pow;
  },

  /* ====================================================
     EDICTS — words of the Old Tongue
     ==================================================== */

  useEdict(p, edictId) {
    const e = EDICTS[edictId];
    if ((p.edictCds[edictId] || 0) > 0) {
      G.msg(`${e.name.split(" — ")[0]} is still echoing (${Math.ceil(p.edictCds[edictId])}s)`, "bad");
      return;
    }
    if (p.atk || p.cast || p.rollT > 0) return;
    p.edictCds[edictId] = e.cooldown * (p.hasPerk("sp_4") ? 0.8 : 1);
    Sfx.play("edict");
    G.shake(7, 0.4);
    G.float(p.x, p.y - 34, e.name.split(" — ")[0], e.color, 26);

    switch (e.kind) {
      case "force": { // VAL
        FX.ring(p.x, p.y, e.range, e.color);
        for (const en of G.entities) {
          if (!en.isEnemy || en.dead) continue;
          const d = U.dist(p.x, p.y, en.x, en.y);
          if (d > e.range + en.r) continue;
          const ad = Math.abs(U.angDiff(p.facing, U.angTo(p.x, p.y, en.x, en.y)));
          if (ad > e.arc) continue;
          const ang = U.angTo(p.x, p.y, en.x, en.y);
          const push = e.knock * (1 - d / (e.range + en.r));
          World.moveCircle(G.map, en, Math.cos(ang) * push * 0.25, Math.sin(ang) * push * 0.25);
          en.staggerT = Math.max(en.staggerT, en.def.boss ? 0.6 : 1.4);
          this.applyDamage(en, { amount: e.dmg, dtype: "phys", poiseDmg: 100, attacker: p });
        }
        break;
      }
      case "drain": { // SUTH
        FX.ring(p.x, p.y, e.range, e.color);
        let drained = 0;
        for (const en of G.entities) {
          if (!en.isEnemy || en.dead) continue;
          if (U.dist(p.x, p.y, en.x, en.y) > e.range + en.r) continue;
          this.applyDamage(en, { amount: e.dmg, dtype: "poison", poiseDmg: 10, attacker: p });
          drained += e.dmg * e.heal;
        }
        if (drained > 0) { p.heal(drained); G.float(p.x, p.y - 50, "+" + Math.round(drained), "#9be09b", 14); }
        break;
      }
      case "time": { // KYR
        G.slowmo = e.dur;
        Sfx.play("kyr");
        break;
      }
      case "breath": { // THUR
        for (const en of G.entities) {
          if (!en.isEnemy || en.dead) continue;
          const d = U.dist(p.x, p.y, en.x, en.y);
          if (d > e.range + en.r) continue;
          const ad = Math.abs(U.angDiff(p.facing, U.angTo(p.x, p.y, en.x, en.y)));
          if (ad > e.arc) continue;
          this.applyDamage(en, { amount: e.dmg, dtype: "fire", edmg: { fire: 1 }, poiseDmg: 30, attacker: p });
          en.status.burn = Math.max(en.status.burn || 0, e.burn);
        }
        FX.cone(p.x, p.y, p.facing, e.range, e.arc, "#ff7a2a");
        FX.cone(p.x, p.y, p.facing, e.range * 0.7, e.arc, "#ffd34a");
        break;
      }
    }
  },
};
