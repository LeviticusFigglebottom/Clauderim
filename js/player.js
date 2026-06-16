/* ============================================================
   CLAUDERIM — player.js
   The Emberborn: attributes, use-based skills & perks,
   inventory/equipment with equip-load, stamina-gated combat
   (light/heavy combos, block, parry, dodge-roll i-frames),
   bow draw, spellcasting, Ember Flask, Edicts, statuses.
   ============================================================ */
"use strict";

const LEVEL_COST = lvl => Math.floor(80 * Math.pow(lvl, 1.55));
const SKILL_XP_TO_NEXT = lvl => 80 + lvl * 14;
const BELT_SIZE = 6;   // quick-belt slots (wheel / [ ] to cycle, T to use)

class Player extends Entity {
  constructor(name, originId) {
    super(0, 0, 11);
    const o = ORIGINS[originId];
    this.name = name || "Wanderer";
    this.origin = originId;

    this.attrs = Object.assign({}, o.attrs);
    this.level = 1;
    this.embers = 0;
    this.gold = 60;

    this.skills = {};
    for (const id in SKILL_DEFS) this.skills[id] = { lvl: o.skills[id] || 5, xp: 0 };
    this.perks = {};
    this.perkPoints = 1;

    this.inventory = [];   // [{id, n}]
    this.equip = { weapon: null, ranged: null, shield: null, head: null, body: null, legs: null, trinket: null };
    this.spells = (o.spells || []).slice();
    this.equippedSpell = this.spells[0] || null;
    this.edicts = [];      // edict ids in order learned
    this.edictCds = {};

    this.flask = { max: 3, charges: 3, heal: 60 };
    this.belt = new Array(BELT_SIZE).fill(null); // quick belt: {type:"item"|"spell", id} | null
    this.beltSel = 0;                            // active belt slot
    this.favorites = [];     // Skyrim-style quick-select: [{type:"item"|"spell", id}]
    this.loadouts = {};      // gear-set snapshots: slot(1-3) -> {equip, spell}
    this.seenHints = {};     // one-shot tutorial hints already shown (G.tip)
    this.honing = {};        // weaponId -> forge tier (0-3)
    this.fpPitch = 0;        // first-person look pitch
    this.stepT = 0;          // footstep cadence
    this.enchants = {};      // itemId -> [enchantId, ...]

    // starting gear
    for (const slot in o.gear) {
      const it = ITEMS[o.gear[slot]];
      this.addItem(it.id, 1);
      this.equipItem(it.id);
    }
    for (const pair of o.items) this.addItem(pair[0], pair[1]);

    // vitals
    this.hp = this.hpMax = this.calcHpMax();
    this.stam = this.stamMax = this.calcStamMax();
    this.mag = this.magMax = this.calcMagMax();
    this.poiseMax = 30;
    this.poise = 30;

    // action state
    this.atk = null;          // {phase, t, heavy}
    this.queuedAtk = false;   // combo buffer: LMB during a swing chains the next
    this.holdT = 0;           // LMB hold time
    this.holding = false;
    this.rollT = 0; this.rollDir = 0;
    this.rollCd = 0;
    this.blocking = false;
    this.blockT = 99;         // time since block began (parry window)
    this.draw = null;         // bow draw {t}
    this.cast = null;         // {spell, t}
    this.crouched = false;
    this.sprinting = false;
    this.status = {};         // poison/burn/frost/bleed
    this.buffs = {};
    this.iframes = 0;
    this.staggerT = 0;
    this.flashT = 0;
    this.moveAng = 0; this.moving = false;
    this.stamLock = 0;        // delay before stamina regen
    this.undimmedUsed = false; // re_4 perk
    this.respawn = { map: "overworld", x: 0, y: 0, shrine: "first_shrine" };
    this.quests = {};         // questId -> {stage, counts:{}}
    this.readBooks = {};
    this.statsKills = 0; this.statsDeaths = 0;
    this.statsFish = 0;
    this.bestiary = {};      // enemyId -> kills
  }

  /* ---------------- derived stats ---------------- */

  calcHpMax() { return Math.round(80 + this.attrs.vig * 14 + (this.trinketBonus("maxHp") || 0) + this.enchBonus("maxHp")); }
  calcStamMax() { return 60 + this.attrs.end * 9; }
  calcMagMax() { return Math.round(40 + this.attrs.mnd * 11 + (this.trinketBonus("maxMag") || 0) + this.enchBonus("maxMag")); }
  equipLoadMax() { return 40 + this.attrs.end * 3 + this.attrs.str; }

