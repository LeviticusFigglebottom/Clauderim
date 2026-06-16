/* ============================================================
   CLAUDERIM — render.js
   Canvas renderer: chunk-cached terrain, decorations, vector
   characters, particles, day/night lighting with point lights,
   biome weather, and the in-world HUD.
   ============================================================ */
"use strict";

const CHUNK = 16; // tiles per chunk side

const TILE_COLORS = {
  [T.DEEPWATER]: "#132638", [T.WATER]: "#1d3a52", [T.SAND]: "#b0a075",
  [T.GRASS]: "#4e7a3a", [T.MEADOW]: "#5d8a42", [T.FORESTFLOOR]: "#3d5c30",
  [T.ROCK]: "#6e6a62", [T.SNOW]: "#c7d2d9", [T.SWAMP]: "#44503a",
  [T.ASH]: "#55504a", [T.ROAD]: "#8a7a5e", [T.BRIDGE]: "#7a6648",
  [T.FLOOR_WOOD]: "#6e5638", [T.FLOOR_STONE]: "#5d5a52",
  [T.WALL_WOOD]: "#42321f", [T.WALL_STONE]: "#393733",
  [T.SNOWROCK]: "#8d99a3", [T.LAVA]: "#c4451c", [T.VOID]: "#070708",
};

