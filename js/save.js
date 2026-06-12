/* ============================================================
   CLAUDERIM — save.js
   Save/load via localStorage. Three slots. World geometry is
   regenerated from the seed; only mutable state is stored.
   ============================================================ */
"use strict";

const SAVE_PREFIX = "clauderim_save_";

const SaveSys = {

  slotKey(slot) { return SAVE_PREFIX + slot; },

  slotInfo(slot) {
    try {
      const raw = localStorage.getItem(this.slotKey(slot));
      if (!raw) return null;
      const d = JSON.parse(raw);
      return {
        name: d.player.name, level: d.player.level, cycle: d.cycle || 0,
        origin: ORIGINS[d.player.origin] ? ORIGINS[d.player.origin].name : "?",
        day: d.time.day, savedAt: d.savedAt,
        region: d.regionName || "",
      };
    } catch (e) { return null; }
  },

  save(slot) {
    if (!G.player) return false;
    const data = {
      version: 1,
      savedAt: Date.now(),
      seed: G.seed,
      time: G.time,
      mapId: G.map.id,
      viewMode: G.viewMode,
      cycle: G.cycle || 0,
      regionName: World.regionNameAt(G.map, G.player.x, G.player.y),
      player: G.player.serialize(),
      flags: G.flags,
      openedChests: G.openedChests,
      slainBosses: G.slainBosses,
      discoveredShrines: G.discoveredShrines,
      discoveredPois: G.discoveredPois,
      lostEmbers: G.lostEmbers,
      // map mutable state: which pickups are taken, which encounters dead
      mapState: this.collectMapState(),
    };
    try {
      localStorage.setItem(this.slotKey(slot), JSON.stringify(data));
      return true;
    } catch (e) {
      G.msg("Saving failed — storage unavailable.", "bad");
      return false;
    }
  },

  collectMapState() {
    const out = {};
    const maps = [G.overworld, ...Object.values(G.maps)].filter(Boolean);
    for (const m of maps) {
      out[m.id] = {
        encDead: m.encDead,
        taken: m.pickups.filter(pk => pk.taken).map(pk => pk.id),
        revealed: m.poiList ? m.poiList.filter(p => !p.hidden).map(p => p.id) : [],
      };
    }
    return out;
  },

  load(slot) {
    let data;
    try {
      const raw = localStorage.getItem(this.slotKey(slot));
      if (!raw) return false;
      data = JSON.parse(raw);
    } catch (e) { return false; }

    G.seed = data.seed;
    G.time = data.time;
    G.viewMode = data.viewMode || "fp";
    G.cycle = data.cycle || 0;
    G.flags = data.flags || {};
    G.openedChests = data.openedChests || {};
    G.slainBosses = data.slainBosses || {};
    G.discoveredShrines = data.discoveredShrines || {};
    G.discoveredPois = data.discoveredPois || {};
    G.lostEmbers = data.lostEmbers || null;
    G.maps = {};
    G.overworld = null;
    G.bossFight = null;

    G.player = Player.deserialize(data.player);

    // regen world from seed, then restore mutable state
    World.getMap("overworld");
    const ms = data.mapState || {};
    for (const id in ms) {
      const m = World.getMap(id);
      m.encDead = ms[id].encDead || {};
      const taken = new Set(ms[id].taken || []);
      for (const pk of m.pickups) pk.taken = taken.has(pk.id);
      if (m.poiList) {
        const rev = new Set(ms[id].revealed || []);
        for (const p of m.poiList) if (rev.has(p.id)) p.hidden = false;
      }
    }
    G.saveSlot = slot;
    return data.mapId;
  },

  hasAny() {
    for (let s = 1; s <= 3; s++) if (this.slotInfo(s)) return true;
    return false;
  },

  latestSlot() {
    let best = null, bestT = -1;
    for (let s = 1; s <= 3; s++) {
      const info = this.slotInfo(s);
      if (info && info.savedAt > bestT) { bestT = info.savedAt; best = s; }
    }
    return best;
  },
};