  equipLoad() {
    let w = 0;
    for (const slot in this.equip) {
      const it = this.equip[slot] ? ITEMS[this.equip[slot]] : null;
      if (!it) continue;
      let iw = it.weight || 0;
      if (it.kind === "light" && this.hasPerk("la_2")) iw *= 0.5;
      if (it.kind === "heavy" && this.hasPerk("ha_2")) iw *= 0.65;
      w += iw;
    }
    return w;
  }

  loadRatio() { return this.equipLoad() / this.equipLoadMax(); }

  rollProfile() {
    const r = this.loadRatio();
    if (r > 1) return { can: false, dur: 0, dist: 0, iframes: 0 };
    let prof;
    if (r < 0.4) prof = { can: true, dur: 0.42, dist: 150, iframes: 0.34, cost: 18 };
    else if (r < 0.75) prof = { can: true, dur: 0.46, dist: 125, iframes: 0.28, cost: 22 };
    else prof = { can: true, dur: 0.55, dist: 95, iframes: 0.2, cost: 28 };
    if (this.hasPerk("la_4") && this.armorKindCount("light") >= 2) prof.iframes += 0.08;
    if (this.hasPerk("la_3") && this.armorKindCount("light") >= 2) prof.cost *= 0.8;
    return prof;
  }

  armorKindCount(kind) {
    let n = 0;
    for (const slot of ["head", "body", "legs"]) {
      const it = this.equip[slot] ? ITEMS[this.equip[slot]] : null;
      if (it && it.kind === kind) n++;
    }
    return n;
  }

  armorTotal() {
    let a = 0;
    for (const slot of ["head", "body", "legs"]) {
      const it = this.equip[slot] ? ITEMS[this.equip[slot]] : null;
      if (!it) continue;
      let v = it.armor;
      const sk = it.kind === "light" ? this.skills.lightarmor.lvl : this.skills.heavyarmor.lvl;
      v *= 1 + sk * 0.004;
      if (it.kind === "light") {
        if (this.hasPerk("la_1")) v *= 1.2;
        if (this.hasPerk("la_4")) v *= 1.4 / 1.2;
      } else {
        if (this.hasPerk("ha_1")) v *= 1.2;
        if (this.hasPerk("ha_4")) v *= 1.4 / 1.2;
      }
      a += v;
    }
    if (this.buffs.stoneskin) a += this.buffs.stoneskin.armor;
    a += this.enchBonus("armor");
    return a;
  }

  resist(dtype) {
    let r = 0;
    for (const slot of ["head", "body", "legs", "shield", "trinket"]) {
      const it = this.equip[slot] ? ITEMS[this.equip[slot]] : null;
      if (it && it.edef && it.edef[dtype]) r += it.edef[dtype];
    }
    if (dtype === "poison" && this.hasPerk("al_3")) r += 25;
    if (dtype === "frost" && this.buffs.warm) r += this.buffs.warm.frostRes;
    r += this.attrs.wil * 0.6;
    r += this.enchResist(dtype);
    return Math.min(80, r);
  }

  poiseTotal() {
    let p = 30 + (this.trinketBonus("poise") || 0);
    const body = this.equip.body ? ITEMS[this.equip.body] : null;
    if (body && body.kind === "heavy") {
      p += 25;
      if (this.hasPerk("ha_3")) p += 30;
    }
    return p;
  }

  trinketBonus(key) {
    const it = this.equip.trinket ? ITEMS[this.equip.trinket] : null;
    return it && it.bonus ? it.bonus[key] || 0 : 0;
  }

  /* Speech moves the market */
  buyPrice(it) {
    let m = 1 - this.skills.speech.lvl * 0.002;
    if (this.hasPerk("sp_3")) m -= 0.2;
    else if (this.hasPerk("sp_1")) m -= 0.1;
    return Math.max(1, Math.round(it.value * Math.max(0.5, m)));
  }
  sellPrice(it) {
    let m = 0.4 * (1 + this.skills.speech.lvl * 0.003);
    if (this.hasPerk("sp_3")) m *= 1.2;
    else if (this.hasPerk("sp_1")) m *= 1.1;
    return Math.max(1, Math.floor(it.value * Math.min(0.8, m)));
  }
  canPersuade() { return this.hasPerk("sp_2") || this.skills.speech.lvl >= 40; }

  /* ---- enchanting ---- */

