/* ============================================================
   CLAUDERIM — entities.js
   Entity base class, enemy AI (patrol / chase / telegraphed
   attacks / poise & stagger), boss pattern engine, NPCs,
   projectiles, ground hazards and the particle system.
   ============================================================ */
"use strict";

/* ---------------- base ---------------- */

class Entity {
  constructor(x, y, r) {
    this.x = x; this.y = y; this.r = r;
    this.facing = 0;
    this.hp = 1; this.hpMax = 1;
    this.dead = false;
    this.flashT = 0;       // white hit-flash
    this.staggerT = 0;
    this.bobT = Math.random() * TAU;
  }
  update(dt) {}
  get isEnemy() { return false; }
}

/* ---------------- enemy ---------------- */

class Enemy extends Entity {
  constructor(typeId, x, y, encIdx) {
    const def = ENEMY_TYPES[typeId];
    super(x, y, def.r);
    this.def = def;
    this.encIdx = encIdx; // interior encounter key (for respawn bookkeeping)
    this.hp = this.hpMax = def.hp;
    this.poiseMax = def.poise;
    this.poise = def.poise;
    this.homeX = x; this.homeY = y;
    this.state = "idle";
    this.stateT = 0;
    this.attackCd = 0;
    this.wanderT = U.randf(Math.random, 0, 2);
    this.wanderAng = Math.random() * TAU;
    this.projCd = U.randf(Math.random, 0.5, 2);
    this.summons = [];
    this.status = {};        // burn/poison/frost/bleed timers
    this.aware = 0;          // detection meter 0..1
    this.spdMult = 1;
    this.engaged = false;    // boss engaged
    this.patternCds = {};
    this.phase = 1;
    this.activePattern = null;
    this.blocking = false;
    this.lastHitBy = null;
    this.elite = false;
    this.dmgMult = 1;
    this.emberMult = 1;
    // deeper cycles breed harder foes (wildlife is spared)
    const cyc = G.cycle || 0;
    if (cyc > 0 && !(def.tags && def.tags.includes("critter"))) {
      this.hpMax = Math.round(this.hpMax * (1 + 0.5 * cyc));
      this.hp = this.hpMax;
      this.dmgMult *= 1 + 0.3 * cyc;
      this.poiseMax = Math.round(this.poiseMax * (1 + 0.2 * cyc));
      this.poise = this.poiseMax;
      this.emberMult = 1 + 0.6 * cyc;
    }
  }

  get isEnemy() { return true; }

  /* ashen elite: rarer, meaner, brighter, richer */
  makeElite() {
    this.elite = true;
    this.hpMax = Math.round(this.hpMax * 1.7);
    this.hp = this.hpMax;
    this.dmgMult = 1.4;
    this.poiseMax = Math.round(this.poiseMax * 1.5);
    this.poise = this.poiseMax;
  }

  effSpd() {
    let s = this.def.spd * this.spdMult;
    if (this.status.frost > 0) s *= 0.55;
    if (G.slowmo > 0) s *= EDICTS.kyr.factor;
    return s;
  }

