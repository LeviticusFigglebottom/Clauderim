/* ============================================================
   CLAUDERIM — world.js
   World generation: the overworld of the Shattered March
   (five biomes, three towns, roads, shrines, dungeon mouths)
   and seven interior dungeons. Plus spatial queries
   (solidity, biome, collision) and ambient spawn logic.
   ============================================================ */
"use strict";

const TILE = 32;
const WORLD_W = 400, WORLD_H = 400;

/* tile ids */
const T = {
  DEEPWATER: 0, WATER: 1, SAND: 2, GRASS: 3, MEADOW: 4, FORESTFLOOR: 5,
  ROCK: 6, SNOW: 7, SWAMP: 8, ASH: 9, ROAD: 10, BRIDGE: 11,
  FLOOR_WOOD: 12, FLOOR_STONE: 13, WALL_WOOD: 14, WALL_STONE: 15,
  SNOWROCK: 16, LAVA: 17, VOID: 18,
};
const SOLID_TILES = new Set([T.DEEPWATER, T.WATER, T.WALL_WOOD, T.WALL_STONE, T.LAVA, T.VOID, T.SNOWROCK]);
const SLOW_TILES = new Set([T.SWAMP, T.SAND]);

/* deco ids */
const D = {
  NONE: 0, TREE: 1, PINE: 2, DEADTREE: 3, ROCK: 4, BUSH: 5,
  SWAMPTREE: 6, BOULDER: 7, ANVIL: 8, ALCH: 9, WELL: 10, LAMP: 11,
  CAIRN: 12, GRAVE: 13, BARREL: 14, TABLE: 15, EMBERVAULT: 16, PILLAR: 17,
};
const SOLID_DECO = new Set([D.TREE, D.PINE, D.DEADTREE, D.ROCK, D.SWAMPTREE, D.BOULDER,
  D.ANVIL, D.ALCH, D.WELL, D.CAIRN, D.BARREL, D.TABLE, D.EMBERVAULT, D.PILLAR]);

/* biome ids */
const B = { HEART: 0, FOREST: 1, MIRE: 2, FROST: 3, ASHLAND: 4, COAST: 5 };
const BIOME_NAMES = ["The Heartlands", "The Greywood", "Mirkfen Mire", "The Frostpeaks", "The Ashlands", "The Cinder Coast"];
const BIOME_TABLE_KEYS = ["heartlands", "forest", "mire", "frostpeaks", "ashlands", "heartlands"];

const GATHER_BY_BIOME = {
  0: ["marrowroot", "glowcap", "wolfsbane"],
  1: ["glowcap", "marrowroot", "ghost_fern"],
  2: ["mireweed", "glowcap", "ghost_fern"],
  3: ["frostmoss", "wolfsbane"],
  4: ["emberbloom", "marrowroot"],
  5: ["glowcap"],
};