  enchPotency() {
    let m = 1 + this.skills.enchanting.lvl * 0.004;
    if (this.hasPerk("en_4")) m *= 1.5;
    else if (this.hasPerk("en_1")) m *= 1.25;
    return m;
  }
  itemEnchants(itemId) { return this.enchants[itemId] || []; }
  // summed numeric enchant bonus of a given key across equipped armor/shield
  enchBonus(key) {
    let total = 0;
    const pot = this.enchPotency();
    for (const slot of ["head", "body", "legs", "shield"]) {
      const id = this.equip[slot];
      if (!id) continue;
      for (const eid of this.itemEnchants(id)) {
        const en = ENCHANTS[eid];
        if (en && en[key]) total += en[key] * pot;
      }
    }
    return total;
  }
  // elemental resist from armor enchants
  enchResist(dtype) {
    let total = 0;
    const pot = this.enchPotency();
    for (const slot of ["head", "body", "legs", "shield"]) {
      const id = this.equip[slot];
      if (!id) continue;
      for (const eid of this.itemEnchants(id)) {
        const en = ENCHANTS[eid];
        if (en && en.edef && en.edef[dtype]) total += en.edef[dtype] * pot;
      }
    }
    return total;
  }

  sneakBonus() {
    let b = 0;
    for (const slot of ["head", "body", "legs"]) {
      const it = this.equip[slot] ? ITEMS[this.equip[slot]] : null;
      if (it && it.sneakBonus) b += it.sneakBonus;
    }
    return b;
  }

  weapon() { return this.equip.weapon ? ITEMS[this.equip.weapon] : null; }
  shield() { return this.equip.shield ? ITEMS[this.equip.shield] : null; }
  bow() { return this.equip.ranged ? ITEMS[this.equip.ranged] : null; }

  /* ---------------- inventory ---------------- */

  addItem(id, n) {
    n = n || 1;
    const it = ITEMS[id];
    if (!it) return;
    if (id === "gold") { this.gold += n; return; }
    const stack = this.inventory.find(s => s.id === id);
    if (stack) stack.n += n;
    else this.inventory.push({ id, n });
    // fresh consumables auto-fill an empty belt slot so they're ready at hand
    if (it.type === "consumable" && this.belt && this.beltIndexOf(id, "item") < 0) {
      const free = this.belt.indexOf(null);
      if (free >= 0) this.belt[free] = { type: "item", id };
      else G.tip("beltfull", "Your belt is full. Rearrange it from your pack [Tab] or favorites [Z].");
    }
  }
  countItem(id) {
    const s = this.inventory.find(s2 => s2.id === id);
    return s ? s.n : 0;
  }
  hasItem(id, n) { return this.countItem(id) >= (n || 1); }
  removeItem(id, n) {
    n = n || 1;
    const i = this.inventory.findIndex(s => s.id === id);
    if (i < 0) return false;
    this.inventory[i].n -= n;
    if (this.inventory[i].n <= 0) {
      // unequip if it was the last equipped copy
      for (const slot in this.equip) if (this.equip[slot] === id) this.equip[slot] = null;
      this.inventory.splice(i, 1);
    }
    return true;
  }

  equipItem(id) {
    const it = ITEMS[id];
    if (!it) return;
    let slot = null;
    if (it.type === "weapon" || it.type === "staff") slot = "weapon";
    else if (it.type === "bow") slot = "ranged";
    else if (it.type === "shield") slot = "shield";
    else if (it.type === "armor") slot = it.slot;
    else if (it.type === "trinket") slot = "trinket";
    if (!slot) return;
    this.equip[slot] = (this.equip[slot] === id) ? null : id;
    // two-handed weapons unseat the shield
    if (slot === "weapon" && it.twoHanded) this.equip.shield = null;
    if (slot === "shield" && this.weapon() && this.weapon().twoHanded) this.equip.weapon = null;
    this.hpMax = this.calcHpMax();
    this.magMax = this.calcMagMax();
    Sfx.play("equip");
  }

  /* ---------------- quick belt ---------------- */

  beltEntry(slot) { return this.belt[slot] || null; }

  beltIndexOf(id, type) {
    for (let i = 0; i < this.belt.length; i++) {
      const e = this.belt[i];
      if (e && e.id === id && (!type || e.type === type)) return i;
    }
    return -1;
  }

