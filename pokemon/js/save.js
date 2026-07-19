/* ============================================================
   POCKET FRONTIER — save.js
   One localStorage slot. Monsters are serialised via their
   toJSON; everything else on `state` rides along as-is.
   ============================================================ */
"use strict";

const Save = {
  KEY: "pocketfrontier_save_v1",

  has() { try { return !!localStorage.getItem(Save.KEY); } catch (e) { return false; } },

  write(state) {
    try {
      const bare = Object.assign({}, state);
      delete bare.party; delete bare.box;
      const data = {
        v: 1, state: bare,
        party: (state.party || []).map(m => m.toJSON()),
        box: (state.box || []).map(m => m.toJSON()),
      };
      localStorage.setItem(Save.KEY, JSON.stringify(data));
      return true;
    } catch (e) { return false; }
  },

  load() {
    try {
      const raw = localStorage.getItem(Save.KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  },

  clear() { try { localStorage.removeItem(Save.KEY); } catch (e) {} },
};

if (typeof module !== "undefined" && module.exports) module.exports = { Save };
