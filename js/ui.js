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
    U.el("cg-back").onclick = () => { U.hide("chargen-screen"); U.show("title-screen"); G.setState("title"); };
    U.el("cg-begin").onclick = () => {
      const name = U.el("cg-name").value.trim() || "Wanderer";
      Game.newGame(name, this.chosenOrigin || "marchwarden");
    };
    U.el("ending-btn").onclick = () => location.reload();

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
    const stock = (npc, ids) => { const s = NPC_DEFS[npc].shop; if (s && s.stock) s.stock.push(...ids); };
    stock("serah", ["book_ember_treatise", "book_emberborn_book", "book_old_tongue_primer"]);
    stock("tobbe", ["book_shattered_march", "book_bestiary"]);
    stock("petra", ["book_duskmere_book"]);
    stock("sigrun", ["book_frosthollow_book"]);
    stock("maren", ["book_alchemy_primer"]);
    LOOT.chest_fine.push({ w: 1, id: "book_wardens_book", n: [1, 1] });
    LOOT.chest_rare.push({ w: 1, id: "book_citadel_book", n: [1, 1] });
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
        U.el("cg-origin-desc").innerHTML =
          `${U.esc(o.desc)}<div class="stat-line">VIG ${a.vig} · END ${a.end} · MND ${a.mnd} · STR ${a.str} · FIN ${a.fin} · WIL ${a.wil}</div>`;
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
        ? `<button class="shrine-opt" data-load="${s}">Slot ${s} — ${U.esc(info.name)}, level ${info.level} ${info.origin}
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
    let list = "";
    for (const [label, types] of cats) {
      const rows = p.inventory.filter(s => types.includes(ITEMS[s.id].type));
      if (!rows.length) continue;
      list += `<div class="inv-cat">${label}</div>`;
      for (const s of rows) {
        const it = ITEMS[s.id];
        const eq = Object.values(p.equip).includes(s.id);
        const sel = this.selItem === s.id ? " sel" : "";
        list += `<div class="inv-row${eq ? " equipped" : ""}${sel}" data-item="${s.id}">
          <span class="iname r-${it.rarity}">${U.esc(it.name)}${s.n > 1 ? " ×" + s.n : ""}</span>
          <span class="imeta">${this.itemMeta(it)} · ${it.weight || 0}wt</span></div>`;
      }
    }
    c.innerHTML = `<div class="inv-layout">
      <div class="inv-list">${list || '<i style="color:#5d574c">Your pack is empty.</i>'}</div>
      <div class="inv-detail" id="inv-detail"></div></div>`;
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
    if (it.type === "consumable") actions += `<button class="act-btn" data-act="use">Use</button>`;
    if (it.type === "book") actions += `<button class="act-btn" data-act="read">Read</button>`;
    if (it.type !== "key") actions += `<button class="act-btn danger" data-act="drop">Discard</button>`;

    box.innerHTML = `<div class="idetail-name r-${it.rarity}">${U.esc(it.name)}</div>
      <div class="idetail-type">${it.type}${it.twoHanded ? " · two-handed" : ""}</div>
      <div class="idetail-stats">${stats}</div>
      <div class="idetail-lore">${U.esc(it.lore || "")}</div>
      <div class="idetail-actions">${actions}</div>`;
    box.querySelectorAll("[data-act]").forEach(b => b.onclick = () => {
      if (b.dataset.act === "equip") p.equipItem(it.id);
      else if (b.dataset.act === "use") p.useConsumable(it.id);
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
        <span class="slot-item ${it ? "r-" + it.rarity : "empty"}">${it ? U.esc(it.name) : "—"}</span></div>`;
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
      if (G.player.equip[s]) { G.player.equip[s] = null; Sfx.play("equip"); this.renderMenu(); }
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
    c.innerHTML = `<h2>${U.esc(p.name)} — ${ORIGINS[p.origin].name}</h2>
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
      spells += `<div class="spell-row${p.equippedSpell === id ? " equipped" : ""}" data-spell="${id}">
        <span class="sp-name">${sp.name}</span>
        <span class="spell-desc">${U.esc(sp.desc)}</span>
        <span class="sp-cost">${Combat.spellCost(p, sp)} mg</span></div>`;
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
        ${info ? `<button class="act-btn" data-load2="${s}">Load</button>` : ""}</div>`;
    }
    const chk = (key, label) => `<label style="display:flex;justify-content:space-between;cursor:pointer">
      <span>${label}</span><input type="checkbox" data-set="${key}" ${G.settings[key] ? "checked" : ""}></label>`;
    c.innerHTML = `<h2>System</h2><div class="sys-rows">
      ${slots}
      <hr style="border-color:#2c2719">
      ${chk("music", "Music")}${chk("sfx", "Sound effects")}${chk("screenShake", "Screen shake")}${chk("showDamage", "Damage numbers")}
      <button class="act-btn" id="sys-help">Manual & Controls</button>
      <button class="act-btn danger" id="sys-quit">Quit to title (unsaved progress is lost)</button>
    </div>
    <p class="sys-note">The world is also saved automatically whenever you rest at a shrine.</p>`;
    c.querySelectorAll("[data-save]").forEach(b => b.onclick = () => {
      if (SaveSys.save(parseInt(b.dataset.save))) { G.msg("Saved.", "good"); Sfx.play("quest"); }
      this.renderMenu();
    });
    c.querySelectorAll("[data-load2]").forEach(b => b.onclick = () => {
      this.closeMenu();
      Game.loadGame(parseInt(b.dataset.load2));
    });
    c.querySelectorAll("[data-set]").forEach(el => el.onchange = () => {
      G.settings[el.dataset.set] = el.checked;
      if (el.dataset.set === "music") { const m = Music.mood; Music.mood = null; Music.setMood(el.checked ? (m || "world") : null); }
    });
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
      box.innerHTML = `
        <button class="shrine-opt" data-o="rest">Rest at the ember
          <span class="so-sub">Restore vitals & flask · the slain return · the world is saved</span></button>
        <button class="shrine-opt" data-o="level">Kindle the self — level ${p.level} → ${p.level + 1}
          <span class="so-sub">Cost: ${U.fmt(LEVEL_COST(p.level))} embers (you carry ${U.fmt(p.embers)})</span></button>
        <button class="shrine-opt" data-o="travel">Walk the ember-paths
          <span class="so-sub">Travel between shrines you have knelt to</span></button>
        <button class="shrine-opt" data-o="leave">Rise and continue</button>`;
      box.querySelector('[data-o="rest"]').onclick = () => { this.closeShrine(); Game.restAtShrine(s); };
      box.querySelector('[data-o="level"]').onclick = () => this.renderShrine("level");
      box.querySelector('[data-o="travel"]').onclick = () => this.renderShrine("travel");
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
        const afford = p.gold >= it.value;
        rows += `<div class="craft-row"><span class="c-name r-${it.rarity}">${U.esc(it.name)} <span style="color:#6a665e;font-size:12px">${this.itemMeta(it)}</span></span>
          <span><span class="c-req ${afford ? "have" : "lack"}">${it.value} g</span>
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
        const price = Math.max(1, Math.floor(it.value * 0.4));
        rows += `<div class="craft-row"><span class="c-name r-${it.rarity}">${U.esc(it.name)}${s.n > 1 ? " ×" + s.n : ""}</span>
          <span><span class="c-req have">${price} g</span>
          <button class="act-btn" data-sell="${s.id}">Sell</button></span></div>`;
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
      if (p.gold < it.value) return;
      p.gold -= it.value;
      p.addItem(it.id, 1);
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
      p.removeItem(it.id, 1);
      p.gold += Math.max(1, Math.floor(it.value * 0.4));
      Sfx.play("coin");
      this.renderShop(npcId, "sell");
    });
  },

  /* ============ crafting ============ */

  openCraft(kind) {
    this.closeDialogue();
    G.setState("station");
    U.show("station-screen");
    this.renderCraft(kind);
  },

  renderCraft(kind) {
    const p = G.player;
    const recipes = kind === "smith" ? RECIPES_SMITH : RECIPES_ALCH;
    const skillId = kind === "smith" ? "smithing" : "alchemy";
    const lvl = p.skills[skillId].lvl;
    const panel = U.el("station-panel");
    let rows = "";
    for (const r of recipes) {
      const out = ITEMS[r.out];
      const locked = lvl < r.skillReq;
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
        <button class="act-btn" data-craft="${r.out}" ${can ? "" : "disabled"}>${kind === "smith" ? "Forge" : "Brew"}</button></span></div>`;
    }
    panel.innerHTML = `<h2>${kind === "smith" ? "Forge — Smithing " + lvl : "Alchemy Bench — Alchemy " + lvl}</h2>
      ${rows}<div style="margin-top:14px;text-align:right"><button class="act-btn" id="craft-close">Step away</button></div>`;
    U.el("craft-close").onclick = () => this.closeStation();
    panel.querySelectorAll("[data-craft]").forEach(b => b.onclick = () => {
      const r = recipes.find(q => q.out === b.dataset.craft);
      // consume (Thrifty Mortar may spare alchemy ingredients)
      const spare = kind !== "smith" && p.hasPerk("al_2") && Math.random() < 0.2;
      if (!spare) for (const m in r.mats) if (r.mats[m]) p.removeItem(m, r.mats[m]);
      p.addItem(r.out, 1);
      p.gainSkill(skillId, 14 + r.skillReq * 0.5);
      Sfx.play("craft");
      G.msg(`${kind === "smith" ? "Forged" : "Brewed"}: ${ITEMS[r.out].name}` + (spare ? " (ingredients spared)" : ""), "good");
      this.renderCraft(kind);
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
      sub.innerHTML = "You step into the coal's small warmth and give it the only fuel it ever wanted.<br>" +
        "Far away, in Emberfall, every lamp flares gold at once, and Serah closes her eyes.<br>" +
        "The March will not remember your name. The light remembers nothing else.<br><br><i>— the age of flame continues —</i>";
    } else {
      txt.textContent = "THE LONG DUSK";
      sub.innerHTML = "You sit with the Ember as it dims, the way one sits with the dying: quietly, holding on.<br>" +
        "When it goes, the dark that follows is not the Deep Dark. It is soft, and full of stars.<br>" +
        "Somewhere above, for the first time in four hundred years, the March dreams of morning.<br><br><i>— the age of embers ends —</i>";
    }
    U.show("ending-screen");
    requestAnimationFrame(() => {
      U.el("ending-screen").classList.add("on");
      setTimeout(() => U.show("ending-btn"), 5200);
    });
  },

  /* ============ help / manual ============ */

  showHelp() {
    G.setState("help");
    U.el("help-content").innerHTML = `
      <h3>Movement</h3>
      <p><b>WASD</b> move · <b>Shift</b> sprint · <b>Space</b> dodge roll (i-frames) · <b>Ctrl/X</b> sneak</p>
      <h3>Combat</h3>
      <p><b>LMB tap</b> light attack · <b>LMB hold</b> heavy attack</p>
      <p><b>RMB hold</b> block with shield — raise it at the last instant to <b>parry</b></p>
      <p><b>F hold</b> draw bow, release to loose · <b>Q</b> cast equipped spell</p>
      <p><b>1–4</b> speak Edicts of the Old Tongue · <b>R</b> drink the Ember Flask</p>
      <h3>World</h3>
      <p><b>E</b> interact — shrines, people, chests, herbs, doors</p>
      <p><b>Tab</b> menu · <b>M</b> map · <b>J</b> journal · <b>C</b> character · <b>Esc</b> close/system</p>
      <h3>The rules of the March</h3>
      <p>Slain foes yield <b>embers</b> — spend them at shrines to level. Death drops your embers
      where you fell; reach them again to reclaim them, but die once more and they are gone forever.</p>
      <p><b>Resting at a shrine</b> restores you, refills the flask, saves the world — and wakes everything you killed.</p>
      <p>Stamina governs all action. Equip load governs your roll. Watch both.</p>
      <p>Skills grow with use; every 5th skill level grants a perk point.</p>
      <p>Enemies telegraph in <b style="color:#d89090">red</b>. Sneak attacks from behind unaware foes deal brutal damage.</p>
      <h3>The road</h3>
      <p>Speak with <b>Serah the Lampwright</b> in Emberfall. Claim the four Sigils of the Wardens.
      Open the Citadel of Hollows. Decide what the light does next.</p>`;
    U.show("help-screen");
  },
};