  beltAdd(id, type) {
    type = type || (SPELLS[id] && !ITEMS[id] ? "spell" : "item");
    if (this.beltIndexOf(id, type) >= 0) return -1;   // already carried
    const free = this.belt.indexOf(null);
    if (free < 0) return -1;                            // belt full
    this.belt[free] = { type, id };
    return free;
  }

  // add if absent, remove if present; returns true when now on the belt
  beltToggle(id, type) {
    type = type || (SPELLS[id] && !ITEMS[id] ? "spell" : "item");
    const at = this.beltIndexOf(id, type);
    if (at >= 0) { this.belt[at] = null; return false; }
    return this.beltAdd(id, type) >= 0;
  }

  beltCycle(dir) {
    const n = this.belt.length;
    this.beltSel = ((this.beltSel + dir) % n + n) % n;
    Sfx.play("ui");
  }

  isFavorite(id, type) {
    type = type || (SPELLS[id] && !ITEMS[id] ? "spell" : "item");
    return this.favorites.some(f => f.id === id && f.type === type);
  }

  // add if absent, remove if present; returns true when now favorited
  favoriteToggle(id, type) {
    type = type || (SPELLS[id] && !ITEMS[id] ? "spell" : "item");
    const i = this.favorites.findIndex(f => f.id === id && f.type === type);
    if (i >= 0) { this.favorites.splice(i, 1); return false; }
    this.favorites.push({ type, id });
    return true;
  }

  // swap a favorite with its neighbor (dir -1 up / +1 down); order persists in the save
  favoriteMove(i, dir) {
    const j = i + dir;
    if (i < 0 || i >= this.favorites.length || j < 0 || j >= this.favorites.length) return false;
    const t = this.favorites[i]; this.favorites[i] = this.favorites[j]; this.favorites[j] = t;
    return true;
  }

  /* ---------------- gear loadouts ---------------- */

  saveLoadout(slot) {
    this.loadouts[slot] = { equip: Object.assign({}, this.equip), spell: this.equippedSpell || null };
  }
  hasLoadout(slot) { return !!this.loadouts[slot]; }
  applyLoadout(slot) {
    const lo = this.loadouts[slot];
    if (!lo) return false;
    const ne = { weapon: null, ranged: null, shield: null, head: null, body: null, legs: null, trinket: null };
    for (const s in ne) { const id = lo.equip[s]; if (id && this.hasItem(id)) ne[s] = id; }  // skip what you no longer own
    this.equip = ne;
    if (lo.spell && this.spells.includes(lo.spell)) this.equippedSpell = lo.spell;
    this.hpMax = this.calcHpMax(); this.magMax = this.calcMagMax();
    this.hp = Math.min(this.hp, this.hpMax); this.mag = Math.min(this.mag, this.magMax);
    return true;
  }

  beltUseSelected() { this.beltUse(this.beltSel); }

  beltUse(slot) {
    const e = this.belt[slot];
    if (!e) { Sfx.play("deny"); return; }
    if (e.type === "spell") {
      if (this.spells.includes(e.id)) { this.equippedSpell = e.id; Sfx.play("ui"); }
      else { this.belt[slot] = null; Sfx.play("deny"); }   // forgotten spell
      return;
    }
    const it = ITEMS[e.id];
    if (!it) { this.belt[slot] = null; return; }
    if (it.type === "consumable") {
      if (this.hasItem(e.id)) this.useConsumable(e.id);
      else { G.msg(`No ${it.name} left.`, "bad"); Sfx.play("deny"); }
    } else {
      // weapons / staves / bows / shields / apparel: quick-swap (equipItem toggles)
      if (this.hasItem(e.id)) this.equipItem(e.id);
      else { this.belt[slot] = null; Sfx.play("deny"); }
    }
  }

  /* ---------------- progression ---------------- */

  gainEmbers(n) {
    this.embers += n;
    if (n >= 25) G.msg(`Claimed ${U.fmt(n)} embers`, "ember");
  }

  gainSkill(id, xp) {
    const s = this.skills[id];
    if (!s || s.lvl >= 100) return;
    s.xp += xp;
    while (s.xp >= SKILL_XP_TO_NEXT(s.lvl) && s.lvl < 100) {
      s.xp -= SKILL_XP_TO_NEXT(s.lvl);
      s.lvl++;
      G.msg(`${SKILL_DEFS[id].name} rose to ${s.lvl}`, "good");
      Sfx.play("skillup");
      if (s.lvl % 5 === 0) {
        this.perkPoints++;
        G.msg("Perk point earned", "good");
      }
    }
  }

  hasPerk(pid) { return !!this.perks[pid]; }

