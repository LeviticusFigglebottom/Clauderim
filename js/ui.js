/* ============================================================
   CLAUDERIM — ui.js
   All DOM interface: title & character creation, the tabbed
   pause menu (inventory/equipment/character/skills/magic/
   journal/map/system), dialogue runtime, shops, crafting
   stations, shrine menu, book reader, boss bar, endings, help.
   ============================================================ */
"use strict";

const UI = {
  menuTab: "inventory",
  selItem: null,
  dlg: null,           // {npcId, node}
  shrine: null,
  bookOnly: false,

  /* ============ boot wiring ============ */

  init() {
    this.injectBooks();

    U.el("btn-newgame").onclick = () => { Sfx.play("ui"); this.openChargen(); };
    U.el("btn-continue").onclick = () => {
      const slot = SaveSys.latestSlot();
      if (slot) Game.loadGame(slot);
    };
    U.el("btn-loadgame").onclick = () => { Sfx.play("ui"); this.openLoadList(); };
    U.el("btn-titlehelp").onclick = () => { Sfx.play("ui"); this.showHelp(); };
    U.el("help-close").onclick = () => { U.hide("help-screen"); if (G.state === "help") G.setState(G.prevState === "help" ? "title" : G.prevState); };
    U.el("fav-close").onclick = () => this.closeFavorites();
    U.el("cg-back").onclick = () => { U.hide("chargen-screen"); U.show("title-screen"); G.setState("title"); };
    U.el("cg-begin").onclick = () => {
      const name = U.el("cg-name").value.trim() || "Wanderer";
      Game.newGame(name, this.chosenOrigin || "marchwarden");
    };
    for (const btn of document.querySelectorAll(".menu-tab")) {
      btn.onclick = () => { Sfx.play("ui"); this.menuTab = btn.dataset.tab; this.renderMenu(); };
    }
    this.refreshTitle();
  },

  /* lore books become carryable items, stocked with fitting vendors */
  injectBooks() {
    for (const id in BOOKS) {
      const iid = "book_" + id;
      if (ITEMS[iid]) continue;
      ITEMS[iid] = {
        id: iid, name: BOOKS[id].title, type: "book", book: id,
        weight: 0.5, value: 30, rarity: "fine",
        lore: "By " + BOOKS[id].author,
      };
    }
    const stock = (npc, ids) => {
      const s = NPC_DEFS[npc].shop;
      if (!s) return;
      if (!s.stock) s.stock = [];
      s.stock.push(...ids);
    };
    stock("serah", ["book_ember_treatise", "book_emberborn_book", "book_old_tongue_primer"]);
    stock("tobbe", ["book_shattered_march", "book_bestiary"]);
    stock("petra", ["book_duskmere_book"]);
    stock("sigrun", ["book_frosthollow_book"]);
    stock("maren", ["book_alchemy_primer"]);
    stock("caldus", ["book_undermarch_book", "book_tollroad_accord", "stormcaller"]);
    stock("senn", ["book_tidelost_book"]);
    stock("bram", ["book_bram_ledger"]);
    stock("ralka", ["book_ralka_journal"]);
    LOOT.chest_fine.push({ w: 1, id: "book_wardens_book", n: [1, 1] });
    LOOT.chest_rare.push({ w: 1, id: "book_citadel_book", n: [1, 1] });
    LOOT.chest_rare.push({ w: 1, id: "ring_deep", n: [1, 1] });
  },

  /* item display name with forge honing and altar workings */
  itemName(it, p) {
    const tier = p && p.honing && p.honing[it.id];
    let name = it.name + (tier ? " +" + tier : "");
    if (p && p.enchants && p.enchants[it.id] && p.enchants[it.id].length) {
      name += " [" + p.enchants[it.id].map(e => ENCHANTS[e] ? ENCHANTS[e].name : e).join(", ") + "]";
    }
    return name;
  },

  refreshTitle() {
    const has = SaveSys.hasAny();
    U.el("btn-continue").disabled = !has;
    U.el("btn-loadgame").disabled = !has;
  },

  /* ============ character creation ============ */

  openChargen() {
    G.setState("chargen");
    U.hide("title-screen");
    U.show("chargen-screen");
    const grid = U.el("cg-origins");
    grid.innerHTML = "";
    for (const id in ORIGINS) {
      const o = ORIGINS[id];
      const card = U.mk("div", "origin-card", `<div class="o-name">${o.name}</div><div class="o-tag">${o.tag}</div>`);
      card.onclick = () => {
        this.chosenOrigin = id;
        for (const c of grid.children) c.classList.remove("sel");
        card.classList.add("sel");
        const a = o.attrs;
        const skillStr = Object.entries(o.skills).map(kv => `${SKILL_DEFS[kv[0]].name} ${kv[1]}`).join(" · ");
        const gearStr = Object.values(o.gear).map(g => ITEMS[g] ? ITEMS[g].name : g).join(", ");
        const spellStr = (o.spells || []).map(s => SPELLS[s] ? SPELLS[s].name : s).join(", ");
        U.el("cg-origin-desc").innerHTML =
          `${U.esc(o.desc)}` +
          `<div class="stat-line">VIG ${a.vig} · END ${a.end} · MND ${a.mnd} · STR ${a.str} · FIN ${a.fin} · WIL ${a.wil}</div>` +
          `<div class="stat-line">Skills: ${U.esc(skillStr)}</div>` +
          `<div class="stat-line">Gear: ${U.esc(gearStr)}</div>` +
          (spellStr ? `<div class="stat-line">Spells: ${U.esc(spellStr)}</div>` : "");
        Sfx.play("ui");
      };
      grid.appendChild(card);
    }
    grid.children[0].click();
  },

  openLoadList() {
    const panel = U.el("station-panel");
    let html = `<h2>Load Ember</h2>`;
    for (let s = 1; s <= 3; s++) {
      const info = SaveSys.slotInfo(s);
      html += info
        ? `<button class="shrine-opt" data-load="${s}">Slot ${s} — ${U.esc(info.name)}, level ${info.level} ${info.origin}${info.cycle ? " · Cycle " + U.roman(info.cycle + 1) : ""}
             <span class="so-sub">Day ${info.day} · ${U.esc(info.region)}</span></button>`
        : `<button class="shrine-opt" disabled style="opacity:.4">Slot ${s} — empty</button>`;
    }
    html += `<button class="title-btn dim" id="load-cancel">Back</button>`;
    panel.innerHTML = html;
    U.show("station-screen");
    panel.querySelectorAll("[data-load]").forEach(b => b.onclick = () => {
      U.hide("station-screen");
      Game.loadGame(parseInt(b.dataset.load));
    });
    U.el("load-cancel").onclick = () => U.hide("station-screen");
  },

  /* ============ pause menu ============ */

  openMenu(tab) {
    if (G.state !== "play") return;
    const p = G.player;
    if (p) { p.draw = null; G.slowmoAim = false; p.holding = false; p.holdT = 0; }
    if (document.exitPointerLock) document.exitPointerLock();
    this.menuTab = tab || this.menuTab;
    G.setState("menu");
    U.show("menu-screen");
    this.renderMenu();
    Sfx.play("ui");
  },
  closeMenu() {
    U.hide("menu-screen");
    G.setState("play");
  },

  renderMenu() {
    for (const btn of document.querySelectorAll(".menu-tab")) {
      btn.classList.toggle("active", btn.dataset.tab === this.menuTab);
    }
    const c = U.el("menu-content");
    switch (this.menuTab) {
      case "inventory": return this.renderInventory(c);
      case "equipment": return this.renderEquipment(c);
      case "character": return this.renderCharacter(c);
      case "skills": return this.renderSkills(c);
      case "magic": return this.renderMagic(c);
      case "quests": return this.renderJournal(c);
      case "map": return this.renderMap(c);
      case "system": return this.renderSystem(c);
    }
  },

  itemMeta(it) {
    if (it.type === "weapon" || it.type === "staff") return `dmg ${it.dmg} · spd ${it.spd}`;
    if (it.type === "bow") return `dmg ${it.dmg}`;
    if (it.type === "shield") return `block ${it.block}`;
    if (it.type === "armor") return `armor ${it.armor}`;
    return it.type;
  },

  renderInventory(c) {
    const p = G.player;
    const cats = [
      ["Weapons & Shields", ["weapon", "staff", "bow", "shield"]],
      ["Apparel", ["armor", "trinket"]],
      ["Consumables", ["consumable", "tool"]],
      ["Ingredients & Materials", ["ingredient", "material"]],
      ["Books", ["book"]],
      ["Keys & Relics", ["key"]],
    ];
    const sortMode = G.settings.invSort || "default";
    const sortRows = arr => {
      if (sortMode === "name") return arr.slice().sort((a, b) => ITEMS[a.id].name.localeCompare(ITEMS[b.id].name));
      if (sortMode === "value") return arr.slice().sort((a, b) => (ITEMS[b.id].value || 0) - (ITEMS[a.id].value || 0));
      if (sortMode === "weight") return arr.slice().sort((a, b) => (ITEMS[b.id].weight || 0) - (ITEMS[a.id].weight || 0));
      return arr;
    };
    let list = "";
    for (const [label, types] of cats) {
      const rows = sortRows(p.inventory.filter(s => types.includes(ITEMS[s.id].type)));
      if (!rows.length) continue;
      list += `<div class="inv-cat">${label}</div>`;
      for (const s of rows) {
        const it = ITEMS[s.id];
        const eq = Object.values(p.equip).includes(s.id);
        const sel = this.selItem === s.id ? " sel" : "";
        const quick = p.beltIndexOf(s.id, "item") >= 0 ? ' <span style="color:#b9d8a0;font-size:11px">[belt]</span>' : "";
        const fav = p.isFavorite(s.id, "item") ? ' <span style="color:#c9a86a;font-size:11px">★</span>' : "";
        list += `<div class="inv-row${eq ? " equipped" : ""}${sel}" data-item="${s.id}">
          <span class="iname r-${it.rarity}">${U.esc(this.itemName(it, p))}${s.n > 1 ? " ×" + s.n : ""}${quick}${fav}</span>
          <span class="imeta">${this.itemMeta(it)} · ${it.weight || 0}wt</span></div>`;
      }
    }
    const sortLabel = { default: "Default", name: "Name", value: "Value", weight: "Weight" }[sortMode];
    c.innerHTML = `<div class="inv-sortbar" style="margin-bottom:6px;font-size:13px;color:#8a8378">Sort by <button class="act-btn" id="inv-sort">${sortLabel}</button></div>
      <div class="inv-layout">
      <div class="inv-list">${list || '<i style="color:#5d574c">Your pack is empty.</i>'}</div>
      <div class="inv-detail" id="inv-detail"></div></div>`;
    U.el("inv-sort").onclick = () => {
      const modes = ["default", "name", "value", "weight"];
      G.settings.invSort = modes[(modes.indexOf(sortMode) + 1) % modes.length];
      G.saveSettings();
      this.renderMenu();
    };
    c.querySelectorAll("[data-item]").forEach(row => row.onclick = () => {
      this.selItem = row.dataset.item;
      this.renderMenu();
    });
    this.renderItemDetail(U.el("inv-detail"));
  },

  renderItemDetail(box) {
    const p = G.player;
    if (!this.selItem || !p.hasItem(this.selItem)) { box.innerHTML = ""; return; }
    const it = ITEMS[this.selItem];
    let stats = "";
    if (it.dmg) stats += `<b>Damage</b> ${it.dmg}${it.edmg ? " +" + Object.entries(it.edmg).map(kv => kv[1] + " " + kv[0]).join(", ") : ""}<br>`;
    if (it.spd) stats += `<b>Speed</b> ${it.spd}/s &nbsp; <b>Stamina</b> ${it.stam}<br>`;
    if (it.scale) stats += `<b>Scaling</b> ${Object.entries(it.scale).map(kv => kv[0].toUpperCase() + ":" + kv[1]).join("  ")}<br>`;
    if (it.block) stats += `<b>Block</b> ${it.block}% &nbsp; <b>Stability</b> ${it.stability}<br>`;
    if (it.armor) stats += `<b>Armor</b> ${it.armor} (${it.kind})<br>`;
    if (it.edef) stats += `<b>Resist</b> ${Object.entries(it.edef).map(kv => kv[0] + " " + kv[1] + "%").join(", ")}<br>`;
    if (it.bonus) stats += `<b>Bonus</b> ${Object.entries(it.bonus).map(kv => kv[0] + " +" + kv[1]).join(", ")}<br>`;
    if (it.sneakBonus) stats += `<b>Stealth</b> +${it.sneakBonus}<br>`;
    if (it.use) {
      const u = it.use;
      const parts = [];
      if (u.hp) parts.push(`+${u.hp} health`);
      if (u.stam) parts.push(`+${u.stam} stamina`);
      if (u.mag) parts.push(`+${u.mag} magicka`);
      if (u.embers) parts.push(`+${u.embers} embers`);
      if (u.cure) parts.push(`cures ${u.cure}`);
      if (u.throw) parts.push(`thrown: ${u.throw.dmg} ${u.throw.dtype}`);
      stats += `<b>Use</b> ${parts.join(", ")}<br>`;
    }
    stats += `<b>Weight</b> ${it.weight || 0} &nbsp; <b>Value</b> ${it.value}`;

    let actions = "";
    if (["weapon", "staff", "bow", "shield", "armor", "trinket"].includes(it.type)) {
      const eq = Object.values(p.equip).includes(it.id);
      actions += `<button class="act-btn" data-act="equip">${eq ? "Unequip" : "Equip"}</button>`;
    }
    if (it.type === "consumable") {
      actions += `<button class="act-btn" data-act="use">Use</button>`;
    }
    if (["weapon", "staff", "bow", "shield", "consumable"].includes(it.type)) {
      const onBelt = p.beltIndexOf(it.id, "item") >= 0;
      actions += `<button class="act-btn" data-act="belt">${onBelt ? "Remove from Belt" : "Add to Belt"}</button>`;
    }
    if (["weapon", "staff", "bow", "shield", "armor", "trinket", "consumable"].includes(it.type)) {
      actions += `<button class="act-btn" data-act="fav">${p.isFavorite(it.id, "item") ? "★ Unfavorite" : "☆ Favorite"}</button>`;
    }
    if (it.type === "book") actions += `<button class="act-btn" data-act="read">Read</button>`;
    if (it.type !== "key") actions += `<button class="act-btn danger" data-act="drop">Discard</button>`;

    box.innerHTML = `<div class="idetail-name r-${it.rarity}">${U.esc(this.itemName(it, p))}</div>
      <div class="idetail-type">${it.type}${it.twoHanded ? " · two-handed" : ""}</div>
      <div class="idetail-stats">${stats}</div>
      <div class="idetail-lore">${U.esc(it.lore || "")}</div>
      <div class="idetail-actions">${actions}</div>`;
    box.querySelectorAll("[data-act]").forEach(b => b.onclick = () => {
      if (b.dataset.act === "equip") p.equipItem(it.id);
      else if (b.dataset.act === "use") p.useConsumable(it.id);
      else if (b.dataset.act === "belt") { p.beltToggle(it.id, "item"); Sfx.play("ui"); }
      else if (b.dataset.act === "fav") { p.favoriteToggle(it.id, "item"); Sfx.play("ui"); }
      else if (b.dataset.act === "read") { this.openBook(it.book); return; }
      else if (b.dataset.act === "drop") { p.removeItem(it.id, 1); Sfx.play("ui"); }
      this.renderMenu();
    });
  },

  renderEquipment(c) {
    const p = G.player;
    const slots = [
      ["weapon", "Weapon"], ["shield", "Shield"], ["ranged", "Bow"],
      ["head", "Head"], ["body", "Body"], ["legs", "Legs"], ["trinket", "Trinket"],
    ];
    let grid = "";
    for (const [slot, label] of slots) {
      const it = p.equip[slot] ? ITEMS[p.equip[slot]] : null;
      grid += `<div class="equip-slot" data-slot="${slot}">
        <span class="slot-label">${label}</span>
        <span class="slot-item ${it ? "r-" + it.rarity : "empty"}">${it ? U.esc(this.itemName(it, p)) : "—"}</span></div>`;
    }
    const lr = p.loadRatio();
    const rollDesc = lr > 1 ? "cannot roll" : lr >= 0.75 ? "heavy roll" : lr >= 0.4 ? "medium roll" : "fast roll";
    const w = p.weapon();
    c.innerHTML = `<h2>Equipment</h2><div class="equip-grid">${grid}</div>
      <div class="derived-stats">
        <div class="ds"><span>Attack</span><b>${w ? Math.round(Combat.weaponDamage(p, w, false)) : "—"}</b></div>
        <div class="ds"><span>Armor</span><b>${Math.round(p.armorTotal())}</b></div>
        <div class="ds"><span>Poise</span><b>${Math.round(p.poiseTotal())}</b></div>
        <div class="ds"><span>Equip load</span><b>${p.equipLoad().toFixed(1)} / ${p.equipLoadMax()}</b></div>
        <div class="ds"><span>Mobility</span><b>${rollDesc}</b></div>
        <div class="ds"><span>Stealth</span><b>+${p.sneakBonus()}</b></div>
        <div class="ds"><span>Fire res.</span><b>${Math.round(p.resist("fire"))}%</b></div>
        <div class="ds"><span>Frost res.</span><b>${Math.round(p.resist("frost"))}%</b></div>
        <div class="ds"><span>Poison res.</span><b>${Math.round(p.resist("poison"))}%</b></div>
      </div>
      <p class="sys-note">Click a slot to unequip. Equip from the Inventory tab.</p>`;
    c.querySelectorAll("[data-slot]").forEach(el => el.onclick = () => {
      const s = el.dataset.slot;
      const pl = G.player;
      if (pl.equip[s]) {
        pl.equip[s] = null;
        // workings on the removed piece may have carried vitals
        pl.hpMax = pl.calcHpMax(); pl.magMax = pl.calcMagMax();
        pl.hp = Math.min(pl.hp, pl.hpMax); pl.mag = Math.min(pl.mag, pl.magMax);
        Sfx.play("equip");
        this.renderMenu();
      }
    });
  },

  renderCharacter(c) {
    const p = G.player;
    let attrs = "";
    for (const a in ATTR_DEFS) {
      attrs += `<div class="attr-row">
        <span class="a-name">${ATTR_DEFS[a].name}</span>
        <span class="a-val">${p.attrs[a]}</span>
        <span class="a-desc">${ATTR_DEFS[a].desc}</span></div>`;
    }
    c.innerHTML = `<h2>${U.esc(p.name)} — ${ORIGINS[p.origin].name}${(G.cycle || 0) > 0 ? ` · Cycle ${U.roman(G.cycle + 1)}` : ""}</h2>
      <div class="char-cols">
        <div class="attr-table">${attrs}</div>
        <div class="attr-table">
          <div class="attr-row"><span class="a-name">Level</span><span class="a-val">${p.level}</span><span class="a-desc">next: ${U.fmt(LEVEL_COST(p.level))} embers (at a shrine)</span></div>
          <div class="attr-row"><span class="a-name">Embers</span><span class="a-val">${U.fmt(p.embers)}</span><span class="a-desc">spent at shrines; lost on death</span></div>
          <div class="attr-row"><span class="a-name">Health</span><span class="a-val">${Math.ceil(p.hp)}</span><span class="a-desc">of ${p.hpMax}</span></div>
          <div class="attr-row"><span class="a-name">Stamina</span><span class="a-val">${Math.ceil(p.stam)}</span><span class="a-desc">of ${p.stamMax}</span></div>
          <div class="attr-row"><span class="a-name">Magicka</span><span class="a-val">${Math.ceil(p.mag)}</span><span class="a-desc">of ${p.magMax}</span></div>
          <div class="attr-row"><span class="a-name">Flask</span><span class="a-val">${p.flask.charges}/${p.flask.max}</span><span class="a-desc">heals ${p.flask.heal}</span></div>
          <div class="attr-row"><span class="a-name">Foes slain</span><span class="a-val">${p.statsKills}</span><span class="a-desc">deaths: ${p.statsDeaths}</span></div>
          <div class="attr-row"><span class="a-name">Sigils</span><span class="a-val">${QS.sigilCount()}/4</span><span class="a-desc">words of the Old Tongue</span></div>
        </div>
      </div>`;
  },

  renderSkills(c) {
    const p = G.player;
    let grid = "";
    for (const id in SKILL_DEFS) {
      const def = SKILL_DEFS[id], s = p.skills[id];
      const frac = s.xp / SKILL_XP_TO_NEXT(s.lvl);
      let perks = "";
      for (const pk of def.perks) {
        const owned = p.hasPerk(pk.id);
        const avail = !owned && p.perkPoints > 0 && s.lvl >= pk.req;
        perks += `<div class="perk-row${owned ? " owned" : avail ? " avail" : ""}">
          <span class="perk-dot">◆</span>
          <span class="p-name" title="${U.esc(pk.desc)}">${pk.name} <span style="opacity:.6">(${pk.req})</span></span>
          ${avail ? `<button class="perk-buy" data-perk="${pk.id}" data-skill="${id}">learn</button>` : ""}
          <span style="color:#6a665e;font-size:11px">— ${U.esc(pk.desc)}</span></div>`;
      }
      grid += `<div class="skill-block">
        <div class="skill-head"><span class="s-name">${def.name}</span><span class="s-lvl">${s.lvl}</span></div>
        <div class="skill-xpbar"><div style="width:${(frac * 100).toFixed(0)}%"></div></div>
        ${perks}</div>`;
    }
    c.innerHTML = `<h2>Skills — perk points: ${p.perkPoints}</h2><div class="skill-grid">${grid}</div>`;
    c.querySelectorAll("[data-perk]").forEach(b => b.onclick = () => {
      const def = SKILL_DEFS[b.dataset.skill];
      const pk = def.perks.find(q => q.id === b.dataset.perk);
      if (G.player.buyPerk(b.dataset.skill, pk)) this.renderMenu();
    });
  },

  renderMagic(c) {
    const p = G.player;
    let spells = "";
    for (const id of p.spells) {
      const sp = SPELLS[id];
      const onBelt = p.beltIndexOf(id, "spell") >= 0;
      spells += `<div class="spell-row${p.equippedSpell === id ? " equipped" : ""}" data-spell="${id}">
        <span class="sp-name">${sp.name}${onBelt ? ' <span style="color:#b9d8a0;font-size:11px">[belt]</span>' : ""}</span>
        <span class="spell-desc">${U.esc(sp.desc)}</span>
        <span class="sp-cost">${Combat.spellCost(p, sp)} mg</span>
        <button class="act-btn" data-spellfav="${id}">${p.isFavorite(id, "spell") ? "★" : "☆"}</button>
        <button class="act-btn" data-spellbelt="${id}">${onBelt ? "− Belt" : "+ Belt"}</button></div>`;
    }
    if (!spells) spells = `<i style="color:#5d574c">You know no spells. Serah and the hermit Caldus teach those with coin.</i>`;
    let edicts = "";
    for (let i = 0; i < p.edicts.length; i++) {
      const e = EDICTS[p.edicts[i]];
      edicts += `<div class="edict-row"><span class="e-name">[${i + 1}] ${e.name}</span>
        <span class="spell-desc">${U.esc(e.desc)}</span></div>`;
    }
    if (!edicts) edicts = `<i style="color:#5d574c">The Wardens hold the words of the Old Tongue. Take them.</i>`;
    c.innerHTML = `<h2>Magic — equipped spell casts with [Q]</h2>${spells}
      <div class="edict-block"><h2>Edicts of the Old Tongue</h2>${edicts}</div>`;
    c.querySelectorAll("[data-spell]").forEach(el => el.onclick = () => {
      G.player.equippedSpell = el.dataset.spell;
      Sfx.play("ui");
      this.renderMenu();
    });
    c.querySelectorAll("[data-spellbelt]").forEach(el => el.onclick = ev => {
      ev.stopPropagation();
      G.player.beltToggle(el.dataset.spellbelt, "spell");
      Sfx.play("ui");
      this.renderMenu();
    });
    c.querySelectorAll("[data-spellfav]").forEach(el => el.onclick = ev => {
      ev.stopPropagation();
      G.player.favoriteToggle(el.dataset.spellfav, "spell");
      Sfx.play("ui");
      this.renderMenu();
    });
  },

  renderJournal(c) {
    const entries = QS.journalEntries();
    if (!entries.length) { c.innerHTML = `<h2>Journal</h2><i style="color:#5d574c">No tasks yet. Speak with the people of the March.</i>`; return; }
    let html = `<h2>Journal</h2>`;
    for (const en of entries) {
      const { id, q, st } = en;
      html += `<div class="quest-entry"><div class="q-name${st.done ? " done" : ""}">${q.type === "main" ? "✦ " : ""}${q.name}</div>`;
      for (let i = 0; i <= Math.min(st.stage, q.stages.length - 1); i++) {
        const past = st.done || i < st.stage;
        html += `<div class="q-stage${past ? " past" : ""}">${U.esc(q.stages[i].journal)}</div>`;
      }
      if (!st.done) html += `<div class="q-obj">▸ ${U.esc(QS.objectiveText(id))}</div>`;
      html += `</div>`;
    }

    // the bestiary: what the March has thrown at you, and how it went
    const p = G.player;
    const known = Object.keys(p.bestiary || {});
    if (known.length) {
      const total = Object.keys(ENEMY_TYPES).length;
      let rows = "";
      known.sort((a, b) => (p.bestiary[b] - p.bestiary[a]));
      for (const id2 of known) {
        const def = ENEMY_TYPES[id2];
        if (!def) continue;
        rows += `<div style="display:inline-block;width:32%;padding:3px 0;font-size:13px">
          <span style="color:${def.boss ? "#e8cf9a" : "#b8b0a0"}">${def.boss ? "✦ " : ""}${U.esc(def.name)}</span>
          <span style="color:#6a665e"> ×${p.bestiary[id2]}</span></div>`;
      }
      html += `<h2 style="margin-top:22px">Bestiary — ${known.length} of ${total} known · ${U.fmt(p.statsKills)} felled · ${p.statsFish} fish landed</h2>${rows}`;
    }
    c.innerHTML = html;
  },

  renderMap(c) {
    c.innerHTML = `<div id="worldmap-wrap"><canvas id="worldmap-canvas" width="640" height="520"></canvas></div>
      <div class="map-legend">◆ towns &nbsp; ▲ dungeons &nbsp; ● shrines (discovered) &nbsp; ✚ you</div>`;
    const cv = U.el("worldmap-canvas");
    const ctx = cv.getContext("2d");
    if (!Render.minimapCanvas) Render.buildMinimap();
    const scale = Math.min(640 / WORLD_W, 520 / WORLD_H);
    const ox = (640 - WORLD_W * scale) / 2, oy = (520 - WORLD_H * scale) / 2;
    ctx.fillStyle = "#0a0908"; ctx.fillRect(0, 0, 640, 520);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(Render.minimapCanvas, ox, oy, WORLD_W * scale, WORLD_H * scale);

    const ow = World.getMap("overworld");
    ctx.font = '11px "Palatino Linotype", Georgia, serif';
    for (const poi of ow.poiList) {
      if (poi.hidden && !G.discoveredPois[poi.id]) continue;
      const x = ox + poi.tx * scale, y = oy + poi.ty * scale;
      if (poi.kind === "town") {
        ctx.fillStyle = "#e8cf9a";
        ctx.fillRect(x - 3, y - 3, 6, 6);
      } else if (poi.kind === "dungeon") {
        ctx.fillStyle = "#d88a7a";
        ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x + 4, y + 3); ctx.lineTo(x - 4, y + 3); ctx.fill();
      } else {
        ctx.fillStyle = "#b0a890";
        ctx.fillRect(x - 2, y - 2, 4, 4);
      }
      ctx.fillStyle = "#d8d0c0";
      ctx.textAlign = "center";
      ctx.fillText(poi.name, x, y - 7);
    }
    for (const s of ow.shrines) {
      if (!G.discoveredShrines[s.id]) continue;
      ctx.fillStyle = "#e07b39";
      ctx.beginPath(); ctx.arc(ox + (s.x / TILE) * scale, oy + (s.y / TILE) * scale, 2.4, 0, TAU); ctx.fill();
    }
    const p = G.player;
    if (G.map.outdoor && p) {
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.6;
      const px = ox + (p.x / TILE) * scale, py = oy + (p.y / TILE) * scale;
      ctx.beginPath();
      ctx.moveTo(px - 5, py); ctx.lineTo(px + 5, py);
      ctx.moveTo(px, py - 5); ctx.lineTo(px, py + 5);
      ctx.stroke();
    }
  },

  renderSystem(c) {
    let slots = "";
    for (let s = 1; s <= 3; s++) {
      const info = SaveSys.slotInfo(s);
      slots += `<div style="display:flex;gap:8px;align-items:center">
        <span style="flex:1;color:${info ? "#d8d0c0" : "#5d574c"}">Slot ${s}: ${info ? `${U.esc(info.name)} lv${info.level}, day ${info.day}` : "empty"}</span>
        <button class="act-btn" data-save="${s}">Save</button>
        ${info ? `<button class="act-btn" data-load2="${s}">Load</button>
        <button class="act-btn danger" data-del="${s}">✕</button>` : ""}</div>`;
    }
    const chk = (key, label) => `<label style="display:flex;justify-content:space-between;cursor:pointer">
      <span>${label}</span><input type="checkbox" data-set="${key}" ${G.settings[key] ? "checked" : ""}></label>`;
    const curResH = G.settings.fpResH || 360;
    const keyLabel = code => {
      if (!code) return "—";
      const map = { ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", BracketLeft: "[", BracketRight: "]", ShiftLeft: "Shift", ShiftRight: "Shift", ControlLeft: "Ctrl", ControlRight: "Ctrl", Escape: "Esc", Space: "Space" };
      return map[code] || code.replace(/^Key/, "").replace(/^Digit/, "");
    };
    const rebindable = [["up", "Forward / up"], ["down", "Back / down"], ["left", "Strafe left"], ["right", "Strafe right"], ["turnL", "Turn left"], ["turnR", "Turn right"], ["sprint", "Sprint"], ["roll", "Dodge roll"], ["crouch", "Sneak"], ["interact", "Interact"], ["flask", "Ember Flask"], ["quickuse", "Use belt slot"], ["beltprev", "Belt ◀"], ["beltnext", "Belt ▶"], ["favorites", "Favorites"], ["cast", "Cast spell"], ["aim", "Draw bow"], ["toggleview", "Toggle view"], ["menu", "Menu"], ["map", "Map"], ["journal", "Journal"], ["character", "Character"], ["photo", "Photo"], ["pause", "Pause"]];
    let rebindList = "";
    if (this.showRebinds) {
      rebindList = `<div class="rebind-list">`;
      for (const [act, label] of rebindable) {
        const cap = Input.captureRebind === act;
        rebindList += `<div class="rebind-row"><span>${label}</span>
          <button class="act-btn" data-rebind="${act}">${cap ? "press a key…" : keyLabel(BINDS[act] && BINDS[act][0])}</button></div>`;
      }
      rebindList += `<button class="act-btn danger" id="sys-rebind-reset">Reset all to defaults</button></div>`;
    }
    const diffNames = { tender: "Tender — forgiving", measured: "Measured — as intended", unforgiving: "Unforgiving — harsh" };
    c.innerHTML = `<h2>System</h2><div class="sys-rows">
      ${slots}
      <hr style="border-color:#2c2719">
      <div style="color:#c9a86a;letter-spacing:.15em;font-size:13px">GAMEPLAY</div>
      <button class="act-btn" id="sys-diff">Difficulty: ${diffNames[G.settings.difficulty] || diffNames.measured}</button>
      ${chk("pauseOnBlur", "Pause when the window loses focus")}
      <div style="color:#c9a86a;letter-spacing:.15em;font-size:13px">GRAPHICS</div>
      ${chk("autoRes", "Adaptive resolution (auto)")}
      <label style="display:flex;justify-content:space-between;align-items:center;gap:10px">
        <span>Resolution: <span id="sys-res-val">${curResH}p${G.settings.autoRes ? " (auto on)" : ""}</span></span>
        <input type="range" id="sys-res" min="240" max="1080" step="30" value="${curResH}" style="flex:1;max-width:180px">
      </label>
      <label style="display:flex;justify-content:space-between;align-items:center;gap:10px">
        <span>View distance: <span id="sys-dist-val">${RenderFP.maxDist} tiles</span></span>
        <input type="range" id="sys-dist" min="24" max="200" step="4" value="${typeof G.settings.viewDist === "number" ? G.settings.viewDist : 48}" style="flex:1;max-width:180px">
      </label>
      ${chk("grain", "Texture grain (first person)")}
      ${chk("showFps", "Frame meter")}
      ${chk("screenShake", "Screen shake")}${chk("showDamage", "Damage numbers")}
      <label style="display:flex;justify-content:space-between;align-items:center;gap:10px">
        <span>Field of view: <span id="sys-fov-val">${G.settings.fov || 75}°</span></span>
        <input type="range" id="sys-fov" min="60" max="100" step="1" value="${G.settings.fov || 75}" style="flex:1;max-width:180px">
      </label>
      <div style="color:#c9a86a;letter-spacing:.15em;font-size:13px;margin-top:4px">MOUSE</div>
      <label style="display:flex;justify-content:space-between;align-items:center;gap:10px">
        <span>Look sensitivity: <span id="sys-sens-val">${(G.settings.sens || 1).toFixed(1)}×</span></span>
        <input type="range" id="sys-sens" min="0.4" max="2" step="0.1" value="${G.settings.sens || 1}" style="flex:1;max-width:180px">
      </label>
      ${chk("invertY", "Invert mouse Y (first person)")}
      <div style="color:#c9a86a;letter-spacing:.15em;font-size:13px;margin-top:4px">SOUND & VIEW</div>
      ${chk("music", "Music")}${chk("sfx", "Sound effects")}
      <button class="act-btn" id="sys-view">View: ${G.viewMode === "fp" ? "First person" : "Top-down"} (switch — or press V in game)</button>
      <div style="color:#c9a86a;letter-spacing:.15em;font-size:13px;margin-top:4px">CONTROLS</div>
      <button class="act-btn" id="sys-rebind">${this.showRebinds ? "Hide key bindings" : "Rebind keys"}</button>
      ${rebindList}
      <button class="act-btn" id="sys-help">Manual & Controls</button>
      <button class="act-btn danger" id="sys-quit">Quit to title (unsaved progress is lost)</button>
    </div>
    <p class="sys-note">Settings persist across sessions. The world saves automatically at every shrine rest. [P] captures a clean screenshot.</p>`;
    c.querySelectorAll("[data-save]").forEach(b => b.onclick = () => {
      if (SaveSys.save(parseInt(b.dataset.save))) { G.msg("Saved.", "good"); Sfx.play("quest"); }
      this.renderMenu();
    });
    c.querySelectorAll("[data-load2]").forEach(b => b.onclick = () => {
      this.closeMenu();
      Game.loadGame(parseInt(b.dataset.load2));
    });
    c.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
      if (b.dataset.confirm) {
        localStorage.removeItem(SaveSys.slotKey(parseInt(b.dataset.del)));
        Sfx.play("ui");
        this.renderMenu();
      } else {
        b.dataset.confirm = "1";
        b.textContent = "sure?";
      }
    });
    c.querySelectorAll("[data-set]").forEach(el => el.onchange = () => {
      G.settings[el.dataset.set] = el.checked;
      if (el.dataset.set === "music") { const m = Music.mood; Music.mood = null; Music.setMood(el.checked ? (m || "world") : null); }
      if (el.dataset.set === "autoRes") { RenderFP.applySettings(); this.renderMenu(); }
      G.saveSettings();
    });
    U.el("sys-res").oninput = (e) => {
      G.settings.fpResH = parseInt(e.target.value);
      U.el("sys-res-val").textContent = G.settings.fpResH + "p" + (G.settings.autoRes ? " (auto on)" : "");
      if (!G.settings.autoRes) RenderFP.applySettings();
      G.saveSettings();
    };
    U.el("sys-dist").oninput = (e) => {
      G.settings.viewDist = parseInt(e.target.value);
      U.el("sys-dist-val").textContent = RenderFP.maxDist + " tiles";
      G.saveSettings();
    };
    U.el("sys-diff").onclick = () => {
      const order = ["tender", "measured", "unforgiving"];
      G.settings.difficulty = order[(order.indexOf(G.settings.difficulty) + 1) % order.length];
      G.saveSettings();
      Sfx.play("ui");
      this.renderMenu();
    };
    U.el("sys-fov").oninput = (e) => {
      G.settings.fov = parseInt(e.target.value);
      U.el("sys-fov-val").textContent = G.settings.fov + "°";
      G.saveSettings();
    };
    U.el("sys-sens").oninput = (e) => {
      G.settings.sens = parseFloat(e.target.value);
      U.el("sys-sens-val").textContent = G.settings.sens.toFixed(1) + "×";
      G.saveSettings();
    };
    U.el("sys-view").onclick = () => {
      G.viewMode = G.viewMode === "fp" ? "top" : "fp";
      Sfx.play("ui");
      this.renderMenu();
    };
    U.el("sys-rebind").onclick = () => { this.showRebinds = !this.showRebinds; Sfx.play("ui"); this.renderMenu(); };
    if (this.showRebinds) {
      c.querySelectorAll("[data-rebind]").forEach(b => b.onclick = () => {
        Input.captureRebind = b.dataset.rebind;
        Input.onRebindDone = () => this.renderMenu();
        this.renderMenu();   // reflect "press a key…"
      });
      const rbReset = U.el("sys-rebind-reset");
      if (rbReset) rbReset.onclick = () => { Input.resetBinds(); Sfx.play("ui"); this.renderMenu(); };
    }
    U.el("sys-help").onclick = () => this.showHelp();
    U.el("sys-quit").onclick = () => location.reload();
  },

  /* ============ dialogue runtime ============ */

  openDialogue(npcId) {
    const tree = DIALOGUES[npcId];
    if (!tree) return;
    QS.onTalk(npcId);
    let node = "hub";
    for (const e of tree.entry) {
      if (e.cond(G.player)) { node = e.node; break; }
    }
    this.dlg = { npcId, node };
    G.setState("dialogue");
    U.show("dialogue-box");
    this.renderDialogue();
  },

  renderDialogue() {
    const { npcId, node } = this.dlg;
    const tree = DIALOGUES[npcId];
    const n = tree.nodes[node];
    if (!n) { this.closeDialogue(); return; }
    U.el("dlg-speaker").textContent = NPC_DEFS[npcId].name;
    U.el("dlg-text").textContent = typeof n.text === "function" ? n.text(G.player) : n.text;
    const box = U.el("dlg-choices");
    box.innerHTML = "";
    const choices = n.choices.filter(ch => !ch.cond || ch.cond(G.player));
    for (const ch of choices) {
      const b = U.mk("button", "dlg-choice" + (ch.cls ? " " + ch.cls : ""), U.esc(ch.text));
      b.onclick = () => {
        Sfx.play("ui");
        if (ch.action) ch.action(G.player);
        if (G.state !== "dialogue") return; // action opened a shop/station
        if (ch.next) { this.dlg.node = ch.next; this.renderDialogue(); }
        else this.closeDialogue();
      };
      box.appendChild(b);
    }
    if (!choices.length) {
      const b = U.mk("button", "dlg-choice", "(Leave)");
      b.onclick = () => this.closeDialogue();
      box.appendChild(b);
    }
  },

  closeDialogue() {
    this.dlg = null;
    U.hide("dialogue-box");
    if (G.state === "dialogue") G.setState("play");
  },

  /* ============ shrine ============ */

  openShrine(shrine) {
    this.shrine = shrine;
    G.setState("shrine");
    U.show("shrine-screen");
    this.renderShrine("main");
  },

  renderShrine(mode) {
    const p = G.player, s = this.shrine;
    U.el("shrine-title").textContent = s.name;
    const box = U.el("shrine-options");

    if (mode === "main") {
      const cycleOpt = G.flags.ending_chosen
        ? `<button class="shrine-opt" data-o="cycle" style="color:#e07b39">Begin the next cycle — Cycle ${U.roman((G.cycle || 0) + 2)}
            <span class="so-sub">The world renews and hardens; you keep all you are and carry</span></button>`
        : "";
      box.innerHTML = `
        <button class="shrine-opt" data-o="rest">Rest at the ember
          <span class="so-sub">Restore vitals & flask · the slain return · the world is saved</span></button>
        <button class="shrine-opt" data-o="level">Kindle the self — level ${p.level} → ${p.level + 1}
          <span class="so-sub">Cost: ${U.fmt(LEVEL_COST(p.level))} embers (you carry ${U.fmt(p.embers)})</span></button>
        <button class="shrine-opt" data-o="travel">Walk the ember-paths
          <span class="so-sub">Travel between shrines you have knelt to</span></button>
        ${cycleOpt}
        <button class="shrine-opt" data-o="leave">Rise and continue</button>`;
      box.querySelector('[data-o="rest"]').onclick = () => { this.closeShrine(); Game.restAtShrine(s); };
      box.querySelector('[data-o="level"]').onclick = () => this.renderShrine("level");
      box.querySelector('[data-o="travel"]').onclick = () => this.renderShrine("travel");
      const cyc = box.querySelector('[data-o="cycle"]');
      if (cyc) cyc.onclick = () => {
        if (cyc.dataset.confirm) { this.closeShrine(); Game.newCycle(); }
        else { cyc.dataset.confirm = "1"; cyc.innerHTML = `Are you certain? The March resets — you remain.<span class="so-sub">Click again to begin Cycle ${U.roman((G.cycle || 0) + 2)}</span>`; }
      };
      box.querySelector('[data-o="leave"]').onclick = () => this.closeShrine();
    } else if (mode === "level") {
      const cost = LEVEL_COST(p.level);
      let rows = `<div class="ember-cost">Level ${p.level} → ${p.level + 1} costs <b>${U.fmt(cost)}</b> embers · you carry ${U.fmt(p.embers)}</div><div class="levelup-grid">`;
      for (const a in ATTR_DEFS) {
        rows += `<div class="attr-row" data-attr="${a}">
          <span class="a-name">${ATTR_DEFS[a].name}</span>
          <span class="a-val">${p.attrs[a]}</span>
          <span class="a-plus">+1</span>
          <span class="a-desc">${ATTR_DEFS[a].desc}</span></div>`;
      }
      rows += `</div><button class="shrine-opt" data-o="back">Back</button>`;
      box.innerHTML = rows;
      box.querySelectorAll("[data-attr]").forEach(el => el.onclick = () => {
        if (p.levelUp(el.dataset.attr)) this.renderShrine("level");
        else { G.msg("Not enough embers.", "bad"); Sfx.play("deny"); }
      });
      box.querySelector('[data-o="back"]').onclick = () => this.renderShrine("main");
    } else if (mode === "travel") {
      let rows = "";
      const all = [];
      const ow = World.getMap("overworld");
      for (const sh of ow.shrines) if (G.discoveredShrines[sh.id]) all.push({ sh, mapId: "overworld", region: World.regionNameAt(ow, sh.x, sh.y) });
      for (const mid in G.maps) {
        for (const sh of G.maps[mid].shrines) if (G.discoveredShrines[sh.id]) all.push({ sh, mapId: mid, region: G.maps[mid].name });
      }
      for (const en of all) {
        if (en.sh.id === s.id) continue;
        rows += `<div class="travel-row" data-shrine="${en.sh.id}" data-map="${en.mapId}">
          <span>${en.sh.name}</span><span class="t-region">${en.region}</span></div>`;
      }
      box.innerHTML = (rows || `<i style="color:#5d574c;display:block;padding:12px">You have knelt to no other flames.</i>`) +
        `<button class="shrine-opt" data-o="back">Back</button>`;
      box.querySelectorAll("[data-shrine]").forEach(el => el.onclick = () => {
        this.closeShrine();
        Game.fastTravel(el.dataset.map, el.dataset.shrine);
      });
      box.querySelector('[data-o="back"]').onclick = () => this.renderShrine("main");
    }
  },

  closeShrine() {
    this.shrine = null;
    U.hide("shrine-screen");
    G.setState("play");
  },

  /* ============ shop ============ */

  openShop(npcId) {
    const def = NPC_DEFS[npcId];
    if (!def.shop) return;
    this.closeDialogue();
    G.setState("station");
    U.show("station-screen");
    this.renderShop(npcId, "buy");
  },

  renderShop(npcId, tab) {
    const def = NPC_DEFS[npcId], p = G.player;
    const panel = U.el("station-panel");
    let rows = "";
    if (tab === "buy") {
      for (const id of (def.shop.stock || [])) {
        const it = ITEMS[id];
        const price = p.buyPrice(it);
        const afford = p.gold >= price;
        rows += `<div class="craft-row"><span class="c-name r-${it.rarity}">${U.esc(it.name)} <span style="color:#6a665e;font-size:12px">${this.itemMeta(it)}</span></span>
          <span><span class="c-req ${afford ? "have" : "lack"}">${price} g</span>
          <button class="act-btn" data-buy="${id}" ${afford ? "" : "disabled"}>Buy</button></span></div>`;
      }
      for (const sid of (def.shop.spells || [])) {
        const sp = SPELLS[sid];
        if (p.spells.includes(sid)) continue;
        const price = sp.price || 100;
        const afford = p.gold >= price;
        rows += `<div class="craft-row"><span class="c-name" style="color:#a8bcd8">${sp.name} <span style="color:#6a665e;font-size:12px">spell — ${U.esc(sp.desc)}</span></span>
          <span><span class="c-req ${afford ? "have" : "lack"}">${price} g</span>
          <button class="act-btn" data-spell="${sid}" ${afford ? "" : "disabled"}>Learn</button></span></div>`;
      }
    } else {
      for (const s of p.inventory) {
        const it = ITEMS[s.id];
        if (it.type === "key" || !it.value) continue;
        const price = p.sellPrice(it);
        const kept = Object.values(p.equip).includes(s.id) || p.isFavorite(s.id, "item"); // don't fat-finger your kit away
        rows += `<div class="craft-row"><span class="c-name r-${it.rarity}">${U.esc(it.name)}${s.n > 1 ? " ×" + s.n : ""}${kept ? ' <span style="color:#c9a86a;font-size:11px">★ kept</span>' : ""}</span>
          <span><span class="c-req have">${price} g</span>
          ${kept ? `<button class="act-btn" disabled title="Unfavorite or unequip to sell">Protected</button>` : `<button class="act-btn" data-sell="${s.id}">Sell</button>`}</span></div>`;
      }
      if (!rows) rows = `<i style="color:#5d574c">Nothing worth selling.</i>`;
    }
    panel.innerHTML = `<h2>${U.esc(def.name)}</h2>
      <div class="shop-gold">Your purse: ${U.fmt(p.gold)} gold
        &nbsp; <button class="act-btn" id="shop-buy">Buy</button>
        <button class="act-btn" id="shop-sell">Sell</button>
        <button class="act-btn" id="shop-close">Leave</button></div>${rows}`;
    U.el("shop-buy").onclick = () => this.renderShop(npcId, "buy");
    U.el("shop-sell").onclick = () => this.renderShop(npcId, "sell");
    U.el("shop-close").onclick = () => this.closeStation();
    panel.querySelectorAll("[data-buy]").forEach(b => b.onclick = () => {
      const it = ITEMS[b.dataset.buy];
      const price = p.buyPrice(it);
      if (p.gold < price) return;
      p.gold -= price;
      p.addItem(it.id, 1);
      p.gainSkill("speech", U.clamp(price / 12, 2, 14));
      Sfx.play("coin");
      this.renderShop(npcId, "buy");
    });
    panel.querySelectorAll("[data-spell]").forEach(b => b.onclick = () => {
      const sp = SPELLS[b.dataset.spell];
      const price = sp.price || 100;
      if (p.gold < price) return;
      p.gold -= price;
      p.learnSpell(sp.id);
      Sfx.play("levelup");
      this.renderShop(npcId, "buy");
    });
    panel.querySelectorAll("[data-sell]").forEach(b => b.onclick = () => {
      const it = ITEMS[b.dataset.sell];
      const price = p.sellPrice(it);
      p.removeItem(it.id, 1);
      p.gold += price;
      p.gainSkill("speech", U.clamp(price / 12, 2, 14));
      Sfx.play("coin");
      this.renderShop(npcId, "sell");
    });
  },

  /* ============ crafting ============ */

  // cost to hone to the next tier; Moonwright (sm_4) adds a dearer tier past the master limit
  honeCost(tier) {
    if (tier < HONE_TIERS.length) return HONE_TIERS[tier];
    const base = HONE_TIERS[HONE_TIERS.length - 1];
    return { gold: Math.round(base.gold * 2.2), mats: base.mats };
  },

  openCraft(kind) {
    this.closeDialogue();
    G.setState("station");
    U.show("station-screen");
    this.renderCraft(kind);
  },

  renderCraft(kind) {
    const p = G.player;
    const recipes = kind === "smith" ? RECIPES_SMITH : kind === "cook" ? RECIPES_COOK : RECIPES_ALCH;
    const skillId = kind === "cook" ? "alchemy" : kind === "smith" ? "smithing" : "alchemy";
    const lvl = p.skills[skillId].lvl;
    const verb = kind === "smith" ? "Forge" : kind === "cook" ? "Cook" : "Brew";
    const panel = U.el("station-panel");
    let rows = "";
    for (const r of recipes) {
      const out = ITEMS[r.out];
      const locked = kind !== "cook" && lvl < r.skillReq;
      let req = "", can = !locked;
      for (const m in r.mats) {
        if (!r.mats[m]) continue;
        const have = p.countItem(m);
        const ok = have >= r.mats[m];
        if (!ok) can = false;
        req += `<span class="${ok ? "have" : "lack"}">${ITEMS[m].name} ${have}/${r.mats[m]}</span> `;
      }
      rows += `<div class="craft-row" style="${locked ? "opacity:.45" : ""}">
        <span class="c-name r-${out.rarity}">${U.esc(out.name)} ${locked ? `<span style="color:#d89090;font-size:11px">(requires ${SKILL_DEFS[skillId].name} ${r.skillReq})</span>` : ""}</span>
        <span><span class="c-req">${req}</span>
        <button class="act-btn" data-craft="${r.out}" ${can ? "" : "disabled"}>${verb}</button></span></div>`;
    }

    /* the forge also hones edges */
    let honing = "";
    if (kind === "smith") {
      const honeStep = p.hasPerk("sm_2") ? 12 : 8;
      const maxTier = HONE_TIERS.length + (p.hasPerk("sm_4") ? 1 : 0);
      honing = `<h2 style="margin-top:22px">Hone an Edge — +${honeStep}% damage per tier</h2>`;
      const honables = p.inventory.filter(s => ["weapon", "bow", "staff"].includes(ITEMS[s.id].type));
      if (!honables.length) honing += `<i style="color:#5d574c">Nothing in your pack takes an edge.</i>`;
      for (const s of honables) {
        const it = ITEMS[s.id];
        const tier = p.honing[s.id] || 0;
        if (tier >= maxTier) {
          honing += `<div class="craft-row"><span class="c-name r-${it.rarity}">${U.esc(this.itemName(it, p))}</span>
            <span class="c-req have">honed to the bone</span></div>`;
          continue;
        }
        const cost = this.honeCost(tier);
        const goldCost = Math.round(cost.gold * (p.hasPerk("sm_1") ? 0.7 : 1));
        let req = `<span class="${p.gold >= goldCost ? "have" : "lack"}">${goldCost} g</span> `, can = p.gold >= goldCost;
        for (const m in cost.mats) {
          const ok = p.countItem(m) >= cost.mats[m];
          if (!ok) can = false;
          req += `<span class="${ok ? "have" : "lack"}">${ITEMS[m].name} ${p.countItem(m)}/${cost.mats[m]}</span> `;
        }
        honing += `<div class="craft-row">
          <span class="c-name r-${it.rarity}">${U.esc(this.itemName(it, p))} → +${tier + 1}${tier + 1 > HONE_TIERS.length ? " ✦" : ""}</span>
          <span><span class="c-req">${req}</span>
          <button class="act-btn" data-hone="${s.id}" ${can ? "" : "disabled"}>Hone</button></span></div>`;
      }
    }

    const title = kind === "smith" ? "Forge — Smithing " + lvl
      : kind === "cook" ? "Campfire — the old hunter's craft"
      : "Alchemy Bench — Alchemy " + lvl;
    panel.innerHTML = `<h2>${title}</h2>
      ${rows}${honing}<div style="margin-top:14px;text-align:right"><button class="act-btn" id="craft-close">Step away</button></div>`;
    U.el("craft-close").onclick = () => this.closeStation();
    panel.querySelectorAll("[data-craft]").forEach(b => b.onclick = () => {
      const r = recipes.find(q => q.out === b.dataset.craft);
      // consume (Thrifty Mortar may spare alchemy ingredients)
      const spare = kind === "alchemy" && p.hasPerk("al_2") && Math.random() < 0.2;
      if (!spare) for (const m in r.mats) if (r.mats[m]) p.removeItem(m, r.mats[m]);
      p.addItem(r.out, 1);
      p.gainSkill(skillId, kind === "cook" ? 4 : 14 + r.skillReq * 0.5);
      Sfx.play("craft");
      G.msg(`${kind === "smith" ? "Forged" : kind === "cook" ? "Cooked" : "Brewed"}: ${ITEMS[r.out].name}` + (spare ? " (ingredients spared)" : ""), "good");
      this.renderCraft(kind);
    });
    panel.querySelectorAll("[data-hone]").forEach(b => b.onclick = () => {
      const id = b.dataset.hone;
      const tier = p.honing[id] || 0;
      const maxTier = HONE_TIERS.length + (p.hasPerk("sm_4") ? 1 : 0);
      if (tier >= maxTier) return;
      const cost = this.honeCost(tier);
      const goldCost = Math.round(cost.gold * (p.hasPerk("sm_1") ? 0.7 : 1));
      if (p.gold < goldCost) return;
      for (const m in cost.mats) if (p.countItem(m) < cost.mats[m]) return;
      p.gold -= goldCost;
      for (const m in cost.mats) p.removeItem(m, cost.mats[m]);
      p.honing[id] = tier + 1;
      p.gainSkill("smithing", 18);
      Sfx.play("craft");
      G.msg(`Honed: ${this.itemName(ITEMS[id], p)}`, "good");
      this.renderCraft(kind);
    });
  },

  /* ============ the Wardens' Ledger (bounty board) ============ */

  openBoard() {
    G.setState("station");
    U.show("station-screen");
    this.renderBoard();
  },

  renderBoard() {
    const p = G.player;
    const panel = U.el("station-panel");
    if (!G.bounties || !G.bounties.length) Game.refreshBounties();
    let rows = "";
    for (const b of G.bounties) {
      const goldMult = p.hasPerk("sp_3") ? 1.2 : p.hasPerk("sp_1") ? 1.1 : 1;
      const payGold = Math.round(b.gold * goldMult);
      let status, action = "";
      if (!b.taken) {
        status = `<span class="c-req">pays ${payGold} g · ${b.embers} embers</span>`;
        action = `<button class="act-btn" data-take="${b.uid}">Take</button>`;
      } else if (b.kind === "gather") {
        const have = p.countItem(b.item);
        status = `<span class="c-req ${have >= b.need ? "have" : "lack"}">${Math.min(have, b.need)}/${b.need} in hand · ${payGold} g</span>`;
        if (have >= b.need) action = `<button class="act-btn" data-claim="${b.uid}">Deliver</button>`;
      } else if (b.progress >= b.need) {
        status = `<span class="c-req have">fulfilled · ${payGold} g · ${b.embers} embers</span>`;
        action = `<button class="act-btn" data-claim="${b.uid}">Claim</button>`;
      } else {
        status = `<span class="c-req">${b.progress}/${b.need} · ${payGold} g</span>`;
      }
      rows += `<div class="craft-row">
        <span class="c-name">${U.esc(Game.bountyText(b))} ${b.taken ? '<span style="color:#b9d8a0;font-size:11px">[taken]</span>' : ""}</span>
        <span>${status} ${action}</span></div>`;
    }
    panel.innerHTML = `<h2>The Wardens' Ledger${(G.cycle || 0) > 0 ? " — Cycle " + U.roman(G.cycle + 1) + " rates" : ""}</h2>
      <p class="lore-text" style="margin-bottom:10px">Contracts posted by the wall-guard, paid on proof.
      The board turns over each time you rest; contracts in hand stay pinned.</p>
      ${rows}
      <div style="margin-top:14px;text-align:right"><button class="act-btn" id="board-close">Step away</button></div>`;
    U.el("board-close").onclick = () => this.closeStation();
    panel.querySelectorAll("[data-take]").forEach(btn => btn.onclick = () => {
      const b = G.bounties.find(q => q.uid === btn.dataset.take);
      if (b) { b.taken = true; Sfx.play("quest"); G.msg("Contract taken: " + Game.bountyText(b), "good"); }
      this.renderBoard();
    });
    panel.querySelectorAll("[data-claim]").forEach(btn => btn.onclick = () => {
      const b = G.bounties.find(q => q.uid === btn.dataset.claim);
      if (!b) return;
      if (b.kind === "gather") {
        if (p.countItem(b.item) < b.need) return;
        p.removeItem(b.item, b.need);
      } else if (b.progress < b.need) return;
      const goldMult = p.hasPerk("sp_3") ? 1.2 : p.hasPerk("sp_1") ? 1.1 : 1;
      p.gold += Math.round(b.gold * goldMult);
      p.gainEmbers(b.embers);
      p.gainSkill("speech", 8);
      b.claimed = true;
      Sfx.play("quest_done");
      G.msg(`The Ledger pays: ${Math.round(b.gold * goldMult)} gold, ${b.embers} embers.`, "good");
      this.renderBoard();
    });
  },

  /* ============ enchanting (Lampwright's altar) ============ */

  openEnchant() {
    this.closeDialogue();
    G.setState("station");
    U.show("station-screen");
    this.enchSel = null;
    this.renderEnchant();
  },

  renderEnchant() {
    const p = G.player;
    const panel = U.el("station-panel");
    if (this.enchSel && !p.hasItem(this.enchSel)) this.enchSel = null;
    const lvl = p.skills.enchanting.lvl;
    const pot = p.enchPotency();
    const emberMult = p.hasPerk("en_2") ? 0.5 : 1;

    // enchantable gear in the pack
    let items = "";
    for (const s of p.inventory) {
      const it = ITEMS[s.id];
      const isWeapon = ["weapon", "bow", "staff"].includes(it.type);
      const isArmor = it.type === "armor" || it.type === "shield";
      if (!isWeapon && !isArmor) continue;
      const cur = p.itemEnchants(s.id);
      const max = isWeapon && p.hasPerk("en_3") ? 2 : 1;
      const sel = this.enchSel === s.id ? " sel" : "";
      items += `<div class="inv-row${sel}" data-ench-item="${s.id}">
        <span class="iname r-${it.rarity}">${U.esc(this.itemName(it, p))}</span>
        <span class="imeta">${cur.length}/${max} workings</span></div>`;
    }

    // workings for the selected item
    let workings = "";
    if (this.enchSel) {
      const it = ITEMS[this.enchSel];
      const isWeapon = ["weapon", "bow", "staff"].includes(it.type);
      const slotKind = isWeapon ? "weapon" : "armor";
      const cur = p.itemEnchants(this.enchSel);
      const max = isWeapon && p.hasPerk("en_3") ? 2 : 1;
      if (cur.length >= max) {
        workings = `<i style="color:#5d574c">${U.esc(this.itemName(it, p))} can hold no more.</i>`;
      } else {
        for (const eid in ENCHANTS) {
          const en = ENCHANTS[eid];
          if (en.slot !== slotKind || cur.includes(eid)) continue;
          const cost = Math.round(en.embers * emberMult);
          let req = `<span class="${p.embers >= cost ? "have" : "lack"}">${cost} embers</span> `;
          let can = p.embers >= cost;
          for (const m in en.mats) {
            const ok = p.countItem(m) >= en.mats[m];
            if (!ok) can = false;
            req += `<span class="${ok ? "have" : "lack"}">${ITEMS[m].name} ${p.countItem(m)}/${en.mats[m]}</span> `;
          }
          workings += `<div class="craft-row">
            <span class="c-name" style="color:#c8b8e8">${en.name} <span style="color:#6a665e;font-size:12px">${U.esc(en.desc)}</span></span>
            <span><span class="c-req">${req}</span>
            <button class="act-btn" data-ench="${eid}" ${can ? "" : "disabled"}>Bind</button></span></div>`;
        }
      }
    } else {
      workings = `<i style="color:#5d574c">Choose a piece from your pack. The altar will listen.</i>`;
    }

    panel.innerHTML = `<h2>Lampwright's Altar — Enchanting ${lvl} · potency ×${pot.toFixed(2)}</h2>
      <p class="lore-text" style="margin-bottom:10px">Embers power the working; materials shape it. What you bind to one blade lives in all of its kind your hands have known.</p>
      <div class="inv-layout">
        <div class="inv-list" style="max-height:360px">${items || '<i style="color:#5d574c">Nothing in your pack takes a working.</i>'}</div>
        <div class="inv-detail">${workings}</div>
      </div>
      <div style="margin-top:14px;text-align:right">
        <span style="color:#e07b39;margin-right:14px">◆ ${U.fmt(p.embers)} embers</span>
        <button class="act-btn" id="ench-close">Step away</button></div>`;
    U.el("ench-close").onclick = () => this.closeStation();
    panel.querySelectorAll("[data-ench-item]").forEach(el => el.onclick = () => {
      this.enchSel = el.dataset.enchItem;
      Sfx.play("ui");
      this.renderEnchant();
    });
    panel.querySelectorAll("[data-ench]").forEach(b => b.onclick = () => {
      const en = ENCHANTS[b.dataset.ench];
      const cost = Math.round(en.embers * emberMult);
      if (p.embers < cost) return;
      for (const m in en.mats) if (p.countItem(m) < en.mats[m]) return;
      p.embers -= cost;
      for (const m in en.mats) p.removeItem(m, en.mats[m]);
      if (!p.enchants[this.enchSel]) p.enchants[this.enchSel] = [];
      p.enchants[this.enchSel].push(en.id);
      p.gainSkill("enchanting", 22);
      p.hpMax = p.calcHpMax(); p.magMax = p.calcMagMax();
      Sfx.play("levelup");
      FX.burst(p.x, p.y, "#c8b8e8", 20, 110);
      G.msg(`Bound: ${en.name} into ${ITEMS[this.enchSel].name}`, "good");
      this.renderEnchant();
    });
  },

  closeStation() {
    U.hide("station-screen");
    if (G.state === "station") G.setState("play");
  },

  /* ============ book reader ============ */

  openBook(bookId) {
    const b = BOOKS[bookId];
    if (!b) return;
    G.player.readBooks[bookId] = true;
    U.hide("menu-screen");
    G.setState("station");
    U.show("station-screen");
    Sfx.play("read");
    const panel = U.el("station-panel");
    panel.innerHTML = `<div class="book-title">${U.esc(b.title)}</div>
      <div class="book-author">${U.esc(b.author)}</div>
      <div class="book-page">${U.esc(b.text)}</div>
      <div style="text-align:center;margin-top:18px"><button class="act-btn" id="book-close">Close the book</button></div>`;
    U.el("book-close").onclick = () => this.closeStation();
  },

  /* ============ boss bar ============ */

  showBossBar(def) {
    U.el("boss-name").textContent = def.name + (def.title ? ", " + def.title : "");
    U.show("boss-bar");
  },
  updateBossBar() {
    if (!G.bossFight) return;
    const b = G.bossFight;
    U.el("boss-bar-fill").style.width = Math.max(0, (b.hp / b.hpMax) * 100) + "%";
  },
  hideBossBar() { U.hide("boss-bar"); },

  /* ============ the ending ============ */

  openEndingChoice() {
    G.setState("station");
    U.show("station-screen");
    const panel = U.el("station-panel");
    if (G.flags.ending_chosen) {
      const chose = G.flags.ending_chosen === "kindle";
      panel.innerHTML = `<h2>The First Ember</h2>
        <p class="lore-text">${chose
          ? "The coal beats steadier now, fed and patient. It knows you. It is, in its way, grateful — and it is already, quietly, asking again."
          : "The vault holds a soft dark, full of the memory of warmth. Nothing here is afraid anymore. Somewhere beneath the silence, the question stirs in its sleep."}</p>
        <button class="shrine-opt" data-end="cycle">Answer it again — begin Cycle ${U.roman((G.cycle || 0) + 2)}
          <span class="so-sub">The March renews and hardens; you keep all you are and carry</span></button>
        <button class="shrine-opt" data-end="leave">Leave the vault in peace</button>`;
      panel.querySelector('[data-end="cycle"]').onclick = () => { this.closeStation(); Game.newCycle(); };
      panel.querySelector('[data-end="leave"]').onclick = () => this.closeStation();
      return;
    }
    panel.innerHTML = `<h2>The First Ember</h2>
      <p class="lore-text">It is smaller than you imagined — a coal you could cup in two hands, beating
      like the heart of something patient. The vault is silent. The Pale King's hoarded light drifts in the
      air like dust. The Ember asks, as it has asked every spark it ever threw:<br><br>
      <b style="color:#e8cf9a">Should I burn again — or may I finally rest?</b></p>
      <button class="shrine-opt" data-end="kindle">Feed yourself to the flame. Kindle the Ember anew.
        <span class="so-sub">The age of light continues. Someone else will stand here, someday.</span></button>
      <button class="shrine-opt" data-end="dark">Let it go out. Hold its hand while it ends.
        <span class="so-sub">The long dusk comes — and after it, perhaps, an honest dawn.</span></button>`;
    panel.querySelector('[data-end="kindle"]').onclick = () => this.runEnding("kindle");
    panel.querySelector('[data-end="dark"]').onclick = () => this.runEnding("dark");
  },

  runEnding(which) {
    G.flags.ending_chosen = which;
    QS.update();
    U.hide("station-screen");
    U.hide("hud-dom");
    G.setState("ending");
    Music.setMood("title");
    const txt = U.el("ending-text"), sub = U.el("ending-sub");
    if (which === "kindle") {
      txt.textContent = "THE EMBER BURNS";
      sub.innerHTML = "You hold your hand to the coal and give it a measure of what it asks — not all; sparks are stubborn.<br>" +
        "Far away, in Emberfall, every lamp flares gold at once, and Serah closes her eyes.<br>" +
        "The March is warmer now. And you are still walking in it.<br><br><i>— the age of flame continues —</i>";
    } else {
      txt.textContent = "THE LONG DUSK";
      sub.innerHTML = "You sit with the Ember as it dims, the way one sits with the dying: quietly, holding on.<br>" +
        "What follows is not the Deep Dark. It is soft, and full of stars, and you are still beneath them.<br>" +
        "Somewhere above, for the first time in four hundred years, the March dreams of morning.<br><br><i>— the age of embers wanes —</i>";
    }
    U.show("ending-screen");
    requestAnimationFrame(() => {
      U.el("ending-screen").classList.add("on");
      setTimeout(() => {
        const btns = U.el("ending-btns");
        btns.classList.remove("hidden");
        U.el("ending-continue").onclick = () => {
          U.hide("ending-screen");
          U.el("ending-screen").classList.remove("on");
          btns.classList.add("hidden");
          U.show("hud-dom");
          G.setState("play");
          Music.setMood(G.map.outdoor ? "world" : "dungeon");
          G.banner("THE MARCH REMAINS", "and so do you");
          G.msg("The story holds its breath, not its ending. The next cycle waits at any shrine.", "good");
          SaveSys.save(G.saveSlot);
        };
        U.el("ending-cycle").onclick = () => {
          U.hide("ending-screen");
          U.el("ending-screen").classList.remove("on");
          btns.classList.add("hidden");
          Game.newCycle();
        };
      }, 5200);
    });
  },

  /* ============ favorites (Skyrim-style quick-select) ============ */

  openFavorites() {
    if (G.state !== "play") return;
    const p = G.player;
    if (!p) return;
    p.draw = null; G.slowmoAim = false; p.holding = false; p.holdT = 0;
    if (document.exitPointerLock) document.exitPointerLock();
    G.setState("favorites");
    U.show("favorites-screen");
    this.renderFavorites();
    Sfx.play("ui");
  },

  closeFavorites() {
    U.hide("favorites-screen");
    if (G.state === "favorites") G.setState("play");
  },

  renderFavorites() {
    const p = G.player;
    const box = U.el("fav-content");
    let html = "";

    /* ---- favorites quick-select ---- */
    if (!p.favorites.length) {
      html += `<i style="color:#5d574c">No favorites yet. Open your pack [Tab] or the Magic tab and mark gear, potions and spells with ★ — they gather here for quick selection.</i>`;
    } else {
      html += `<div class="fav-cat">Favorites <span style="color:#5d574c;text-transform:none;letter-spacing:0">— press 1–9 to select, ▲▼ to reorder</span></div>`;
      for (let i = 0; i < p.favorites.length; i++) {
        const f = p.favorites[i];
        const hot = i < 9 ? `<span class="f-hot">${i + 1}</span>` : `<span class="f-hot"> </span>`;
        const reorder = `<button class="act-btn f-mv" data-favup="${i}"${i === 0 ? " disabled" : ""}>▲</button>` +
                        `<button class="act-btn f-mv" data-favdown="${i}"${i === p.favorites.length - 1 ? " disabled" : ""}>▼</button>`;
        if (f.type === "spell") {
          const sp = SPELLS[f.id]; if (!sp) continue;
          const eq = p.equippedSpell === f.id;
          html += `<div class="fav-row${eq ? " equipped" : ""}" draggable="true" data-fav="${i}">
            ${hot}<span class="f-name">${sp.name}</span>
            <span class="f-kind">spell · ${Combat.spellCost(p, sp)} mg${eq ? " · equipped" : ""}</span>
            ${reorder}<button class="act-btn" data-favbelt="${i}">${p.beltIndexOf(f.id, "spell") >= 0 ? "− Belt" : "+ Belt"}</button></div>`;
        } else {
          const it = ITEMS[f.id]; if (!it) continue;
          const have = p.countItem(f.id), eq = Object.values(p.equip).includes(f.id);
          const isC = it.type === "consumable";
          html += `<div class="fav-row${eq ? " equipped" : ""}" draggable="true" data-fav="${i}">
            ${hot}<span class="f-name r-${it.rarity}">${U.esc(this.itemName(it, p))}${isC ? " ×" + have : ""}</span>
            <span class="f-kind">${it.type}${eq ? " · equipped" : ""}${(!isC && have === 0) ? " · none carried" : ""}</span>
            ${reorder}<button class="act-btn" data-favbelt="${i}">${p.beltIndexOf(f.id, "item") >= 0 ? "− Belt" : "+ Belt"}</button></div>`;
        }
      }
    }

    /* ---- gear loadouts ---- */
    html += `<div class="fav-cat">Gear Loadouts <span style="color:#5d574c;text-transform:none;letter-spacing:0">— snapshot your kit + spell, swap in a tap</span></div>`;
    for (let s = 1; s <= 3; s++) {
      const lo = p.loadouts[s];
      const roman = ["", "I", "II", "III"][s];
      if (lo) {
        const w = lo.equip.weapon ? (ITEMS[lo.equip.weapon] ? ITEMS[lo.equip.weapon].name : lo.equip.weapon) : "Fists";
        const sp = lo.spell && SPELLS[lo.spell] ? SPELLS[lo.spell].name : "—";
        html += `<div class="fav-row" data-loadapply="${s}">
          <span class="f-hot">${roman}</span>
          <span class="f-name">${U.esc(w)} <span style="color:#5d574c">·</span> <span style="color:#a8bcd8">${U.esc(sp)}</span></span>
          <span class="f-kind">equip kit</span>
          <button class="act-btn" data-loadsave="${s}">Overwrite</button>
          <button class="act-btn danger" data-loadclear="${s}">Clear</button></div>`;
      } else {
        html += `<div class="fav-row" data-loadsave="${s}">
          <span class="f-hot">${roman}</span>
          <span class="f-name" style="color:#5d574c">Loadout ${roman} — empty</span>
          <span class="f-kind">save current kit</span></div>`;
      }
    }

    box.innerHTML = html;

    box.querySelectorAll("[data-fav]").forEach(row => {
      row.onclick = () => { const f = p.favorites[parseInt(row.dataset.fav)]; if (f) this.favActivate(f); };
      row.ondragstart = ev => { this._favDrag = parseInt(row.dataset.fav); if (ev.dataTransfer) ev.dataTransfer.effectAllowed = "move"; };
      row.ondragover = ev => ev.preventDefault();
      row.ondrop = ev => {
        ev.preventDefault();
        const to = parseInt(row.dataset.fav), from = this._favDrag;
        if (from != null && from !== to) { const m = p.favorites.splice(from, 1)[0]; p.favorites.splice(to, 0, m); Sfx.play("ui"); this.renderFavorites(); }
        this._favDrag = null;
      };
    });
    box.querySelectorAll("[data-favbelt]").forEach(b => b.onclick = ev => {
      ev.stopPropagation();
      const f = p.favorites[parseInt(b.dataset.favbelt)];
      if (f) p.beltToggle(f.id, f.type);
      Sfx.play("ui"); this.renderFavorites();
    });
    box.querySelectorAll("[data-favup]").forEach(b => b.onclick = ev => {
      ev.stopPropagation(); p.favoriteMove(parseInt(b.dataset.favup), -1); Sfx.play("ui"); this.renderFavorites();
    });
    box.querySelectorAll("[data-favdown]").forEach(b => b.onclick = ev => {
      ev.stopPropagation(); p.favoriteMove(parseInt(b.dataset.favdown), 1); Sfx.play("ui"); this.renderFavorites();
    });
    box.querySelectorAll("[data-loadapply]").forEach(row => row.onclick = ev => {
      if (ev.target.dataset.loadsave || ev.target.dataset.loadclear) return; // let buttons handle themselves
      const s = parseInt(row.dataset.loadapply);
      if (p.applyLoadout(s)) { Sfx.play("equip"); G.msg("Loadout equipped.", "good"); this.closeFavorites(); }
      else Sfx.play("deny");
    });
    box.querySelectorAll("[data-loadsave]").forEach(b => b.onclick = ev => {
      ev.stopPropagation(); const s = parseInt(b.dataset.loadsave);
      p.saveLoadout(s); Sfx.play("ui"); G.tip("loadout", "Loadouts snapshot your gear and spell — equip a saved kit to swap everything at once.");
      this.renderFavorites();
    });
    box.querySelectorAll("[data-loadclear]").forEach(b => b.onclick = ev => {
      ev.stopPropagation(); delete p.loadouts[parseInt(b.dataset.loadclear)]; Sfx.play("ui"); this.renderFavorites();
    });
  },

  // shared activation for click + digit hotkeys; closes the overlay on success
  favActivate(f) {
    const p = G.player;
    if (f.type === "spell") {
      if (p.spells.includes(f.id)) { p.equippedSpell = f.id; Sfx.play("ui"); this.closeFavorites(); return true; }
      Sfx.play("deny"); return false;
    }
    const it = ITEMS[f.id];
    if (it && it.type === "consumable") {
      if (p.hasItem(f.id)) { p.useConsumable(f.id); this.closeFavorites(); return true; }
      Sfx.play("deny"); return false;
    }
    if (it) {
      if (p.hasItem(f.id)) { p.equipItem(f.id); this.closeFavorites(); return true; }
      Sfx.play("deny"); return false;
    }
    return false;
  },

  // 1-based selection used by the 1–9 hotkeys
  favSelect(n) {
    const f = G.player.favorites[n - 1];
    if (!f) { Sfx.play("deny"); return false; }
    return this.favActivate(f);
  },

  /* ============ help / manual ============ */

  showHelp() {
    G.setState("help");
    U.el("help-content").innerHTML = `
      <h3>View & movement</h3>
      <p><b>V</b> toggles first-person / top-down at any time (also in System; your choice is saved).
      In first person: <b>mouse</b> looks and pitches (click to capture; Esc releases),
      <b>←/→</b> also turn, <b>W/S</b> walk, <b>A/D</b> strafe, and <b>E</b> uses whatever you're looking at.
      Field of view, look sensitivity and invert-Y live in the System menu.
      In top-down: <b>WASD</b> moves, cursor aims.</p>
      <p><b>Shift</b> sprint · <b>Space</b> dodge roll (i-frames) · <b>Ctrl/X</b> sneak</p>
      <h3>Combat</h3>
      <p><b>LMB tap</b> light attack · <b>LMB hold</b> heavy attack — you keep moving while you swing,
      a press mid-swing <b>buffers the next blow</b>, and <b>Space</b> rolls out of the follow-through</p>
      <p><b>RMB hold</b> block with shield — raise it at the last instant to <b>parry</b></p>
      <p><b>F hold</b> draw bow, release to loose · <b>Q</b> cast equipped spell</p>
      <p><b>1–5</b> speak Edicts of the Old Tongue · <b>R</b> drink the Ember Flask · <b>P</b> photo (clean screenshot)</p>
      <p><b>T</b> use the selected quick-belt slot · <b>mouse wheel</b> or <b>[ / ]</b> cycle the belt — consumables you gather fill it automatically; weapons and spells can be slotted for quick-swap</p>
      <p><b>Z</b> favorites: a quick-select of anything you've marked with ★ — click or press <b>1–9</b> to equip/use, <b>▲▼</b> (or drag) to reorder, or assign to a belt slot. Save up to three <b>gear loadouts</b> here to swap your whole kit + spell in a tap.</p>
      <h3>World</h3>
      <p><b>E</b> interact — shrines, people, chests, herbs, doors, graves, campfires, wells</p>
      <p><b>Tab</b> menu · <b>M</b> map · <b>J</b> journal · <b>C</b> character · <b>Esc</b> close/system</p>
      <h3>The rules of the March</h3>
      <p>Slain foes yield <b>embers</b> — spend them at shrines to level. Death drops your embers
      where you fell; reach them again to reclaim them, but die once more and they are gone forever.</p>
      <p><b>Resting at a shrine</b> restores you, refills the flask, saves the world — and wakes everything you killed.</p>
      <p>Stamina governs all action. Equip load governs your roll. Watch both.</p>
      <p>Skills grow with use; every 5th skill level grants a perk point.</p>
      <p>Enemies telegraph in <b style="color:#d89090">red</b>. Sneak attacks from behind unaware foes deal brutal damage — approach from behind and they notice far less.</p>
      <p><b>Hone weapons</b> at any forge (+8% damage a tier, three tiers). <b>Cook</b> hunted meat at campfires. Beware <b style="color:#ff7a3a">ashen elites</b> — they burn brighter and hit harder, but carry triple embers.</p>
      <p>Hunt deer and hares for meat and hides. Search old graves if you dare; the tenants object roughly one time in four.</p>
      <h3>The Ledger, the line & the conjured</h3>
      <p>The <b>Wardens' Ledger</b> by the Emberfall inn posts rotating contracts — cull, gather, or
      hunt the ashen — paid in gold and embers, refreshed each rest, scaled by cycle. Buy a
      <b>fishing rod</b> (Petra, Senn), face open water and cast: strike on the bite with <b>E</b>.
      <b>Conjuration</b> spells summon an ember sprite that fights beside you, or a lantern that
      walks the dark with you. The <b>Bestiary</b> in your journal remembers everything you've felled.</p>
      <h3>The third craft & the next cycle</h3>
      <p><b>Enchanting</b> at a Lampwright's altar (Serah's lamp-house, the Unlit Tower) binds
      embers into gear: elemental brands, lifesteal, wards, and more — potency grows with the skill.
      After the vault's question is answered, the world goes on; any shrine can begin the
      <b>next cycle</b>: the March renews and hardens, and you keep everything you are.</p>
      <h3>Words & wagers</h3>
      <p><b>Speech</b> grows with every trade: better prices, and (with Silver Tongue) <b>persuasion</b>
      options in conversation. <b>Brann's Gauntlet</b> south of the crossroads pays embers per survived
      wave — five waves makes you champion. The <b>White Pass</b> holds two frozen armies; search the
      soldiers if you dare, and listen to Eirik before you go.</p>
      <h3>The road</h3>
      <p>Speak with <b>Serah the Lampwright</b> in Emberfall. Claim the four Sigils of the Wardens.
      Open the Citadel of Hollows. Decide what the light does next.</p>`;
    U.show("help-screen");
  },
};