  update(dt) {
    if (this.dead) return;
    const def = this.def;
    const p = G.player;
    this.flashT = Math.max(0, this.flashT - dt);
    this.attackCd = Math.max(0, this.attackCd - dt);
    const tdt = (G.slowmo > 0) ? dt * EDICTS.kyr.factor : dt;

    // status effects
    Combat.tickStatus(this, dt);
    if (def.regen && this.state !== "dead" && this.hp < this.hpMax && !this.status.burn) {
      this.hp = Math.min(this.hpMax, this.hp + def.regen * dt);
    }
    // poise regen
    if (this.staggerT <= 0) this.poise = Math.min(this.poiseMax, this.poise + this.poiseMax * 0.25 * dt);

    if (this.staggerT > 0) {
      this.staggerT -= dt;
      this.activePattern = null;
      this.attackPhase = null;
      return;
    }

    if (def.boss) { this.updateBoss(tdt, dt); return; }

    const distP = p && !p.dead ? U.dist(this.x, this.y, p.x, p.y) : Infinity;

    /* ---- detection ---- */
    if (this.state === "idle" || this.state === "patrol") {
      let range = def.aggro * (p && p.crouched ? 0.42 : 1);
      if (G.map.outdoor) range *= U.lerp(1, 0.62, G.darkness());
      if (p) {
        range *= Math.max(0.35, 1 - (p.skills.sneak.lvl * 0.004 + p.sneakBonus() * 0.01) * (p.crouched ? 1 : 0.2));
        // sneak perks: stack BELOW the floor above for true invisibility builds
        if (p.crouched && p.hasPerk("sn_1")) range *= 0.6;        // Soft Step
        if (p.hasPerk("sn_3") && p.crouched && !p.moving &&
            (!G.map.outdoor || G.darkness() > 0.45)) range *= 0.3; // Dusk Sibling
        // armor noise: plate gives you away, leathers hush
        if (p.armorKindCount("heavy") >= 2) range *= 1.2;
        else if (p.armorKindCount("light") >= 2) range *= 0.9;
        // approaching from behind is much harder to notice
        const behind = Math.abs(U.angDiff(this.facing, U.angTo(this.x, this.y, p.x, p.y))) > 1.7;
        if (behind) range *= 0.55;
      }
      if (distP < range) {
        this.aware += dt * (p.crouched ? 1.2 : 4) * U.clamp(1 - distP / Math.max(1, range), 0.15, 1) * 2;
        if (this.aware >= 1) {
          if (def.behavior === "flee") this.enterFlee();
          else this.enterChase();
        }
      } else {
        this.aware = Math.max(0, this.aware - dt * 0.5);
      }
    }

    switch (this.state) {
      case "idle":
      case "patrol": {
        this.wanderT -= tdt;
        if (this.wanderT <= 0) {
          this.wanderT = U.randf(Math.random, 1.5, 4);
          this.wanderAng = Math.random() * TAU;
          this.state = this.state === "idle" ? "patrol" : "idle";
        }
        if (this.state === "patrol") {
          const sp = this.effSpd() * 0.35 * tdt;
          // drift back toward home
          const toHome = U.angTo(this.x, this.y, this.homeX, this.homeY);
          const distH = U.dist(this.x, this.y, this.homeX, this.homeY);
          const ang = distH > 120 ? toHome : this.wanderAng;
          World.moveCircle(G.map, this, Math.cos(ang) * sp, Math.sin(ang) * sp);
          this.facing = ang;
        }
        break;
      }

      case "flee": {
        if (!p || p.dead || distP > def.deaggro) { this.state = "idle"; this.aware = 0; break; }
        const away = U.angTo(p.x, p.y, this.x, this.y) + Math.sin(G.elapsed * 3 + this.bobT) * 0.4;
        const walked = World.steerMove(G.map, this, away, this.effSpd() * tdt);
        if (walked !== null) this.facing = walked;
        break;
      }

      case "chase": {
        if (!p || p.dead) { this.state = "return"; break; }
        if (distP > def.deaggro) { this.state = "return"; break; }
        this.facing = U.angTo(this.x, this.y, p.x, p.y);

        const b = def.behavior;
        if (b === "archer" || b === "caster") {
          // keep mid distance, fire — only with a clear line of sight
          const want = 200;
          const sp = this.effSpd() * tdt;
          const sees = World.lineClear(G.map, this.x, this.y, p.x, p.y);
          if (!sees || distP > want + 40) World.steerMove(G.map, this, this.facing, sp);
          else if (distP < want - 60) World.steerMove(G.map, this, this.facing + Math.PI, sp * 0.7);
          else {
            // strafe
            const sa = this.facing + Math.PI / 2 * (this.strafeDir || (this.strafeDir = Math.random() < 0.5 ? 1 : -1));
            if (!World.moveCircle(G.map, this, Math.cos(sa) * sp * 0.4, Math.sin(sa) * sp * 0.4)) this.strafeDir *= -1;
          }
          this.projCd -= dt;
          if (this.projCd <= 0 && distP < 420 && sees) {
            this.startAttack("shoot");
          }
        } else {
          const sp = this.effSpd() * tdt;
          if (distP > def.reach * 0.75 + p.r) {
            World.steerMove(G.map, this, this.facing, sp);
          }
          if (distP < def.reach + p.r + (b === "lunger" ? 30 : 4) && this.attackCd <= 0) {
            this.startAttack("melee");
          }
        }
        break;
      }

      case "attack": {
        this.stateT -= tdt * (this.status.frost > 0 ? 0.62 : 1); // KYR's stillness + a chill in the limbs both slow the blow
        const def2 = this.def;
        if (this.attackPhase === "wind" && this.stateT <= 0) {
          this.attackPhase = "strike";
          this.stateT = def2.strike;
          this.resolveStrike();
        } else if (this.attackPhase === "strike" && this.stateT <= 0) {
          this.attackPhase = "rec";
          this.stateT = def2.recover;
        } else if (this.attackPhase === "rec" && this.stateT <= 0) {
          this.attackPhase = null;
          this.state = "chase";
          this.attackCd = U.randf(Math.random, 0.3, 0.9);
        }
        // lungers dash during strike
        if (this.attackPhase === "strike" && this.lunge) {
          const sp = this.effSpd() * 2.6 * dt;
          World.moveCircle(G.map, this, Math.cos(this.facing) * sp, Math.sin(this.facing) * sp);
          if (p && !p.dead && !this.lungeHit && U.dist(this.x, this.y, p.x, p.y) < this.r + p.r + 10) {
            this.lungeHit = true;
            Combat.enemyHitPlayer(this, 1);
          }
        }
        break;
      }

      case "return": {
        const distH = U.dist(this.x, this.y, this.homeX, this.homeY);
        if (distH < 30) { this.state = "idle"; this.aware = 0; this.hp = Math.min(this.hpMax, this.hp + this.hpMax * 0.02); break; }
        const ang = U.angTo(this.x, this.y, this.homeX, this.homeY);
        this.facing = ang;
        World.steerMove(G.map, this, ang, this.effSpd() * 0.8 * tdt);
        this.hp = Math.min(this.hpMax, this.hp + this.hpMax * 0.1 * dt);
        // re-aggro if player gets close again
        if (p && !p.dead && U.dist(this.x, this.y, p.x, p.y) < def.aggro * 0.5) this.enterChase();
        break;
      }
    }

    // separation from other enemies
    for (const o of G.entities) {
      if (o === this || !o.isEnemy || o.dead) continue;
      const d2 = U.dist2(this.x, this.y, o.x, o.y);
      const min = (this.r + o.r) * 0.9;
      if (d2 < min * min && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (min - d) * 0.5;
        const ang = U.angTo(o.x, o.y, this.x, this.y);
        World.moveCircle(G.map, this, Math.cos(ang) * push, Math.sin(ang) * push);
      }
    }
  }