  buyPerk(skillId, perk) {
    if (this.perkPoints <= 0 || this.perks[perk.id]) return false;
    if (this.skills[skillId].lvl < perk.req) return false;
    this.perks[perk.id] = true;
    this.perkPoints--;
    Sfx.play("levelup");
    G.msg(`Perk learned: ${perk.name}`, "good");
    return true;
  }

  levelUp(attr) {
    const cost = LEVEL_COST(this.level);
    if (this.embers < cost) return false;
    this.embers -= cost;
    this.attrs[attr]++;
    this.level++;
    this.hpMax = this.calcHpMax();
    this.stamMax = this.calcStamMax();
    this.magMax = this.calcMagMax();
    this.hp = this.hpMax; this.stam = this.stamMax; this.mag = this.magMax;
    Sfx.play("levelup");
    G.msg(`${ATTR_DEFS[attr].name} increased — level ${this.level}`, "good");
    return true;
  }

  learnSpell(id) {
    if (this.spells.includes(id)) return;
    this.spells.push(id);
    if (!this.equippedSpell) this.equippedSpell = id;
    G.msg(`Spell learned: ${SPELLS[id].name}`, "good");
  }

  learnEdict(id) {
    if (this.edicts.includes(id)) return;
    this.edicts.push(id);
    const e = EDICTS[id];
    G.questToast("EDICT LEARNED", e.name);
    Sfx.play("edict");
  }

  /* ---------------- vitals ---------------- */

  heal(n) {
    if (this.hasPerk("re_1")) n *= 1.25;
    this.hp = Math.min(this.hpMax, this.hp + n);
    FX.sparkle(this.x, this.y, "#ffe9a8");
  }
  spendStam(n) {
    this.stam = Math.max(0, this.stam - n);
    this.stamLock = 0.8;
    if (this.stam === 0) G.tip("stamina", "Stamina spent — no rolling or striking until it returns. The dead are the ones who emptied it.");
  }

  useFlask() {
    if (this.flask.charges <= 0) { G.msg("The flask is empty. Rest at a shrine.", "bad"); Sfx.play("deny"); return; }
    if (this.cast || this.atk || this.rollT > 0) return;
    this.flask.charges--;
    this.heal(this.flask.heal);
    this.cast = { flask: true, t: 0.55 };
    Sfx.play("flask");
    G.msg(`Ember Flask — ${this.flask.charges}/${this.flask.max} remaining`, "ember");
  }

  useConsumable(id) {
    const it = ITEMS[id];
    if (!it || !it.use || !this.hasItem(id)) return;
    const u = it.use;
    if (u.throw) {
      // thrown weapon: lob toward cursor
      const ang = U.angTo(this.x, this.y, Input.worldX(), Input.worldY());
      Projectile.spawn({
        x: this.x + Math.cos(ang) * 16, y: this.y + Math.sin(ang) * 16,
        ang, speed: 320, dmg: u.throw.dmg, dtype: u.throw.dtype,
        color: "#ff8c3a", from: "player", radius: u.throw.radius, life: 1.4,
      });
      Sfx.play("throw");
    } else {
      if (u.hp) this.heal(u.hp);
      if (u.stam) this.stam = Math.min(this.stamMax, this.stam + u.stam);
      if (u.mag) this.mag = Math.min(this.magMax, this.mag + u.mag);
      if (u.embers) this.gainEmbers(u.embers);
      if (u.cure) delete this.status[u.cure];
      if (u.buff) this.buffs[u.buff.id] = Object.assign({ t: u.buff.dur }, u.buff);
      Sfx.play("drink");
    }
    this.removeItem(id, 1);
  }

  /* ---------------- per-frame update ---------------- */

