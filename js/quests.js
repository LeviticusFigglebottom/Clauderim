/* ============================================================
   CLAUDERIM — quests.js
   Quest state machine: stage tracking, kill/collect/reach/
   boss/sigil objectives, rewards, journal text.
   State lives on the player (p.quests[id] = {stage, counts, done}).
   ============================================================ */
"use strict";

const SIGIL_ITEMS = ["sigil_grave", "sigil_mire", "sigil_frost", "sigil_ash"];

const QS = {

  /* -1 = not started; n = current stage index; 999 = done */
  stage(id) {
    const q = G.player && G.player.quests[id];
    if (!q) return -1;
    if (q.done) return 999;
    return q.stage;
  },

  start(id) {
    const p = G.player;
    if (!p || p.quests[id]) return;
    p.quests[id] = { stage: 0, counts: {}, done: false };
    const q = QUESTS[id];
    G.questToast("NEW QUEST", q.name);
    Sfx.play("quest");
    this.hooksFor(id, 0);
    // deeds already done count: a boss slain before the asking still satisfies it
    const obj = this.currentObjective(id);
    if (obj && obj.kind === "boss" && G.slainBosses[obj.boss]) this.advance(id);
  },

  advance(id) {
    const p = G.player;
    const st = p.quests[id];
    if (!st || st.done) return;
    const q = QUESTS[id];
    st.stage++;
    st.counts = {};
    if (st.stage >= q.stages.length) {
      this.complete(id);
      return;
    }
    G.questToast("QUEST UPDATED", q.name);
    Sfx.play("quest");
    this.hooksFor(id, st.stage);
  },

  complete(id) {
    const p = G.player;
    const st = p.quests[id];
    if (!st || st.done) return;
    const q = QUESTS[id];
    // consume collect-objective items (handed over)
    for (const s of q.stages) {
      if (s.objective && s.objective.kind === "collect") {
        p.removeItem(s.objective.item, Math.min(p.countItem(s.objective.item), s.objective.count));
      }
    }
    st.done = true;
    st.stage = q.stages.length;
    const r = q.rewards || {};
    if (r.gold) { p.gold += r.gold; G.msg(`Received ${r.gold} gold`, "good"); }
    if (r.embers) p.gainEmbers(r.embers);
    if (r.items) for (const pair of r.items) { p.addItem(pair[0], pair[1]); G.msg(`Received ${ITEMS[pair[0]].name}`, "good"); }
    if (r.flaskUp) {
      p.flask.max += r.flaskUp;
      p.flask.charges = p.flask.max;
    }
    if (q.rewardText) G.msg(q.rewardText, "good");
    G.questToast("QUEST COMPLETE", q.name);
    Sfx.play("quest_done");
  },

  /* stage-entry side effects */
  hooksFor(id, stage) {
    if (id === "mq_ember" && stage === 1) {
      for (const poi of ["barrow", "mire_deep", "frost_keep", "ash_temple", "citadel"]) World.revealPoi(poi);
      G.msg("The Wardens' lairs are marked on your map.", "good");
    }
  },

  sigilCount() {
    const p = G.player;
    if (!p) return 0;
    return SIGIL_ITEMS.reduce((n, s) => n + (p.hasItem(s) ? 1 : 0), 0);
  },

  currentObjective(id) {
    const st = this.stage(id);
    if (st < 0 || st === 999) return null;
    return QUESTS[id].stages[st].objective || null;
  },

  /* ---- event hooks ---- */

  onKill(typeId) {
    const p = G.player;
    for (const id in p.quests) {
      const obj = this.currentObjective(id);
      if (!obj || obj.kind !== "kill" || obj.enemy !== typeId) continue;
      const st = p.quests[id];
      st.counts.kill = (st.counts.kill || 0) + 1;
      const q = QUESTS[id];
      if (st.counts.kill >= obj.count) {
        this.advance(id);
      } else {
        G.msg(`${q.name}: ${st.counts.kill}/${obj.count}`, "good");
      }
    }
  },

  onBoss(bossId) {
    const p = G.player;
    for (const id in p.quests) {
      const obj = this.currentObjective(id);
      if (obj && obj.kind === "boss" && obj.boss === bossId) this.advance(id);
    }
  },

  onTalk(npcId) {
    const p = G.player;
    for (const id in p.quests) {
      const obj = this.currentObjective(id);
      if (obj && obj.kind === "talk" && obj.npc === npcId) {
        // talk stages normally advance through dialogue actions; this is a
        // fallback for quests with no bespoke node (e.g. delivery handled in node)
      }
    }
  },

  /* polled objectives: collect / reach / sigils / flag */
  update() {
    const p = G.player;
    if (!p) return;
    for (const id in p.quests) {
      const obj = this.currentObjective(id);
      if (!obj) continue;
      if (obj.kind === "collect") {
        if (p.countItem(obj.item) >= obj.count) this.advance(id);
      } else if (obj.kind === "sigils") {
        if (this.sigilCount() >= obj.count) this.advance(id);
      } else if (obj.kind === "flag") {
        if (G.flags[obj.flag]) this.advance(id);
      } else if (obj.kind === "flags") {
        if (this.flagCount(obj.prefix) >= obj.count) this.advance(id);
      } else if (obj.kind === "reach") {
        const poi = World.poiById(obj.poi);
        if (!poi) continue;
        if (poi.interior && G.map && G.map.id === poi.interior) this.advance(id);
        else if (G.map && G.map.id === "overworld" &&
                 U.dist(p.x, p.y, poi.tx * TILE, poi.ty * TILE) < 180) this.advance(id);
      }
    }
  },

  flagCount(prefix) {
    let n = 0;
    for (const k in G.flags) if (k.startsWith(prefix) && G.flags[k]) n++;
    return n;
  },

  /* journal helpers */
  objectiveText(id) {
    const obj = this.currentObjective(id);
    if (!obj) return "";
    const p = G.player, st = p.quests[id];
    let txt = obj.hint || "";
    if (obj.kind === "kill") txt = txt.replace(/\(0\//, `(${st.counts.kill || 0}/`);
    if (obj.kind === "flags") txt = txt.replace(/\(0\//, `(${this.flagCount(obj.prefix)}/`);
    if (obj.kind === "collect") txt += ` — ${Math.min(p.countItem(obj.item), obj.count)}/${obj.count}`;
    if (obj.kind === "sigils") txt += ` — ${this.sigilCount()}/${obj.count}`;
    return txt;
  },

  /* the place your current task points to, for compass/map stars */
  currentTargetPoi() {
    const p = G.player;
    if (!p) return null;
    // main quest first, then sides
    for (const en of this.journalEntries()) {
      if (en.st.done) continue;
      const obj = this.currentObjective(en.id);
      if (!obj) continue;
      const poiId = obj.targetPoi || (obj.kind === "reach" ? obj.poi : null);
      if (!poiId) continue;
      const poi = World.poiById(poiId);
      if (poi && (!poi.hidden || G.discoveredPois[poiId])) return poi;
    }
    return null;
  },

  /* sorted entries for the journal tab */
  journalEntries() {
    const p = G.player;
    const out = [];
    for (const id in p.quests) {
      const q = QUESTS[id], st = p.quests[id];
      out.push({ id, q, st });
    }
    out.sort((a, b) => {
      if (a.st.done !== b.st.done) return a.st.done ? 1 : -1;
      if ((a.q.type === "main") !== (b.q.type === "main")) return a.q.type === "main" ? -1 : 1;
      return 0;
    });
    return out;
  },
};