  enterChase() {
    if (this.def.behavior === "flee") { this.enterFlee(); return; }
    if (this.state === "chase" || this.state === "attack") return;
    this.state = "chase";
    this.aware = 1;
    Sfx.play(this.def.voice || "growl");
  }

  enterFlee() {
    if (this.state === "flee") return;
    this.state = "flee";
    this.aware = 1;
  }

  startAttack(mode) {
    const def = this.def;
    this.state = "attack";
    this.attackPhase = "wind";
    this.stateT = def.windup;
    this.lunge = (def.behavior === "lunger" && mode === "melee");
    this.lungeHit = false;
    this.shootMode = (mode === "shoot");
    // chance to raise shield while winding (visual + handled in Combat)
    this.blocking = false;
  }

  resolveStrike() {
    const p = G.player;
    if (this.shootMode) {
      const def = this.def;
      this.projCd = def.proj.cd * U.randf(Math.random, 0.9, 1.3);
      if (!p || p.dead) return;
      const ang = U.angTo(this.x, this.y, p.x, p.y) + U.randf(Math.random, -0.06, 0.06);
      Projectile.spawn({
        x: this.x + Math.cos(ang) * (this.r + 6), y: this.y + Math.sin(ang) * (this.r + 6),
        ang, speed: def.proj.speed, dmg: def.proj.dmg, dtype: def.proj.dtype,
        color: def.proj.color, from: "enemy", radius: 0,
      });
      Sfx.play("cast");
      return;
    }
    if (this.lunge) return; // handled during dash
    Combat.enemyHitPlayer(this, 1);
  }

  /* ---------- boss brain ---------- */

