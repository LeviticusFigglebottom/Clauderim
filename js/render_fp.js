/* ============================================================
   CLAUDERIM — render_fp.js
   First-person renderer: a DDA raycaster over the same tile
   world the top-down view uses. Low internal resolution
   (400x225) upscaled 3.2x for a chunky, torchlit look.

   - Walls: WALL_WOOD / WALL_STONE / VOID / SNOWROCK columns,
     procedurally "textured", side- and distance-shaded.
   - Floors (and interior ceilings) are cast per column from
     the real tile map; water shimmers, lava glows.
   - Sky: time-of-day gradient, dusk warmth, night starfield.
   - Everything else is billboards with per-column depth
     testing: entities (reusing Render.drawEntity), deco,
     chests, shrines, portals, pickups, stations, projectiles,
     hazards, corpses and your lost embers.
   - Damage numbers and particles are projected onto the main
     canvas. The HUD is shared with the top-down view.
   ============================================================ */
"use strict";

const FP_WALLS = new Set([T.WALL_WOOD, T.WALL_STONE, T.VOID, T.SNOWROCK]);
const FP_MAXDIST = 26; // tiles

/* billboard heights in tiles, by deco id */
const FP_DECO_H = {
  [D.TREE]: 2.6, [D.PINE]: 3.0, [D.SWAMPTREE]: 2.4, [D.DEADTREE]: 2.2,
  [D.ROCK]: 0.9, [D.BOULDER]: 1.25, [D.BUSH]: 0.55, [D.ANVIL]: 0.8,
  [D.ALCH]: 0.9, [D.WELL]: 0.9, [D.LAMP]: 1.9, [D.CAIRN]: 1.0,
  [D.GRAVE]: 1.0, [D.BARREL]: 0.9, [D.TABLE]: 0.8, [D.EMBERVAULT]: 1.3,
  [D.PILLAR]: 2.1,
};