  update(dt) {
    if (this.dead) return;
    const map = G.map;

    this.flashT = Math.max(0, this.flashT - dt);
    this.iframes = Math.max(0, this.iframes - dt);
    if (this.hp > 0 && this.hp / this.hpMax < 0.25) G.tip("lowhp", "Life runs low. R drinks the Ember Flask; T uses the selected belt potion.");
    this.rollCd = Math.max(0, this.rollCd - dt);
    this.stamLock = Math.max(0, this.stamLock - dt);
    this.blockT += dt;
    for (const k in this.edictCds) this.edictCds[k] = Math.max(0, this.edictCds[k] - dt);
    for (const k in this.buffs) {
      this.buffs[k].t -= dt;
      if (this.buffs[k].t <= 0) delete this.buffs[k];
    }
    Combat.tickStatus(this, dt);

    // passive regen
    if (this.stamLock <= 0 && !this.blocking && !this.sprinting) {
      let rs = 16 + this.attrs.end * 0.7 + (this.trinketBonus("stamRegen") || 0) + this.enchBonus("stamRegen");
      if (this.crouched) rs *= 1.2;
      this.stam = Math.min(this.stamMax, this.stam + rs * dt);
    }
    this.mag = Math.min(this.magMax, this.mag + (1.6 + this.attrs.mnd * 0.12 + (this.trinketBonus("magRegen") || 0)) * dt);
    const hpRegen = this.trinketBonus("hpRegen");
    if (hpRegen) this.hp = Math.min(this.hpMax, this.hp + hpRegen * dt);
    this.poise = Math.min(this.poiseTotal(), this.poise + this.poiseTotal() * 0.2 * dt);

    if (this.staggerT > 0) { this.staggerT -= dt; return; }

    /* ---- roll in progress ---- */
    if (this.rollT > 0) {
      this.rollT -= dt;
      const prof = this._rollProf;
      const sp = (prof.dist / prof.dur) * dt;
      World.moveCircle(map, this, Math.cos(this.rollDir) * sp, Math.sin(this.rollDir) * sp);
      return;
    }

    /* ---- casting / flask animation (you keep your feet) ---- */
    if (this.cast) {
      this.cast.t -= dt;
      if (this.cast.t <= 0) {
        const c = this.cast;
        this.cast = null;
        if (!c.flask && c.spell) Combat.finishCast(this, c.spell);
      }
    }

    /* ---- attack swing ticks alongside movement: no more freezing
       in place mid-combat — swings only SLOW you ---- */
    if (this.atk) this.updateAttack(dt);

    /* ---- movement ---- */
    const fp = G.viewMode === "fp";
    let ix, iy;
    if (fp) {
      // first person: W/S along the view, A/D strafe, arrows (or mouse) turn
      const turn = (Input.act("turnR") ? 1 : 0) - (Input.act("turnL") ? 1 : 0);
      if (turn) this.facing += turn * 2.7 * dt;
      const fwd = (Input.act("up") ? 1 : 0) - (Input.act("down") ? 1 : 0);
      const strafe = (Input.act("right") ? 1 : 0) - (Input.act("left") ? 1 : 0);
      this.moving = (fwd !== 0 || strafe !== 0);
      if (this.moving) {
        const a = this.facing + Math.atan2(strafe, fwd);
        ix = Math.cos(a); iy = Math.sin(a);
      } else { ix = 0; iy = 0; }
    } else {
      ix = (Input.act("right") ? 1 : 0) - (Input.act("left") ? 1 : 0);
      iy = (Input.act("down") ? 1 : 0) - (Input.act("up") ? 1 : 0);
      this.moving = (ix !== 0 || iy !== 0);
    }
    this.crouched = Input.act("crouch");
    this.sprinting = Input.act("sprint") && this.moving && this.stam > 1 && !this.crouched;

    let speed = 132;
    if (this.sprinting) { speed = 205; this.spendStam(14 * dt); this.stamLock = 0.25; }
    if (this.crouched) speed *= 0.55;
    if (this.blocking) speed *= 0.6;
    if (this.draw) speed *= 0.5;
    if (this.atk) speed *= this.atk.heavy ? 0.34 : 0.5;
    if (this.cast) speed *= 0.55;
    if (this.loadRatio() > 1) { speed *= 0.45; G.tip("burden", "Overburdened — your steps drag and your roll fails. Shed weight or raise Endurance."); }
    if (this.status.frost > 0) speed *= 0.6;
    speed *= World.slowAt(map, this.x, this.y);

    if (this.moving) {
      this.moveAng = Math.atan2(iy, ix);
      const sp = speed * dt;
      World.moveCircle(map, this, Math.cos(this.moveAng) * sp, 0);
      World.moveCircle(map, this, 0, Math.sin(this.moveAng) * sp);
      this.bobT += dt * (this.sprinting ? 13 : 8);
      // footsteps
      this.stepT -= dt;
      if (this.stepT <= 0 && !this.crouched) {
        this.stepT = this.sprinting ? 0.27 : 0.4;
        Sfx.play("step");
      }
    }

    // face the cursor — but not mid-swing (updateAttack steers the windup)
    if (!this.atk) this.facing = U.angTo(this.x, this.y, Input.worldX(), Input.worldY());

    /* ---- blocking ---- */
    const wantBlock = Input.mouse.rdown && this.shield() && !this.draw && !this.atk && !this.cast;
    if (wantBlock && !this.blocking) {
      this.blocking = true; this.blockT = 0; Sfx.play("block_raise");
      G.tip("block", "Hold the guard and it soaks blows. Raise it the instant before impact to parry and stagger your foe.");
    }
    if (!wantBlock) this.blocking = false;

    /* ---- bow draw ---- */
    if (this.bow() && Input.act("aim") && !this.atk && !this.cast) {
      if (!this.draw) this.draw = { t: 0 };
      this.draw.t += dt;
      if (this.hasPerk("ar_2")) G.slowmoAim = true;
    } else if (this.draw) {
      // release
      const d = this.draw; this.draw = null;
      G.slowmoAim = false;
      const power = U.clamp(d.t / 0.8, 0.3, 1);
      Combat.playerShoot(this, power);
    }

    /* ---- light / heavy attacks (LMB tap vs hold) ---- */
    if (this.atk) {
      // mid-swing: LMB buffers the next blow instead of vanishing
      if (Input.mouse.pressed) this.queuedAtk = true;
      this.holding = false; this.holdT = 0;
    } else if (Input.mouse.down && !this.blocking && !this.draw && !this.cast) {
      this.holding = true;
      this.holdT += dt;
      if (this.holdT > 0.32) { this.startAttack(true); this.holding = false; this.holdT = 0; }
    } else if (this.holding) {
      this.holding = false;
      if (this.holdT <= 0.32) this.startAttack(false);
      this.holdT = 0;
    }

    /* ---- dodge roll ---- */
    if (Input.pressed("roll") && this.rollCd <= 0 &&
        (!this.atk || this.atk.phase === "rec")) {
      const prof = this.rollProfile();
      if (!prof.can) { G.msg("Overburdened — you cannot roll.", "bad"); }
      else if (this.stam >= 1) {
        // the roll cancels the follow-through and any half-spoken spell
        this.atk = null; this.queuedAtk = false;
        this.cast = null;
        this.spendStam(prof.cost);
        this._rollProf = prof;
        this.rollT = prof.dur;
        this.rollCd = prof.dur + 0.12;
        this.rollDir = this.moving ? this.moveAng : this.facing + Math.PI;
        this.iframes = prof.iframes;
        this.blocking = false;
        this.draw = null;          // rolling lets the bowstring go slack
        G.slowmoAim = false;
        Sfx.play("roll");
        FX.burst(this.x, this.y, "#aaa08a", 6, 60);
        G.tip("roll", "A roll carries a flicker of invulnerability — roll *through* a blow, not merely away from it.");
      }
    }

    /* ---- flask ---- */
    if (Input.pressed("flask")) this.useFlask();

    /* ---- quick belt: cycle (wheel / [ ]) + use (T) ---- */
    let beltStep = Input.wheel || 0;
    if (Input.pressed("beltnext")) beltStep += 1;
    if (Input.pressed("beltprev")) beltStep -= 1;
    if (beltStep) this.beltCycle(beltStep > 0 ? 1 : -1);
    if (Input.pressed("quickuse")) this.beltUseSelected();

    /* ---- spell cast ---- */
    if (Input.pressed("cast") && this.equippedSpell && !this.atk && !this.cast) {
      Combat.beginCast(this, this.equippedSpell);
    }

    /* ---- edicts 1-4 ---- */
    for (let i = 0; i < this.edicts.length && i < 4; i++) {
      if (Input.pressed("edict" + (i + 1))) Combat.useEdict(this, this.edicts[i]);
    }
  }

