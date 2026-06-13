/* ============================================================
   CLAUDERIM — render_fp.js
   First-person renderer, refined: a software raycaster over
   the same tile world as the top-down view, tuned to feel
   like a classic first-person RPG.

   - 640x360 internal buffer, filtered 2x upscale.
   - Walls stand 1.6 tiles with the eye at 0.62 — doorways
     loom, ramparts tower.
   - Mouse-look with pitch (y-sheared horizon), head-bob,
     crouch & roll camera dips.
   - Sky: time-of-day gradient, travelling sun and moon,
     fBm cloud banks, dusk warmth, night starfield.
   - Distance fog that melts into the sky; light sources
     pool real glow on the ground at night.
   - Opaque billboards (fog TINTS sprites — it never makes
     them transparent) with span-batched depth clipping.
   - A first-person viewmodel: your weapon, shield, bow and
     casting hand, animated through every combat state.
   ============================================================ */
"use strict";

const FP_WALLS = new Set([T.WALL_WOOD, T.WALL_STONE, T.VOID, T.SNOWROCK]);
const FP_MAXDIST = 48;     // tiles
const FP_WALL_H = 1.6;     // wall height in tiles
const FP_EYE = 0.62;       // eye height in tiles

/* billboard heights in tiles, by deco id */
const FP_DECO_H = {
  [D.TREE]: 2.7, [D.PINE]: 3.1, [D.SWAMPTREE]: 2.5, [D.DEADTREE]: 2.3,
  [D.ROCK]: 0.9, [D.BOULDER]: 1.25, [D.BUSH]: 0.55, [D.ANVIL]: 0.85,
  [D.ALCH]: 0.95, [D.WELL]: 0.95, [D.LAMP]: 2.0, [D.CAIRN]: 1.05,
  [D.GRAVE]: 1.05, [D.BARREL]: 0.95, [D.TABLE]: 0.85, [D.EMBERVAULT]: 1.35,
  [D.PILLAR]: 2.2, [D.FROZEN]: 1.5, [D.WRECK]: 1.8, [D.ALTAR]: 1.4, [D.BOARD]: 1.6,
};

/* shared deco painter — sprites carry data (pa = deco id, pb = hash)
   instead of a fresh closure per tree per frame */
function paintDecoSprite(c, sp) {
  c.save(); c.scale(2, 2);
  Render.drawDeco(c, sp.pa, 32, 72, sp.pb);
  c.restore();
}