  updateBoss(tdt, dt) {
    const p = G.player;
    const def = this.def;

    if (!this.engaged) {
      // dormant until the player steps into the arena
      if (p && !p.dead && G.map.bossArena && G.map.bossArena.boss === def.id &&
          World.inArena(G.map, p.x, p.y, -10)) {
        this.engaged = true;
        G.bossFight = this;
        G.tip("boss", "A Warden bars the way, and it will not bleed until you commit. The seal closes behind you.");
        UI.showBossBar(def);
        Music.setMood("boss");
        G.banner(def.intro || def.name.toUpperCase());
        Sfx.play(def.voice || "roar");
      }
      return;
    }
    if (!p || p.dead) return;

    // phase transition
    if (this.phase === 1 && def.phase2 && this.hp / this.hpMax <= def.phase2.at) {
      this.phase = 2;
      this.spdMult = def.phase2.spdMult || 1;
      G.msg(def.phase2.announce, "bad");
      G.shake(8, 0.5);
      FX.burst(this.x, this.y, def.look.trim, 40, 240);
      Sfx.play("roar");
    }

    const distP = U.dist(this.x, this.y, p.x, p.y);
    this.facing = U.angApproach(this.facing, U.angTo(this.x, this.y, p.x, p.y), 4 * dt);

    for (const k in this.patternCds) this.patternCds[k] = Math.max(0, this.patternCds[k] - dt);

    if (this.activePattern) { this.runPattern(tdt, dt); return; }

    // movement when no pattern: close in
    if (distP > def.reach * 0.7 + p.r) {
      World.steerMove(G.map, this, this.facing, this.effSpd() * tdt);
    }

    // choose a pattern
    let pats = def.patterns.slice();
    if (this.phase === 2 && def.phase2 && def.phase2.addPatterns) pats = pats.concat(def.phase2.addPatterns);
    const usable = pats.filter((pt, i) => {
      const key = pt.kind + i;
      pt._key = key;
      if ((this.patternCds[key] || 0) > 0) return false;
      if (pt.kind === "swing" && distP > (pt.range || 90) + p.r + 20) return false;
      if (pt.kind === "charge" && distP < (pt.minRange || 120)) return false;
      if (pt.kind === "summon") {
        this.summons = this.summons.filter(s => !s.dead);
        if (this.summons.length >= (pt.max || 3)) return false;
      }
      return true;
    });
    if (!usable.length) return;
    const pt = usable[(Math.random() * usable.length) | 0];
    this.activePattern = { def: pt, t: 0, phase: "wind", windT: def.windup * (pt.kind === "slam" || pt.kind === "breath" ? 1.6 : 1) };
    this.patternCds[pt._key] = pt.cd * U.randf(Math.random, 0.85, 1.2);
  }

  runPattern(tdt, dt) {
    const ap = this.activePattern, pt = ap.def, def = this.def, p = G.player;
    ap.t += tdt; // KYR stretches even a king's tempo

    if (ap.phase === "wind") {
      this.attackPhase = "wind"; // reuse telegraph visuals
      if (ap.t >= ap.windT) {
        ap.phase = "act"; ap.t = 0;
        this.executePattern(pt);
      }
      return;
    }
    if (ap.phase === "act") {
      this.attackPhase = "strike";
      // charge moves over time
      if (pt.kind === "charge") {
        const sp = this.effSpd() * 3.4 * tdt;
        World.moveCircle(G.map, this, Math.cos(this.facing) * sp, Math.sin(this.facing) * sp);
        if (p && !p.dead && !ap.hit && U.dist(this.x, this.y, p.x, p.y) < this.r + p.r + 14) {
          ap.hit = true;
          Combat.enemyHitPlayer(this, pt.dmgMult || 1.3);
          G.shake(6, 0.3);
        }
        if (ap.t > 0.7) { ap.phase = "rec"; ap.t = 0; }
        return;
      }
      if (pt.kind === "breath") {
        // damage ticks in a cone
        ap.tick = (ap.tick || 0) - dt;
        if (ap.tick <= 0) {
          ap.tick = 0.18;
          FX.cone(this.x, this.y, this.facing, pt.range, pt.arc, pt.dtype === "frost" ? "#bfeaff" : "#ff7a2a");
          if (p && !p.dead) {
            const d = U.dist(this.x, this.y, p.x, p.y);
            const ad = Math.abs(U.angDiff(this.facing, U.angTo(this.x, this.y, p.x, p.y)));
            if (d < pt.range + p.r && ad < pt.arc / 2) {
              Combat.enemyHitPlayer(this, 0.32, pt.dtype || def.edmg && Object.keys(def.edmg)[0]);
            }
          }
          Sfx.play("breath");
        }
        if (ap.t > 1.6) { ap.phase = "rec"; ap.t = 0; }
        return;
      }
      // instantaneous kinds resolve in executePattern; brief act window
      if (ap.t > 0.25) { ap.phase = "rec"; ap.t = 0; }
      return;
    }
    // recover
    this.attackPhase = "rec";
    if (ap.t > def.recover) {
      this.activePattern = null;
      this.attackPhase = null;
    }
  }