  startAttack(heavy) {
    const w = this.weapon();
    if (!w) {
      // unarmed jab
      this.atk = { phase: "wind", t: 0.18, heavy: false, unarmed: true, windT: 0.18, strikeT: 0.08, recT: 0.2 };
      return;
    }
    const spd = w.spd || 1.2;
    const total = (1 / spd) * (heavy ? 1.5 : 1);
    const cost = (w.stam || 12) * (heavy ? 1.7 : 1) * (this.hasPerk("oh_3") && w.skill === "onehand" ? 0.75 : 1);
    if (this.stam < 1) { Sfx.play("deny"); return; }
    this.spendStam(cost);
    this.atk = {
      phase: "wind", heavy,
      windT: total * 0.4, strikeT: total * 0.15, recT: total * 0.45,
      t: total * 0.4, hit: false,
    };
    Sfx.play(heavy ? "swing_heavy" : "swing");
  }

  updateAttack(dt) {
    const a = this.atk;
    a.t -= dt;
    // allow steering slightly during windup
    if (a.phase === "wind") {
      this.facing = U.angApproach(this.facing, U.angTo(this.x, this.y, Input.worldX(), Input.worldY()), 6 * dt);
      if (a.t <= 0) {
        a.phase = "strike"; a.t = a.strikeT;
        Combat.playerStrike(this, a.heavy);
      }
    } else if (a.phase === "strike") {
      // weight carries you forward THROUGH the blow — a smooth lunge,
      // not the old single-frame jolt
      const lspd = (a.heavy ? 150 : 110) * dt;
      World.moveCircle(G.map, this, Math.cos(this.facing) * lspd, Math.sin(this.facing) * lspd);
      if (a.t <= 0) { a.phase = "rec"; a.t = a.recT; }
    } else if (a.t <= 0) {
      this.atk = null;
      // a buffered press chains straight into the next light swing
      if (this.queuedAtk) {
        this.queuedAtk = false;
        if (this.stam >= 1) this.startAttack(false);
      }
    }
  }