const Render = {
  chunkCache: new Map(),   // key -> canvas
  minimapCanvas: null,
  weatherSeeds: [],

  init() {
    for (let i = 0; i < 90; i++) this.weatherSeeds.push(Math.random());
  },

  invalidateChunks(mapId) {
    for (const k of [...this.chunkCache.keys()]) {
      if (k.startsWith(mapId + ":")) this.chunkCache.delete(k);
    }
  },

  /* ---------------- terrain chunks ---------------- */

  chunkCanvas(map, cx, cy) {
    const key = map.id + ":" + cx + "," + cy;
    let c = this.chunkCache.get(key);
    if (c) return c;
    if (this.chunkCache.size > 110) {
      // drop oldest
      const first = this.chunkCache.keys().next().value;
      this.chunkCache.delete(first);
    }
    c = document.createElement("canvas");
    c.width = c.height = CHUNK * TILE;
    const ctx = c.getContext("2d");
    for (let ty = 0; ty < CHUNK; ty++) {
      for (let tx = 0; tx < CHUNK; tx++) {
        const wx = cx * CHUNK + tx, wy = cy * CHUNK + ty;
        this.paintTile(ctx, map, wx, wy, tx * TILE, ty * TILE);
      }
    }
    this.chunkCache.set(key, c);
    return c;
  },

  paintTile(ctx, map, wx, wy, px, py) {
    const t = World.tileAt(map, wx, wy);
    const base = TILE_COLORS[t] || "#222";
    const h = U.hash2(wx, wy, 1234);
    ctx.fillStyle = base;
    ctx.fillRect(px, py, TILE, TILE);
    // smooth large-scale patchiness + faint per-tile grain
    const v = U.vnoise(wx / 6.3, wy / 6.3, 4242);
    ctx.globalAlpha = Math.abs(v - 0.5) * 0.26 + Math.abs(h - 0.5) * 0.07;
    ctx.fillStyle = v > 0.5 ? "#fff" : "#000";
    ctx.fillRect(px, py, TILE, TILE);
    ctx.globalAlpha = 1;

    // walls throw shade on whatever stands south of them
    if (t !== T.WALL_WOOD && t !== T.WALL_STONE) {
      const above = World.tileAt(map, wx, wy - 1);
      if (above === T.WALL_WOOD || above === T.WALL_STONE) {
        const gsh = ctx.createLinearGradient(px, py, px, py + 14);
        gsh.addColorStop(0, "rgba(0,0,0,0.34)");
        gsh.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gsh;
        ctx.fillRect(px, py, TILE, 14);
      }
    }

    // soft transitions between natural terrains (walls/floors stay crisp)
    if (t <= T.BRIDGE) {
      const edges = [[0, -1, px, py, TILE, 7], [0, 1, px, py + TILE - 7, TILE, 7],
                     [-1, 0, px, py, 7, TILE], [1, 0, px + TILE - 7, py, 7, TILE]];
      for (const ed of edges) {
        const nt = World.tileAt(map, wx + ed[0], wy + ed[1]);
        if (nt === t || nt > T.BRIDGE) continue;
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = TILE_COLORS[nt] || "#222";
        ctx.fillRect(ed[2], ed[3], ed[4], ed[5]);
        ctx.globalAlpha = 1;
        // foam line where land meets water
        if ((nt === T.WATER || nt === T.DEEPWATER) && t !== T.WATER && t !== T.DEEPWATER) {
          ctx.globalAlpha = 0.22;
          ctx.fillStyle = "#dceaf2";
          if (ed[0] === 0) ctx.fillRect(ed[2], ed[1] < 0 ? py : py + TILE - 2, TILE, 2);
          else ctx.fillRect(ed[0] < 0 ? px : px + TILE - 2, ed[3], 2, TILE);
          ctx.globalAlpha = 1;
        }
      }
    }

    // texture details
    const h2 = U.hash2(wx, wy, 777);
    if (t === T.GRASS || t === T.MEADOW || t === T.FORESTFLOOR) {
      ctx.strokeStyle = "rgba(20,40,12,0.4)";
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const gx = px + ((h * 91 + i * 41) % 28) + 2, gy = py + ((h2 * 87 + i * 53) % 26) + 3;
        ctx.moveTo(gx, gy + 3); ctx.lineTo(gx + 1.5, gy);
      }
      ctx.stroke();
    } else if (t === T.SNOW) {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(px + (h * 24 | 0), py + (h2 * 24 | 0), 3, 2);
    } else if (t === T.WALL_STONE || t === T.WALL_WOOD) {
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(px, py, TILE, 3);
    } else if (t === T.FLOOR_STONE || t === T.ROAD) {
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.strokeRect(px + 1.5, py + 1.5, TILE - 3, TILE - 3);
    } else if (t === T.FLOOR_WOOD || t === T.BRIDGE) {
      ctx.strokeStyle = "rgba(0,0,0,0.22)";
      ctx.beginPath();
      for (let i = 1; i < 4; i++) { ctx.moveTo(px, py + i * 8); ctx.lineTo(px + TILE, py + i * 8); }
      ctx.stroke();
    } else if (t === T.SWAMP) {
      ctx.fillStyle = "rgba(28,40,30,0.5)";
      ctx.beginPath();
      ctx.ellipse(px + 8 + h * 14, py + 8 + h2 * 14, 5, 3, 0, 0, TAU);
      ctx.fill();
    } else if (t === T.ASH) {
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(px + (h * 22 | 0), py + (h2 * 22 | 0), 4, 2);
    } else if (t === T.SNOWROCK) {
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.beginPath();
      ctx.moveTo(px + 6, py + 26); ctx.lineTo(px + 16, py + 6 + h * 8); ctx.lineTo(px + 26, py + 26);
      ctx.fill();
    }
  },

  /* ---------------- main draw ---------------- */

  draw() {
    const ctx = G.ctx, map = G.map, p = G.player;
    if (!map) return;
    // integer camera: fractional blits bleed at chunk seams
    const camX = Math.floor(G.camera.x), camY = Math.floor(G.camera.y);

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#070708";
    ctx.fillRect(0, 0, G.W, G.H);

    /* terrain */
    const cx0 = Math.max(0, (camX / (CHUNK * TILE)) | 0);
    const cy0 = Math.max(0, (camY / (CHUNK * TILE)) | 0);
    const cx1 = Math.min(Math.ceil(map.w / CHUNK) - 1, ((camX + G.W) / (CHUNK * TILE)) | 0);
    const cy1 = Math.min(Math.ceil(map.h / CHUNK) - 1, ((camY + G.H) / (CHUNK * TILE)) | 0);
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        ctx.drawImage(this.chunkCanvas(map, cx, cy), cx * CHUNK * TILE - camX, cy * CHUNK * TILE - camY);
      }
    }

    /* animated water shimmer & lava glow */
    this.animatedTiles(ctx, map, camX, camY);

    /* world objects (static interactables) */
    this.drawStatics(ctx, map, camX, camY);

    /* corpses */
    for (const c of G.corpsePile) {
      ctx.save();
      ctx.translate(c.x - camX, c.y - camY);
      ctx.globalAlpha = Math.max(0, 0.7 - c.t * 0.07);
      ctx.fillStyle = c.look.body;
      ctx.beginPath();
      ctx.ellipse(0, 4, 12 * (c.look.size || 1), 5 * (c.look.size || 1), 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    /* birds cross the high air */
    if (G.birds) {
      for (const b of G.birds) {
        for (let i = 0; i < b.n; i++) {
          const bx = b.x - camX + i * 16 + Math.sin(b.phase + i) * 4;
          const by = b.y - camY + Math.cos(b.phase * 0.7 + i * 1.3) * 6 + i * 5;
          if (bx < -20 || bx > G.W + 20 || by < -20 || by > G.H + 20) continue;
          const flap = Math.sin(b.phase + i * 0.8) * 3;
          ctx.strokeStyle = "rgba(30,28,24,0.7)";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(bx - 5, by - flap);
          ctx.lineTo(bx, by + 1.5);
          ctx.lineTo(bx + 5, by - flap);
          ctx.stroke();
        }
      }
    }

    /* the fishing line */
    if (G.fishing) {
      const f = G.fishing;
      const bx = f.x - camX, by = f.y - camY;
      const bob = f.state === "bite" ? 4 : Math.sin(G.elapsed * 2.2) * 1.5;
      ctx.strokeStyle = "rgba(220,215,200,0.5)";
      ctx.lineWidth = 1;
      const p2 = G.player;
      ctx.beginPath(); ctx.moveTo(p2.x - camX, p2.y - camY - 6); ctx.lineTo(bx, by + bob); ctx.stroke();
      ctx.fillStyle = "#c44";
      ctx.beginPath(); ctx.arc(bx, by + bob, 3.2, 0, TAU); ctx.fill();
      ctx.fillStyle = "#eee";
      ctx.beginPath(); ctx.arc(bx, by + bob - 2.5, 2.2, 0, TAU); ctx.fill();
    }

    /* deco above ground but below entities? trees drawn after entities for canopy depth —
       simpler: draw trunk+canopy with entities sorted; here draw smaller deco first */
    this.drawDecoLayer(ctx, map, camX, camY, false);

    /* entities sorted by y */
    const drawables = [];
    for (const e of G.entities) if (!e.dead) drawables.push(e);
    if (p && !p.dead) drawables.push(p);
    drawables.sort((a, b) => a.y - b.y);
    for (const e of drawables) this.drawEntity(ctx, e, camX, camY);

    /* tall deco (tree canopies) overlapping entities */
    this.drawDecoLayer(ctx, map, camX, camY, true);

    /* projectiles */
    for (const pr of G.projectiles) {
      ctx.save();
      ctx.translate(pr.x - camX, pr.y - camY);
      ctx.rotate(Math.atan2(pr.vy, pr.vx));
      if (pr.spell || pr.from === "enemy") {
        ctx.shadowColor = pr.color; ctx.shadowBlur = 10;
        ctx.fillStyle = pr.color;
        ctx.beginPath(); ctx.arc(0, 0, pr.r, 0, TAU); ctx.fill();
      } else {
        ctx.strokeStyle = pr.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(5, 0); ctx.stroke();
        ctx.fillStyle = "#d8d0c0";
        ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(2, -2.5); ctx.lineTo(2, 2.5); ctx.fill();
      }
      ctx.restore();
    }

    /* particles */
    for (const pt of G.particles) {
      const a = 1 - pt.t / pt.life;
      ctx.globalAlpha = Math.max(0, a);
      if (pt.slash) {
        ctx.save();
        ctx.translate(pt.x - camX, pt.y - camY);
        ctx.rotate(pt.ang);
        ctx.strokeStyle = pt.color;
        ctx.lineWidth = 3 * a;
        ctx.beginPath();
        ctx.arc(0, 0, pt.len * 0.55, -0.9, 0.9);
        ctx.stroke();
        ctx.restore();
      } else if (pt.ring) {
        ctx.strokeStyle = pt.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(pt.x - camX, pt.y - camY, pt.maxR * (pt.t / pt.life), 0, TAU);
        ctx.stroke();
      } else {
        if (pt.glow) { ctx.shadowColor = pt.color; ctx.shadowBlur = 7; }
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - camX - pt.size / 2, pt.y - camY - pt.size / 2, pt.size, pt.size);
        if (pt.glow) ctx.shadowBlur = 0;
      }
    }
    ctx.globalAlpha = 1;

    /* lighting & weather */
    this.lighting(ctx, map, camX, camY);
    this.weather(ctx, map, camX, camY);

    /* floating texts */
    for (const f of G.floats) {
      const a = 1 - f.t / f.life;
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = `${f.size}px "Palatino Linotype", Georgia, serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = "#000";
      ctx.fillText(f.text, f.x - camX + 1, f.y - camY + 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x - camX, f.y - camY);
    }
    ctx.globalAlpha = 1;

    /* storm light */
    if (G.lightning > 0) {
      ctx.fillStyle = `rgba(235,240,255,${Math.min(0.85, G.lightning * 5)})`;
      ctx.fillRect(0, 0, G.W, G.H);
    }

    /* HUD */
    if (!G.photoHide && (G.state === "play" || G.state === "dialogue")) this.hud(ctx);

    /* crosshair */
    if (!G.photoHide && G.state === "play") {
      ctx.strokeStyle = "rgba(232,207,154,0.7)";
      ctx.lineWidth = 1;
      const mx = Input.mouse.x, my = Input.mouse.y;
      ctx.beginPath();
      ctx.moveTo(mx - 7, my); ctx.lineTo(mx - 2, my);
      ctx.moveTo(mx + 2, my); ctx.lineTo(mx + 7, my);
      ctx.moveTo(mx, my - 7); ctx.lineTo(mx, my - 2);
      ctx.moveTo(mx, my + 2); ctx.lineTo(mx, my + 7);
      ctx.stroke();
    }
  },

  animatedTiles(ctx, map, camX, camY) {
    const t0x = Math.max(0, (camX / TILE) | 0), t0y = Math.max(0, (camY / TILE) | 0);
    const t1x = Math.min(map.w - 1, ((camX + G.W) / TILE) | 0), t1y = Math.min(map.h - 1, ((camY + G.H) / TILE) | 0);
    const tm = G.elapsed;
    for (let ty = t0y; ty <= t1y; ty++) {
      for (let tx = t0x; tx <= t1x; tx++) {
        const t = map.tiles[ty * map.w + tx];
        if (t === T.WATER || t === T.DEEPWATER) {
          const ph = Math.sin(tm * 1.5 + tx * 1.3 + ty * 2.1);
          if (ph > 0.55) {
            ctx.fillStyle = "rgba(255,255,255,0.07)";
            ctx.fillRect(tx * TILE - camX + 4, ty * TILE - camY + 10 + ph * 6, 18, 2);
          }
        } else if (t === T.LAVA) {
          const ph = 0.5 + 0.5 * Math.sin(tm * 2.2 + tx + ty * 1.7);
          ctx.fillStyle = `rgba(255,${140 + ph * 80 | 0},40,${0.25 + ph * 0.2})`;
          ctx.fillRect(tx * TILE - camX, ty * TILE - camY, TILE, TILE);
        }
      }
    }
  },

  /* shrines, chests, portals, pickups, ember drops */
  drawStatics(ctx, map, camX, camY) {
    const tm = G.elapsed;
    const vis = (x, y) => x > camX - 60 && x < camX + G.W + 60 && y > camY - 60 && y < camY + G.H + 60;

    for (const s of map.shrines) {
      if (!vis(s.x, s.y)) continue;
      const x = s.x - camX, y = s.y - camY;
      // stone base
      ctx.fillStyle = "#4c4a45";
      ctx.beginPath(); ctx.ellipse(x, y + 8, 13, 6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "#5d5a52";
      ctx.fillRect(x - 5, y - 14, 10, 22);
      ctx.fillStyle = "#6e6a62";
      ctx.fillRect(x - 8, y - 18, 16, 6);
      // ember flame
      const fl = 0.7 + 0.3 * Math.sin(tm * 6 + s.x);
      ctx.save();
      ctx.shadowColor = "#ff8c3a"; ctx.shadowBlur = 14;
      ctx.fillStyle = `rgba(255,${120 + fl * 80 | 0},40,0.95)`;
      ctx.beginPath();
      ctx.moveTo(x, y - 30 - fl * 5);
      ctx.quadraticCurveTo(x + 6, y - 22, x, y - 16);
      ctx.quadraticCurveTo(x - 6, y - 22, x, y - 30 - fl * 5);
      ctx.fill();
      ctx.restore();
    }

    for (const c of map.chests) {
      if (!vis(c.x, c.y)) continue;
      const open = G.openedChests[c.id];
      const x = c.x - camX, y = c.y - camY;
      ctx.fillStyle = open ? "#4a3826" : "#6e5230";
      ctx.fillRect(x - 9, y - 7, 18, 13);
      ctx.fillStyle = open ? "#2c2014" : "#8a6a3a";
      ctx.fillRect(x - 9, y - 9, 18, 5);
      ctx.fillStyle = c.tier === "chest_rare" ? "#c89ad8" : c.tier === "chest_fine" ? "#9ab0d8" : "#c9a86a";
      ctx.fillRect(x - 1.5, y - 6, 3, 5);
    }

    for (const pt of map.portals) {
      if (!vis(pt.x, pt.y)) continue;
      const x = pt.x - camX, y = pt.y - camY;
      ctx.save();
      ctx.shadowColor = "#101018"; ctx.shadowBlur = 16;
      ctx.fillStyle = pt.exit ? "rgba(200,180,140,0.25)" : "rgba(5,5,10,0.9)";
      ctx.beginPath();
      ctx.ellipse(x, y, 12, 16, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
      if (pt.lockedBy && !G.flags["unlocked_" + pt.id]) {
        ctx.fillStyle = "#c9a86a";
        ctx.fillRect(x - 2.5, y - 4, 5, 7);
        ctx.beginPath(); ctx.arc(x, y - 5, 3.4, Math.PI, 0); ctx.strokeStyle = "#c9a86a"; ctx.lineWidth = 1.6; ctx.stroke();
      }
    }

    for (const pk of map.pickups) {
      if (pk.taken || !vis(pk.x, pk.y)) continue;
      const x = pk.x - camX, y = pk.y - camY;
      if (pk.vein) {
        ctx.fillStyle = "#7a7670";
        ctx.beginPath(); ctx.ellipse(x, y, 8, 6, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = "#c9a86a";
        ctx.fillRect(x - 3, y - 2, 2.5, 2.5);
        ctx.fillRect(x + 1, y + 0.5, 2, 2);
      } else {
        const it = ITEMS[pk.item];
        const col = pk.item === "glowcap" ? "#9ad6ff" : pk.item === "emberbloom" ? "#ff8c3a"
          : pk.item === "frostmoss" ? "#bfeaff" : pk.item === "ghost_fern" ? "#cfe6da" : "#7da45a";
        ctx.strokeStyle = "#3a5a2a"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.lineTo(x, y - 3); ctx.stroke();
        ctx.fillStyle = col;
        if (pk.item === "glowcap") { ctx.shadowColor = col; ctx.shadowBlur = 7; }
        ctx.beginPath(); ctx.arc(x, y - 5, 3.6, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    for (const st of map.stations) {
      if (st.kind === "campfire" && vis(st.x, st.y)) {
        const x = st.x - camX, y = st.y - camY;
        ctx.strokeStyle = "#4a3826"; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x - 8, y + 4); ctx.lineTo(x + 8, y - 2);
        ctx.moveTo(x - 8, y - 2); ctx.lineTo(x + 8, y + 4);
        ctx.stroke();
        const fl = 0.7 + 0.3 * Math.sin(tm * 8 + st.x);
        ctx.save();
        ctx.shadowColor = "#ff8c3a"; ctx.shadowBlur = 12;
        ctx.fillStyle = `rgba(255,${130 + fl * 70 | 0},45,0.92)`;
        ctx.beginPath();
        ctx.moveTo(x, y - 14 - fl * 4);
        ctx.quadraticCurveTo(x + 5, y - 6, x, y - 1);
        ctx.quadraticCurveTo(x - 5, y - 6, x, y - 14 - fl * 4);
        ctx.fill();
        ctx.restore();
        if (Math.random() < 0.06) FX.sparkle(st.x, st.y - 10, "#ffb060");
      } else if (st.kind === "waylamp" && vis(st.x, st.y)) {
        const x = st.x - camX, y = st.y - camY;
        const lit = G.flags[st.flag];
        ctx.fillStyle = "#3c3a36";
        ctx.fillRect(x - 3, y - 22, 6, 28);
        ctx.fillRect(x - 7, y - 28, 14, 8);
        if (lit) {
          const fl = 0.75 + 0.25 * Math.sin(tm * 7 + st.x);
          ctx.save();
          ctx.shadowColor = "#ffc060"; ctx.shadowBlur = 14;
          ctx.fillStyle = `rgba(255,205,120,${fl})`;
          ctx.fillRect(x - 4, y - 27, 8, 6);
          ctx.restore();
        } else {
          ctx.fillStyle = "#15151a";
          ctx.fillRect(x - 4, y - 27, 8, 6);
        }
      } else if (st.kind === "vault" && vis(st.x, st.y)) {
        const fl = 0.5 + 0.5 * Math.sin(tm * 2);
        ctx.save();
        ctx.shadowColor = "#ffd9a0"; ctx.shadowBlur = 20 + fl * 14;
        ctx.fillStyle = `rgba(255,210,140,${0.7 + fl * 0.3})`;
        ctx.beginPath(); ctx.arc(st.x - camX, st.y - camY - 8, 6 + fl * 2, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }

    // sealed boss arena: a breathing wall of fog
    if (G.bossFight && map.bossArena) {
      const a = map.bossArena;
      const pulse = 0.45 + 0.2 * Math.sin(tm * 2.2);
      ctx.save();
      ctx.strokeStyle = `rgba(220,190,140,${pulse})`;
      ctx.lineWidth = 5;
      ctx.shadowColor = "#e8cf9a"; ctx.shadowBlur = 18;
      ctx.setLineDash([14, 10]);
      ctx.lineDashOffset = -tm * 30;
      ctx.strokeRect(a.x1 - camX, a.y1 - camY, a.x2 - a.x1, a.y2 - a.y1);
      ctx.restore();
      ctx.setLineDash([]);
    }

    // lost embers (souls recovery)
    if (G.lostEmbers && G.lostEmbers.mapId === map.id) {
      const le = G.lostEmbers;
      if (vis(le.x, le.y)) {
        const fl = 0.6 + 0.4 * Math.sin(tm * 5);
        ctx.save();
        ctx.shadowColor = "#7ce08a"; ctx.shadowBlur = 16;
        ctx.fillStyle = `rgba(140,255,160,${0.5 + fl * 0.5})`;
        ctx.beginPath(); ctx.arc(le.x - camX, le.y - camY, 7 + fl * 3, 0, TAU); ctx.fill();
        ctx.restore();
        if (Math.random() < 0.2) FX.sparkle(le.x, le.y, "#9be09b");
      }
    }
  },

  drawDecoLayer(ctx, map, camX, camY, tall) {
    const t0x = Math.max(0, ((camX - 64) / TILE) | 0), t0y = Math.max(0, ((camY - 64) / TILE) | 0);
    const t1x = Math.min(map.w - 1, ((camX + G.W + 64) / TILE) | 0), t1y = Math.min(map.h - 1, ((camY + G.H + 64) / TILE) | 0);
    for (let ty = t0y; ty <= t1y; ty++) {
      for (let tx = t0x; tx <= t1x; tx++) {
        const d = map.deco[ty * map.w + tx];
        if (!d) continue;
        const isTall = (d === D.TREE || d === D.PINE || d === D.SWAMPTREE || d === D.DEADTREE);
        if (tall !== isTall) continue;
        const x = tx * TILE + 16 - camX, y = ty * TILE + 16 - camY;
        const h = U.hash2(tx, ty, 31);
        this.drawDeco(ctx, d, x, y, h);
      }
    }
  },

  drawDeco(ctx, d, x, y, h) {
    // gentle canopy sway — the wood breathes
    const sway = Math.sin(G.elapsed * 0.9 + x * 0.045 + h * 6) * (1.4 + h);
    switch (d) {
      case D.TREE: {
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath(); ctx.ellipse(x, y + 6, 13, 5, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = "#4a3826";
        ctx.fillRect(x - 2.5, y - 12, 5, 18);
        ctx.fillStyle = h > 0.5 ? "#33522a" : "#3d5c30";
        ctx.beginPath(); ctx.arc(x + sway, y - 20, 14 + h * 4, 0, TAU); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.07)";
        ctx.beginPath(); ctx.arc(x - 4 + sway, y - 24, 7, 0, TAU); ctx.fill();
        break;
      }
      case D.PINE: {
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath(); ctx.ellipse(x, y + 6, 11, 4, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = "#3a2c1e";
        ctx.fillRect(x - 2, y - 6, 4, 12);
        ctx.fillStyle = "#2c4630";
        ctx.beginPath();
        ctx.moveTo(x + sway * 0.7, y - 34 - h * 6); ctx.lineTo(x + 11, y - 6); ctx.lineTo(x - 11, y - 6);
        ctx.fill();
        ctx.fillStyle = "rgba(230,240,250,0.5)";
        ctx.beginPath();
        ctx.moveTo(x + sway * 0.7, y - 33 - h * 6); ctx.lineTo(x + 5, y - 21); ctx.lineTo(x - 5, y - 21);
        ctx.fill();
        break;
      }
      case D.SWAMPTREE: {
        ctx.fillStyle = "#3a3526";
        ctx.fillRect(x - 2, y - 14, 4, 20);
        ctx.strokeStyle = "#3a3526"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.lineTo(x + 8, y - 20); ctx.moveTo(x, y - 8); ctx.lineTo(x - 7, y - 16); ctx.stroke();
        ctx.fillStyle = "rgba(70,90,60,0.8)";
        ctx.beginPath(); ctx.arc(x + 2 + sway * 0.6, y - 22, 10 + h * 3, 0, TAU); ctx.fill();
        break;
      }
      case D.DEADTREE: {
        ctx.strokeStyle = "#41372c"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.lineTo(x, y - 18);
        ctx.moveTo(x, y - 8); ctx.lineTo(x + 8, y - 18);
        ctx.moveTo(x, y - 12); ctx.lineTo(x - 7, y - 20);
        ctx.stroke();
        break;
      }
      case D.ROCK: case D.BOULDER: {
        const s = d === D.BOULDER ? 1.4 : 1;
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath(); ctx.ellipse(x, y + 5 * s, 10 * s, 4 * s, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = d === D.BOULDER ? "#5d574e" : "#6e6a62";
        ctx.beginPath();
        ctx.moveTo(x - 9 * s, y + 5 * s); ctx.lineTo(x - 5 * s, y - 6 * s); ctx.lineTo(x + 4 * s, y - 8 * s); ctx.lineTo(x + 9 * s, y + 5 * s);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.beginPath(); ctx.moveTo(x - 5 * s, y - 6 * s); ctx.lineTo(x + 4 * s, y - 8 * s); ctx.lineTo(x + 2 * s, y - 2 * s); ctx.fill();
        break;
      }
      case D.BUSH: {
        ctx.fillStyle = "rgba(40,70,30,0.75)";
        ctx.beginPath(); ctx.arc(x - 3, y, 5, 0, TAU); ctx.arc(x + 3, y - 1, 4.5, 0, TAU); ctx.fill();
        break;
      }
      case D.ANVIL: {
        ctx.fillStyle = "#2e2c29";
        ctx.fillRect(x - 8, y - 4, 16, 6);
        ctx.fillRect(x - 3, y + 2, 6, 5);
        ctx.fillStyle = "#4a4845"; ctx.fillRect(x - 8, y - 6, 16, 3);
        break;
      }
      case D.ALCH: {
        ctx.fillStyle = "#4a3826"; ctx.fillRect(x - 9, y - 2, 18, 8);
        ctx.fillStyle = "#5a8a62";
        ctx.beginPath(); ctx.arc(x - 3, y - 5, 3.4, 0, TAU); ctx.fill();
        ctx.fillStyle = "#8a5a62";
        ctx.beginPath(); ctx.arc(x + 4, y - 4, 2.8, 0, TAU); ctx.fill();
        break;
      }
      case D.WELL: {
        ctx.fillStyle = "#5d5a52";
        ctx.beginPath(); ctx.arc(x, y, 10, 0, TAU); ctx.fill();
        ctx.fillStyle = "#1d3a52";
        ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fill();
        break;
      }
      case D.LAMP: {
        ctx.strokeStyle = "#2c2620"; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x, y - 18); ctx.stroke();
        const fl = 0.7 + 0.3 * Math.sin(G.elapsed * 7 + x);
        ctx.save();
        ctx.shadowColor = "#ffc060"; ctx.shadowBlur = 10;
        ctx.fillStyle = `rgba(255,200,110,${fl})`;
        ctx.fillRect(x - 3, y - 24, 6, 7);
        ctx.restore();
        break;
      }
      case D.CAIRN: {
        ctx.fillStyle = "#7a766e";
        ctx.beginPath(); ctx.arc(x, y + 2, 6, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(x, y - 5, 4.5, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(x, y - 11, 3, 0, TAU); ctx.fill();
        break;
      }
      case D.GRAVE: {
        ctx.fillStyle = "#6a665e";
        ctx.fillRect(x - 5, y - 10, 10, 14);
        ctx.beginPath(); ctx.arc(x, y - 10, 5, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.4)";
        ctx.strokeRect(x - 3, y - 8, 6, 2);
        break;
      }
      case D.BARREL: {
        ctx.fillStyle = "#6e5638";
        ctx.beginPath(); ctx.ellipse(x, y, 7, 9, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = "#3a2c1e"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x - 7, y - 3); ctx.lineTo(x + 7, y - 3); ctx.moveTo(x - 7, y + 3); ctx.lineTo(x + 7, y + 3); ctx.stroke();
        break;
      }
      case D.TABLE: {
        ctx.fillStyle = "#5d4a32";
        ctx.fillRect(x - 11, y - 6, 22, 12);
        ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.strokeRect(x - 11, y - 6, 22, 12);
        break;
      }
      case D.PILLAR: {
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath(); ctx.ellipse(x, y + 6, 8, 3, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = "#55524c";
        ctx.fillRect(x - 5, y - 26, 10, 32);
        ctx.fillStyle = "#6a665e";
        ctx.fillRect(x - 7, y - 30, 14, 5);
        break;
      }
      case D.FROZEN: {
        // a soldier, mid-stride, iced over
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath(); ctx.ellipse(x, y + 6, 9, 4, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = "#aebfc8";
        ctx.beginPath(); ctx.ellipse(x, y - 4, 7, 9, h > 0.5 ? 0.15 : -0.15, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(x + (h > 0.5 ? 2 : -2), y - 14, 4.6, 0, TAU); ctx.fill();
        // raised spear, never landing
        ctx.strokeStyle = "#8fa2ad"; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + (h > 0.5 ? 6 : -6), y + 2);
        ctx.lineTo(x + (h > 0.5 ? 13 : -13), y - 22);
        ctx.stroke();
        // rime glint
        ctx.fillStyle = "rgba(220,240,255,0.5)";
        ctx.fillRect(x - 2 + h * 4, y - 12, 2, 2);
        break;
      }
      case D.WRECK: {
        // a rib of the hull, barnacled
        ctx.strokeStyle = "#3a3026"; ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x - 8, y + 6);
        ctx.quadraticCurveTo(x + (h > 0.5 ? 10 : -10), y - 18, x + (h > 0.5 ? 4 : -4), y - 30);
        ctx.stroke();
        ctx.strokeStyle = "#4a4036"; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 6, y + 4);
        ctx.quadraticCurveTo(x + (h > 0.5 ? 8 : -8), y - 16, x + (h > 0.5 ? 3 : -3), y - 26);
        ctx.stroke();
        ctx.fillStyle = "rgba(120,160,150,0.5)";
        ctx.fillRect(x - 4 + h * 6, y - 12, 3, 3);
        break;
      }
      case D.ALTAR: {
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath(); ctx.ellipse(x, y + 5, 9, 4, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = "#4a4456";
        ctx.fillRect(x - 6, y - 10, 12, 16);
        ctx.fillStyle = "#5d5870";
        ctx.fillRect(x - 8, y - 13, 16, 4);
        const fl2 = 0.6 + 0.4 * Math.sin(G.elapsed * 3 + x);
        ctx.save();
        ctx.shadowColor = "#c8b8e8"; ctx.shadowBlur = 12;
        ctx.strokeStyle = `rgba(200,184,232,${fl2})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(x, y - 20, 5 + fl2 * 1.5, 0, TAU); ctx.stroke();
        ctx.fillStyle = `rgba(200,184,232,${fl2})`;
        ctx.beginPath(); ctx.arc(x, y - 20, 2, 0, TAU); ctx.fill();
        ctx.restore();
        break;
      }
      case D.BOARD: {
        ctx.strokeStyle = "#3a2c1e"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x - 7, y + 6); ctx.lineTo(x - 7, y - 18); ctx.moveTo(x + 7, y + 6); ctx.lineTo(x + 7, y - 18); ctx.stroke();
        ctx.fillStyle = "#5d4a32";
        ctx.fillRect(x - 11, y - 22, 22, 14);
        ctx.fillStyle = "#d8d0c0";
        ctx.fillRect(x - 8, y - 20, 6, 8);
        ctx.fillRect(x + 1, y - 19, 6, 9);
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(x - 7, y - 18, 4, 1.5); ctx.fillRect(x + 2, y - 17, 4, 1.5);
        break;
      }
      case D.EMBERVAULT: {
        ctx.fillStyle = "#393733";
        ctx.beginPath(); ctx.arc(x, y, 14, 0, TAU); ctx.fill();
        ctx.strokeStyle = "#c9a86a"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 14, 0, TAU); ctx.stroke();
        break;
      }
    }
  },

  /* ---------------- characters ---------------- */

  // render-only eased facing: combat reads e.facing, eyes read this.
  // Without it, heads snap with every wander turn / cursor twitch.
  visFacing(e) {
    if (e._fpFace !== undefined) return e._fpFace; // first-person billboard override
    const rdt = G.rdt || 0.016;
    if (e._vf === undefined) e._vf = e.facing;
    e._vf = U.angApproach(e._vf, e.facing, (e === G.player ? 17 : 8) * rdt);
    return e._vf;
  },

  drawEntity(ctx, e, camX, camY) {
    const x = e.x - camX, y = e.y - camY;
    if (x < -80 || x > G.W + 80 || y < -80 || y > G.H + 80) return;

    if (e instanceof Player) { this.drawPlayer(ctx, e, x, y); return; }
    if (e instanceof Ally) {
      const col = e.kind === "lantern" ? "#ffe9a8" : e.kind === "guard" ? "#9ab0d8" : e.kind === "warden_shade" ? "#b9a8ff" : "#ffb060";
      const fl = 0.7 + 0.3 * Math.sin(G.elapsed * 7 + e.orbit);
      ctx.save();
      ctx.shadowColor = col; ctx.shadowBlur = 16;
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.55 + fl * 0.4;
      if (e.kind === "warden_shade" || e.kind === "guard") {
        // a hooded, blade-bearing silhouette
        ctx.beginPath(); ctx.ellipse(x, y - 8, 5, 9, 0, 0, TAU); ctx.fill();
        ctx.fillRect(x + Math.cos(e.facing) * 6 - 1, y - 14, 2, 16);
      } else {
        ctx.beginPath(); ctx.arc(x, y - 10, e.kind === "lantern" ? 6 : 5 + fl * 1.5, 0, TAU); ctx.fill();
      }
      if (e.kind === "sprite") {
        ctx.beginPath();
        ctx.moveTo(x, y - 20 - fl * 3);
        ctx.quadraticCurveTo(x + 4, y - 14, x, y - 9);
        ctx.quadraticCurveTo(x - 4, y - 14, x, y - 20 - fl * 3);
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      return;
    }
    if (e instanceof Hazard) {
      ctx.globalAlpha = 0.3 + 0.1 * Math.sin(G.elapsed * 3);
      ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.ellipse(x, y, e.r, e.r * 0.7, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }

    const look = e.def.look || { shape: "humanoid", body: "#888", trim: "#555", size: 1 };
    const s = (look.size || 1);
    const isNpc = e instanceof NPC;
    const vf = this.visFacing(e);

    // telegraph: flash red during windup
    let tint = null;
    if (e.attackPhase === "wind") tint = "rgba(255,80,40,0.55)";
    if (e.flashT > 0) tint = "rgba(255,255,255,0.8)";
    if (e.staggerT > 0) tint = "rgba(255,220,100,0.4)";

    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.beginPath(); ctx.ellipse(x, y + 7 * s, 11 * s, 4.5 * s, 0, 0, TAU); ctx.fill();

    const bob = Math.sin(e.bobT + G.elapsed * 5) * 1.2;

    // ashen elites smolder
    if (e.elite) {
      const fl = 0.35 + 0.18 * Math.sin(G.elapsed * 5 + e.bobT);
      ctx.save();
      ctx.shadowColor = "#ff5a30"; ctx.shadowBlur = 18;
      ctx.strokeStyle = `rgba(255,90,48,${fl})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, y, 16 * s, 0, TAU); ctx.stroke();
      ctx.restore();
      if (Math.random() < 0.12) FX.sparkle(e.x, e.y - 8, "#ff7a3a");
    }

    ctx.save();
    ctx.translate(x, y + bob * 0.4);

    if (look.shape === "beast") {
      ctx.rotate(vf);
      // little legs paddle while moving
      const stride = (e.state === "chase" || e.state === "flee" || e.state === "patrol")
        ? Math.sin(G.elapsed * 14 + e.bobT) * 4 * s : 0;
      ctx.strokeStyle = look.trim; ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(6 * s + stride, 5 * s); ctx.lineTo(6 * s + stride, 9 * s);
      ctx.moveTo(-6 * s - stride, 5 * s); ctx.lineTo(-6 * s - stride, 9 * s);
      ctx.stroke();
      ctx.fillStyle = look.body;
      ctx.beginPath(); ctx.ellipse(0, 0, 13 * s, 7.5 * s, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = look.trim;
      ctx.beginPath(); ctx.ellipse(9 * s, 0, 6 * s, 4.5 * s, 0, 0, TAU); ctx.fill();
      // ears / antlers
      ctx.fillStyle = look.body;
      ctx.beginPath();
      ctx.moveTo(7 * s, -4 * s); ctx.lineTo(10 * s, -8 * s); ctx.lineTo(11 * s, -4 * s); ctx.fill();
      if (look.antlers) {
        ctx.strokeStyle = "#c8b89a"; ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(11 * s, -3 * s); ctx.lineTo(15 * s, -9 * s); ctx.lineTo(18 * s, -10 * s);
        ctx.moveTo(15 * s, -9 * s); ctx.lineTo(14 * s, -13 * s);
        ctx.moveTo(11 * s, 3 * s); ctx.lineTo(15 * s, 9 * s); ctx.lineTo(18 * s, 10 * s);
        ctx.moveTo(15 * s, 9 * s); ctx.lineTo(14 * s, 13 * s);
        ctx.stroke();
      }
      // tail
      ctx.strokeStyle = look.body; ctx.lineWidth = 2.5 * s;
      ctx.beginPath(); ctx.moveTo(-12 * s, 0); ctx.lineTo(-18 * s, -3 * s); ctx.stroke();
    } else if (look.shape === "crawler") {
      ctx.rotate(vf);
      // eight scuttling legs
      const skit = Math.sin(G.elapsed * 18 + e.bobT);
      ctx.strokeStyle = look.trim; ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let li = 0; li < 4; li++) {
        const lx = (li - 1.5) * 5 * s;
        const bend = (li % 2 === 0 ? skit : -skit) * 3;
        ctx.moveTo(lx, -4 * s); ctx.lineTo(lx - 3 + bend, -11 * s);
        ctx.moveTo(lx, 4 * s); ctx.lineTo(lx - 3 - bend, 11 * s);
      }
      ctx.stroke();
      ctx.fillStyle = look.body;
      ctx.beginPath(); ctx.ellipse(-3 * s, 0, 9 * s, 7 * s, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(7 * s, 0, 5.5 * s, 4.5 * s, 0, 0, TAU); ctx.fill();
      // pale eye cluster
      ctx.fillStyle = look.trim;
      ctx.beginPath();
      ctx.arc(9 * s, -2 * s, 1.5, 0, TAU); ctx.arc(10.5 * s, 0.5 * s, 1.2, 0, TAU); ctx.arc(8 * s, 1.8 * s, 1.2, 0, TAU);
      ctx.fill();
    } else if (look.shape === "blob") {
      const wob = Math.sin(G.elapsed * 4 + e.bobT) * 2 * s;
      ctx.fillStyle = look.body;
      ctx.beginPath(); ctx.ellipse(0, 0, (11 + wob * 0.4) * s, (9 - wob * 0.3) * s, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = look.trim;
      ctx.beginPath(); ctx.ellipse(0, 2 * s, 7 * s, 5 * s, 0, 0, TAU); ctx.fill();
      // eyes
      ctx.fillStyle = "#ffd34a";
      const ex = Math.cos(vf) * 4 * s, ey = Math.sin(vf) * 4 * s;
      ctx.beginPath(); ctx.arc(ex - 2, ey - 2 * s, 1.5, 0, TAU); ctx.arc(ex + 3, ey - 2 * s, 1.5, 0, TAU); ctx.fill();
    } else if (look.shape === "wisp") {
      ctx.save();
      ctx.shadowColor = look.body; ctx.shadowBlur = 16;
      ctx.globalAlpha = 0.75 + 0.2 * Math.sin(G.elapsed * 3 + e.bobT);
      ctx.fillStyle = look.body;
      ctx.beginPath(); ctx.arc(0, -4 * s, 8 * s, 0, TAU); ctx.fill();
      ctx.fillStyle = look.trim;
      ctx.beginPath();
      ctx.moveTo(-7 * s, -2 * s);
      ctx.quadraticCurveTo(0, 12 * s, 7 * s, -2 * s);
      ctx.fill();
      ctx.restore();
      // eyes
      ctx.fillStyle = "#fff";
      const ex = Math.cos(vf) * 3, ey = Math.sin(vf) * 2;
      ctx.fillRect(ex - 3, ey - 6 * s, 2, 3);
      ctx.fillRect(ex + 2, ey - 6 * s, 2, 3);
      // the Echo wears what the kings refused
      if (look.crown) {
        ctx.fillStyle = "#e8cf9a";
        ctx.fillRect(-5 * s, -13 * s, 10 * s, 2.5 * s);
        ctx.fillRect(-4 * s, -16 * s, 2 * s, 3 * s);
        ctx.fillRect(2 * s, -16 * s, 2 * s, 3 * s);
      }
    } else {
      // humanoid
      const fx = Math.cos(vf), fy = Math.sin(vf);
      // shuffling feet while moving
      const eMoving = (e.state === "chase" || e.state === "patrol" || e.state === "flee" || (e instanceof NPC && e.moving));
      if (eMoving) {
        const step = Math.sin(G.elapsed * 11 + e.bobT) * 3.5 * s;
        ctx.fillStyle = "rgba(20,16,12,0.85)";
        ctx.beginPath();
        ctx.ellipse(-3 * s + fx * step, 8 * s + fy * step * 0.4, 2.4 * s, 1.6 * s, 0, 0, TAU);
        ctx.ellipse(3 * s - fx * step, 8 * s - fy * step * 0.4, 2.4 * s, 1.6 * s, 0, 0, TAU);
        ctx.fill();
      }
      // body
      ctx.fillStyle = look.body;
      ctx.beginPath(); ctx.ellipse(0, 0, 8 * s, 9.5 * s, 0, 0, TAU); ctx.fill();
      // trim sash
      ctx.fillStyle = look.trim;
      ctx.fillRect(-7 * s, -2 * s, 14 * s, 4 * s);
      // a coal where the heart should be (ash revenants)
      if (look.ember) {
        const fl = 0.6 + 0.4 * Math.sin(G.elapsed * 6 + e.bobT);
        ctx.save();
        ctx.shadowColor = "#ff7a2a"; ctx.shadowBlur = 9;
        ctx.fillStyle = `rgba(255,130,50,${fl})`;
        ctx.beginPath(); ctx.arc(0, -2 * s, 2.6 * s, 0, TAU); ctx.fill();
        ctx.restore();
      }
      // head
      ctx.fillStyle = isNpc ? "#caa882" : look.body;
      ctx.beginPath(); ctx.arc(fx * 2, fy * 2 - 9 * s, 5.5 * s, 0, TAU); ctx.fill();
      if (isNpc && e.def.look.hair) {
        ctx.fillStyle = e.def.look.hair;
        ctx.beginPath(); ctx.arc(fx * 2, fy * 2 - 10.5 * s, 4.5 * s, Math.PI, 0); ctx.fill();
      }
      if (look.crown) {
        ctx.fillStyle = "#d8d4cc";
        ctx.fillRect(fx * 2 - 5 * s, fy * 2 - 15 * s, 10 * s, 3 * s);
      }
      if (look.hat) {
        // a drowned captain keeps her tricorn
        ctx.fillStyle = "#2c2a26";
        ctx.beginPath();
        ctx.ellipse(fx * 2, fy * 2 - 13 * s, 7 * s, 3 * s, 0, 0, TAU);
        ctx.fill();
        ctx.fillRect(fx * 2 - 3 * s, fy * 2 - 16 * s, 6 * s, 3 * s);
      }
      if (look.kelp) {
        ctx.strokeStyle = "rgba(60,90,70,0.8)"; ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-4 * s, -6 * s); ctx.lineTo(-6 * s, 4 * s + Math.sin(G.elapsed * 2 + e.bobT) * 2);
        ctx.moveTo(3 * s, -8 * s); ctx.lineTo(5 * s, 2 * s);
        ctx.stroke();
      }
      if (look.banner) {
        ctx.strokeStyle = "#6d8290"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-6 * s, 4 * s); ctx.lineTo(-10 * s, -22 * s); ctx.stroke();
        ctx.fillStyle = "rgba(196,210,218,0.85)";
        ctx.beginPath();
        ctx.moveTo(-10 * s, -22 * s);
        ctx.lineTo(-10 * s + 12 + Math.sin(G.elapsed * 2.5) * 2, -19 * s);
        ctx.lineTo(-10 * s, -15 * s);
        ctx.closePath(); ctx.fill();
      }
      // weapon
      if (look.weapon && !isNpc) {
        let swing = 0;
        if (e.attackPhase === "wind") swing = -1.1;
        else if (e.attackPhase === "strike") swing = 0.9;
        ctx.save();
        ctx.rotate(vf + swing);
        ctx.strokeStyle = "#b8b4a8"; ctx.lineWidth = 2.5 * Math.min(s, 1.4);
        const wl = (look.weapon === "sword2h" || look.weapon === "maul" || look.weapon === "axe2h") ? 26 * s : 18 * s;
        ctx.beginPath(); ctx.moveTo(6 * s, 4); ctx.lineTo(6 * s + wl, 4); ctx.stroke();
        if (look.weapon === "maul") { ctx.fillStyle = "#9a96aa"; ctx.fillRect(6 * s + wl - 5, -1, 9, 10); }
        if (look.weapon === "axe2h") { ctx.fillStyle = "#8a8478"; ctx.beginPath(); ctx.moveTo(6 * s + wl, -3); ctx.quadraticCurveTo(6 * s + wl + 8, 4, 6 * s + wl, 11); ctx.fill(); }
        if (look.weapon === "staff") { ctx.fillStyle = e.def.proj ? e.def.proj.color : "#fff"; ctx.beginPath(); ctx.arc(6 * s + wl, 4, 3.5, 0, TAU); ctx.fill(); }
        if (look.weapon === "bow") {
          ctx.strokeStyle = "#8a6a3a"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(10 * s, 4, 9, -1.2, 1.2); ctx.stroke();
        }
        ctx.restore();
      }
      // shield
      if (look.shield) {
        ctx.save();
        ctx.rotate(vf);
        ctx.fillStyle = "#5d5a52";
        ctx.beginPath(); ctx.ellipse(7 * s, -5 * s, 3 * s, 6.5 * s, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }

    if (tint) {
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = tint;
      ctx.fillRect(-22 * s, -34 * s, 44 * s, 60 * s);
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.restore();

    // status pips
    let pipX = x - 8;
    const pip = (col) => { ctx.fillStyle = col; ctx.fillRect(pipX, y - 18 * s - 8, 5, 5); pipX += 7; };
    if (e.status) {
      if (e.status.burn > 0) pip("#ff8c3a");
      if (e.status.poison > 0) pip("#9be09b");
      if (e.status.frost > 0) pip("#bfeaff");
      if (e.status.bleed > 0) pip("#c0392b");
    }

    // health bar for wounded non-boss enemies
    if (e.isEnemy && !e.def.boss && e.hp < e.hpMax) {
      const w = 26 * s;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(x - w / 2, y - 16 * s - 6, w, 3.5);
      ctx.fillStyle = "#a8392f";
      ctx.fillRect(x - w / 2, y - 16 * s - 6, w * U.clamp(e.hp / e.hpMax, 0, 1), 3.5);
    }
    // awareness eye
    if (e.isEnemy && e.aware > 0.05 && e.aware < 1 && (e.state === "idle" || e.state === "patrol")) {
      ctx.fillStyle = `rgba(255,210,80,${0.4 + e.aware * 0.6})`;
      ctx.font = "13px serif";
      ctx.textAlign = "center";
      ctx.fillText("?", x, y - 20 * s);
    }
  },

  drawPlayer(ctx, p, x, y) {
    const bob = p.moving ? Math.sin(p.bobT) * 1.6 : 0;
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.ellipse(x, y + 8, 10, 4.5, 0, 0, TAU); ctx.fill();

    // footwork
    if (p.moving && p.rollT <= 0) {
      const step = Math.sin(p.bobT) * 4;
      ctx.fillStyle = "rgba(20,16,12,0.85)";
      ctx.beginPath();
      ctx.ellipse(x - 3 + Math.cos(p.moveAng) * step, y + 8 + Math.sin(p.moveAng) * step * 0.4, 2.6, 1.7, 0, 0, TAU);
      ctx.ellipse(x + 3 - Math.cos(p.moveAng) * step, y + 8 - Math.sin(p.moveAng) * step * 0.4, 2.6, 1.7, 0, 0, TAU);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(x, y + bob * 0.4);

    // roll: spin & squash
    if (p.rollT > 0) {
      ctx.rotate(p.rollDir);
      ctx.scale(1.15, 0.7);
    }
    if (p.crouched) ctx.scale(1, 0.8);

    const bodyIt = p.equip.body ? ITEMS[p.equip.body] : null;
    const headIt = p.equip.head ? ITEMS[p.equip.head] : null;
    const bodyCol = bodyIt ? (bodyIt.kind === "heavy" ? "#8d8a82" : "#6b5340") : "#7a6a52";
    const trimCol = bodyIt && bodyIt.rarity === "rare" ? "#9ab0d8" : "#c9a86a";

    if (p.flashT > 0) { ctx.globalAlpha = 0.6 + 0.4 * Math.sin(G.elapsed * 60); }
    if (p.iframes > 0) ctx.globalAlpha = 0.55;

    const vf = this.visFacing(p);
    const fx = Math.cos(vf), fy = Math.sin(vf);

    // cloak
    ctx.fillStyle = "#3c2f22";
    ctx.beginPath(); ctx.ellipse(-fx * 3, -fy * 3 + 1, 8.5, 10, 0, 0, TAU); ctx.fill();
    // body
    ctx.fillStyle = bodyCol;
    ctx.beginPath(); ctx.ellipse(0, 0, 7.5, 9, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = trimCol;
    ctx.fillRect(-6, -1.5, 12, 3);
    // head
    ctx.fillStyle = headIt ? (headIt.kind === "heavy" ? "#9a968c" : "#5d4a36") : "#caa882";
    ctx.beginPath(); ctx.arc(fx * 2, fy * 2 - 9, 5.2, 0, TAU); ctx.fill();
    if (!headIt) {
      ctx.fillStyle = "#4a3a2a";
      ctx.beginPath(); ctx.arc(fx * 2, fy * 2 - 10.5, 4.4, Math.PI, 0); ctx.fill();
    }

    // shield
    const sh = p.shield();
    if (sh) {
      ctx.save();
      ctx.rotate(vf + (p.blocking ? 0 : -0.8));
      ctx.fillStyle = "#5d5a52";
      ctx.strokeStyle = trimCol; ctx.lineWidth = 1.4;
      const sx = p.blocking ? 10 : 6;
      ctx.beginPath(); ctx.ellipse(sx, p.blocking ? 0 : -6, 3.4, 7.5, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    // weapon
    const w = p.weapon();
    const bow = p.bow();
    if (p.draw && bow) {
      ctx.save();
      ctx.rotate(vf);
      ctx.strokeStyle = "#8a6a3a"; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(9, 0, 10, -1.25, 1.25); ctx.stroke();
      const pull = U.clamp(p.draw.t / 0.8, 0, 1) * 6;
      ctx.strokeStyle = "#d8d0c0"; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(9 + Math.cos(-1.25) * 10, Math.sin(-1.25) * 10);
      ctx.lineTo(9 - pull, 0);
      ctx.lineTo(9 + Math.cos(1.25) * 10, Math.sin(1.25) * 10);
      ctx.stroke();
      ctx.strokeStyle = "#e8dcb8"; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(9 - pull, 0); ctx.lineTo(19, 0); ctx.stroke();
      ctx.restore();
    } else if (w) {
      let swing = -0.7;
      if (p.atk) {
        if (p.atk.phase === "wind") swing = -1.5;
        else if (p.atk.phase === "strike") swing = 0.95;
        else swing = 0.4;
      }
      ctx.save();
      ctx.rotate(vf + swing);
      const isStaff = w.type === "staff";
      const two = w.twoHanded;
      ctx.strokeStyle = isStaff ? "#6a5236" : "#c8c4b8";
      ctx.lineWidth = two ? 3 : 2.2;
      const wl = two ? 26 : w.wclass === "dagger" ? 12 : 19;
      ctx.beginPath(); ctx.moveTo(5, 3); ctx.lineTo(5 + wl, 3); ctx.stroke();
      if (!isStaff) {
        ctx.strokeStyle = "#8a6a3a"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(8, -1); ctx.lineTo(8, 7); ctx.stroke();
      } else {
        const sp = p.equippedSpell ? SPELLS[p.equippedSpell] : null;
        ctx.fillStyle = sp ? sp.color : "#b9a8ff";
        ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(5 + wl, 3, 3.6, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    }

    // casting glow
    if (p.cast && !p.cast.flask) {
      const sp = SPELLS[p.cast.spell];
      ctx.save();
      ctx.shadowColor = sp.color; ctx.shadowBlur = 14;
      ctx.fillStyle = sp.color;
      ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.arc(fx * 12, fy * 12, 4 + Math.sin(G.elapsed * 16) * 1.5, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // flask drink
    if (p.cast && p.cast.flask) {
      ctx.fillStyle = "#e07b39";
      ctx.shadowColor = "#e07b39"; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(fx * 2, fy * 2 - 14, 3, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  },

  /* ---------------- lighting & weather ---------------- */

  lighting(ctx, map, camX, camY) {
    let dark = map.outdoor ? G.darkness() * 0.72 : 0.62;
    if (map.ambient === "cave") dark = 0.7;
    if (map.ambient === "undermarch") dark = 0.78;
    if (dark <= 0.02) return;

    const lc = this._lightCanvas || (this._lightCanvas = document.createElement("canvas"));
    if (lc.width !== G.W) { lc.width = G.W; lc.height = G.H; }
    const lctx = lc.getContext("2d");
    lctx.globalCompositeOperation = "source-over";
    lctx.clearRect(0, 0, G.W, G.H);
    lctx.fillStyle = map.outdoor
      ? `rgba(8,10,26,${dark})`
      : `rgba(4,4,8,${dark})`;
    lctx.fillRect(0, 0, G.W, G.H);

    lctx.globalCompositeOperation = "destination-out";
    const punch = (x, y, r, str) => {
      if (x < -r || x > G.W + r || y < -r || y > G.H + r) return;
      const g = lctx.createRadialGradient(x, y, r * 0.15, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${str})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      lctx.fillStyle = g;
      lctx.beginPath(); lctx.arc(x, y, r, 0, TAU); lctx.fill();
    };
    for (const l of map.lights) {
      const fl = l.flicker ? 0.85 + 0.15 * Math.sin(G.elapsed * 9 + l.x) : 1;
      punch(l.x - camX, l.y - camY, l.r * fl, 0.95);
    }
    const p = G.player;
    if (p) punch(p.x - camX, p.y - camY, 150, 0.85); // the Emberborn carries a faint glow
    for (const e of G.entities) {
      if (e.lightR && !e.dead) punch(e.x - camX, e.y - camY, e.lightR, 0.9);
    }
    // burning things glow
    for (const e of G.entities) {
      if (e.status && e.status.burn > 0) punch(e.x - camX, e.y - camY, 70, 0.7);
    }
    for (const pr of G.projectiles) {
      if (pr.dtype === "fire" || pr.spell) punch(pr.x - camX, pr.y - camY, 60, 0.8);
    }

    ctx.drawImage(lc, 0, 0);

    // warm tint overlay at dusk
    if (map.outdoor) {
      const h = G.time.hour;
      if (h > 17 && h < 21) {
        ctx.fillStyle = `rgba(255,120,40,${0.12 * (1 - Math.abs(h - 19) / 2)})`;
        ctx.fillRect(0, 0, G.W, G.H);
      }
    }
  },

  weather(ctx, map, camX, camY) {
    if (!map.outdoor) return;
    const wk = G.weather.kind;
    if (wk === "clear") return;
    const inten = G.weather.intensity;
    const tm = G.elapsed;
    ctx.save();
    if (wk === "rain") {
      ctx.strokeStyle = `rgba(170,190,220,${0.25 * inten})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 70 * inten; i++) {
        const s = this.weatherSeeds[i % 90];
        const rx = ((s * 1280 + tm * 520 * (0.7 + s * 0.6)) % (G.W + 60)) - 30;
        const ry = ((s * 977 + tm * 720 * (0.8 + s * 0.4)) % (G.H + 40)) - 20;
        ctx.moveTo(rx, ry); ctx.lineTo(rx - 3, ry + 11);
      }
      ctx.stroke();
    } else if (wk === "snow") {
      ctx.fillStyle = `rgba(235,242,248,${0.5 * inten})`;
      for (let i = 0; i < 60 * inten; i++) {
        const s = this.weatherSeeds[i % 90];
        const rx = ((s * 1280 + Math.sin(tm * (0.5 + s) + i) * 40 + tm * 30) % (G.W + 20)) - 10;
        const ry = ((s * 977 + tm * (40 + s * 50)) % (G.H + 20)) - 10;
        ctx.fillRect(rx, ry, 2.2, 2.2);
      }
    } else if (wk === "fog") {
      const g = ctx.createRadialGradient(G.W / 2, G.H / 2, 140, G.W / 2, G.H / 2, 620);
      g.addColorStop(0, "rgba(180,185,180,0)");
      g.addColorStop(1, `rgba(180,185,180,${0.45 * inten})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, G.W, G.H);
    } else if (wk === "ashfall") {
      ctx.fillStyle = `rgba(120,110,100,${0.5 * inten})`;
      for (let i = 0; i < 40 * inten; i++) {
        const s = this.weatherSeeds[i % 90];
        const rx = ((s * 1280 + Math.sin(tm * 0.4 + i) * 60 + tm * 18) % (G.W + 20)) - 10;
        const ry = ((s * 977 + tm * (22 + s * 26)) % (G.H + 20)) - 10;
        ctx.fillRect(rx, ry, 2.5, 2.5);
      }
    }
    ctx.restore();
  },

  /* ---------------- HUD ---------------- */

  hud(ctx) {
    const p = G.player;
    if (!p) return;

    // wounded vignette: the edges of the world redden as you fail
    const hpFrac = p.hp / p.hpMax;
    if (hpFrac < 0.35) {
      const urgency = 1 - hpFrac / 0.35;
      const pulse = 0.55 + 0.45 * Math.sin(G.elapsed * (3 + urgency * 4));
      const g = ctx.createRadialGradient(G.W / 2, G.H / 2, G.H * 0.32, G.W / 2, G.H / 2, G.H * 0.75);
      g.addColorStop(0, "rgba(120,10,10,0)");
      g.addColorStop(1, `rgba(120,10,10,${0.38 * urgency * pulse})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, G.W, G.H);
    }

    /* vitals */
    const bar = (x, y, w, h, frac, col, bg) => {
      ctx.fillStyle = bg || "rgba(0,0,0,0.66)";
      ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = col;
      ctx.fillRect(x, y, w * U.clamp(frac, 0, 1), h);
      ctx.strokeStyle = "rgba(201,168,106,0.45)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 1.5, y - 1.5, w + 3, h + 3);
    };
    bar(18, 18, Math.min(420, 250 * (p.hpMax / 300)), 12, p.hp / p.hpMax, "#a8392f");
    bar(18, 36, Math.min(380, 230 * (p.stamMax / 250)), 9, p.stam / p.stamMax, "#5d8a42");
    bar(18, 51, Math.min(360, 210 * (p.magMax / 250)), 9, p.mag / p.magMax, "#3a6ea8");

    /* embers + gold */
    ctx.font = '15px "Palatino Linotype", Georgia, serif';
    ctx.textAlign = "left";
    ctx.fillStyle = "#e07b39";
    ctx.fillText("◆ " + U.fmt(p.embers), 18, 80);
    ctx.fillStyle = "#c9a86a";
    ctx.fillText("● " + U.fmt(p.gold), 110, 80);

    /* flask charges */
    for (let i = 0; i < p.flask.max; i++) {
      const fx = 18 + i * 17, fy = 96;
      ctx.fillStyle = i < p.flask.charges ? "#e07b39" : "rgba(60,50,40,0.8)";
      ctx.beginPath();
      ctx.moveTo(fx + 5, fy);
      ctx.lineTo(fx + 9, fy + 7); ctx.lineTo(fx + 7, fy + 13); ctx.lineTo(fx + 3, fy + 13); ctx.lineTo(fx + 1, fy + 7);
      ctx.closePath(); ctx.fill();
    }

    /* status icons */
    let sx = 18, sy = 118;
    const stat = (label, col) => {
      ctx.fillStyle = col; ctx.font = "12px serif";
      ctx.fillText(label, sx, sy); sx += ctx.measureText(label).width + 10;
    };
    if (p.status.poison > 0) stat("POISON", "#9be09b");
    if (p.status.burn > 0) stat("BURNING", "#ff8c3a");
    if (p.status.frost > 0) stat("CHILLED", "#bfeaff");
    if (p.status.bleed > 0) stat("BLEEDING", "#c0392b");
    if (p.loadRatio() > 1) stat("OVERBURDENED", "#d89090");
    for (const b in p.buffs) stat(b.toUpperCase(), "#cfc4a8");

    /* bottom-center: equipment loadout */
    const cy = G.H - 54;
    const slotBox = (x, label, sub, col) => {
      ctx.fillStyle = "rgba(10,9,7,0.78)";
      ctx.fillRect(x, cy, 132, 40);
      ctx.strokeStyle = "rgba(74,64,48,0.9)";
      ctx.strokeRect(x + 0.5, cy + 0.5, 131, 39);
      ctx.fillStyle = "#8a8378"; ctx.font = "10px serif"; ctx.textAlign = "left";
      ctx.fillText(label, x + 7, cy + 13);
      ctx.fillStyle = col || "#d8d0c0"; ctx.font = "13px serif";
      ctx.fillText(sub, x + 7, cy + 29);
    };
    const w = p.weapon();
    slotBox(G.W / 2 - 345, "WEAPON  [LMB/hold]", w ? UI.itemName(w, p) : "Fists");
    slotBox(G.W / 2 - 207, "BOW  [F hold]", p.bow() ? UI.itemName(p.bow(), p) : "—");
    const sp = p.equippedSpell ? SPELLS[p.equippedSpell] : null;
    slotBox(G.W / 2 - 69, "SPELL  [Q]", sp ? sp.name : "—", sp ? "#a8bcd8" : "#555");
    const be = p.beltEntry(p.beltSel);
    let beName = "—", beCol = "#555";
    if (be && be.type === "spell") { const bsp = SPELLS[be.id]; beName = bsp ? bsp.name : "?"; beCol = "#a8bcd8"; }
    else if (be) { const bit = ITEMS[be.id]; beName = bit ? (bit.type === "consumable" ? `${bit.name} ×${p.countItem(be.id)}` : bit.name) : "?"; beCol = "#b9d8a0"; }
    slotBox(G.W / 2 + 69, "BELT  [T] · wheel/[ ]", beName, beCol);
    // edicts with cooldown sweep (up to five words of the Old Tongue)
    let ex = G.W / 2 + 207;
    for (let i = 0; i < 5; i++) {
      const eid = p.edicts[i];
      ctx.fillStyle = "rgba(10,9,7,0.78)";
      ctx.fillRect(ex, cy, 32, 40);
      ctx.strokeStyle = "rgba(140,90,50,0.6)";
      ctx.strokeRect(ex + 0.5, cy + 0.5, 31, 39);
      if (eid) {
        const e = EDICTS[eid];
        const cd = p.edictCds[eid] || 0;
        ctx.fillStyle = cd > 0 ? "#5d574c" : e.color;
        ctx.font = "13px serif"; ctx.textAlign = "center";
        ctx.fillText(e.name.split(" ")[0], ex + 16, cy + 22);
        if (cd > 0) {
          ctx.fillStyle = "rgba(0,0,0,0.55)";
          ctx.fillRect(ex, cy, 32, 40 * (cd / e.cooldown));
        }
        ctx.fillStyle = "#8a8378"; ctx.font = "9px serif";
        ctx.fillText(String(i + 1), ex + 16, cy + 37);
      }
      ex += 36;
    }
    ctx.textAlign = "left";

    /* quick belt strip (auto-fills with consumables; wheel / [ ] cycle, T uses) */
    {
      const bn = p.belt.length, bw = 40, bgap = 4;
      const btot = bn * bw + (bn - 1) * bgap;
      let bx = G.W / 2 - btot / 2;
      const by = G.H - 102;
      ctx.textAlign = "center";
      for (let i = 0; i < bn; i++) {
        const e = p.belt[i], on = i === p.beltSel;
        ctx.fillStyle = "rgba(10,9,7,0.8)";
        ctx.fillRect(bx, by, bw, 38);
        ctx.strokeStyle = on ? "#c9a86a" : "rgba(74,64,48,0.9)";
        ctx.lineWidth = on ? 2 : 1;
        ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, 37);
        ctx.lineWidth = 1;
        if (e) {
          let tag = "?", col = "#d8d0c0", cnt = null;
          if (e.type === "spell") { const s2 = SPELLS[e.id]; tag = s2 ? s2.name : "?"; col = s2 ? s2.color : "#555"; }
          else {
            const i2 = ITEMS[e.id];
            tag = i2 ? i2.name : "?";
            if (i2 && i2.type === "consumable") { cnt = p.countItem(e.id); col = cnt === 0 ? "#5d574c" : "#d8d0c0"; }
            else if (i2 && Object.values(p.equip).includes(e.id)) col = "#b9d8a0";
          }
          const init = (tag.replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).map(wd => wd[0]).join("").slice(0, 3).toUpperCase()) || "?";
          ctx.fillStyle = on ? "#e8cf9a" : col;
          ctx.font = "13px serif";
          ctx.fillText(init, bx + bw / 2, by + (cnt !== null ? 18 : 23));
          if (cnt !== null) { ctx.fillStyle = cnt === 0 ? "#8e2f2f" : "#8a8378"; ctx.font = "10px serif"; ctx.fillText("×" + cnt, bx + bw / 2, by + 31); }
        }
        bx += bw + bgap;
      }
      ctx.fillStyle = "rgba(138,131,120,0.6)"; ctx.font = "9px serif";
      ctx.fillText("wheel or [ ] cycle · T use", G.W / 2, by - 4);
      ctx.textAlign = "left";
    }

    /* random-encounter klaxon — pulses until the alert window lapses */
    if (G.encAlertT > 0) {
      const a = 0.55 + 0.45 * Math.sin(G.elapsed * 9);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = G.encAlertCol || "#d89090";
      ctx.font = "bold 18px serif"; ctx.textAlign = "center";
      ctx.fillText("⚔  ENCOUNTER", G.W / 2, 88);
      ctx.restore();
      ctx.textAlign = "left";
    }

    /* compass strip */
    this.compass(ctx, p);

    /* minimap */
    this.minimap(ctx, p);

    /* frame meter */
    if (G.settings.showFps) {
      const ms = G.frameMsAll || 0;
      ctx.fillStyle = ms > 15 ? "#d89090" : "#8fae8f";
      ctx.font = "12px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${ms.toFixed(1)} ms · ${(1000 / Math.max(0.1, ms)).toFixed(0)} fps · ${G.viewMode === "fp" ? RenderFP.W + "×" + RenderFP.H : "top"}`, G.W - 18, 176);
      ctx.textAlign = "left";
    }

    /* clock */
    const hh = Math.floor(G.time.hour), mm = Math.floor((G.time.hour % 1) * 60);
    ctx.fillStyle = "#8a8378"; ctx.font = "12px serif"; ctx.textAlign = "right";
    ctx.fillText(`Day ${G.time.day} — ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`, G.W - 18, G.H - 14);
    ctx.textAlign = "left";

    /* objective tracker */
    let trackY = 150;
    ctx.font = "12px serif";
    for (const entry of QS.journalEntries()) {
      if (entry.st.done) continue;
      const txt = QS.objectiveText(entry.id);
      if (!txt) continue;
      ctx.fillStyle = entry.q.type === "main" ? "rgba(232,207,154,0.85)" : "rgba(180,200,160,0.7)";
      ctx.fillText("✦ " + txt, 18, trackY);
      trackY += 17;
      if (trackY > 240) break;
    }
  },

  compass(ctx, p) {
    const cw = 360, cx0 = G.W / 2 - cw / 2, cy0 = 12;
    ctx.fillStyle = "rgba(8,7,5,0.6)";
    ctx.fillRect(cx0, cy0, cw, 18);
    ctx.strokeStyle = "rgba(74,64,48,0.8)";
    ctx.strokeRect(cx0 + 0.5, cy0 + 0.5, cw - 1, 17);
    ctx.save();
    ctx.beginPath(); ctx.rect(cx0, cy0, cw, 18); ctx.clip();
    const heading = p.facing;
    ctx.font = "12px serif"; ctx.textAlign = "center";
    const dirs = [[0, "E"], [Math.PI / 2, "S"], [Math.PI, "W"], [-Math.PI / 2, "N"]];
    for (const dd of dirs) {
      let rel = U.angDiff(heading, dd[0]);
      if (Math.abs(rel) < 1.6) {
        ctx.fillStyle = dd[1] === "N" ? "#e8cf9a" : "#8a8378";
        ctx.fillText(dd[1], G.W / 2 + rel * (cw / 3.2), cy0 + 13.5);
      }
    }
    // poi pips on compass
    if (G.map.outdoor) {
      for (const poi of G.map.poiList) {
        if (poi.hidden) continue;
        const ang = U.angTo(p.x, p.y, poi.tx * TILE, poi.ty * TILE);
        let rel = U.angDiff(heading, ang);
        if (Math.abs(rel) < 1.6) {
          ctx.fillStyle = poi.kind === "town" ? "#c9a86a" : poi.kind === "dungeon" ? "#a86a6a" : "#8a8378";
          ctx.fillRect(G.W / 2 + rel * (cw / 3.2) - 1.5, cy0 + 3, 3, 3);
        }
      }
      // shrine pips
      for (const s of G.map.shrines) {
        if (!G.discoveredShrines[s.id]) continue;
        const ang = U.angTo(p.x, p.y, s.x, s.y);
        let rel = U.angDiff(heading, ang);
        if (Math.abs(rel) < 1.6) {
          ctx.fillStyle = "#e07b39";
          ctx.fillRect(G.W / 2 + rel * (cw / 3.2) - 1.5, cy0 + 3, 3, 3);
        }
      }
    }
    // current quest target, when it lives on this map
    if (G.map.outdoor) {
      const tgt = QS.currentTargetPoi();
      if (tgt) {
        const ang = U.angTo(p.x, p.y, tgt.tx * TILE, tgt.ty * TILE);
        const rel = U.angDiff(heading, ang);
        if (Math.abs(rel) < 1.6) {
          ctx.fillStyle = "#ffe9a8";
          ctx.font = "11px serif"; ctx.textAlign = "center";
          ctx.fillText("✦", G.W / 2 + rel * (cw / 3.2), cy0 + 9);
          ctx.textAlign = "left";
        }
      }
    }
    // lost embers beckon from where you fell
    if (G.lostEmbers && G.lostEmbers.mapId === G.map.id) {
      const ang = U.angTo(p.x, p.y, G.lostEmbers.x, G.lostEmbers.y);
      const rel = U.angDiff(heading, ang);
      if (Math.abs(rel) < 1.6) {
        const fl = 0.6 + 0.4 * Math.sin(G.elapsed * 5);
        ctx.fillStyle = `rgba(140,255,160,${fl})`;
        ctx.fillRect(G.W / 2 + rel * (cw / 3.2) - 2, cy0 + 2, 4, 4);
      }
    }
    ctx.restore();
    ctx.textAlign = "left";
  },

  buildMinimap() {
    const map = World.getMap("overworld");
    const c = document.createElement("canvas");
    c.width = map.w; c.height = map.h;
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(map.w, map.h);
    for (let i = 0; i < map.w * map.h; i++) {
      const col = TILE_COLORS[map.tiles[i]] || "#222";
      img.data[i * 4] = parseInt(col.slice(1, 3), 16);
      img.data[i * 4 + 1] = parseInt(col.slice(3, 5), 16);
      img.data[i * 4 + 2] = parseInt(col.slice(5, 7), 16);
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    this.minimapCanvas = c;
  },

  minimap(ctx, p) {
    if (!G.map.outdoor) return;
    if (!this.minimapCanvas) this.buildMinimap();
    const size = 148, mx = G.W - size - 16, my = 14;
    const scale = 0.55; // world tiles per minimap px region
    const view = size / scale;
    const ptx = p.x / TILE, pty = p.y / TILE;
    let sx = U.clamp(ptx - view / 2, 0, WORLD_W - view);
    let sy = U.clamp(pty - view / 2, 0, WORLD_H - view);

    ctx.save();
    ctx.globalAlpha = 0.88;
    ctx.beginPath(); ctx.rect(mx, my, size, size); ctx.clip();
    ctx.drawImage(this.minimapCanvas, sx, sy, view, view, mx, my, size, size);
    // pois
    for (const poi of G.map.poiList) {
      if (poi.hidden) continue;
      const px2 = mx + (poi.tx - sx) * scale, py2 = my + (poi.ty - sy) * scale;
      if (px2 < mx || px2 > mx + size || py2 < my || py2 > my + size) continue;
      ctx.fillStyle = poi.kind === "town" ? "#e8cf9a" : poi.kind === "dungeon" ? "#d88a7a" : "#b0a890";
      ctx.fillRect(px2 - 2, py2 - 2, 4, 4);
    }
    for (const s of G.map.shrines) {
      if (!G.discoveredShrines[s.id]) continue;
      const px2 = mx + (s.x / TILE - sx) * scale, py2 = my + (s.y / TILE - sy) * scale;
      ctx.fillStyle = "#e07b39";
      ctx.fillRect(px2 - 1.5, py2 - 1.5, 3, 3);
    }
    // lost embers
    if (G.lostEmbers && G.lostEmbers.mapId === G.map.id) {
      const fl = 0.5 + 0.5 * Math.sin(G.elapsed * 5);
      ctx.fillStyle = `rgba(140,255,160,${fl})`;
      ctx.beginPath();
      ctx.arc(mx + (G.lostEmbers.x / TILE - sx) * scale, my + (G.lostEmbers.y / TILE - sy) * scale, 2.6, 0, TAU);
      ctx.fill();
    }
    // player, with heading
    const pxm = mx + (ptx - sx) * scale, pym = my + (pty - sy) * scale;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(pxm, pym, 2.4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(pxm, pym);
    ctx.lineTo(pxm + Math.cos(p.facing) * 7, pym + Math.sin(p.facing) * 7);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(74,64,48,0.9)";
    ctx.strokeRect(mx + 0.5, my + 0.5, size - 1, size - 1);
  },
};