const RenderFP = {
  W: 400, H: 225,
  fov: 0.66,             // camera-plane half length (≈66° fov)
  canvas: null, ctx: null, img: null,
  depth: null, wallEnd: null,
  tmp: null, tmpCtx: null,
  TILE_RGB: null,
  skyRow: null,

  init() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.W; this.canvas.height = this.H;
    this.ctx = this.canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false; // chunky sprites, not blurry ones
    this.img = this.ctx.createImageData(this.W, this.H);
    this.depth = new Float32Array(this.W);
    this.wallEnd = new Int32Array(this.W);
    this.tmp = document.createElement("canvas");
    this.tmp.width = 64; this.tmp.height = 88;
    this.tmpCtx = this.tmp.getContext("2d");
    this.TILE_RGB = {};
    for (const k in TILE_COLORS) {
      const c = TILE_COLORS[k];
      this.TILE_RGB[k] = [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    }
    this.skyRow = new Array(this.H >> 1);
  },

  /* tiny deterministic per-cell jitter for ground/wall texture */
  jit(xi, yi) {
    let h = (Math.imul(xi, 73856093) ^ Math.imul(yi, 19349663)) >>> 0;
    return ((h >>> 8) % 1000) / 1000;
  },

  /* world point -> main-canvas projection (floats, particles) */
  project(wx, wy) {
    const p = G.player;
    if (!p) return null;
    const dx = (wx - p.x) / TILE, dy = (wy - p.y) / TILE;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const rel = U.angDiff(p.facing, Math.atan2(dy, dx));
    if (Math.abs(rel) > 1.15) return null;
    const perp = dist * Math.cos(rel);
    if (perp < 0.15) return null;
    const scale = G.W / this.W;
    const sx = (0.5 + Math.tan(rel) / (2 * this.fov)) * this.W;
    if (sx < -40 || sx > this.W + 40) return null;
    const wallH = this.H / perp;
    return {
      x: sx * scale,
      ground: (this.H / 2 + wallH / 2) * scale,
      h: wallH * scale, perp, col: U.clamp(sx | 0, 0, this.W - 1),
    };
  },

  /* ------------------------------------------------------ */

  draw() {
    if (!this.canvas) this.init();
    const map = G.map, p = G.player;
    if (!map || !p) return;
    const W = this.W, H = this.H, horizon = H >> 1;
    const data = this.img.data;
    const px = p.x / TILE, py = p.y / TILE;
    const yaw = p.facing;
    const dirX = Math.cos(yaw), dirY = Math.sin(yaw);
    const plX = -dirY * this.fov, plY = dirX * this.fov;
    const tm = G.elapsed;

    /* ---- ambient & fog ---- */
    const dark = map.outdoor ? G.darkness() : 1;
    let amb, fog;
    if (map.outdoor) {
      amb = 1 - dark * 0.62;
      // sky gradient: day -> dusk -> night
      const h = G.time.hour;
      const duskW = (h > 16.5 && h < 21.5) ? 1 - Math.abs(h - 19) / 2.5 : 0;
      const top = [
        U.lerp(U.lerp(96, 14, dark), 120, duskW * 0.4),
        U.lerp(U.lerp(140, 16, dark), 70, duskW * 0.5),
        U.lerp(U.lerp(190, 34, dark), 60, duskW * 0.6),
      ];
      const hor = [
        U.lerp(U.lerp(170, 24, dark), 224, duskW),
        U.lerp(U.lerp(190, 28, dark), 120, duskW),
        U.lerp(U.lerp(210, 46, dark), 60, duskW),
      ];
      // weather mutes the sky
      const wmute = G.weather.kind === "clear" ? 0 : G.weather.intensity * 0.5;
      for (let i = 0; i < 3; i++) {
        const grey = (top[i] + hor[i]) / 2 * 0.7;
        top[i] = U.lerp(top[i], grey, wmute);
        hor[i] = U.lerp(hor[i], grey, wmute);
      }
      for (let y = 0; y < horizon; y++) {
        const t = y / horizon;
        this.skyRow[y] = [
          U.lerp(top[0], hor[0], t) | 0,
          U.lerp(top[1], hor[1], t) | 0,
          U.lerp(top[2], hor[2], t) | 0,
        ];
      }
      fog = [hor[0] * 0.85 | 0, hor[1] * 0.85 | 0, hor[2] * 0.85 | 0];
    } else if (map.ambient === "undermarch") {
      amb = 0.5; fog = [7, 8, 14];
    } else {
      amb = 0.62; fog = [10, 9, 8];
    }

    /* ---- per-column raycast ---- */
    for (let col = 0; col < W; col++) {
      const camXr = 2 * col / W - 1;
      const rdx = dirX + plX * camXr;
      const rdy = dirY + plY * camXr;

      let mapX = Math.floor(px), mapY = Math.floor(py);
      const dDx = Math.abs(1 / (rdx || 1e-9)), dDy = Math.abs(1 / (rdy || 1e-9));
      let stepX, stepY, sideX, sideY;
      if (rdx < 0) { stepX = -1; sideX = (px - mapX) * dDx; } else { stepX = 1; sideX = (mapX + 1 - px) * dDx; }
      if (rdy < 0) { stepY = -1; sideY = (py - mapY) * dDy; } else { stepY = 1; sideY = (mapY + 1 - py) * dDy; }

      let hit = 0, side = 0, tile = 0, steps = 0;
      while (steps++ < 64) {
        if (sideX < sideY) { sideX += dDx; mapX += stepX; side = 0; }
        else { sideY += dDy; mapY += stepY; side = 1; }
        tile = World.tileAt(map, mapX, mapY);
        if (FP_WALLS.has(tile)) { hit = 1; break; }
        if ((side === 0 ? sideX - dDx : sideY - dDy) > FP_MAXDIST) break;
      }

      let perp = FP_MAXDIST, drawStart = horizon, drawEnd = horizon;
      if (hit) {
        perp = side === 0 ? sideX - dDx : sideY - dDy;
        perp = Math.max(0.08, perp);
        const lineH = H / perp;
        drawStart = Math.max(0, (horizon - lineH / 2) | 0);
        drawEnd = Math.min(H - 1, (horizon + lineH / 2) | 0);

        // wall base color
        const rgb = this.TILE_RGB[tile] || [60, 60, 60];
        const wallX = side === 0 ? py + perp * rdy : px + perp * rdx;
        const u = wallX - Math.floor(wallX);
        const cellJ = this.jit(mapX, mapY);
        let br = amb * (side === 1 ? 0.74 : 1) / (1 + perp * 0.085);
        br += Math.max(0, 1 - perp / 4.5) * 0.5 * (1 - amb); // the Emberborn's faint glow
        const fogT = Math.pow(Math.min(1, perp / FP_MAXDIST), 1.35);

        const vStep = 1 / (H / perp);
        let v = (drawStart - (horizon - (H / perp) / 2)) * vStep;
        for (let y = drawStart; y <= drawEnd; y++, v += vStep) {
          // procedural masonry: course lines + staggered joints + cell jitter
          let tex = 1 + (cellJ - 0.5) * 0.16;
          const course = v * 3;
          if (course - Math.floor(course) < 0.07) tex *= 0.72;
          const brick = u * 2 + (Math.floor(course) % 2) * 0.5;
          if (brick - Math.floor(brick) < 0.05) tex *= 0.78;
          if (tile === T.SNOWROCK && v < 0.25) tex *= 1.35; // snow caps
          const b = br * tex;
          const i4 = (y * W + col) * 4;
          data[i4]     = U.lerp(rgb[0] * b, fog[0], fogT) | 0;
          data[i4 + 1] = U.lerp(rgb[1] * b, fog[1], fogT) | 0;
          data[i4 + 2] = U.lerp(rgb[2] * b, fog[2], fogT) | 0;
          data[i4 + 3] = 255;
        }
      }
      this.depth[col] = perp;
      this.wallEnd[col] = drawEnd;

      /* sky / ceiling above the wall */
      const skyEnd = hit ? drawStart : horizon;
      if (map.outdoor) {
        for (let y = 0; y < skyEnd; y++) {
          const c = this.skyRow[y] || this.skyRow[horizon - 1];
          const i4 = (y * W + col) * 4;
          data[i4] = c[0]; data[i4 + 1] = c[1]; data[i4 + 2] = c[2]; data[i4 + 3] = 255;
        }
      } else {
        // cast stone ceiling
        for (let y = 0; y < skyEnd; y++) {
          const rowDist = (0.5 * H) / Math.max(1, horizon - y);
          const fx2 = px + rdx * rowDist, fy2 = py + rdy * rowDist;
          const j = this.jit(Math.floor(fx2 * 2), Math.floor(fy2 * 2));
          let b = amb * 0.55 / (1 + rowDist * 0.09);
          b += Math.max(0, 1 - rowDist / 4.5) * 0.4 * (1 - amb);
          const fogT = Math.pow(Math.min(1, rowDist / FP_MAXDIST), 1.35);
          const base = 34 + j * 14;
          const i4 = (y * W + col) * 4;
          data[i4]     = U.lerp(base * b, fog[0], fogT) | 0;
          data[i4 + 1] = U.lerp(base * b * 0.97, fog[1], fogT) | 0;
          data[i4 + 2] = U.lerp((base + 4) * b, fog[2], fogT) | 0;
          data[i4 + 3] = 255;
        }
      }

      /* floor below the wall (or below the horizon when open) */
      const floorStart = hit ? drawEnd + 1 : horizon + 1;
      for (let y = floorStart; y < H; y++) {
        const rowDist = (0.5 * H) / (y - horizon);
        const fx2 = px + rdx * rowDist, fy2 = py + rdy * rowDist;
        const t2 = World.tileAt(map, Math.floor(fx2), Math.floor(fy2));
        const rgb = this.TILE_RGB[t2] || [40, 40, 40];
        const j = this.jit(Math.floor(fx2 * 2), Math.floor(fy2 * 2));
        let r = rgb[0], g = rgb[1], bch = rgb[2];
        if (t2 === T.WATER || t2 === T.DEEPWATER) {
          const sh = Math.sin(tm * 1.8 + fx2 * 2.2 + fy2 * 3.1) * 14;
          r += sh; g += sh; bch += sh + 8;
        } else if (t2 === T.LAVA) {
          const pulse = 0.6 + 0.4 * Math.sin(tm * 2.5 + fx2 + fy2);
          r = 200 * pulse + 60; g = 80 * pulse + 30; bch = 25;
        }
        const tex = 1 + (j - 0.5) * 0.22;
        let b = amb * tex / (1 + rowDist * 0.075);
        b += Math.max(0, 1 - rowDist / 4.5) * 0.55 * (1 - amb);
        const fogT = Math.pow(Math.min(1, rowDist / FP_MAXDIST), 1.35);
        const i4 = (y * W + col) * 4;
        data[i4]     = U.lerp(r * b, fog[0], fogT) | 0;
        data[i4 + 1] = U.lerp(g * b, fog[1], fogT) | 0;
        data[i4 + 2] = U.lerp(bch * b, fog[2], fogT) | 0;
        data[i4 + 3] = 255;
      }
    }

    this.ctx.putImageData(this.img, 0, 0);

    /* ---- night starfield ---- */
    if (map.outdoor && dark > 0.45) {
      this.ctx.save();
      for (let i = 0; i < 110; i++) {
        const az = U.hash2(i, 3, 77) * TAU * 2;
        const rel = U.angDiff(yaw, az);
        if (Math.abs(rel) > 0.85) continue;
        const sx = (0.5 + Math.tan(rel) / (2 * this.fov)) * W;
        const sy = U.hash2(i, 9, 41) * horizon * 0.82;
        const tw = 0.5 + 0.5 * Math.sin(tm * (1 + U.hash2(i, 5, 13) * 2) + i);
        this.ctx.fillStyle = `rgba(220,228,255,${(dark - 0.45) * 1.4 * (0.25 + 0.6 * tw)})`;
        this.ctx.fillRect(sx | 0, sy | 0, 1, 1);
      }
      this.ctx.restore();
    }

    /* ---- billboards ---- */
    this.drawBillboards(map, p, yaw, tm);

    /* ---- upscale to the main canvas ---- */
    G.ctx.imageSmoothingEnabled = false;
    G.ctx.drawImage(this.canvas, 0, 0, W, H, 0, 0, G.W, G.H);

    /* ---- projected particles & floats ---- */
    this.drawProjected();

    /* ---- shared screen-space layers ---- */
    Render.weather(G.ctx, map, 0, 0);
    if (G.state === "play" || G.state === "dialogue") {
      Render.hud(G.ctx);
      // center reticle
      const cx = G.W / 2, cy = G.H / 2;
      G.ctx.strokeStyle = "rgba(232,207,154,0.8)";
      G.ctx.lineWidth = 1.5;
      G.ctx.beginPath();
      G.ctx.arc(cx, cy, 3.5, 0, TAU);
      G.ctx.stroke();
      G.ctx.fillStyle = "rgba(232,207,154,0.9)";
      G.ctx.fillRect(cx - 0.7, cy - 0.7, 1.4, 1.4);
    }
  },

  /* ------------------------------------------------------ */

  gatherSprites(map, p, tm) {
    const list = [];
    const seen = (wx, wy) => U.dist(p.x, p.y, wx, wy) / TILE;
    const addIf = (wx, wy, hTiles, anchorFrac, paint, wFactor, yLift) => {
      const dist = seen(wx, wy);
      if (dist > FP_MAXDIST) return;
      const rel = U.angDiff(p.facing, U.angTo(p.x, p.y, wx, wy));
      if (Math.abs(rel) > 1.05) return;          // outside the view cone / behind
      const perp = dist * Math.cos(rel);
      if (perp < 0.22) return;                    // inside the camera — nothing sane to draw
      list.push({ rel, perp, hTiles, anchorFrac, paint, wFactor: wFactor || 1, yLift: yLift || 0 });
    };

    /* entities */
    for (const e of G.entities) {
      if (e.dead || e === p) continue;
      if (e instanceof Hazard) {
        addIf(e.x, e.y, 0.36, 0.62, (c) => {
          c.globalAlpha = 0.45 + 0.12 * Math.sin(tm * 3);
          c.fillStyle = e.color;
          c.beginPath(); c.ellipse(32, 56, 30, 12, 0, 0, TAU); c.fill();
          c.globalAlpha = 1;
        }, 2.6);
        continue;
      }
      const look = (e.def && e.def.look) || {};
      const size = look.size || 1;
      // body plans stand at different heights
      const shapeH = { beast: 0.8, crawler: 0.7, blob: 0.85, wisp: 1.25 }[look.shape] || 1.45;
      addIf(e.x, e.y, U.clamp(shapeH * size, 0.45, 4.2), 0.77, (c) => {
        // billboards face the camera: show heading relative to the view,
        // not the world-rotated top-down sprite
        e._fpFace = Math.PI / 2 + U.angDiff(p.facing, e.facing) * 0.5;
        Render.drawEntity(c, e, e.x - 32, e.y - 60);
        delete e._fpFace;
      });
    }

    /* corpses */
    for (const cp of G.corpsePile) {
      addIf(cp.x, cp.y, 0.4, 0.7, (c) => {
        c.globalAlpha = Math.max(0, 0.7 - cp.t * 0.07);
        c.fillStyle = cp.look.body;
        c.beginPath(); c.ellipse(32, 60, 16 * (cp.look.size || 1), 6 * (cp.look.size || 1), 0, 0, TAU); c.fill();
        c.globalAlpha = 1;
      }, 1.6);
    }

    /* deco within view box */
    const tx0 = Math.max(0, ((p.x / TILE) | 0) - 20), tx1 = Math.min(map.w - 1, ((p.x / TILE) | 0) + 20);
    const ty0 = Math.max(0, ((p.y / TILE) | 0) - 20), ty1 = Math.min(map.h - 1, ((p.y / TILE) | 0) + 20);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const d = map.deco[ty * map.w + tx];
        if (!d) continue;
        const h = FP_DECO_H[d] || 1;
        const hash = U.hash2(tx, ty, 31);
        addIf(tx * TILE + 16, ty * TILE + 16, h, 0.86,
          (c) => Render.drawDeco(c, d, 32, 72, hash));
      }
    }

    /* chests */
    for (const ch of map.chests) {
      addIf(ch.x, ch.y, 0.55, 0.8, (c) => {
        const open = G.openedChests[ch.id];
        c.fillStyle = open ? "#4a3826" : "#6e5230";
        c.fillRect(14, 52, 36, 24);
        c.fillStyle = open ? "#2c2014" : "#8a6a3a";
        c.fillRect(14, 46, 36, 9);
        c.fillStyle = ch.tier === "chest_rare" ? "#c89ad8" : ch.tier === "chest_fine" ? "#9ab0d8" : "#c9a86a";
        c.fillRect(29, 54, 6, 9);
      });
    }

    /* shrines */
    for (const s of map.shrines) {
      addIf(s.x, s.y, 1.7, 0.88, (c) => {
        c.fillStyle = "#5d5a52"; c.fillRect(24, 36, 16, 40);
        c.fillStyle = "#6e6a62"; c.fillRect(18, 30, 28, 9);
        const fl = 0.7 + 0.3 * Math.sin(tm * 6 + s.x);
        c.save();
        c.shadowColor = "#ff8c3a"; c.shadowBlur = 16;
        c.fillStyle = `rgba(255,${120 + fl * 80 | 0},40,0.95)`;
        c.beginPath();
        c.moveTo(32, 6 - fl * 5);
        c.quadraticCurveTo(41, 20, 32, 30);
        c.quadraticCurveTo(23, 20, 32, 6 - fl * 5);
        c.fill();
        c.restore();
      });
    }

    /* portals */
    for (const pt of map.portals) {
      addIf(pt.x, pt.y, 1.9, 0.9, (c) => {
        c.save();
        c.shadowColor = "#101018"; c.shadowBlur = 14;
        c.fillStyle = pt.exit ? "rgba(220,200,160,0.4)" : "rgba(4,4,9,0.95)";
        c.beginPath(); c.ellipse(32, 46, 17, 34, 0, 0, TAU); c.fill();
        c.restore();
        if (pt.lockedBy && !G.flags["unlocked_" + pt.id]) {
          c.fillStyle = "#c9a86a";
          c.fillRect(28, 42, 8, 11);
          c.beginPath(); c.arc(32, 41, 5, Math.PI, 0); c.strokeStyle = "#c9a86a"; c.lineWidth = 2.4; c.stroke();
        }
      });
    }

    /* pickups */
    for (const pk of map.pickups) {
      if (pk.taken) continue;
      addIf(pk.x, pk.y, 0.5, 0.84, (c) => {
        if (pk.vein) {
          c.fillStyle = "#7a7670";
          c.beginPath(); c.ellipse(32, 64, 13, 9, 0, 0, TAU); c.fill();
          c.fillStyle = "#c9a86a";
          c.fillRect(27, 60, 4, 4); c.fillRect(34, 64, 3.4, 3.4);
        } else {
          const col = pk.item === "glowcap" ? "#9ad6ff" : pk.item === "emberbloom" ? "#ff8c3a"
            : pk.item === "frostmoss" ? "#bfeaff" : pk.item === "ghost_fern" ? "#cfe6da" : "#7da45a";
          c.strokeStyle = "#3a5a2a"; c.lineWidth = 2.4;
          c.beginPath(); c.moveTo(32, 70); c.lineTo(32, 56); c.stroke();
          if (pk.item === "glowcap") { c.shadowColor = col; c.shadowBlur = 9; }
          c.fillStyle = col;
          c.beginPath(); c.arc(32, 53, 6, 0, TAU); c.fill();
          c.shadowBlur = 0;
        }
      });
    }

    /* stations */
    for (const st of map.stations) {
      if (st.kind === "campfire") {
        addIf(st.x, st.y, 0.9, 0.86, (c) => {
          c.strokeStyle = "#4a3826"; c.lineWidth = 5;
          c.beginPath();
          c.moveTo(18, 72); c.lineTo(46, 62); c.moveTo(18, 62); c.lineTo(46, 72);
          c.stroke();
          const fl = 0.7 + 0.3 * Math.sin(tm * 8 + st.x);
          c.save();
          c.shadowColor = "#ff8c3a"; c.shadowBlur = 14;
          c.fillStyle = `rgba(255,${130 + fl * 70 | 0},45,0.92)`;
          c.beginPath();
          c.moveTo(32, 32 - fl * 7);
          c.quadraticCurveTo(41, 50, 32, 62);
          c.quadraticCurveTo(23, 50, 32, 32 - fl * 7);
          c.fill();
          c.restore();
        });
      } else if (st.kind === "waylamp") {
        addIf(st.x, st.y, 1.9, 0.9, (c) => {
          const lit = G.flags[st.flag];
          c.fillStyle = "#3c3a36";
          c.fillRect(28, 24, 8, 52);
          c.fillRect(20, 14, 24, 13);
          if (lit) {
            c.save();
            c.shadowColor = "#ffc060"; c.shadowBlur = 16;
            c.fillStyle = `rgba(255,205,120,${0.75 + 0.25 * Math.sin(tm * 7 + st.x)})`;
            c.fillRect(24, 16, 16, 9);
            c.restore();
          } else {
            c.fillStyle = "#15151a"; c.fillRect(24, 16, 16, 9);
          }
        });
      } else if (st.kind === "vault") {
        addIf(st.x, st.y, 1.3, 0.85, (c) => {
          const fl = 0.5 + 0.5 * Math.sin(tm * 2);
          c.fillStyle = "#393733";
          c.beginPath(); c.arc(32, 52, 20, 0, TAU); c.fill();
          c.strokeStyle = "#c9a86a"; c.lineWidth = 3;
          c.beginPath(); c.arc(32, 52, 20, 0, TAU); c.stroke();
          c.save();
          c.shadowColor = "#ffd9a0"; c.shadowBlur = 22 + fl * 14;
          c.fillStyle = `rgba(255,210,140,${0.7 + fl * 0.3})`;
          c.beginPath(); c.arc(32, 44, 8 + fl * 3, 0, TAU); c.fill();
          c.restore();
        });
      }
    }

    /* lost embers */
    if (G.lostEmbers && G.lostEmbers.mapId === map.id) {
      const le = G.lostEmbers;
      addIf(le.x, le.y, 0.6, 0.8, (c) => {
        const fl = 0.6 + 0.4 * Math.sin(tm * 5);
        c.save();
        c.shadowColor = "#7ce08a"; c.shadowBlur = 18;
        c.fillStyle = `rgba(140,255,160,${0.5 + fl * 0.5})`;
        c.beginPath(); c.arc(32, 52, 9 + fl * 4, 0, TAU); c.fill();
        c.restore();
      });
    }

    /* projectiles fly at chest height */
    for (const pr of G.projectiles) {
      addIf(pr.x, pr.y, 0.32, 0.5, (c) => {
        c.save();
        c.shadowColor = pr.color; c.shadowBlur = 12;
        c.fillStyle = pr.color;
        if (pr.spell || pr.from === "enemy") {
          c.beginPath(); c.arc(32, 44, 7, 0, TAU); c.fill();
        } else {
          c.translate(32, 44);
          c.rotate(0.2);
          c.fillRect(-13, -2, 26, 4);
        }
        c.restore();
      }, 1, 0.55);
    }

    return list;
  },

  drawBillboards(map, p, yaw, tm) {
    const W = this.W, H = this.H, horizon = H >> 1;
    const sprites = this.gatherSprites(map, p, tm);
    sprites.sort((a, b) => b.perp - a.perp);

    for (const sp of sprites) {
      const wallH = H / sp.perp;
      const groundY = horizon + wallH / 2 - sp.yLift * wallH;
      const sH = sp.hTiles * wallH * (88 / 64); // tmp canvas is taller than wide
      const sW = sH * (64 / 88) * sp.wFactor;
      if (sH < 2 || sH > H * 6) continue;
      const sx = (0.5 + Math.tan(sp.rel) / (2 * this.fov)) * W;
      const x0 = Math.max(0, (sx - sW / 2) | 0);
      const x1 = Math.min(W - 1, (sx + sW / 2) | 0);
      if (x1 <= x0) continue;
      const yTop = groundY - sH * sp.anchorFrac;

      // distance dimming via composite alpha
      const fogT = Math.pow(Math.min(1, sp.perp / FP_MAXDIST), 1.5);
      this.tmpCtx.clearRect(0, 0, 64, 88);
      sp.paint(this.tmpCtx);

      this.ctx.globalAlpha = 1 - fogT * 0.9;
      // 2px column strips with depth test
      for (let x = x0; x <= x1; x += 2) {
        if (this.depth[x] + 0.08 < sp.perp) continue;
        const u = (x - (sx - sW / 2)) / sW;
        const srcX = U.clamp(u * 64, 0, 63);
        const srcW = Math.max(0.6, (2 / sW) * 64);
        this.ctx.drawImage(this.tmp, srcX, 0, srcW, 88, x, yTop, 2, sH);
      }
      this.ctx.globalAlpha = 1;
    }
  },

  drawProjected() {
    const ctx = G.ctx;
    // particles (skip slashes/rings — they're top-down shapes)
    for (const pt of G.particles) {
      if (pt.slash || pt.ring) continue;
      const pr = this.project(pt.x, pt.y);
      if (!pr || this.depth[pr.col] + 0.1 < pr.perp) continue;
      const a = Math.max(0, 1 - pt.t / pt.life);
      ctx.globalAlpha = a * Math.max(0.15, 1 - pr.perp / FP_MAXDIST);
      ctx.fillStyle = pt.color;
      const sz = U.clamp(pt.size * pr.h / 130, 1.5, 9);
      if (pt.glow) { ctx.shadowColor = pt.color; ctx.shadowBlur = 6; }
      ctx.fillRect(pr.x - sz / 2, pr.ground - pr.h * 0.45 - sz / 2, sz, sz);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    // floating texts
    for (const f of G.floats) {
      const pr = this.project(f.x, f.y);
      if (!pr) continue;
      const a = Math.max(0, 1 - f.t / f.life);
      const fs = U.clamp(f.size * pr.h / 190, 9, 30);
      ctx.globalAlpha = a;
      ctx.font = `${fs}px "Palatino Linotype", Georgia, serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = "#000";
      ctx.fillText(f.text, pr.x + 1, pr.ground - pr.h * 0.85 - f.t * 26 + 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, pr.x, pr.ground - pr.h * 0.85 - f.t * 26);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  },
};