const World = {

  /* ======================================================
     OVERWORLD GENERATION
     ====================================================== */
  genOverworld(seed) {
    const w = WORLD_W, h = WORLD_H;
    const rng = U.mulberry32(seed ^ 0xBEEF);
    const map = {
      id: "overworld", name: "The Shattered March", w, h, outdoor: true,
      tiles: new Uint8Array(w * h), deco: new Uint8Array(w * h), biome: new Uint8Array(w * h),
      portals: [], shrines: [], chests: [], pickups: [], npcs: [],
      spawners: [], encounters: [], encDead: {}, safeZones: [], lights: [], stations: [],
      poiList: [], bossArena: null,
    };
    const { tiles, deco, biome } = map;

    /* ---- terrain ---- */
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const wob = (U.fbm(x / 38, y / 38, seed + 7, 3) - 0.5) * 46;
        const wob2 = (U.fbm(x / 23, y / 23, seed + 31, 3) - 0.5) * 30;
        const detail = U.fbm(x / 11, y / 11, seed + 99, 4);
        const edge = Math.min(x, y, w - 1 - x, h - 1 - y);

        if (edge < 5 + wob2 * 0.3) { tiles[i] = edge < 3 ? T.DEEPWATER : T.WATER; biome[i] = B.COAST; continue; }
        if (edge < 8 + wob2 * 0.3) { tiles[i] = T.SAND; biome[i] = B.COAST; continue; }

        let bm;
        if (y + wob < 118) bm = B.FROST;
        else if (x + wob < 104) bm = B.ASHLAND;
        else if (x + wob > 262 && y + wob > 248) bm = B.MIRE;
        else bm = (U.fbm(x / 34, y / 34, seed + 55, 3) > 0.58) ? B.FOREST : B.HEART;
        biome[i] = bm;

        if (bm === B.FROST) {
          const ridg = Math.abs(U.fbm(x / 26, y / 26, seed + 13, 4) - 0.5) * 2;
          tiles[i] = (y < 78 + wob2 && ridg > 0.45) ? T.SNOWROCK : T.SNOW;
          if (tiles[i] === T.SNOW) {
            if (detail > 0.64) deco[i] = D.PINE;
            else if (detail < 0.17) deco[i] = D.ROCK;
          }
        } else if (bm === B.ASHLAND) {
          tiles[i] = T.ASH;
          if (detail > 0.72) deco[i] = D.DEADTREE;
          else if (detail < 0.15) deco[i] = D.BOULDER;
        } else if (bm === B.MIRE) {
          tiles[i] = detail > 0.36 ? T.SWAMP : T.WATER;
          if (tiles[i] === T.SWAMP) {
            if (detail > 0.66) deco[i] = D.SWAMPTREE;
            else if (detail < 0.42) deco[i] = D.BUSH;
          }
        } else if (bm === B.FOREST) {
          tiles[i] = T.FORESTFLOOR;
          if (detail > 0.5) deco[i] = D.TREE;
          else if (detail < 0.18) deco[i] = D.BUSH;
        } else {
          tiles[i] = detail > 0.55 ? T.MEADOW : T.GRASS;
          if (detail > 0.79) deco[i] = D.TREE;
          else if (detail < 0.09) deco[i] = D.ROCK;
          else if (detail > 0.6 && detail < 0.617) deco[i] = D.BUSH;
        }

        if ((bm === B.HEART || bm === B.FOREST) && U.fbm(x / 50, y / 50, seed + 77, 3) < 0.295) {
          tiles[i] = T.WATER; deco[i] = D.NONE;
        }
      }
    }

    /* ---- points of interest ---- */
    map.poiList = [
      { id: "emberfall", name: "Emberfall", kind: "town", tx: 200, ty: 200, discovered: true },
      { id: "duskmere", name: "Duskmere", kind: "town", tx: 296, ty: 296, discovered: true },
      { id: "frosthollow", name: "Frosthollow", kind: "town", tx: 172, ty: 124, discovered: true },
      { id: "watchtower", name: "The Unlit Tower", kind: "tower", tx: 126, ty: 234 },
      { id: "barrow", name: "Barrow of the Sentinel", kind: "dungeon", tx: 264, ty: 180, interior: "barrow" },
      { id: "chapel", name: "The Sunken Chapel", kind: "dungeon", tx: 306, ty: 334, interior: "chapel", hidden: true },
      { id: "mire_deep", name: "The Matron's Hollow", kind: "dungeon", tx: 338, ty: 270, interior: "mire_deep" },
      { id: "frost_keep", name: "White Pass Keep", kind: "dungeon", tx: 196, ty: 56, interior: "frost_keep" },
      { id: "ash_temple", name: "Temple of Answering Fire", kind: "dungeon", tx: 56, ty: 254, interior: "ash_temple" },
      { id: "citadel", name: "Citadel of Hollows", kind: "dungeon", tx: 144, ty: 166, interior: "citadel", lockedBy: "sigils" },
      { id: "undermarch", name: "The Great Sink", kind: "dungeon", tx: 246, ty: 220, interior: "undermarch", hidden: true },
      { id: "camp_redwater", name: "Redwater Camp", kind: "camp", tx: 234, ty: 244 },
      { id: "camp_gallows", name: "Gallows Hill", kind: "camp", tx: 158, ty: 262 },
      { id: "camp_shiver", name: "Shiverwatch Ruin", kind: "camp", tx: 226, ty: 96 },
    ];

    this.stampEmberfall(map);
    this.stampDuskmere(map);
    this.stampFrosthollow(map);
    this.stampWatchtower(map);
    for (const p of map.poiList) if (p.interior) this.stampDungeonMouth(map, p);

    /* ---- roads ---- */
    const roads = [
      [200, 210, 294, 292], [200, 196, 172, 130], [206, 200, 262, 182],
      [194, 200, 150, 170], [200, 210, 128, 236], [296, 292, 306, 330],
      [172, 122, 196, 60], [128, 236, 60, 254], [298, 294, 336, 272],
    ];
    for (const r of roads) this.carveRoad(map, r[0], r[1], r[2], r[3], rng);

    /* ---- shrines ---- */
    const shr = (id, name, tx, ty) => {
      this.clearArea(map, tx, ty, 2);
      map.shrines.push({ id, name, x: tx * TILE + 16, y: ty * TILE + 16 });
      map.lights.push({ x: tx * TILE + 16, y: ty * TILE + 16, r: 120, color: "255,150,60", flicker: true });
    };
    shr("first_shrine", "Shrine of the Waking", 203, 214);
    shr("shrine_duskmere", "Duskmere Shrine", 291, 290);
    shr("shrine_frosthollow", "Frosthollow Shrine", 176, 129);
    shr("shrine_barrow", "Barrowfield Shrine", 260, 184);
    shr("shrine_mire", "Sunken Causeway Shrine", 333, 274);
    shr("shrine_pass", "White Pass Shrine", 192, 62);
    shr("shrine_ash", "Pilgrim's Rest Shrine", 62, 250);
    shr("shrine_citadel", "Gatefall Shrine", 149, 172);
    shr("shrine_crossroads", "Crossroads Shrine", 226, 232);

    for (const c of [[234, 244], [158, 262], [226, 96]]) this.stampCamp(map, rng, c[0], c[1]);

    /* ---- wilderness chests ---- */
    const chestSpots = [
      [248, 156, "chest_common"], [174, 246, "chest_common"], [262, 222, "chest_common"],
      [310, 258, "chest_fine"], [142, 92, "chest_fine"], [84, 232, "chest_fine"],
      [218, 62, "chest_fine"], [340, 318, "chest_rare"], [72, 280, "chest_rare"],
      [122, 62, "chest_rare"], [288, 168, "chest_common"], [186, 296, "chest_common"],
      [250, 300, "chest_common"], [98, 180, "chest_fine"],
    ];
    for (const c of chestSpots) this.placeChest(map, c[0], c[1], c[2]);

    this.scatterPickups(map, rng);

    /* ---- ambient spawners ---- */
    for (let gy = 24; gy < h - 24; gy += 24) {
      for (let gx = 24; gx < w - 24; gx += 24) {
        const i = gy * w + gx;
        if (SOLID_TILES.has(tiles[i])) continue;
        const px = gx * TILE, py = gy * TILE;
        if (this.nearSafeZone(map, px, py, 500)) continue;
        map.spawners.push({ x: px, y: py, r: 280, table: BIOME_TABLE_KEYS[biome[i]], max: 3, members: [], cd: U.randf(rng, 0, 4) });
      }
    }
    for (const c of [[234, 244, "heartlands"], [158, 262, "heartlands"], [226, 96, "frostpeaks"]]) {
      map.spawners.push({ x: c[0] * TILE, y: c[1] * TILE, r: 170, table: c[2], max: 5, members: [], cd: 0, camp: true });
    }

    return map;
  },

  /* ======================================================
     STAMP HELPERS
     ====================================================== */

  inBounds(map, x, y) { return x >= 0 && y >= 0 && x < map.w && y < map.h; },

  groundFor(bm) {
    return [T.GRASS, T.FORESTFLOOR, T.SWAMP, T.SNOW, T.ASH, T.SAND][bm] ?? T.GRASS;
  },

  clearArea(map, cx, cy, r, tile) {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (!this.inBounds(map, x, y)) continue;
        const i = y * map.w + x;
        if (tile !== undefined) map.tiles[i] = tile;
        else if (SOLID_TILES.has(map.tiles[i])) map.tiles[i] = map.biome ? this.groundFor(map.biome[i]) : T.GRASS;
        map.deco[i] = D.NONE;
      }
    }
  },

  stampBuilding(map, x, y, w, h, opts) {
    opts = opts || {};
    const floor = opts.floor !== undefined ? opts.floor : T.FLOOR_WOOD;
    const wall = opts.wall !== undefined ? opts.wall : T.WALL_WOOD;
    for (let j = y; j < y + h; j++) {
      for (let i2 = x; i2 < x + w; i2++) {
        if (!this.inBounds(map, i2, j)) continue;
        const i = j * map.w + i2;
        const isWall = (i2 === x || i2 === x + w - 1 || j === y || j === y + h - 1);
        map.tiles[i] = isWall ? wall : floor;
        map.deco[i] = D.NONE;
      }
    }
    const dx = opts.doorX !== undefined ? opts.doorX : (x + (w >> 1));
    map.tiles[(y + h - 1) * map.w + dx] = floor;
    if (opts.station) {
      const sx = x + 1, sy = y + 1;
      map.deco[sy * map.w + sx] = opts.station;
      map.stations.push({
        kind: opts.station === D.ANVIL ? "smith" : "alchemy",
        x: sx * TILE + 16, y: sy * TILE + 16,
      });
    }
    if (opts.light !== false) {
      map.lights.push({ x: (x + w / 2) * TILE, y: (y + h / 2) * TILE, r: 140, color: "255,180,90" });
    }
  },

  placeNpc(map, npcId, tx, ty, homeTx, homeTy) {
    map.npcs.push({
      id: npcId, x: tx * TILE + 16, y: ty * TILE + 16,
      homeX: (homeTx !== undefined ? homeTx : tx) * TILE + 16,
      homeY: (homeTy !== undefined ? homeTy : ty) * TILE + 16,
    });
  },

  placeChest(map, tx, ty, tier) {
    this.clearArea(map, tx, ty, 1);
    map.chests.push({ id: map.id + "_c" + map.chests.length, x: tx * TILE + 16, y: ty * TILE + 16, tier });
  },

  setDeco(map, tx, ty, d) {
    if (this.inBounds(map, tx, ty)) map.deco[ty * map.w + tx] = d;
  },

  /* ---- Emberfall: the hub town ---- */
  stampEmberfall(map) {
    const cx = 200, cy = 200;
    this.clearArea(map, cx, cy, 15, T.GRASS);
    map.safeZones.push({ x: cx * TILE, y: cy * TILE, r: 520 });

    for (let y = cy - 12; y <= cy + 16; y++) map.tiles[y * map.w + cx] = T.ROAD;
    for (let x = cx - 12; x <= cx + 12; x++) map.tiles[cy * map.w + x] = T.ROAD;

    this.stampBuilding(map, cx - 11, cy - 8, 7, 6, { station: D.ANVIL });   // Bram's forge
    this.stampBuilding(map, cx + 5, cy - 8, 7, 6, { station: D.ALCH });     // Maren's stillroom
    this.stampBuilding(map, cx - 4, cy - 12, 9, 7, {});                     // the Guttered Candle (inn)
    this.stampBuilding(map, cx + 5, cy + 3, 6, 5, {});                      // Ralka's lodge
    this.stampBuilding(map, cx - 10, cy + 3, 6, 5, {});                     // lamp-house (Serah)

    this.setDeco(map, cx, cy, D.WELL);
    this.setDeco(map, cx - 3, cy + 2, D.LAMP);
    this.setDeco(map, cx + 3, cy + 2, D.LAMP);
    this.setDeco(map, cx - 3, cy - 3, D.LAMP);
    this.setDeco(map, cx + 3, cy - 3, D.LAMP);
    map.lights.push({ x: (cx - 3) * TILE + 16, y: (cy + 2) * TILE + 16, r: 110, color: "255,190,110" });
    map.lights.push({ x: (cx + 3) * TILE + 16, y: (cy + 2) * TILE + 16, r: 110, color: "255,190,110" });
    map.lights.push({ x: (cx - 3) * TILE + 16, y: (cy - 3) * TILE + 16, r: 110, color: "255,190,110" });
    map.lights.push({ x: (cx + 3) * TILE + 16, y: (cy - 3) * TILE + 16, r: 110, color: "255,190,110" });

    // day posts outside their doors; homes inside for the night
    this.placeNpc(map, "bram", cx - 8, cy - 1, cx - 8, cy - 5);
    this.placeNpc(map, "maren", cx + 8, cy - 1, cx + 8, cy - 5);
    this.placeNpc(map, "tobbe", cx, cy - 9, cx, cy - 9);
    this.placeNpc(map, "ralka", cx + 8, cy + 9, cx + 7, cy + 5);
    this.placeNpc(map, "serah", cx - 7, cy + 9, cx - 7, cy + 5);

    // hearth-fire by the inn for travellers' cooking, and the town well
    map.stations.push({ kind: "campfire", x: (cx + 2) * TILE + 16, y: (cy - 4) * TILE + 16 });
    map.lights.push({ x: (cx + 2) * TILE + 16, y: (cy - 4) * TILE + 16, r: 90, color: "255,150,60", flicker: true });
    map.stations.push({ kind: "well", x: cx * TILE + 16, y: cy * TILE + 16 });

    // crypt entrance behind the inn
    const px = cx + 6, py = cy - 11;
    this.clearArea(map, px, py, 1, T.FLOOR_STONE);
    map.tiles[(py - 1) * map.w + px] = T.WALL_STONE;
    map.portals.push({
      id: "crypt_door", x: px * TILE + 16, y: py * TILE + 16, to: "crypt",
      name: "Crypt of Emberfall", lockedBy: "crypt_key",
    });
    map.poiList.push({ id: "crypt", name: "Crypt of Emberfall", kind: "dungeon", tx: px, ty: py, hidden: true });
  },

  /* ---- Duskmere: stilt village in the Mire ---- */
  stampDuskmere(map) {
    const cx = 296, cy = 296;
    this.clearArea(map, cx, cy, 10, T.SWAMP);
    map.safeZones.push({ x: cx * TILE, y: cy * TILE, r: 420 });

    for (let y = cy - 8; y <= cy + 8; y++) map.tiles[y * map.w + cx] = T.BRIDGE;
    for (let x = cx - 8; x <= cx + 8; x++) map.tiles[cy * map.w + x] = T.BRIDGE;

    this.stampBuilding(map, cx - 7, cy - 6, 6, 5, {});  // Mosswick's house
    this.stampBuilding(map, cx + 3, cy - 6, 6, 5, {});  // Petra's shop
    this.stampBuilding(map, cx - 2, cy + 3, 5, 4, {});  // fisher hut

    this.setDeco(map, cx - 1, cy - 1, D.LAMP);
    this.setDeco(map, cx + 1, cy + 1, D.LAMP);
    map.lights.push({ x: (cx - 1) * TILE + 16, y: (cy - 1) * TILE + 16, r: 110, color: "190,255,170" });
    map.lights.push({ x: (cx + 1) * TILE + 16, y: (cy + 1) * TILE + 16, r: 110, color: "190,255,170" });

    this.placeNpc(map, "mosswick", cx - 4, cy, cx - 4, cy - 4);
    this.placeNpc(map, "petra", cx + 6, cy, cx + 6, cy - 4);
    map.stations.push({ kind: "campfire", x: (cx - 1) * TILE + 16, y: (cy + 2) * TILE + 16 });
    map.lights.push({ x: (cx - 1) * TILE + 16, y: (cy + 2) * TILE + 16, r: 90, color: "255,150,60", flicker: true });
  },

  /* ---- Frosthollow: timber village under the peaks ---- */
  stampFrosthollow(map) {
    const cx = 172, cy = 124;
    this.clearArea(map, cx, cy, 9, T.SNOW);
    map.safeZones.push({ x: cx * TILE, y: cy * TILE, r: 420 });

    for (let y = cy - 7; y <= cy + 7; y++) map.tiles[y * map.w + cx] = T.ROAD;

    this.stampBuilding(map, cx - 7, cy - 5, 7, 6, {});  // Eirik's hall
    this.stampBuilding(map, cx + 3, cy - 5, 6, 5, {});  // Sigrun's hut
    this.stampBuilding(map, cx - 3, cy + 3, 6, 4, {});  // brewhouse

    this.setDeco(map, cx, cy - 1, D.LAMP);
    this.setDeco(map, cx - 2, cy + 6, D.CAIRN);
    map.lights.push({ x: cx * TILE + 16, y: (cy - 1) * TILE + 16, r: 110, color: "255,190,110" });

    this.placeNpc(map, "eirik", cx - 4, cy + 2, cx - 4, cy - 2);
    this.placeNpc(map, "sigrun", cx + 6, cy + 1, cx + 6, cy - 3);
    map.stations.push({ kind: "campfire", x: (cx + 1) * TILE + 16, y: (cy + 4) * TILE + 16 });
    map.lights.push({ x: (cx + 1) * TILE + 16, y: (cy + 4) * TILE + 16, r: 90, color: "255,150,60", flicker: true });
  },

  /* ---- Caldus's watchtower ---- */
  stampWatchtower(map) {
    const cx = 126, cy = 234;
    this.clearArea(map, cx, cy, 4);
    map.safeZones.push({ x: cx * TILE, y: cy * TILE, r: 240 });
    this.stampBuilding(map, cx - 3, cy - 3, 7, 7, { wall: T.WALL_STONE, floor: T.FLOOR_STONE });
    this.placeNpc(map, "caldus", cx, cy);
  },

  /* ---- bandit camp ---- */
  stampCamp(map, rng, tx, ty) {
    this.clearArea(map, tx, ty, 4);
    this.setDeco(map, tx, ty, D.NONE);
    this.setDeco(map, tx - 2, ty - 1, D.BARREL);
    this.setDeco(map, tx + 2, ty + 1, D.BARREL);
    this.setDeco(map, tx + 1, ty - 2, D.TABLE);
    map.lights.push({ x: tx * TILE + 16, y: ty * TILE + 16, r: 130, color: "255,140,60", flicker: true });
    this.placeChest(map, tx, ty + 2, "chest_fine");
    map.stations.push({ kind: "campfire", x: tx * TILE + 16, y: ty * TILE + 16 });
  },

  /* ---- stone mouth of a dungeon, with portal ---- */
  stampDungeonMouth(map, poi) {
    const { tx, ty } = poi;
    this.clearArea(map, tx, ty, 2);
    for (let x = tx - 1; x <= tx + 1; x++) map.tiles[(ty - 1) * map.w + x] = T.WALL_STONE;
    map.tiles[ty * map.w + (tx - 1)] = T.WALL_STONE;
    map.tiles[ty * map.w + (tx + 1)] = T.WALL_STONE;
    map.tiles[ty * map.w + tx] = T.VOID;
    this.setDeco(map, tx - 2, ty, D.PILLAR);
    this.setDeco(map, tx + 2, ty, D.PILLAR);
    map.portals.push({
      id: "mouth_" + poi.id, x: tx * TILE + 16, y: (ty + 1) * TILE + 16,
      to: poi.interior, name: poi.name, lockedBy: poi.lockedBy || null, poiId: poi.id,
    });
  },

  /* ---- roads (greedy jittered walk; water becomes bridge) ---- */
  carveRoad(map, x1, y1, x2, y2, rng) {
    let x = x1, y = y1, guard = 0;
    while ((x !== x2 || y !== y2) && guard++ < 5000) {
      for (const off of [[0, 0], [1, 0], [0, 1]]) {
        const xx = x + off[0], yy = y + off[1];
        if (!this.inBounds(map, xx, yy)) continue;
        const i = yy * map.w + xx;
        const t = map.tiles[i];
        if (t === T.WALL_WOOD || t === T.WALL_STONE || t === T.FLOOR_WOOD || t === T.FLOOR_STONE) continue;
        map.tiles[i] = (t === T.WATER || t === T.DEEPWATER) ? T.BRIDGE : T.ROAD;
        map.deco[i] = D.NONE;
      }
      const dx = Math.sign(x2 - x), dy = Math.sign(y2 - y);
      if (dx !== 0 && (dy === 0 || rng() < 0.5)) x += dx;
      else if (dy !== 0) y += dy;
      if (rng() < 0.12) { // jitter
        if (rng() < 0.5 && this.inBounds(map, x, y + 1)) y += rng() < 0.5 ? 1 : -1;
        else x += rng() < 0.5 ? 1 : -1;
        x = U.clamp(x, 2, map.w - 3); y = U.clamp(y, 2, map.h - 3);
      }
    }
  },

  /* ---- gatherable plants and ore veins ---- */
  scatterPickups(map, rng) {
    let placed = 0, tries = 0;
    while (placed < 240 && tries++ < 3000) {
      const tx = U.randi(rng, 10, map.w - 10), ty = U.randi(rng, 10, map.h - 10);
      const i = ty * map.w + tx;
      if (SOLID_TILES.has(map.tiles[i]) || map.deco[i] !== D.NONE) continue;
      if (map.tiles[i] === T.ROAD || map.tiles[i] >= T.FLOOR_WOOD) continue;
      const opts = GATHER_BY_BIOME[map.biome[i]];
      if (!opts) continue;
      const item = U.choice(rng, opts);
      map.pickups.push({ id: "pk" + placed, item, n: 1, x: tx * TILE + 16, y: ty * TILE + 16 });
      placed++;
    }
    // iron veins near rock
    let veins = 0; tries = 0;
    while (veins < 50 && tries++ < 4000) {
      const tx = U.randi(rng, 10, map.w - 10), ty = U.randi(rng, 10, map.h - 10);
      const i = ty * map.w + tx;
      if (SOLID_TILES.has(map.tiles[i]) || map.deco[i] !== D.NONE) continue;
      if (map.tiles[i] === T.ROAD || map.tiles[i] >= T.FLOOR_WOOD) continue;
      // require nearby rock/mountain
      let nearRock = false;
      for (let oy = -2; oy <= 2 && !nearRock; oy++)
        for (let ox = -2; ox <= 2; ox++) {
          if (!this.inBounds(map, tx + ox, ty + oy)) continue;
          const j = (ty + oy) * map.w + (tx + ox);
          if (map.tiles[j] === T.SNOWROCK || map.deco[j] === D.ROCK || map.deco[j] === D.BOULDER) { nearRock = true; break; }
        }
      if (!nearRock) continue;
      map.pickups.push({ id: "vein" + veins, item: "iron_ore", n: 2, x: tx * TILE + 16, y: ty * TILE + 16, vein: true });
      veins++;
    }
  },

  nearSafeZone(map, x, y, extra) {
    for (const z of map.safeZones) {
      if (U.dist(x, y, z.x, z.y) < z.r + (extra || 0)) return true;
    }
    return false;
  },

  /* ======================================================
     INTERIOR DUNGEONS
     ====================================================== */

  getMap(id) {
    if (id === "overworld") {
      if (!G.overworld) G.overworld = this.genOverworld(G.seed);
      return G.overworld;
    }
    if (!G.maps[id]) G.maps[id] = this.genInterior(id);
    return G.maps[id];
  },

  genInterior(id) {
    const seed = G.seed ^ U.hashStr(id);
    const rng = U.mulberry32(seed);
    switch (id) {
      case "crypt": return this.genRoomsDungeon(rng, {
        id, name: "Crypt of Emberfall", w: 38, h: 38, rooms: 7,
        exit: { map: "overworld", poi: "crypt" },
        enemies: [["hollow_thrall", 7], ["barrow_sentinel", 2]],
        chests: ["chest_common", "chest_common", "chest_fine"],
        gather: ["ghost_fern", "old_bone"],
        graves: true, ambient: "crypt",
      });
      case "barrow": return this.genRoomsDungeon(rng, {
        id, name: "Barrow of the Sentinel", w: 54, h: 54, rooms: 10,
        exit: { map: "overworld", poi: "barrow" },
        enemies: [["hollow_thrall", 6], ["barrow_sentinel", 4], ["grave_wisp", 3]],
        chests: ["chest_common", "chest_fine", "chest_fine"],
        boss: "boss_korvash", gather: ["ghost_fern", "old_bone"],
        graves: true, ambient: "crypt",
      });
      case "chapel": return this.genCaveDungeon(rng, {
        id, name: "The Sunken Chapel", w: 44, h: 44,
        floor: T.SWAMP, exit: { map: "overworld", poi: "chapel" },
        enemies: [["mire_leech", 6], ["grave_wisp", 4], ["hollow_thrall", 3]],
        chests: ["chest_fine", "chest_rare"],
        boss: "bell_wraith", gather: ["mireweed", "ghost_fern"],
        ambient: "cave",
      });
      case "mire_deep": return this.genCaveDungeon(rng, {
        id, name: "The Matron's Hollow", w: 58, h: 58,
        floor: T.SWAMP, exit: { map: "overworld", poi: "mire_deep" },
        enemies: [["mire_leech", 8], ["bog_horror", 4], ["grave_wisp", 3]],
        chests: ["chest_fine", "chest_fine", "chest_rare"],
        boss: "boss_vask", gather: ["mireweed", "glowcap"],
        ambient: "cave",
      });
      case "frost_keep": return this.genRoomsDungeon(rng, {
        id, name: "White Pass Keep", w: 58, h: 58, rooms: 11,
        exit: { map: "overworld", poi: "frost_keep" },
        enemies: [["hollow_thrall", 5], ["barrow_sentinel", 3], ["grave_wisp", 4], ["frost_troll", 2]],
        chests: ["chest_fine", "chest_fine", "chest_rare"],
        boss: "boss_hrolgar", gather: ["frostmoss"],
        ambient: "keep",
      });
      case "ash_temple": return this.genRoomsDungeon(rng, {
        id, name: "Temple of Answering Fire", w: 56, h: 56, rooms: 10,
        exit: { map: "overworld", poi: "ash_temple" },
        enemies: [["ash_imp", 7], ["cult_acolyte", 5], ["hollow_thrall", 3]],
        chests: ["chest_fine", "chest_rare", "chest_rare"],
        boss: "boss_velmora", gather: ["emberbloom"],
        ambient: "temple",
      });
      case "citadel": return this.genRoomsDungeon(rng, {
        id, name: "Citadel of Hollows", w: 68, h: 68, rooms: 13,
        exit: { map: "overworld", poi: "citadel" },
        enemies: [["pale_knight", 6], ["wraith", 3], ["grave_wisp", 4], ["barrow_sentinel", 3]],
        chests: ["chest_rare", "chest_rare", "chest_fine"],
        boss: "boss_maerodric", vault: true, gather: ["ghost_fern"],
        ambient: "keep",
      });
      case "undermarch": return this.genCaveDungeon(rng, {
        id, name: "The Undermarch", w: 78, h: 78,
        floor: T.FLOOR_STONE, exit: { map: "overworld", poi: "undermarch" },
        enemies: [["gloomcrawler", 9], ["grave_wisp", 5], ["wraith", 2], ["pale_knight", 2]],
        chests: ["chest_fine", "chest_rare", "chest_rare"],
        boss: "boss_echo", gather: ["ghost_fern", "glowcap"],
        waylamps: 3, ambient: "undermarch",
      });
    }
    throw new Error("unknown interior: " + id);
  },

  /* rooms-and-corridors generator */
  genRoomsDungeon(rng, opt) {
    const w = opt.w, h = opt.h;
    const map = {
      id: opt.id, name: opt.name, w, h, outdoor: false, ambient: opt.ambient,
      tiles: new Uint8Array(w * h).fill(T.WALL_STONE),
      deco: new Uint8Array(w * h), biome: null,
      portals: [], shrines: [], chests: [], pickups: [], npcs: [],
      spawners: [], encounters: [], encDead: {}, safeZones: [], lights: [], stations: [],
      bossArena: null,
    };

    const rooms = [];
    let tries = 0;
    while (rooms.length < opt.rooms && tries++ < 300) {
      const rw = U.randi(rng, 5, 10), rh = U.randi(rng, 5, 10);
      const rx = U.randi(rng, 2, w - rw - 3), ry = U.randi(rng, 2, h - rh - 3);
      let ok = true;
      for (const r of rooms) {
        if (rx < r.x + r.w + 1 && rx + rw + 1 > r.x && ry < r.y + r.h + 1 && ry + rh + 1 > r.y) { ok = false; break; }
      }
      if (!ok) continue;
      rooms.push({ x: rx, y: ry, w: rw, h: rh, cx: rx + (rw >> 1), cy: ry + (rh >> 1) });
    }
    const carve = (x, y) => {
      if (x > 0 && y > 0 && x < w - 1 && y < h - 1) {
        map.tiles[y * w + x] = T.FLOOR_STONE;
        map.deco[y * w + x] = D.NONE;
      }
    };
    for (const r of rooms) {
      for (let y = r.y; y < r.y + r.h; y++)
        for (let x = r.x; x < r.x + r.w; x++) carve(x, y);
    }
    // connect each room to the next (L corridors, 2 wide)
    rooms.sort((a, b) => (a.cx + a.cy) - (b.cx + b.cy));
    for (let i = 1; i < rooms.length; i++) {
      const a = rooms[i - 1], b2 = rooms[i];
      let x = a.cx, y = a.cy;
      while (x !== b2.cx) { carve(x, y); carve(x, y + 1); x += Math.sign(b2.cx - x); }
      while (y !== b2.cy) { carve(x, y); carve(x + 1, y); y += Math.sign(b2.cy - y); }
    }

    const entrance = rooms[0];
    map.arrival = { x: entrance.cx * TILE + 16, y: entrance.cy * TILE + 16 };
    map.portals.push({
      id: "exit", x: entrance.cx * TILE + 16, y: (entrance.y + 1) * TILE + 16,
      to: opt.exit.map, toPoi: opt.exit.poi, name: "Leave " + opt.name, exit: true,
    });
    map.lights.push({ x: map.arrival.x, y: map.arrival.y, r: 130, color: "255,170,80", flicker: true });

    // boss room: farthest from entrance
    let bossRoom = null;
    if (opt.boss) {
      let best = -1;
      for (let i = 1; i < rooms.length; i++) {
        const d = U.dist2(rooms[i].cx, rooms[i].cy, entrance.cx, entrance.cy);
        if (d > best) { best = d; bossRoom = rooms[i]; }
      }
      // enlarge boss room
      const bx = U.clamp(bossRoom.cx - 7, 2, w - 17), by = U.clamp(bossRoom.cy - 7, 2, h - 17);
      for (let y = by; y < by + 14; y++)
        for (let x = bx; x < bx + 14; x++) carve(x, y);
      bossRoom = { x: bx, y: by, w: 14, h: 14, cx: bx + 7, cy: by + 7 };
      map.bossArena = {
        boss: opt.boss,
        x1: bx * TILE, y1: by * TILE, x2: (bx + 14) * TILE, y2: (by + 14) * TILE,
        bossX: bossRoom.cx * TILE + 16, bossY: bossRoom.cy * TILE + 16,
      };
      // shrine in the nearest other room to the boss
      let shrineRoom = entrance, bd = Infinity;
      for (const r of rooms) {
        if (r === entrance) continue;
        const d = U.dist2(r.cx, r.cy, bossRoom.cx, bossRoom.cy);
        if (d < bd && d > 100) { bd = d; shrineRoom = r; }
      }
      map.shrines.push({ id: opt.id + "_shrine", name: opt.name + " Shrine", x: shrineRoom.cx * TILE + 16, y: shrineRoom.cy * TILE + 16 });
      map.lights.push({ x: shrineRoom.cx * TILE + 16, y: shrineRoom.cy * TILE + 16, r: 120, color: "255,150,60", flicker: true });

      // ember vault behind the citadel boss room
      if (opt.vault) {
        const vx = U.clamp(bossRoom.cx - 2, 2, w - 7), vy = U.clamp(by - 8, 2, h - 8);
        for (let y = vy; y < vy + 7; y++)
          for (let x = vx; x < vx + 5; x++) carve(x, y);
        let cy2 = vy + 7;
        while (cy2 < by + 1) { carve(bossRoom.cx, cy2); carve(bossRoom.cx + 1, cy2); cy2++; }
        map.deco[(vy + 2) * w + (vx + 2)] = D.EMBERVAULT;
        map.stations.push({ kind: "vault", x: (vx + 2) * TILE + 16, y: (vy + 2) * TILE + 16 });
        map.lights.push({ x: (vx + 2) * TILE + 16, y: (vy + 2) * TILE + 16, r: 160, color: "255,200,120", flicker: true });
      }
    }

    this.populateDungeon(map, rng, rooms, entrance, bossRoom, opt);
    return map;
  },

  /* cellular-automata cave generator */
  genCaveDungeon(rng, opt) {
    const w = opt.w, h = opt.h;
    const floor = opt.floor !== undefined ? opt.floor : T.FLOOR_STONE;
    const map = {
      id: opt.id, name: opt.name, w, h, outdoor: false, ambient: opt.ambient,
      tiles: new Uint8Array(w * h).fill(T.WALL_STONE),
      deco: new Uint8Array(w * h), biome: null,
      portals: [], shrines: [], chests: [], pickups: [], npcs: [],
      spawners: [], encounters: [], encDead: {}, safeZones: [], lights: [], stations: [],
      bossArena: null,
    };

    let grid = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) grid[i] = rng() < 0.44 ? 1 : 0; // 1 = wall
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) grid[y * w + x] = 1;
    }
    for (let it = 0; it < 4; it++) {
      const next = new Uint8Array(grid);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          let n = 0;
          for (let oy = -1; oy <= 1; oy++)
            for (let ox = -1; ox <= 1; ox++) {
              if (ox === 0 && oy === 0) continue;
              n += grid[(y + oy) * w + (x + ox)];
            }
          next[y * w + x] = (grid[y * w + x] === 1) ? (n >= 4 ? 1 : 0) : (n >= 5 ? 1 : 0);
        }
      }
      grid = next;
    }
    // keep only the largest open region
    const region = new Int32Array(w * h).fill(-1);
    let bestRegion = -1, bestSize = 0, rc = 0;
    for (let i = 0; i < w * h; i++) {
      if (grid[i] === 1 || region[i] !== -1) continue;
      const stack = [i]; region[i] = rc; let size = 0;
      while (stack.length) {
        const j = stack.pop(); size++;
        const jx = j % w, jy = (j / w) | 0;
        for (const o of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = jx + o[0], ny = jy + o[1];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const k = ny * w + nx;
          if (grid[k] === 0 && region[k] === -1) { region[k] = rc; stack.push(k); }
        }
      }
      if (size > bestSize) { bestSize = size; bestRegion = rc; }
      rc++;
    }
    const open = [];
    for (let i = 0; i < w * h; i++) {
      if (grid[i] === 0 && region[i] === bestRegion) {
        map.tiles[i] = floor;
        open.push(i);
      }
    }
    // sprinkle water in swampy caves
    if (floor === T.SWAMP) {
      for (const i of open) {
        const x = i % w, y = (i / w) | 0;
        if (U.fbm(x / 7, y / 7, G.seed ^ 909, 3) < 0.34) map.tiles[i] = T.WATER;
      }
    }

    // entrance: topmost open tile cluster; boss: bottommost
    open.sort((a, b) => ((a / w) | 0) - ((b / w) | 0));
    const entI = open[U.randi(rng, 0, Math.min(30, open.length - 1))];
    const ex = entI % w, ey = (entI / w) | 0;
    this.carveCircle(map, ex, ey, 3, floor);
    map.arrival = { x: ex * TILE + 16, y: ey * TILE + 16 };
    map.portals.push({
      id: "exit", x: ex * TILE + 16, y: ey * TILE + 16,
      to: opt.exit.map, toPoi: opt.exit.poi, name: "Leave " + opt.name, exit: true,
    });
    map.lights.push({ x: map.arrival.x, y: map.arrival.y, r: 130, color: "255,170,80", flicker: true });

    let bossRoom = null;
    if (opt.boss) {
      const bI = open[open.length - 1 - U.randi(rng, 0, Math.min(30, open.length - 1))];
      const bx = U.clamp(bI % w, 9, w - 10), by = U.clamp((bI / w) | 0, 9, h - 10);
      this.carveCircle(map, bx, by, 8, floor);
      map.bossArena = {
        boss: opt.boss,
        x1: (bx - 8) * TILE, y1: (by - 8) * TILE, x2: (bx + 8) * TILE, y2: (by + 8) * TILE,
        bossX: bx * TILE + 16, bossY: by * TILE + 16,
      };
      // corridor guarantee: carve path entrance -> boss
      let cx2 = ex, cy2 = ey, guard = 0;
      while ((cx2 !== bx || cy2 !== by) && guard++ < 3000) {
        this.carveCircle(map, cx2, cy2, 1, floor);
        if (cx2 !== bx && (cy2 === by || rng() < 0.5)) cx2 += Math.sign(bx - cx2);
        else if (cy2 !== by) cy2 += Math.sign(by - cy2);
      }
      // shrine partway
      const sx = ((ex + bx) >> 1), sy = ((ey + by) >> 1);
      this.carveCircle(map, sx, sy, 3, floor);
      map.shrines.push({ id: opt.id + "_shrine", name: opt.name + " Shrine", x: sx * TILE + 16, y: sy * TILE + 16 });
      map.lights.push({ x: sx * TILE + 16, y: sy * TILE + 16, r: 120, color: "255,150,60", flicker: true });
      bossRoom = { cx: bx, cy: by };

      // cold way-lamps along the entrance->boss line (the Lampwright's quest)
      if (opt.waylamps) {
        for (let n = 1; n <= opt.waylamps; n++) {
          const f = n / (opt.waylamps + 1);
          const lx = Math.round(U.lerp(ex, bx, f)) + U.randi(rng, -2, 2);
          const ly = Math.round(U.lerp(ey, by, f)) + U.randi(rng, -2, 2);
          this.carveCircle(map, lx, ly, 2, floor);
          map.stations.push({
            kind: "waylamp", flag: "waylamp_um_" + n,
            x: lx * TILE + 16, y: ly * TILE + 16,
          });
        }
      }
    }

    // fake "rooms" list for population: random open spots
    const rooms = [];
    for (let i = 0; i < 14; i++) {
      const j = open[U.randi(rng, 0, open.length - 1)];
      rooms.push({ cx: j % w, cy: (j / w) | 0, x: j % w, y: (j / w) | 0, w: 1, h: 1 });
    }
    this.populateDungeon(map, rng, rooms, { cx: ex, cy: ey }, bossRoom, opt);
    return map;
  },

  carveCircle(map, cx, cy, r, floor) {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (x < 1 || y < 1 || x >= map.w - 1 || y >= map.h - 1) continue;
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) {
          map.tiles[y * map.w + x] = floor;
          map.deco[y * map.w + x] = D.NONE;
        }
      }
    }
  },

  populateDungeon(map, rng, rooms, entrance, bossRoom, opt) {
    const openSpots = [];
    for (let y = 2; y < map.h - 2; y++) {
      for (let x = 2; x < map.w - 2; x++) {
        const t = map.tiles[y * map.w + x];
        if (SOLID_TILES.has(t)) continue;
        if (U.dist(x, y, entrance.cx, entrance.cy) < 7) continue;
        if (bossRoom && U.dist(x, y, bossRoom.cx, bossRoom.cy) < 10) continue;
        openSpots.push([x, y]);
      }
    }
    U.shuffle(rng, openSpots);
    let si = 0;
    const next = () => openSpots[(si++) % openSpots.length];

    // encounters
    let ei = 0;
    for (const pair of opt.enemies) {
      const type = pair[0], count = pair[1];
      for (let n = 0; n < count; n++) {
        const s = next();
        if (!s) break;
        map.encounters.push({ idx: "e" + (ei++), type, x: s[0] * TILE + 16, y: s[1] * TILE + 16 });
      }
    }
    // chests
    for (const tier of (opt.chests || [])) {
      const s = next();
      if (!s) break;
      map.chests.push({ id: map.id + "_c" + map.chests.length, x: s[0] * TILE + 16, y: s[1] * TILE + 16, tier });
    }
    // gatherables
    for (let n = 0; n < 8; n++) {
      const s = next();
      if (!s || !opt.gather || !opt.gather.length) break;
      map.pickups.push({ id: map.id + "_pk" + n, item: U.choice(rng, opt.gather), n: 1, x: s[0] * TILE + 16, y: s[1] * TILE + 16 });
    }
    // grave deco for crypts — searchable, at a price
    map.graves = map.graves || [];
    if (opt.graves) {
      for (let n = 0; n < 14; n++) {
        const s = next();
        if (!s) break;
        map.deco[s[1] * map.w + s[0]] = D.GRAVE;
        map.graves.push({ id: map.id + "_g" + n, x: s[0] * TILE + 16, y: s[1] * TILE + 16 });
      }
    }
    // torch lights
    for (const r of rooms) {
      if (rng() < 0.7) {
        map.lights.push({ x: r.cx * TILE + 16, y: r.cy * TILE + 16, r: 110, color: "255,160,70", flicker: true });
      }
    }
  },

  /* ======================================================
     SPATIAL QUERIES & COLLISION
     ====================================================== */

  tileAt(map, tx, ty) {
    if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return T.VOID;
    return map.tiles[ty * map.w + tx];
  },

  decoAtTile(map, tx, ty) {
    if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return D.NONE;
    return map.deco[ty * map.w + tx];
  },

  solidAtTile(map, tx, ty) {
    const t = this.tileAt(map, tx, ty);
    if (SOLID_TILES.has(t)) {
      // boss gate: arena walls off while boss lives (entry side stays open until engaged)
      return true;
    }
    if (SOLID_DECO.has(this.decoAtTile(map, tx, ty))) return true;
    return false;
  },

  // is a circle at px,py radius r blocked?
  circleBlocked(map, px, py, r) {
    const x0 = ((px - r) / TILE) | 0, x1 = ((px + r) / TILE) | 0;
    const y0 = ((py - r) / TILE) | 0, y1 = ((py + r) / TILE) | 0;
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!this.solidAtTile(map, tx, ty)) continue;
        // circle vs tile aabb
        const cx = U.clamp(px, tx * TILE, tx * TILE + TILE);
        const cy = U.clamp(py, ty * TILE, ty * TILE + TILE);
        if (U.dist2(px, py, cx, cy) < r * r) return true;
      }
    }
    // sealed boss gate
    if (G.bossFight && map.bossArena && !this.inArena(map, px, py, -6)) {
      if (this.inArena(map, px, py, r + 8)) return true; // pressing on the seal from either side
    }
    return false;
  },

  inArena(map, px, py, pad) {
    const a = map.bossArena;
    if (!a) return false;
    const p = pad || 0;
    return px > a.x1 - p && px < a.x2 + p && py > a.y1 - p && py < a.y2 + p;
  },

  // attempt to move a circular entity; slides along walls; returns true if any movement
  moveCircle(map, e, dx, dy) {
    let moved = false;
    if (dx !== 0 && !this.circleBlocked(map, e.x + dx, e.y, e.r)) { e.x += dx; moved = true; }
    if (dy !== 0 && !this.circleBlocked(map, e.x, e.y + dy, e.r)) { e.y += dy; moved = true; }
    return moved;
  },

  // AI movement with obstacle steering: tries the desired heading, then fans
  // outward until something gives. Returns the heading actually walked, or null.
  steerMove(map, e, ang, sp) {
    for (const off of [0, 0.65, -0.65, 1.25, -1.25]) {
      const a = ang + off;
      if (this.moveCircle(map, e, Math.cos(a) * sp, Math.sin(a) * sp)) return a;
    }
    return null;
  },

  // straight-line sight test (tiles + solid deco block it)
  lineClear(map, x1, y1, x2, y2) {
    const d = U.dist(x1, y1, x2, y2);
    const steps = Math.max(1, Math.ceil(d / 14));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = U.lerp(x1, x2, t), y = U.lerp(y1, y2, t);
      if (this.solidAtTile(map, (x / TILE) | 0, (y / TILE) | 0)) return false;
    }
    return true;
  },

  slowAt(map, px, py) {
    return SLOW_TILES.has(this.tileAt(map, (px / TILE) | 0, (py / TILE) | 0)) ? 0.72 : 1;
  },

  biomeAtPx(map, px, py) {
    if (!map.biome) return -1;
    const tx = U.clamp((px / TILE) | 0, 0, map.w - 1);
    const ty = U.clamp((py / TILE) | 0, 0, map.h - 1);
    return map.biome[ty * map.w + tx];
  },

  regionNameAt(map, px, py) {
    if (!map.outdoor) return map.name;
    for (const p of map.poiList) {
      if (p.kind === "town" && U.dist(px, py, p.tx * TILE, p.ty * TILE) < 480) return p.name;
    }
    const b = this.biomeAtPx(map, px, py);
    return b >= 0 ? BIOME_NAMES[b] : map.name;
  },

  poiById(id) {
    const ow = this.getMap("overworld");
    return ow.poiList.find(p => p.id === id) || null;
  },

  revealPoi(id) {
    const p = this.poiById(id);
    if (p) { p.hidden = false; G.discoveredPois[id] = true; }
  },

  /* ======================================================
     SPAWNERS (overworld ambient packs)
     ====================================================== */

  updateSpawners(dt) {
    const map = G.map;
    if (!map || !map.outdoor || !G.player) return;
    const p = G.player;
    for (const s of map.spawners) {
      s.cd -= dt;
      s.members = s.members.filter(m => !m.dead);
      if (s.cd > 0 || s.members.length >= s.max) continue;
      const d = U.dist(p.x, p.y, s.x, s.y);
      if (d < 380 || d > 1000) continue;
      if (this.nearSafeZone(map, s.x, s.y, 0)) continue;
      const table = SPAWN_TABLES[s.table];
      if (!table) continue;
      const pick = U.weighted(Math.random, table);
      const packN = U.randi(Math.random, pick.pack[0], pick.pack[1]);
      for (let n = 0; n < packN && s.members.length < s.max; n++) {
        const ang = Math.random() * TAU, rr = 40 + Math.random() * s.r;
        const ex = s.x + Math.cos(ang) * rr, ey = s.y + Math.sin(ang) * rr;
        if (this.circleBlocked(map, ex, ey, 14)) continue;
        if (U.dist(p.x, p.y, ex, ey) < 320) continue;
        const e = new Enemy(pick.id, ex, ey);
        e.homeX = s.x; e.homeY = s.y;
        // a rare few burn brighter: elite "ashen" variants (never wildlife)
        if (!(e.def.tags && e.def.tags.includes("critter")) && Math.random() < 0.07) e.makeElite();
        G.entities.push(e);
        s.members.push(e);
      }
      s.cd = 9 + Math.random() * 6;
    }
  },

  /* Dark Souls rule: resting (or dying) restores the world's monsters & herbs */
  restReset() {
    const maps = [G.overworld, ...Object.values(G.maps)].filter(Boolean);
    for (const m of maps) {
      m.encDead = {};
      for (const s of m.spawners) { s.members = []; s.cd = 2; }
      for (const pk of m.pickups) pk.taken = false;
    }
    // clear live non-boss enemies on the active map
    G.entities = G.entities.filter(e => !(e.isEnemy && !e.def.boss));
    G.projectiles.length = 0;
  },
};