  executePattern(pt) {
    const p = G.player, def = this.def;
    switch (pt.kind) {
      case "swing": {
        if (p && !p.dead) {
          const d = U.dist(this.x, this.y, p.x, p.y);
          const ad = Math.abs(U.angDiff(this.facing, U.angTo(this.x, this.y, p.x, p.y)));
          if (d < (pt.range || def.reach) + p.r + 10 && ad < 1.5) {
            Combat.enemyHitPlayer(this, pt.dmgMult || 1);
          }
        }
        FX.slash(this.x + Math.cos(this.facing) * this.r, this.y + Math.sin(this.facing) * this.r, this.facing, def.look.trim, this.def.reach);
        Sfx.play("swing_heavy");
        break;
      }
      case "slam": {
        G.shake(10, 0.4);
        Sfx.play("slam");
        FX.ring(this.x, this.y, pt.radius, pt.dtype === "fire" ? "#ff7a2a" : pt.dtype === "shock" ? "#cfe0ff" : "#cbb78a");
        if (p && !p.dead && U.dist(this.x, this.y, p.x, p.y) < pt.radius + p.r) {
          Combat.enemyHitPlayer(this, pt.dmgMult || 1.4, pt.dtype);
        }
        if (pt.leaves) {
          G.entities.push(new Hazard(this.x, this.y, pt.radius * 0.85, pt.leaves));
        }
        break;
      }
      case "volley": {
        const n = pt.count || 6;
        Sfx.play("cast");
        for (let i = 0; i < n; i++) {
          let ang;
          if (pt.aimed && p) {
            ang = U.angTo(this.x, this.y, p.x, p.y) + (i - (n - 1) / 2) * ((pt.proj.arcSpread || 0.4) / Math.max(1, n - 1)) * 2;
          } else {
            ang = (TAU / n) * i + Math.random() * 0.2;
          }
          Projectile.spawn({
            x: this.x + Math.cos(ang) * (this.r + 8), y: this.y + Math.sin(ang) * (this.r + 8),
            ang, speed: pt.proj.speed, dmg: pt.proj.dmg, dtype: pt.proj.dtype,
            color: pt.proj.color, from: "enemy", radius: 0,
          });
        }
        break;
      }
      case "summon": {
        Sfx.play(def.voice || "roar");
        for (let i = 0; i < (pt.count || 2); i++) {
          const ang = Math.random() * TAU;
          const ex = this.x + Math.cos(ang) * 70, ey = this.y + Math.sin(ang) * 70;
          if (World.circleBlocked(G.map, ex, ey, 14)) continue;
          const e = new Enemy(pt.type, ex, ey);
          e.enterChase();
          G.entities.push(e);
          this.summons.push(e);
          FX.burst(ex, ey, "#9be09b", 14, 120);
        }
        break;
      }
    }
  }
}

/* ---------------- conjured allies ---------------- */