  /* ---------------- serialization ---------------- */

  serialize() {
    return {
      name: this.name, origin: this.origin, attrs: this.attrs, level: this.level,
      embers: this.embers, gold: this.gold, skills: this.skills, perks: this.perks,
      perkPoints: this.perkPoints, inventory: this.inventory, equip: this.equip,
      spells: this.spells, equippedSpell: this.equippedSpell, edicts: this.edicts,
      flask: this.flask, x: this.x, y: this.y, hp: this.hp, stam: this.stam, mag: this.mag,
      respawn: this.respawn, quests: this.quests, readBooks: this.readBooks,
      undimmedUsed: this.undimmedUsed, statsKills: this.statsKills, statsDeaths: this.statsDeaths,
      belt: this.belt, beltSel: this.beltSel, favorites: this.favorites, loadouts: this.loadouts,
      seenHints: this.seenHints, honing: this.honing, enchants: this.enchants,
      bestiary: this.bestiary, statsFish: this.statsFish,
    };
  }

  static deserialize(d) {
    const p = new Player(d.name, d.origin);
    p.inventory = []; // wipe origin kit; restore saved state
    p.equip = { weapon: null, ranged: null, shield: null, head: null, body: null, legs: null, trinket: null };
    Object.assign(p.attrs, d.attrs);
    p.level = d.level; p.embers = d.embers; p.gold = d.gold;
    p.skills = d.skills; p.perks = d.perks; p.perkPoints = d.perkPoints;
    // older saves predate newer skills — backfill them
    for (const id in SKILL_DEFS) if (!p.skills[id]) p.skills[id] = { lvl: 5, xp: 0 };
    p.inventory = d.inventory; p.equip = d.equip;
    p.spells = d.spells; p.equippedSpell = d.equippedSpell; p.edicts = d.edicts;
    p.flask = d.flask;
    p.x = d.x; p.y = d.y;
    p.hpMax = p.calcHpMax(); p.stamMax = p.calcStamMax(); p.magMax = p.calcMagMax();
    p.hp = d.hp; p.stam = d.stam; p.mag = d.mag;
    p.respawn = d.respawn; p.quests = d.quests; p.readBooks = d.readBooks || {};
    p.undimmedUsed = d.undimmedUsed || false;
    p.statsKills = d.statsKills || 0; p.statsDeaths = d.statsDeaths || 0;
    // belt: prefer saved belt, fall back to the legacy single quick-item slot
    if (d.belt) { p.belt = d.belt; p.beltSel = d.beltSel || 0; }
    else if (d.quickItem) { p.belt = new Array(BELT_SIZE).fill(null); p.belt[0] = { type: "item", id: d.quickItem }; }
    else { p.belt = new Array(BELT_SIZE).fill(null); }
    while (p.belt.length < BELT_SIZE) p.belt.push(null);
    p.favorites = d.favorites || [];
    p.loadouts = d.loadouts || {};
    p.seenHints = d.seenHints || {};
    p.honing = d.honing || {};
    p.enchants = d.enchants || {};
    p.bestiary = d.bestiary || {};
    p.statsFish = d.statsFish || 0;
    p.hpMax = p.calcHpMax(); p.magMax = p.calcMagMax();
    return p;
  }
}