const RenderFP = {
  W: 640, H: 360,
  fov: 0.767,   // tan(75°/2): horizontal half-plane at the default FOV
  focal: 0,     // pixels per unit tan — one lens for both axes
  swayX: 0, swayY: 0,
  frameMs: 8, frameN: 0,   // rolling cost — drives adaptive resolution
  canvas: null, ctx: null, img: null,
  depth: null, wallTop: null, wallBot: null,
  tmp: null, tmpCtx: null,
  TILE_RGB: null,
  lastHorizon: 180,
  cloudCol: null,
  spriteCache: new Map(),

  init() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.W; this.canvas.height = this.H;
    this.ctx = this.canvas.getContext("2d");
    this.img = this.ctx.createImageData(this.W, this.H);
    this.buf32 = new Uint32Array(this.img.data.buffer);
    this.skyPacked = new Uint32Array(this.H);
    this.depth = new Float32Array(this.W);
    this.wallTop = new Int32Array(this.W);
    this.wallBot = new Int32Array(this.W);
    this.cloudCol = new Float32Array(this.W);
    this.tmp = document.createElement("canvas");
    this.tmp.width = 128; this.tmp.height = 176;
    this.tmpCtx = this.tmp.getContext("2d");
    // hi-res buffer: close/large sprites repaint their vectors at 2x
    this.tmpBig = document.createElement("canvas");
    this.tmpBig.width = 256; this.tmpBig.height = 352;
    this.tmpBigCtx = this.tmpBig.getContext("2d");
    // per-screen-row lookup tables (rebuilt each frame; row-only math)
    this.rowRD = new Float32Array(this.H);     // ground distance per row
    this.rowFog = new Float32Array(this.H);    // fog blend per row
    this.rowB = new Float32Array(this.H);      // brightness per row
    this.ceilRD = new Float32Array(this.H);
    this.ceilFog = new Float32Array(this.H);
    this.ceilB = new Float32Array(this.H);
    this.skyR = new Float32Array(this.H);
    this.skyG = new Float32Array(this.H);
    this.skyB = new Float32Array(this.H);
    this.TILE_RGB = {};
    this.tileR = new Float32Array(32); this.tileG = new Float32Array(32); this.tileB = new Float32Array(32);
    for (const k in TILE_COLORS) {
      const c = TILE_COLORS[k];
      const rgb = [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
      this.TILE_RGB[k] = rgb;
      this.tileR[k] = rgb[0]; this.tileG[k] = rgb[1]; this.tileB[k] = rgb[2];
    }
  },

  // adaptive resolution: ease down on struggling machines, climb back when idle
  setRes(w, h) {
    if (this.W === w && this.H === h) return;
    this.W = w; this.H = h;
    this.canvas = null; // full re-init next frame
    // sprite cache is resolution-independent (128x176 vectors) — keep it
  },
  // the player's word is law; 'auto' lets the frame budget decide
  applySettings() {
    const rs = G.settings.renderScale;
    if (rs === "low") this.setRes(480, 270);
    else if (rs === "med") this.setRes(640, 360);
    else if (rs === "high") this.setRes(854, 480);
    // 'auto' keeps whatever autoRes chose
  },
  get maxDist() {
    const v = G.settings.viewDist;
    return v === "near" ? 36 : v === "vfar" ? 64 : 48;
  },
  autoRes() {
    if (G.settings.renderScale !== "auto") return;
    this.frameN++;
    if (this.frameN < 120) return;
    this.frameN = 0;
    // hysteresis: two consecutive bad/good windows before switching, so a
    // single GC spike or a quiet moment can't ping-pong the resolution
    if (this.frameMs > 15 && this.W > 480) {
      this._resDown = (this._resDown || 0) + 1; this._resUp = 0;
      if (this._resDown >= 2) { this._resDown = 0; this.setRes(480, 270); }
    } else if (this.frameMs < 5.5 && this.W < 640) {
      this._resUp = (this._resUp || 0) + 1; this._resDown = 0;
      if (this._resUp >= 2) { this._resUp = 0; this.setRes(640, 360); }
    } else {
      this._resDown = 0; this._resUp = 0;
    }
  },

  jit(xi, yi) {
    let h = (Math.imul(xi, 73856093) ^ Math.imul(yi, 19349663)) >>> 0;
    return ((h >>> 8) % 1000) / 1000;
  },

  /* world point -> main-canvas projection */
  project(wx, wy) {
    const p = G.player;
    if (!p) return null;
    const dx = (wx - p.x) / TILE, dy = (wy - p.y) / TILE;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const rel = U.angDiff(p.facing, Math.atan2(dy, dx));
    if (Math.abs(rel) > 1.2) return null;
    const perp = dist * Math.cos(rel);
    if (perp < 0.15) return null;
    const scale = G.W / this.W;
    const sx = (0.5 + Math.tan(rel) / (2 * this.fov)) * this.W;
    if (sx < -60 || sx > this.W + 60) return null;
    const unit = (this.lastFocal || this.H) / perp; // pixels per tile at this depth
    return {
      x: sx * scale,
      ground: (this.lastHorizon + (this.lastEye || FP_EYE) * unit) * scale,
      h: unit * scale, perp, col: U.clamp(sx | 0, 0, this.W - 1),
    };
  },

  /* ------------------------------------------------------ */

  draw() {
    if (!this.canvas) this.init();
    const map = G.map, p = G.player;
    if (!map || !p) return;
    const tFrame0 = performance.now();
    const W = this.W, H = this.H;
    const data = this.img.data;
    const px = p.x / TILE, py = p.y / TILE;
    const yaw = p.facing;
    const dirX = Math.cos(yaw), dirY = Math.sin(yaw);
    const plX = -dirY * this.fov, plY = dirX * this.fov;
    const tm = G.elapsed;
    const md = this.maxDist;
    const grain = G.settings.grain;

    /* camera: pitch shears the horizon; head-bob, crouch and roll
       lower the EYE instead — near ground sways, the horizon holds still */
    const pitch = p.fpPitch || 0;
    let eye = FP_EYE;
    if (p.moving && p.rollT <= 0) eye += Math.sin(p.bobT * 0.95) * (p.sprinting ? 0.022 : 0.013);
    if (p.crouched) eye -= 0.17;
    if (p.rollT > 0 && p._rollProf) {
      const ph = 1 - p.rollT / p._rollProf.dur;
      eye -= Math.sin(ph * Math.PI) * 0.3;
    }
    eye = Math.max(0.2, eye);
    this.lastEye = eye;
    const horizon = U.clamp((H * (0.5 - pitch)) | 0, 48, H - 48);
    this.lastHorizon = horizon;
    /* field of view: the player's setting in true horizontal degrees.
       One focal length serves BOTH axes — vertical scale derives from the
       same lens as horizontal, so circles stay circles and the edges of
       the frame stop stretching. Sprint widens the lens a touch. */
    const fovDeg = U.clamp(G.settings.fov || 75, 60, 100);
    const planeTarget = Math.tan(fovDeg * Math.PI / 360) * (p.sprinting ? 1.12 : 1);
    this.fov += (planeTarget - this.fov) * Math.min(1, (G.rdt || 0.016) * 7);
    const focal = (W * 0.5) / this.fov;   // pixels per unit tan
    this.focal = focal;
    this.lastFocal = focal;

    /* look-velocity, smoothed: the viewmodel drags a beat behind the eye */
    {
      const rdt = Math.max(0.004, Math.min(0.05, G.rdt || 0.016));
      const yawV = this._prevYaw === undefined ? 0 : U.angDiff(this._prevYaw, yaw) / rdt;
      const pitV = this._prevPitch === undefined ? 0 : (pitch - this._prevPitch) / rdt;
      this._prevYaw = yaw; this._prevPitch = pitch;
      const k = Math.min(1, rdt * 9);
      this.swayX = (this.swayX || 0) + (U.clamp(-yawV * 7, -16, 16) - (this.swayX || 0)) * k;
      this.swayY = (this.swayY || 0) + (U.clamp(-pitV * 30, -12, 12) - (this.swayY || 0)) * k;
    }

    /* ---- ambient, fog, sky ---- */
    const dark = map.outdoor ? G.darkness() : 1;
    const h24 = G.time.hour;
    let amb, fog, skyTop = null, skyHor = null;
    if (map.outdoor) {
      amb = 1 - dark * 0.62;
      const duskW = (h24 > 16.5 && h24 < 21.5) ? 1 - Math.abs(h24 - 19) / 2.5 : 0;
      skyTop = [
        U.lerp(U.lerp(92, 12, dark), 110, duskW * 0.4),
        U.lerp(U.lerp(138, 14, dark), 64, duskW * 0.5),
        U.lerp(U.lerp(196, 32, dark), 58, duskW * 0.6),
      ];
      skyHor = [
        U.lerp(U.lerp(168, 22, dark), 226, duskW),
        U.lerp(U.lerp(190, 26, dark), 122, duskW),
        U.lerp(U.lerp(214, 44, dark), 62, duskW),
      ];
      const wmute = G.weather.kind === "clear" ? 0 : G.weather.intensity * 0.55;
      for (let i = 0; i < 3; i++) {
        const grey = (skyTop[i] + skyHor[i]) / 2 * 0.72;
        skyTop[i] = U.lerp(skyTop[i], grey, wmute);
        skyHor[i] = U.lerp(skyHor[i], grey, wmute);
      }
      fog = [skyHor[0] * 0.92 | 0, skyHor[1] * 0.92 | 0, skyHor[2] * 0.92 | 0];

      // where the sun stands, for wall faces (moon takes the watch at night)
      {
        const sunT = (h24 - 6) / 12;
        const az = (sunT > 0 && sunT < 1)
          ? U.lerp(-Math.PI, 0, sunT) - Math.PI / 2
          : U.lerp(-Math.PI, 0, ((h24 + 12) % 24 - 6) / 12) - Math.PI / 2;
        this._sunX = Math.cos(az); this._sunY = Math.sin(az);
      }

      // cloud banks: one fBm sample per column, brightening a sky band
      const cloudAmt = G.weather.kind === "clear" ? 0.45 : 0.85;
      for (let col = 0; col < W; col++) {
        const camXr = 2 * col / W - 1;
        const az = yaw + Math.atan(camXr * this.fov);
        this.cloudCol[col] = Math.max(0, U.fbm(az * 1.7 + tm * 0.013, 7.3, 4321, 3) - 0.46) * 3 * cloudAmt;
      }
    } else if (map.ambient === "undermarch") {
      amb = 0.5; fog = [7, 8, 14];
      this._sunX = 0.4; this._sunY = -0.7;
    } else {
      amb = 0.62; fog = [10, 9, 8];
      this._sunX = 0.4; this._sunY = -0.7;
    }

    const unitFor = perp => focal / perp;

    /* ---- per-row tables: distance, fog and brightness are
       functions of the screen row alone — compute them once ---- */
    const glowK = 0.55 * (1 - amb);
    for (let y = horizon + 1; y < H; y++) {
      const rd = (eye * focal) / (y - horizon);
      this.rowRD[y] = rd;
      if (rd > md) { this.rowFog[y] = 1; this.rowB[y] = 0; continue; }
      const f = Math.min(1, rd / md);
      this.rowFog[y] = Math.min(1, f * f * Math.sqrt(f) * 1.02); // ~pow 2.5: clear mid-range, late fade
      this.rowB[y] = amb / (1 + rd * 0.05) + Math.max(0, 1 - rd / 5) * glowK;
    }
    const ceilH = FP_WALL_H - eye;
    if (!map.outdoor) {
      for (let y = 0; y < horizon; y++) {
        const rd = (ceilH * focal) / Math.max(1, horizon - y);
        this.ceilRD[y] = rd;
        if (rd > md) { this.ceilFog[y] = 1; this.ceilB[y] = 0; continue; }
        const f = Math.min(1, rd / md);
        this.ceilFog[y] = Math.min(1, f * f * Math.sqrt(f) * 1.02);
        this.ceilB[y] = amb * 0.5 / (1 + rd * 0.08) + Math.max(0, 1 - rd / 5) * 0.4 * (1 - amb);
      }
    } else {
      for (let y = 0; y < horizon; y++) {
        const t = Math.min(1, y / Math.max(1, horizon));
        const r = U.lerp(skyTop[0], skyHor[0], t) | 0;
        const g = U.lerp(skyTop[1], skyHor[1], t) | 0;
        const b = U.lerp(skyTop[2], skyHor[2], t) | 0;
        this.skyR[y] = r; this.skyG[y] = g; this.skyB[y] = b;
        this.skyPacked[y] = 0xff000000 | (b << 16) | (g << 8) | r;
      }
    }
    const tiles = map.tiles, mw = map.w, mh = map.h;
    const fog0 = fog[0], fog1 = fog[1], fog2 = fog[2];
    const tileR = this.tileR, tileG = this.tileG, tileB = this.tileB;
    const rowRD = this.rowRD, rowFog = this.rowFog, rowB = this.rowB;
    const ceilRD = this.ceilRD, ceilFog = this.ceilFog, ceilB = this.ceilB;
    const skyRa = this.skyR, skyGa = this.skyG, skyBa = this.skyB;
    const depthA = this.depth, wallTopA = this.wallTop, wallBotA = this.wallBot;
    const cloudA = this.cloudCol;
    const buf32 = this.buf32, skyPk = this.skyPacked;
    const fogPk = 0xff000000 | (fog2 << 16) | (fog1 << 8) | fog0;
    // local integer hash (no method-call overhead per pixel)
    const jitL = (xi, yi) => (((Math.imul(xi, 73856093) ^ Math.imul(yi, 19349663)) >>> 8) % 1000) / 1000;

    /* ---- raycast ---- */
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
      const maxSteps = md * 2.4 + 24;
      while (steps++ < maxSteps) {
        if (sideX < sideY) { sideX += dDx; mapX += stepX; side = 0; }
        else { sideY += dDy; mapY += stepY; side = 1; }
        tile = World.tileAt(map, mapX, mapY);
        if (FP_WALLS.has(tile)) { hit = 1; break; }
        if ((side === 0 ? sideX - dDx : sideY - dDy) > md) break;
      }

      let perp = md, top = horizon, bot = horizon;
      if (hit) {
        perp = Math.max(0.06, side === 0 ? sideX - dDx : sideY - dDy);
        const unit = unitFor(perp);
        const topF = horizon - (FP_WALL_H - eye) * unit;
        const botF = horizon + eye * unit;
        top = Math.max(0, topF | 0);
        bot = Math.min(H - 1, botF | 0);

        const rgb = this.TILE_RGB[tile] || [60, 60, 60];
        const wallX = side === 0 ? py + perp * rdy : px + perp * rdx;
        const u = wallX - (wallX | 0);
        const cellJ = this.jit(mapX, mapY);
        // faces lit by where the sun actually stands
        let faceLight;
        if (side === 0) faceLight = 0.78 + 0.22 * Math.max(0, -stepX * this._sunX);
        else faceLight = 0.74 + 0.26 * Math.max(0, -stepY * this._sunY);
        let br = amb * faceLight / (1 + perp * 0.05);
        br += Math.max(0, 1 - perp / 5) * 0.5 * (1 - amb);
        const ff = Math.min(1, perp / md);
        const fogT = Math.min(1, ff * ff * Math.sqrt(ff) * 1.02);

        const vStep = FP_WALL_H / (botF - topF);
        let v = (top - topF) * vStep;
        const wood = tile === T.WALL_WOOD;
        const wr = rgb[0], wg = rgb[1], wb = rgb[2];
        let wi = top * W + col;
        for (let y = top; y <= bot; y++, v += vStep, wi += W) {
          let tex = 1 + (cellJ - 0.5) * 0.14;
          if (grain) tex += ((((Math.imul((u * 24) | 0, 73856093) ^ Math.imul((v * 24) | 0, 19349663)) >>> 8) % 1000) / 1000 - 0.5) * 0.1;
          if (wood) {
            const plank = u * 4;
            if (plank - (plank | 0) < 0.07) tex *= 0.7;
            const gr = v * 9;
            if (gr - (gr | 0) < 0.12) tex *= 0.92;
          } else {
            const course = v * 2.4;
            if (course - (course | 0) < 0.055) tex *= 0.7;
            const brick = u * 2 + ((course | 0) % 2) * 0.5;
            if (brick - (brick | 0) < 0.045) tex *= 0.76;
          }
          if (tile === T.SNOWROCK && v < 0.3) tex *= 1.45;
          tex *= 0.86 + 0.2 * (1 - v / FP_WALL_H);
          const b = br * tex;
          let r = wr * b; r = r + (fog0 - r) * fogT; if (r > 255) r = 255;
          let g = wg * b; g = g + (fog1 - g) * fogT; if (g > 255) g = 255;
          let bb = wb * b; bb = bb + (fog2 - bb) * fogT; if (bb > 255) bb = 255;
          buf32[wi] = 0xff000000 | (bb << 16) | (g << 8) | r;
        }
      }
      depthA[col] = perp;
      wallTopA[col] = hit ? top : horizon;
      wallBotA[col] = hit ? bot : horizon;

      /* sky / interior ceiling — row tables carry the heavy math */
      const skyEnd = hit ? top : horizon;
      if (map.outdoor) {
        const cloud = cloudA[col];
        const lum = 0.95 - 0.4 * dark;
        const invHor = 1 / Math.max(1, horizon);
        let wi = col;
        if (cloud > 0.01) {
          for (let y = 0; y < skyEnd; y++, wi += W) {
            const band = 1 - Math.abs(y * invHor - 0.62) / 0.34;
            if (band <= 0) { buf32[wi] = skyPk[y]; continue; }
            const cl = Math.min(1, cloud * band);
            const r = (skyRa[y] + (235 * lum - skyRa[y]) * cl) | 0;
            const g = (skyGa[y] + (238 * lum - skyGa[y]) * cl) | 0;
            const b = (skyBa[y] + (242 * lum - skyBa[y]) * cl) | 0;
            buf32[wi] = 0xff000000 | (b << 16) | (g << 8) | r;
          }
        } else {
          for (let y = 0; y < skyEnd; y++, wi += W) buf32[wi] = skyPk[y];
        }
      } else {
        let wi = col;
        for (let y = 0; y < skyEnd; y++, wi += W) {
          const fogT = ceilFog[y];
          if (fogT >= 1) { buf32[wi] = fogPk; continue; }
          const rd = ceilRD[y];
          const fx2 = px + rdx * rd, fy2 = py + rdy * rd;
          const j = jitL((fx2 * 2) | 0, (fy2 * 2) | 0);
          const b = ceilB[y];
          const base = (34 + j * 14) * b;
          const r = (base + (fog0 - base) * fogT) | 0;
          const g = (base * 0.97 + (fog1 - base * 0.97) * fogT) | 0;
          const bb = (base + 4 * b + (fog2 - base - 4 * b) * fogT) | 0;
          buf32[wi] = 0xff000000 | (bb << 16) | (g << 8) | r;
        }
      }

      /* floor */
      const floorStart = hit ? bot + 1 : horizon + 1;
      // walls seat into the ground: short occlusion ramp at their base
      const aoRows = hit ? Math.min(14, Math.max(2, (focal / perp * 0.22) | 0)) : 0;
      let wif = floorStart * W + col;
      for (let y = floorStart; y < H; y++, wif += W) {
        const fogT = rowFog[y];
        if (fogT >= 1) { buf32[wif] = fogPk; continue; }
        const rd = rowRD[y];
        const fx2 = px + rdx * rd, fy2 = py + rdy * rd;
        const txi = fx2 | 0, tyi = fy2 | 0;
        const t2 = (fx2 < 0 || fy2 < 0 || txi >= mw || tyi >= mh) ? 18 : tiles[tyi * mw + txi];
        let r, g, bch;
        if (t2 === 1 || t2 === 0) { // WATER / DEEPWATER: the sky lies on the surface
          const sh = Math.sin(tm * 1.8 + fx2 * 2.2 + fy2 * 3.1) * 11;
          r = tileR[t2] * 0.6 + fog0 * 0.42 + sh;
          g = tileG[t2] * 0.6 + fog1 * 0.42 + sh;
          bch = tileB[t2] * 0.6 + fog2 * 0.42 + sh + 6;
        } else if (t2 === 17) {     // LAVA
          const pulse = 0.6 + 0.4 * Math.sin(tm * 2.5 + fx2 + fy2);
          r = 200 * pulse + 60; g = 80 * pulse + 30; bch = 25;
        } else {
          r = tileR[t2]; g = tileG[t2]; bch = tileB[t2];
        }
        let b = rowB[y];
        if (grain) b *= 1 + (jitL((fx2 * 3) | 0, (fy2 * 3) | 0) - 0.5) * 0.18;
        if (aoRows && y - bot <= aoRows) b *= 0.62 + 0.38 * ((y - bot) / aoRows);
        r *= b; g *= b; bch *= b;
        r = r + (fog0 - r) * fogT; if (r > 255) r = 255;
        g = g + (fog1 - g) * fogT; if (g > 255) g = 255;
        bch = bch + (fog2 - bch) * fogT; if (bch > 255) bch = 255;
        buf32[wif] = 0xff000000 | (bch << 16) | (g << 8) | r;
      }
    }

    this.ctx.putImageData(this.img, 0, 0);

    /* ---- celestial bodies ---- */
    if (map.outdoor) this.drawCelestials(horizon, yaw, dark, h24);

    /* ---- starfield ---- */
    if (map.outdoor && dark > 0.45) {
      for (let i = 0; i < 130; i++) {
        const az = U.hash2(i, 3, 77) * TAU * 2;
        const rel = U.angDiff(yaw, az);
        if (Math.abs(rel) > 0.85) continue;
        const sx = (0.5 + Math.tan(rel) / (2 * this.fov)) * W;
        const sy = U.hash2(i, 9, 41) * horizon * 0.85;
        if (this.wallTop[U.clamp(sx | 0, 0, W - 1)] < sy) continue;
        const tw = 0.5 + 0.5 * Math.sin(tm * (1 + U.hash2(i, 5, 13) * 2) + i);
        this.ctx.fillStyle = `rgba(222,230,255,${(dark - 0.45) * 1.5 * (0.25 + 0.6 * tw)})`;
        this.ctx.fillRect(sx | 0, sy | 0, 1.5, 1.5);
      }
    }

    /* ---- ground glow from light sources ---- */
    this.drawLightPools(map, p, horizon, dark);

    /* ---- billboards ---- */
    this.drawBillboards(map, p, yaw, tm, horizon);

    /* ---- birds in the high air ---- */
    if (map.outdoor && G.birds && G.birds.length) {
      const ctx2 = this.ctx;
      for (const b of G.birds) {
        for (let i = 0; i < b.n; i++) {
          const wx = b.x + i * 16, wy2 = b.y + i * 5;
          const prl = this.projectLocal(wx, wy2, p, horizon);
          if (!prl) continue;
          const alt = (b.alt + Math.cos(b.phase * 0.7 + i * 1.3) * 0.2) * prl.unit;
          const by2 = prl.ground - alt;
          if (by2 < -10 || by2 > H + 10) continue;
          const sz = U.clamp(prl.unit * 0.07, 1.2, 7);
          const flap = Math.sin(b.phase + i * 0.8) * sz * 0.8;
          ctx2.strokeStyle = "rgba(30,28,24,0.75)";
          ctx2.lineWidth = Math.max(1, sz * 0.3);
          ctx2.beginPath();
          ctx2.moveTo(prl.x - sz, by2 - flap);
          ctx2.lineTo(prl.x, by2 + sz * 0.3);
          ctx2.lineTo(prl.x + sz, by2 - flap);
          ctx2.stroke();
        }
      }
    }

    /* ---- the bobber on the water ---- */
    if (G.fishing) {
      const f = G.fishing;
      const prl = this.projectLocal(f.x, f.y, p, horizon);
      if (prl && this.depth[prl.col] + 0.1 >= prl.perp) {
        const bob = (f.state === "bite" ? 0.09 : Math.sin(tm * 2.2) * 0.03) * prl.unit;
        const sz = U.clamp(prl.unit * 0.06, 2, 9);
        this.ctx.fillStyle = "#c44";
        this.ctx.beginPath(); this.ctx.arc(prl.x, prl.ground + bob, sz, 0, TAU); this.ctx.fill();
        this.ctx.fillStyle = "#eee";
        this.ctx.beginPath(); this.ctx.arc(prl.x, prl.ground + bob - sz * 0.7, sz * 0.65, 0, TAU); this.ctx.fill();
      }
    }

    /* ---- upscale (filtered — soft, not chunky) ---- */
    G.ctx.imageSmoothingEnabled = true;
    G.ctx.drawImage(this.canvas, 0, 0, W, H, 0, 0, G.W, G.H);
    G.ctx.imageSmoothingEnabled = false;

    /* ---- projected particles & floats ---- */
    this.drawProjected();

    /* ---- viewmodel: your hands in the world ---- */
    if (G.state === "play" || G.state === "dialogue") this.drawViewmodel(p, tm);

    /* ---- damage flash ---- */
    if (p.flashT > 0) {
      const a = p.flashT / 0.15;
      const g = G.ctx.createRadialGradient(G.W / 2, G.H / 2, G.H * 0.3, G.W / 2, G.H / 2, G.H * 0.72);
      g.addColorStop(0, "rgba(160,20,20,0)");
      g.addColorStop(1, `rgba(160,20,20,${0.45 * a})`);
      G.ctx.fillStyle = g;
      G.ctx.fillRect(0, 0, G.W, G.H);
    }

    /* ---- shared screen-space layers ---- */
    Render.weather(G.ctx, map, 0, 0);
    if (G.lightning > 0) {
      G.ctx.fillStyle = `rgba(235,240,255,${Math.min(0.85, G.lightning * 5)})`;
      G.ctx.fillRect(0, 0, G.W, G.H);
    }
    if (!G.photoHide && (G.state === "play" || G.state === "dialogue")) {
      Render.hud(G.ctx);
      const cx = G.W / 2, cy = G.H / 2;
      G.ctx.strokeStyle = "rgba(232,207,154,0.75)";
      G.ctx.lineWidth = 1.5;
      G.ctx.beginPath();
      G.ctx.arc(cx, cy, 3.2, 0, TAU);
      G.ctx.stroke();
      G.ctx.fillStyle = "rgba(232,207,154,0.9)";
      G.ctx.fillRect(cx - 0.7, cy - 0.7, 1.4, 1.4);
    }

    this.frameMs = this.frameMs * 0.94 + (performance.now() - tFrame0) * 0.06;
    this.autoRes();
  },

  /* sun by day, moon by night, riding east to west */
  drawCelestials(horizon, yaw, dark, h24) {
    const W = this.W;
    const body = (az, elev, radius, color, glow) => {
      if (elev <= 0.02) return;
      const rel = U.angDiff(yaw, az);
      if (Math.abs(rel) > 0.95) return;
      const sx = (0.5 + Math.tan(rel) / (2 * this.fov)) * W;
      const sy = horizon - elev * horizon * 1.05;
      if (sy < -30 || sx < -30 || sx > W + 30) return;
      // hidden behind a wall?
      const colI = U.clamp(sx | 0, 0, W - 1);
      if (this.wallTop[colI] < sy) return;
      const ctx = this.ctx;
      ctx.save();
      const grad = ctx.createRadialGradient(sx, sy, radius * 0.3, sx, sy, radius * 3.2);
      grad.addColorStop(0, glow);
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(sx - radius * 3.2, sy - radius * 3.2, radius * 6.4, radius * 6.4);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(sx, sy, radius, 0, TAU); ctx.fill();
      ctx.restore();
    };
    // sun: east at 06, overhead at noon, west at 18
    const sunT = (h24 - 6) / 12;
    if (sunT > 0 && sunT < 1) {
      const az = U.lerp(-Math.PI, 0, sunT) + Math.PI / 2; // east(-PI/2 world) … west
      body(az - Math.PI, Math.sin(sunT * Math.PI), 11, "rgba(255,236,190,0.95)", "rgba(255,210,130,0.5)");
    }
    // moon: opposite schedule
    const moonT = ((h24 + 12) % 24 - 6) / 12;
    if (moonT > 0 && moonT < 1 && dark > 0.2) {
      const az = U.lerp(-Math.PI, 0, moonT) + Math.PI / 2;
      body(az - Math.PI, Math.sin(moonT * Math.PI), 8, "rgba(214,222,238,0.9)", "rgba(180,195,230,0.3)");
    }
  },

  /* torches, shrines and lamps pool warm light on the ground */
  drawLightPools(map, p, horizon, dark) {
    const strength = U.lerp(0.1, 0.55, map.outdoor ? dark : 0.85);
    if (strength < 0.12) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const carried = [];
    for (const e of G.entities) {
      if (e.lightR && !e.dead) carried.push({ x: e.x, y: e.y, r: e.lightR, color: e.lightColor || "255,200,120", flicker: true });
    }
    for (const l of map.lights.concat(carried)) {
      if (U.dist(p.x, p.y, l.x, l.y) > this.maxDist * TILE * 0.8) continue;
      const pr = this.projectLocal(l.x, l.y, p, horizon);
      if (!pr || this.depth[pr.col] + 0.4 < pr.perp) continue;
      const rad = Math.min(Math.max(8, (l.r / TILE) * pr.unit * 0.85), this.H * 0.45);
      const fl = l.flicker ? 0.82 + 0.18 * Math.sin(G.elapsed * 9 + l.x) : 1;
      const a = Math.min(0.5, strength * fl / (1 + pr.perp * 0.12));
      const g = ctx.createRadialGradient(pr.x, pr.ground, rad * 0.1, pr.x, pr.ground, rad);
      g.addColorStop(0, `rgba(${l.color},${(a * 0.5).toFixed(3)})`);
      g.addColorStop(1, `rgba(${l.color},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(pr.x, pr.ground, rad, rad * 0.42, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  },

  // like project() but in internal-resolution coords
  projectLocal(wx, wy, p, horizon) {
    const dx = (wx - p.x) / TILE, dy = (wy - p.y) / TILE;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const rel = U.angDiff(p.facing, Math.atan2(dy, dx));
    if (Math.abs(rel) > 1.1) return null;
    const perp = dist * Math.cos(rel);
    if (perp < 0.2) return null;
    const sx = (0.5 + Math.tan(rel) / (2 * this.fov)) * this.W;
    if (sx < -80 || sx > this.W + 80) return null;
    const unit = (this.focal || (this.W * 0.5) / this.fov) / perp;
    return { x: sx, ground: horizon + (this.lastEye || FP_EYE) * unit, unit, perp, col: U.clamp(sx | 0, 0, this.W - 1) };
  },

  /* ------------------------------------------------------ */

  gatherSprites(map, p, tm) {
    const list = [];
    const addIf = (wx, wy, hTiles, anchorFrac, paint, wFactor, yLift, key, pa, pb) => {
      const dist = U.dist(p.x, p.y, wx, wy) / TILE;
      if (dist > this.maxDist) return;
      const rel = U.angDiff(p.facing, U.angTo(p.x, p.y, wx, wy));
      if (Math.abs(rel) > 1.05) return;
      const perp = dist * Math.cos(rel);
      if (perp < 0.22) return;
      list.push({ rel, perp, hTiles, anchorFrac, paint, wFactor: wFactor || 1, yLift: yLift || 0, key: key || null, pa, pb });
    };

    for (const e of G.entities) {
      if (e.dead || e === p) continue;
      if (e instanceof Ally) {
        addIf(e.x, e.y, 0.45, 0.5, (c) => {
          const col = e.kind === "lantern" ? "#ffe9a8" : "#ffb060";
          const fl = 0.7 + 0.3 * Math.sin(tm * 7 + e.orbit);
          c.save();
          c.shadowColor = col; c.shadowBlur = 30;
          c.fillStyle = col;
          c.globalAlpha = 0.6 + fl * 0.4;
          c.beginPath(); c.arc(64, 88, e.kind === "lantern" ? 13 : 10 + fl * 4, 0, TAU); c.fill();
          c.restore();
          c.globalAlpha = 1;
        }, 1, 0.85);
        continue;
      }
      if (e instanceof Hazard) {
        addIf(e.x, e.y, 0.36, 0.62, (c) => {
          c.globalAlpha = 0.45 + 0.12 * Math.sin(tm * 3);
          c.fillStyle = e.color;
          c.beginPath(); c.ellipse(64, 112, 60, 24, 0, 0, TAU); c.fill();
          c.globalAlpha = 1;
        }, 2.6);
        continue;
      }
      const look = (e.def && e.def.look) || {};
      const size = look.size || 1;
      const shapeH = { beast: 0.8, crawler: 0.7, blob: 0.85, wisp: 1.25 }[look.shape] || 1.45;
      addIf(e.x, e.y, U.clamp(shapeH * size, 0.45, 4.2), 0.77, (c) => {
        e._fpFace = Math.PI / 2 + U.angDiff(p.facing, e.facing) * 0.5;
        c.save(); c.scale(2, 2);
        Render.drawEntity(c, e, e.x - 32, e.y - 60);
        c.restore();
        delete e._fpFace;
      });
    }

    for (const cp of G.corpsePile) {
      addIf(cp.x, cp.y, 0.4, 0.7, (c) => {
        c.globalAlpha = Math.max(0, 0.7 - cp.t * 0.07);
        c.fillStyle = cp.look.body;
        c.beginPath(); c.ellipse(64, 120, 32 * (cp.look.size || 1), 12 * (cp.look.size || 1), 0, 0, TAU); c.fill();
        c.globalAlpha = 1;
      }, 1.6);
    }

    const tx0 = Math.max(0, ((p.x / TILE) | 0) - (this.maxDist * 0.7 | 0)), tx1 = Math.min(map.w - 1, ((p.x / TILE) | 0) + (this.maxDist * 0.7 | 0));
    const ty0 = Math.max(0, ((p.y / TILE) | 0) - (this.maxDist * 0.7 | 0)), ty1 = Math.min(map.h - 1, ((p.y / TILE) | 0) + (this.maxDist * 0.7 | 0));
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const d = map.deco[ty * map.w + tx];
        if (!d) continue;
        const hT = FP_DECO_H[d] || 1;
        const hash = U.hash2(tx, ty, 31);
        const key = d === D.LAMP ? null : "d:" + d + ":" + ((hash * 4) | 0);
        // paint:null routes to the shared deco painter — no closure churn
        addIf(tx * TILE + 16, ty * TILE + 16, hT, 0.86, null, 1, 0, key, d, hash);
      }
    }

    for (const ch of map.chests) {
      const open = G.openedChests[ch.id];
      addIf(ch.x, ch.y, 0.55, 0.8, (c) => {
        c.fillStyle = open ? "#4a3826" : "#6e5230";
        c.fillRect(28, 104, 72, 48);
        c.fillStyle = open ? "#2c2014" : "#8a6a3a";
        c.fillRect(28, 92, 72, 18);
        c.strokeStyle = "rgba(0,0,0,0.4)"; c.lineWidth = 2;
        c.strokeRect(28, 92, 72, 60);
        c.fillStyle = ch.tier === "chest_rare" ? "#c89ad8" : ch.tier === "chest_fine" ? "#9ab0d8" : "#c9a86a";
        c.fillRect(58, 108, 12, 18);
      }, 1, 0, "ch:" + ch.tier + (open ? "o" : "c"));
    }

    for (const s of map.shrines) {
      addIf(s.x, s.y, 1.7, 0.88, (c) => {
        c.fillStyle = "#55524c"; c.fillRect(48, 72, 32, 80);
        c.fillStyle = "#6e6a62"; c.fillRect(36, 60, 56, 18);
        c.fillStyle = "rgba(0,0,0,0.25)"; c.fillRect(48, 72, 8, 80);
        const fl = 0.7 + 0.3 * Math.sin(tm * 6 + s.x);
        c.save();
        c.shadowColor = "#ff8c3a"; c.shadowBlur = 28;
        c.fillStyle = `rgba(255,${120 + fl * 80 | 0},40,0.95)`;
        c.beginPath();
        c.moveTo(64, 12 - fl * 9);
        c.quadraticCurveTo(82, 40, 64, 60);
        c.quadraticCurveTo(46, 40, 64, 12 - fl * 9);
        c.fill();
        c.restore();
      });
    }

    for (const pt of map.portals) {
      addIf(pt.x, pt.y, 1.9, 0.9, (c) => {
        c.save();
        c.shadowColor = "#101018"; c.shadowBlur = 24;
        c.fillStyle = pt.exit ? "rgba(220,200,160,0.4)" : "rgba(4,4,9,0.95)";
        c.beginPath(); c.ellipse(64, 92, 34, 68, 0, 0, TAU); c.fill();
        c.restore();
        if (pt.lockedBy && !G.flags["unlocked_" + pt.id]) {
          c.fillStyle = "#c9a86a";
          c.fillRect(56, 84, 16, 22);
          c.beginPath(); c.arc(64, 82, 10, Math.PI, 0); c.strokeStyle = "#c9a86a"; c.lineWidth = 4.5; c.stroke();
        }
      }, 1, 0, "pt:" + (pt.exit ? "x" : "i") + (pt.lockedBy && !G.flags["unlocked_" + pt.id] ? "L" : "u"));
    }

    for (const pk of map.pickups) {
      if (pk.taken) continue;
      addIf(pk.x, pk.y, 0.5, 0.84, (c) => {
        if (pk.vein) {
          c.fillStyle = "#7a7670";
          c.beginPath(); c.ellipse(64, 128, 26, 18, 0, 0, TAU); c.fill();
          c.fillStyle = "#c9a86a";
          c.fillRect(54, 120, 8, 8); c.fillRect(68, 128, 7, 7);
        } else {
          const col = pk.item === "glowcap" ? "#9ad6ff" : pk.item === "emberbloom" ? "#ff8c3a"
            : pk.item === "frostmoss" ? "#bfeaff" : pk.item === "ghost_fern" ? "#cfe6da" : "#7da45a";
          c.strokeStyle = "#3a5a2a"; c.lineWidth = 4.5;
          c.beginPath(); c.moveTo(64, 140); c.lineTo(64, 112); c.stroke();
          if (pk.item === "glowcap") { c.shadowColor = col; c.shadowBlur = 16; }
          c.fillStyle = col;
          c.beginPath(); c.arc(64, 106, 12, 0, TAU); c.fill();
          c.shadowBlur = 0;
        }
      }, 1, 0, "pk:" + (pk.vein ? "vein" : pk.item));
    }

    for (const st of map.stations) {
      if (st.kind === "campfire") {
        addIf(st.x, st.y, 0.9, 0.86, (c) => {
          c.strokeStyle = "#4a3826"; c.lineWidth = 10;
          c.beginPath();
          c.moveTo(36, 144); c.lineTo(92, 124); c.moveTo(36, 124); c.lineTo(92, 144);
          c.stroke();
          const fl = 0.7 + 0.3 * Math.sin(tm * 8 + st.x);
          c.save();
          c.shadowColor = "#ff8c3a"; c.shadowBlur = 26;
          c.fillStyle = `rgba(255,${130 + fl * 70 | 0},45,0.92)`;
          c.beginPath();
          c.moveTo(64, 64 - fl * 14);
          c.quadraticCurveTo(82, 100, 64, 124);
          c.quadraticCurveTo(46, 100, 64, 64 - fl * 14);
          c.fill();
          c.restore();
        });
      } else if (st.kind === "waylamp") {
        addIf(st.x, st.y, 1.9, 0.9, (c) => {
          const lit = G.flags[st.flag];
          c.fillStyle = "#3c3a36";
          c.fillRect(56, 48, 16, 104);
          c.fillRect(40, 28, 48, 26);
          if (lit) {
            c.save();
            c.shadowColor = "#ffc060"; c.shadowBlur = 30;
            c.fillStyle = `rgba(255,205,120,${0.75 + 0.25 * Math.sin(tm * 7 + st.x)})`;
            c.fillRect(48, 32, 32, 18);
            c.restore();
          } else {
            c.fillStyle = "#15151a"; c.fillRect(48, 32, 32, 18);
          }
        });
      } else if (st.kind === "vault") {
        addIf(st.x, st.y, 1.3, 0.85, (c) => {
          const fl = 0.5 + 0.5 * Math.sin(tm * 2);
          c.fillStyle = "#393733";
          c.beginPath(); c.arc(64, 104, 40, 0, TAU); c.fill();
          c.strokeStyle = "#c9a86a"; c.lineWidth = 6;
          c.beginPath(); c.arc(64, 104, 40, 0, TAU); c.stroke();
          c.save();
          c.shadowColor = "#ffd9a0"; c.shadowBlur = 40 + fl * 24;
          c.fillStyle = `rgba(255,210,140,${0.7 + fl * 0.3})`;
          c.beginPath(); c.arc(64, 88, 16 + fl * 6, 0, TAU); c.fill();
          c.restore();
        });
      }
    }

    if (G.lostEmbers && G.lostEmbers.mapId === map.id) {
      const le = G.lostEmbers;
      addIf(le.x, le.y, 0.6, 0.8, (c) => {
        const fl = 0.6 + 0.4 * Math.sin(tm * 5);
        c.save();
        c.shadowColor = "#7ce08a"; c.shadowBlur = 34;
        c.fillStyle = `rgba(140,255,160,${0.5 + fl * 0.5})`;
        c.beginPath(); c.arc(64, 104, 18 + fl * 8, 0, TAU); c.fill();
        c.restore();
      });
    }

    for (const pr of G.projectiles) {
      addIf(pr.x, pr.y, 0.32, 0.5, (c) => {
        c.save();
        c.shadowColor = pr.color; c.shadowBlur = 22;
        c.fillStyle = pr.color;
        if (pr.spell || pr.from === "enemy") {
          c.beginPath(); c.arc(64, 88, 14, 0, TAU); c.fill();
        } else {
          c.translate(64, 88);
          c.rotate(0.2);
          c.fillRect(-26, -4, 52, 8);
        }
        c.restore();
      }, 1, 0.55);
    }

    return list;
  },

  drawBillboards(map, p, yaw, tm, horizon) {
    const W = this.W, H = this.H;
    const focal = this.focal || (W * 0.5) / this.fov;
    let sprites = this.gatherSprites(map, p, tm);
    sprites.sort((a, b) => b.perp - a.perp);
    if (sprites.length > 260) sprites = sprites.slice(-260);
    this._fogStrFrame = this._fogStr; // computed once, reused per sprite
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = true;

    for (const sp of sprites) {
      const unit = focal / sp.perp;
      const groundY = horizon + (this.lastEye || FP_EYE) * unit - sp.yLift * unit;
      let sH = sp.hTiles * unit * (176 / 128);
      if (sH < 3) continue;
      // point-blank: bound the silhouette so it towers instead of smearing
      sH = Math.min(sH, H * 2.1);
      const sW = sH * (128 / 176) * sp.wFactor;
      const sx = (0.5 + Math.tan(sp.rel) / (2 * this.fov)) * W;
      const x0 = Math.max(0, Math.floor(sx - sW / 2));
      const x1 = Math.min(W - 1, Math.ceil(sx + sW / 2));
      if (x1 <= x0) continue;
      const yTop = groundY - sH * sp.anchorFrac;

      // close/large sprites repaint at 2x vector scale for crispness
      const useBig = sH > 290;
      const ffs0 = Math.min(1, sp.perp / this.maxDist);
      const fogT0 = Math.min(1, ffs0 * ffs0 * Math.sqrt(ffs0) * 1.02);

      let tcv;
      if (sp.key && !useBig) {
        // statics cache PER FOG BUCKET: a distant tree is one blit, not a pipeline
        const bucket = Math.round(fogT0 * 9);
        const fullKey = bucket ? sp.key + "|" + bucket + "|" + this._fogStrFrame : sp.key;
        tcv = this.spriteCache.get(fullKey);
        if (!tcv) {
          tcv = document.createElement("canvas");
          tcv.width = 128; tcv.height = 176;
          const cctx = tcv.getContext("2d");
          if (sp.paint) sp.paint(cctx); else paintDecoSprite(cctx, sp);
          if (bucket) {
            cctx.save();
            cctx.globalCompositeOperation = "source-atop";
            cctx.globalAlpha = (bucket / 9) * 0.92;
            cctx.fillStyle = "rgb(" + this._fogStrFrame + ")";
            cctx.fillRect(0, 0, 128, 176);
            cctx.restore();
          }
          if (this.spriteCache.size > 420) {
            // shed the oldest third — never the whole cache (a full clear
            // means a hundred repaints next frame: a visible hitch)
            let shed = 140;
            for (const k of this.spriteCache.keys()) {
              this.spriteCache.delete(k);
              if (--shed <= 0) break;
            }
          }
          this.spriteCache.set(fullKey, tcv);
        }
      } else {
        // dynamics (and the very close) paint fresh
        tcv = useBig ? this.tmpBig : this.tmp;
        const tctx = useBig ? this.tmpBigCtx : this.tmpCtx;
        tctx.clearRect(0, 0, tcv.width, tcv.height);
        if (useBig) {
          tctx.save(); tctx.scale(2, 2);
          if (sp.paint) sp.paint(tctx); else paintDecoSprite(tctx, sp);
          tctx.restore();
        } else {
          if (sp.paint) sp.paint(tctx); else paintDecoSprite(tctx, sp);
        }
        // fog TINTS the sprite (it stays opaque — no ghost trees)
        if (fogT0 > 0.03) {
          tctx.save();
          tctx.globalCompositeOperation = "source-atop";
          tctx.globalAlpha = fogT0 * 0.92;
          tctx.fillStyle = "rgb(" + this._fogStrFrame + ")";
          tctx.fillRect(0, 0, tcv.width, tcv.height);
          tctx.restore();
        }
      }

      // span-batch: contiguous visible column runs become single draws
      const tw = tcv.width, th = tcv.height;
      let runStart = -1;
      const flush = (endX) => {
        if (runStart < 0) return;
        const u0 = (runStart - (sx - sW / 2)) / sW;
        const u1 = (endX - (sx - sW / 2)) / sW;
        const srcX = U.clamp(u0 * tw, 0, tw - 1);
        const srcW = Math.max(0.5, U.clamp(u1 * tw, 0, tw) - srcX);
        ctx.drawImage(tcv, srcX, 0, srcW, th, runStart, yTop, endX - runStart, sH);
        runStart = -1;
      };
      for (let x = x0; x <= x1; x++) {
        const vis = this.depth[x] + 0.08 >= sp.perp;
        if (vis && runStart < 0) runStart = x;
        else if (!vis && runStart >= 0) flush(x);
      }
      flush(x1 + 1);
    }
  },

  drawProjected() {
    const ctx = G.ctx;
    for (const pt of G.particles) {
      if (pt.slash || pt.ring) continue;
      const pr = this.project(pt.x, pt.y);
      if (!pr || this.depth[pr.col] + 0.1 < pr.perp) continue;
      const a = Math.max(0, 1 - pt.t / pt.life);
      ctx.globalAlpha = a * Math.max(0.15, 1 - pr.perp / this.maxDist);
      ctx.fillStyle = pt.color;
      const sz = U.clamp(pt.size * pr.h / 130, 1.5, 10);
      if (pt.glow) { ctx.shadowColor = pt.color; ctx.shadowBlur = 7; }
      ctx.fillRect(pr.x - sz / 2, pr.ground - pr.h * 0.45 - sz / 2, sz, sz);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

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

  get _fogStr() {
    const map = G.map;
    if (map && map.outdoor) {
      const dark = G.darkness();
      // quantize to steps of 16 — cache keys hold steady through dawn and
      // dusk instead of invalidating every sprite each frame
      const q = v => Math.min(255, Math.round(v / 16) * 16);
      return `${q(U.lerp(168, 22, dark) * 0.92)},${q(U.lerp(190, 26, dark) * 0.92)},${q(U.lerp(214, 44, dark) * 0.92)}`;
    }
    return map && map.ambient === "undermarch" ? "7,8,14" : "10,9,8";
  },

  /* ====================================================
     VIEWMODEL — the hands that hold the March together
     ==================================================== */

  drawViewmodel(p, tm) {
    const ctx = G.ctx;
    if (p.dead) return;
    const bobX = p.moving && p.rollT <= 0 ? Math.sin(p.bobT * 0.95) * 9 : Math.sin(tm * 1.3) * 2.5;
    const bobYv = p.moving && p.rollT <= 0 ? Math.abs(Math.cos(p.bobT * 0.95)) * 8 : Math.sin(tm * 1.7) * 3;
    if (p.rollT > 0) return; // hands tuck during the roll

    ctx.save();
    ctx.translate(bobX + (this.swayX || 0), bobYv + (this.swayY || 0) + (p.crouched ? 26 : 0));

    const w = p.weapon();

    /* bow takes both hands */
    if (p.draw && p.bow()) {
      const pull = U.clamp(p.draw.t / 0.8, 0, 1);
      const cx = G.W / 2 + 30, cy = G.H / 2 + 150 - pull * 26;
      ctx.strokeStyle = "#6e5436"; ctx.lineWidth = 13;
      ctx.beginPath(); ctx.arc(cx, cy, 200, -1.05, 1.05); ctx.stroke();
      ctx.strokeStyle = "#5a442c"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(cx, cy, 200, -1.05, 1.05); ctx.stroke();
      // string
      const ax = cx + Math.cos(-1.05) * 200, ay = cy + Math.sin(-1.05) * 200;
      const bx2 = cx + Math.cos(1.05) * 200, by2 = cy + Math.sin(1.05) * 200;
      const nockX = cx - 16 - pull * 70, nockY = cy;
      ctx.strokeStyle = "rgba(225,215,190,0.9)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(nockX, nockY); ctx.lineTo(bx2, by2); ctx.stroke();
      // arrow
      ctx.strokeStyle = "#c8b890"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(nockX, nockY); ctx.lineTo(cx + 215, cy); ctx.stroke();
      ctx.fillStyle = "#d8d4c8";
      ctx.beginPath(); ctx.moveTo(cx + 232, cy); ctx.lineTo(cx + 210, cy - 8); ctx.lineTo(cx + 210, cy + 8); ctx.fill();
      // drawing hand
      this.hand(ctx, nockX - 8, nockY + 4, 1.1);
      ctx.restore();
      return;
    }

    /* shield (left side) */
    const sh = p.shield();
    if (sh) {
      const raise = p.blocking ? 1 : 0;
      const sx = U.lerp(150, G.W / 2 - 120, raise);
      const sy = U.lerp(G.H - 110, G.H / 2 + 60, raise);
      const sscale = U.lerp(1, 1.55, raise);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(sscale, sscale);
      ctx.rotate(U.lerp(-0.25, -0.05, raise));
      ctx.fillStyle = "#4e4a42";
      ctx.beginPath(); ctx.ellipse(0, 0, 95, 120, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "#5d5a52";
      ctx.beginPath(); ctx.ellipse(0, 0, 80, 104, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = "#8a7350"; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.ellipse(0, 0, 80, 104, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = "#8a7350";
      ctx.beginPath(); ctx.arc(0, 0, 17, 0, TAU); ctx.fill();
      ctx.restore();
    }

    /* spell-casting hand (left when no shield raise) */
    if (p.cast && !p.cast.flask) {
      const sp = SPELLS[p.cast.spell];
      const chT = 1 - p.cast.t / sp.cast;
      const hx = G.W / 2 - 190, hy = G.H - 130 - chT * 36;
      this.hand(ctx, hx, hy, 1.5);
      ctx.save();
      ctx.shadowColor = sp.color; ctx.shadowBlur = 26 + chT * 22;
      ctx.fillStyle = sp.color;
      ctx.globalAlpha = 0.55 + chT * 0.4;
      ctx.beginPath(); ctx.arc(hx, hy - 42, 16 + chT * 13 + Math.sin(tm * 18) * 2.5, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    } else if (p.cast && p.cast.flask) {
      // drinking: the flask tips up
      const chT = 1 - p.cast.t / 0.55;
      ctx.save();
      ctx.translate(G.W / 2 + 70, G.H - 110 - chT * 95);
      ctx.rotate(-chT * 1.1);
      ctx.fillStyle = "#3a2c20";
      ctx.beginPath();
      ctx.moveTo(-20, 40); ctx.lineTo(-26, -8); ctx.lineTo(-10, -26); ctx.lineTo(10, -26); ctx.lineTo(26, -8); ctx.lineTo(20, 40);
      ctx.closePath(); ctx.fill();
      ctx.save();
      ctx.shadowColor = "#e07b39"; ctx.shadowBlur = 18;
      ctx.fillStyle = "rgba(224,123,57,0.85)";
      ctx.fillRect(-16, 2, 32, 32);
      ctx.restore();
      ctx.fillStyle = "#2a2018";
      ctx.fillRect(-8, -38, 16, 14);
      ctx.restore();
      ctx.restore();
      return;
    }

    /* main-hand weapon (right side) */
    const atk = p.atk;
    let prog = 0, phase = "idle";
    if (atk) {
      phase = atk.phase;
      const tot = phase === "wind" ? atk.windT : phase === "strike" ? atk.strikeT : atk.recT;
      prog = 1 - atk.t / Math.max(0.001, tot);
    }
    // pose: idle low-right; windup pulls up-right; strike sweeps across; recover returns
    let wx2 = G.W - 320, wy2 = G.H + 30, rot = -0.95;
    if (phase === "wind") {
      wx2 += prog * 130; wy2 -= prog * 60; rot = U.lerp(-0.95, -1.7, prog);
    } else if (phase === "strike") {
      wx2 = U.lerp(G.W - 190, G.W / 2 - 330, prog);
      wy2 = U.lerp(G.H - 40, G.H - 120, Math.sin(prog * Math.PI));
      rot = U.lerp(-1.7, 0.75, prog);
    } else if (phase === "rec") {
      wx2 = U.lerp(G.W / 2 - 330, G.W - 320, prog);
      wy2 = U.lerp(G.H - 120, G.H + 30, prog);
      rot = U.lerp(0.75, -0.95, prog);
    }

    // a crescent of motion follows the strike
    if (phase === "strike" && w && w.type !== "staff") {
      ctx.save();
      ctx.globalAlpha = 0.28 * Math.sin(prog * Math.PI);
      ctx.strokeStyle = "#e8e0c8";
      ctx.lineWidth = 26;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(G.W / 2, G.H + 140, 400, -2.2 + prog * 1.4, -1.5 + prog * 1.4);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(wx2, wy2);
    ctx.rotate(rot);
    if (!w) {
      this.hand(ctx, 0, -40, 1.7); // bare knuckles
    } else if (w.type === "staff") {
      ctx.fillStyle = "#5a442c";
      ctx.fillRect(-13, -420, 26, 460);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(-13, -420, 9, 460);
      const spc = p.equippedSpell ? SPELLS[p.equippedSpell].color : "#b9a8ff";
      ctx.save();
      ctx.shadowColor = spc; ctx.shadowBlur = 24;
      ctx.fillStyle = spc;
      ctx.beginPath(); ctx.arc(0, -432, 22 + Math.sin(tm * 4) * 3, 0, TAU); ctx.fill();
      ctx.restore();
    } else {
      const two = w.twoHanded;
      const isAxe = w.wclass && w.wclass.includes("axe") || /axe|maul/i.test(w.name);
      const isMace = /mace|morningstar|maul/i.test(w.name);
      const len = w.wclass === "dagger" ? 200 : two ? 430 : 320;
      // grip
      ctx.fillStyle = "#3a2c20";
      ctx.fillRect(-11, -88, 22, 110);
      // crossguard
      ctx.fillStyle = "#8a7350";
      ctx.fillRect(-42, -100, 84, 16);
      if (isMace) {
        ctx.fillStyle = "#76726a";
        ctx.fillRect(-9, -len, 18, len - 96);
        ctx.beginPath(); ctx.arc(0, -len, 42, 0, TAU); ctx.fill();
        ctx.fillStyle = "#8d8a82";
        for (let a = 0; a < 8; a++) {
          const ang = a * TAU / 8;
          ctx.fillRect(Math.cos(ang) * 46 - 5, -len + Math.sin(ang) * 46 - 5, 10, 10);
        }
      } else if (isAxe) {
        ctx.fillStyle = "#6e5436";
        ctx.fillRect(-9, -len, 18, len - 96);
        ctx.fillStyle = "#9a968c";
        ctx.beginPath();
        ctx.moveTo(6, -len + 24);
        ctx.quadraticCurveTo(96, -len + 30, 76, -len + 116);
        ctx.lineTo(6, -len + 88);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.14)";
        ctx.beginPath();
        ctx.moveTo(6, -len + 24); ctx.quadraticCurveTo(96, -len + 30, 76, -len + 116);
        ctx.lineTo(62, -len + 102); ctx.quadraticCurveTo(76, -len + 44, 6, -len + 32);
        ctx.closePath(); ctx.fill();
      } else {
        // blade with fuller and rim light
        ctx.fillStyle = "#b9b4a8";
        ctx.beginPath();
        ctx.moveTo(-16, -100); ctx.lineTo(-9, -len); ctx.lineTo(0, -len - 34); ctx.lineTo(9, -len); ctx.lineTo(16, -100);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.22)";
        ctx.beginPath();
        ctx.moveTo(2, -100); ctx.lineTo(7, -len); ctx.lineTo(14, -100);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.fillRect(-3, -len + 24, 6, len - 130);
        // honed edges gleam
        if ((p.honing[w.id] || 0) > 0) {
          ctx.save();
          ctx.shadowColor = "#ffe9a8"; ctx.shadowBlur = 9;
          ctx.strokeStyle = `rgba(255,233,168,${0.25 + p.honing[w.id] * 0.15})`;
          ctx.lineWidth = 2.4;
          ctx.beginPath(); ctx.moveTo(-14, -104); ctx.lineTo(-8, -len + 6); ctx.stroke();
          ctx.restore();
        }
        // workings and innate tempers both light the steel
        const allEdmg = Object.assign({}, w.edmg);
        let hasLeech = !!w.leech;
        for (const eid of p.itemEnchants(w.id)) {
          const en = ENCHANTS[eid];
          if (!en) continue;
          if (en.edmg) for (const t2 in en.edmg) allEdmg[t2] = (allEdmg[t2] || 0) + en.edmg[t2];
          if (en.leech) hasLeech = true;
        }
        if (Object.keys(allEdmg).length || hasLeech) {
          const ecol = allEdmg.fire ? "rgba(255,120,40,0.30)" : allEdmg.frost ? "rgba(150,210,255,0.30)"
            : allEdmg.shock ? "rgba(200,220,255,0.30)" : allEdmg.poison ? "rgba(140,220,140,0.30)"
            : hasLeech ? "rgba(140,255,160,0.25)" : null;
          if (ecol) {
            ctx.save();
            ctx.shadowColor = ecol; ctx.shadowBlur = 22;
            ctx.fillStyle = ecol;
            ctx.beginPath();
            ctx.moveTo(-12, -104); ctx.lineTo(0, -len - 30); ctx.lineTo(12, -104);
            ctx.closePath(); ctx.fill();
            ctx.restore();
          }
        }
      }
      this.hand(ctx, 0, -34, 1.7);
    }
    ctx.restore();
    ctx.restore();
  },

  hand(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = "#b08a64";
    ctx.beginPath(); ctx.ellipse(0, 0, 24, 30, 0.2, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath(); ctx.ellipse(-7, 5, 12, 18, 0.2, 0, TAU); ctx.fill();
    // sleeve
    ctx.fillStyle = "#3c2f22";
    ctx.beginPath(); ctx.ellipse(4, 34, 30, 24, 0, 0, TAU); ctx.fill();
    ctx.restore();
  },
};