class Ally extends Entity {
  constructor(kind, dur, power) {
    super(G.player ? G.player.x : 0, G.player ? G.player.y : 0, 8);
    this.kind = kind;          // 'sprite' | 'lantern'
    this.life = dur;
    this.power = power || 1;
    this.orbit = Math.random() * TAU;
    this.fireCd = 1;
    const melee = kind === "warden_shade" || kind === "guard";
    this.lightR = kind === "lantern" ? 150 : melee ? 50 : 80;
    this.lightColor = kind === "lantern" ? "255,233,168" : kind === "guard" ? "154,176,216" : kind === "warden_shade" ? "185,168,255" : "255,150,60";
  }
  update(dt) {
    const p = G.player;
    if (!p || p.dead) { this.dead = true; return; }
    const meleeCol = this.kind === "guard" ? "#9ab0d8" : "#b9a8ff";
    this.life -= dt;
    if (this.life <= 0) {
      this.dead = true;
      FX.burst(this.x, this.y, this.kind === "lantern" ? "#ffe9a8" : this.kind === "guard" ? "#9ab0d8" : this.kind === "warden_shade" ? "#b9a8ff" : "#ffb060", 14, 80);
      return;
    }

    // melee allies (warden-shade / march-guard): seek the nearest foe and hew it
    if (this.kind === "warden_shade" || this.kind === "guard") {
      let best = null, bd = 340 * 340;
      for (const e of G.entities) {
        if (!e.isEnemy || e.dead || e.def.behavior === "flee") continue;
        const d2 = U.dist2(this.x, this.y, e.x, e.y);
        if (d2 < bd) { bd = d2; best = e; }
      }
      this.fireCd -= dt;
      if (best) {
        const ang = U.angTo(this.x, this.y, best.x, best.y);
        this.facing = ang;
        if (Math.sqrt(bd) > this.r + best.r + 4) {
          const sp = 165 * dt;
          World.moveCircle(G.map, this, Math.cos(ang) * sp, Math.sin(ang) * sp);
        } else if (this.fireCd <= 0) {
          this.fireCd = 0.85;
          Combat.applyDamage(best, { amount: 16 * this.power, dtype: "phys", poiseDmg: 16, attacker: p });
          FX.slash(this.x + Math.cos(ang) * this.r, this.y + Math.sin(ang) * this.r, ang, meleeCol, 26);
          Sfx.play("swing");
        }
      } else {
        this.orbit += dt * 0.8;
        const tx = p.x + Math.cos(this.orbit) * 40, ty = p.y + Math.sin(this.orbit) * 40;
        this.x += (tx - this.x) * Math.min(1, dt * 4);
        this.y += (ty - this.y) * Math.min(1, dt * 4);
      }
      if (Math.random() < 1.5 * dt) FX.sparkle(this.x, this.y, meleeCol);
      return;
    }

    // drift at the shoulder
    this.orbit += dt * (this.kind === "sprite" ? 1.7 : 1.0);
    const tx = p.x + Math.cos(this.orbit) * 36;
    const ty = p.y + Math.sin(this.orbit) * 36;
    this.x += (tx - this.x) * Math.min(1, dt * 6);
    this.y += (ty - this.y) * Math.min(1, dt * 6);
    if (Math.random() < 2.2 * dt) FX.sparkle(this.x, this.y, this.kind === "lantern" ? "#ffe9a8" : "#ffb060");

    // the sprite has opinions about your enemies
    if (this.kind === "sprite") {
      this.fireCd -= dt;
      if (this.fireCd <= 0) {
        let best = null, bd = 260 * 260;
        for (const e of G.entities) {
          if (!e.isEnemy || e.dead) continue;
          if (e.def.behavior === "flee") continue; // it does not bully deer
          const d2 = U.dist2(this.x, this.y, e.x, e.y);
          if (d2 < bd && World.lineClear(G.map, this.x, this.y, e.x, e.y)) { bd = d2; best = e; }
        }
        if (best) {
          this.fireCd = 1.5;
          const ang = U.angTo(this.x, this.y, best.x, best.y);
          Projectile.spawn({
            x: this.x, y: this.y, ang, speed: 420,
            dmg: 11 * this.power, dtype: "fire",
            color: "#ffb060", from: "player", r: 4, life: 1.4, spell: "ember_sprite",
          });
          Sfx.play("cast");
        } else {
          this.fireCd = 0.4;
        }
      }
    }
  }
  get isEnemy() { return false; }
}

/* ---------------- NPC ---------------- */

class NPC extends Entity {
  constructor(npcId, x, y, homeX, homeY) {
    super(x, y, 12);
    this.def = NPC_DEFS[npcId];
    this.npcId = npcId;
    this.hp = this.hpMax = 100;
    this.dayX = x; this.dayY = y;
    this.homeX = homeX !== undefined ? homeX : x;
    this.homeY = homeY !== undefined ? homeY : y;
    this.wanderT = U.randf(Math.random, 1, 5);
    this.wanderAng = Math.random() * TAU;
    this.moving = false;
    this.barkT = U.randf(Math.random, 4, 14);
  }

  // people keep their posts by day and their hearths by night
  get anchorX() { const h = G.time.hour; return (h >= 21 || h < 6.5) ? this.homeX : this.dayX; }
  get anchorY() { const h = G.time.hour; return (h >= 21 || h < 6.5) ? this.homeY : this.dayY; }

  update(dt) {
    this.wanderT -= dt;
    if (this.wanderT <= 0) {
      this.wanderT = U.randf(Math.random, 2, 6);
      this.moving = !this.moving && Math.random() < 0.5;
      this.wanderAng = Math.random() * TAU;
    }
    const distA = U.dist(this.x, this.y, this.anchorX, this.anchorY);
    if (distA > 40) {
      // commute between post and home
      const ang = U.angTo(this.x, this.y, this.anchorX, this.anchorY);
      this.facing = ang;
      World.steerMove(G.map, this, ang, 46 * dt);
      this.bobT += dt * 6;
    } else if (this.moving) {
      const ang = distA > 28 ? U.angTo(this.x, this.y, this.anchorX, this.anchorY) : this.wanderAng;
      this.facing = ang;
      World.moveCircle(G.map, this, Math.cos(ang) * 24 * dt, Math.sin(ang) * 24 * dt);
    }
    // face the player when near
    const p = G.player;
    if (p && U.dist(this.x, this.y, p.x, p.y) < 60) {
      this.facing = U.angTo(this.x, this.y, p.x, p.y);
      this.moving = false;
      this.barkT -= dt;
      if (this.barkT <= 0) {
        this.barkT = U.randf(Math.random, 10, 25);
        const b = this.def.bark;
        const line = Array.isArray(b) ? b[(Math.random() * b.length) | 0] : b;
        if (line && G.state === "play") G.float(this.x, this.y - 24, line, "#d8d0c0", 12);
      }
    }
  }
}

/* ---------------- projectile ---------------- */

class Projectile {
  static spawn(o) {
    G.projectiles.push({
      x: o.x, y: o.y,
      vx: Math.cos(o.ang) * o.speed, vy: Math.sin(o.ang) * o.speed,
      dmg: o.dmg, dtype: o.dtype || "phys", color: o.color || "#fff",
      from: o.from, radius: o.radius || 0, pierce: o.pierce || false,
      slow: o.slow || 0, magBurn: o.magBurn || 0, sneak: o.sneak || false,
      life: o.life || 2.2, r: o.r || 5, hitSet: new Set(),
      spell: o.spell || null, crit: o.crit || false,
    });
  }

  static update(dt) {
    const map = G.map;
    for (let i = G.projectiles.length - 1; i >= 0; i--) {
      const pr = G.projectiles[i];
      const mult = (pr.from === "enemy" && G.slowmo > 0) ? EDICTS.kyr.factor : 1;
      pr.x += pr.vx * dt * mult;
      pr.y += pr.vy * dt * mult;
      pr.life -= dt;
      let kill = pr.life <= 0;

      if (!kill && World.circleBlocked(map, pr.x, pr.y, 2)) kill = true;

      if (!kill && pr.from === "player") {
        for (const e of G.entities) {
          if (!e.isEnemy || e.dead || pr.hitSet.has(e)) continue;
          if (U.dist(pr.x, pr.y, e.x, e.y) < e.r + pr.r) {
            pr.hitSet.add(e);
            Combat.projectileHit(pr, e);
            if (!pr.pierce) { kill = true; break; }
          }
        }
      } else if (!kill && pr.from === "enemy") {
        const p = G.player;
        if (p && !p.dead && U.dist(pr.x, pr.y, p.x, p.y) < p.r + pr.r) {
          Combat.projectileHitPlayer(pr);
          kill = true;
        }
      }

      if (kill) {
        if (pr.radius > 0) Combat.explode(pr);
        else FX.burst(pr.x, pr.y, pr.color, 6, 80);
        G.projectiles.splice(i, 1);
      }
    }
  }
}

/* ---------------- ground hazards ---------------- */

class Hazard extends Entity {
  constructor(x, y, radius, kind) {
    super(x, y, radius);
    this.kind = kind; // poison_pool | fire_field | frost_field
    this.life = 7;
    this.tick = 0;
    this.color = kind === "poison_pool" ? "#5d8a4a" : kind === "fire_field" ? "#d8531f" : "#9ad6ff";
  }
  update(dt) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = 0.5;
      const p = G.player;
      if (p && !p.dead && U.dist(this.x, this.y, p.x, p.y) < this.r + p.r) {
        const dtype = this.kind === "poison_pool" ? "poison" : this.kind === "fire_field" ? "fire" : "frost";
        Combat.damagePlayer({ amount: 7, dtype, source: null, undodgeable: true, unblockable: true });
      }
      FX.burst(this.x + (Math.random() - 0.5) * this.r * 1.4, this.y + (Math.random() - 0.5) * this.r * 1.4, this.color, 3, 30);
    }
  }
  get isEnemy() { return false; }
}

/* ---------------- particles ---------------- */

const FX = {
  burst(x, y, color, n, spd) {
    if (G.particles.length > 600) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = (0.3 + Math.random() * 0.7) * spd;
      G.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.3 + Math.random() * 0.5, t: 0, color, size: 1.5 + Math.random() * 2.5, drag: 4,
      });
    }
  },
  blood(x, y, ang, n) {
    if (G.particles.length > 600) return;
    for (let i = 0; i < n; i++) {
      const a = ang + (Math.random() - 0.5) * 1.4, s = 60 + Math.random() * 160;
      G.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.35 + Math.random() * 0.4, t: 0, color: "#7a1f1a", size: 1.5 + Math.random() * 2, drag: 5,
      });
    }
  },
  slash(x, y, ang, color, len) {
    G.particles.push({
      x, y, vx: 0, vy: 0, life: 0.16, t: 0, color: color || "#fff",
      slash: true, ang, len: len || 50, size: 3, drag: 0,
    });
  },
  ring(x, y, radius, color) {
    G.particles.push({ x, y, vx: 0, vy: 0, life: 0.45, t: 0, color, ring: true, maxR: radius, size: 3, drag: 0 });
  },
  cone(x, y, ang, range, arc, color) {
    if (G.particles.length > 600) return;
    for (let i = 0; i < 10; i++) {
      const a = ang + (Math.random() - 0.5) * arc;
      const s = range * (1.2 + Math.random() * 0.9);
      G.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.3 + Math.random() * 0.25, t: 0, color, size: 2.5 + Math.random() * 3.5, drag: 2.2,
      });
    }
  },
  sparkle(x, y, color) {
    if (G.particles.length > 600) return;
    G.particles.push({
      x: x + (Math.random() - 0.5) * 14, y: y + (Math.random() - 0.5) * 14,
      vx: 0, vy: -18 - Math.random() * 18, life: 0.7 + Math.random() * 0.5, t: 0,
      color, size: 1 + Math.random() * 1.6, drag: 0,
    });
  },
  update(dt) {
    for (let i = G.particles.length - 1; i >= 0; i--) {
      const p = G.particles[i];
      p.t += dt;
      if (p.t >= p.life) { G.particles.splice(i, 1); continue; }
      const dr = 1 - (p.drag || 0) * dt;
      p.vx *= dr; p.vy *= dr;
      if (p.wander) p.vx += Math.sin(p.t * 2.2 + p.y * 0.02) * 18 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    // floating texts
    for (let i = G.floats.length - 1; i >= 0; i--) {
      const f = G.floats[i];
      f.t += dt;
      f.y += f.vy * dt;
      f.vy *= 1 - 2.5 * dt;
      if (f.t >= f.life) G.floats.splice(i, 1);
    }
  },
};

/* ---------------- map population ---------------- */

const Spawn = {
  // called whenever a map becomes active
  populate(map) {
    G.entities = [];
    G.projectiles = [];
    G.particles = [];
    G.corpsePile = [];

    // any enemies spawned on a previous visit are gone now; let spawners refill
    for (const s of map.spawners) s.members = [];

    // npcs (towns)
    for (const n of map.npcs) {
      G.entities.push(new NPC(n.id, n.x, n.y, n.homeX, n.homeY));
    }
    // fixed encounters (interiors)
    for (const enc of map.encounters) {
      if (map.encDead[enc.idx]) continue;
      const e = new Enemy(enc.type, enc.x, enc.y, enc.idx);
      G.entities.push(e);
    }
    // boss
    if (map.bossArena && !G.slainBosses[map.bossArena.boss]) {
      const bdef = ENEMY_TYPES[map.bossArena.boss];
      const boss = new Enemy(map.bossArena.boss, map.bossArena.bossX, map.bossArena.bossY);
      boss.facing = -Math.PI / 2;
      G.entities.push(boss);
    }
  },
};
