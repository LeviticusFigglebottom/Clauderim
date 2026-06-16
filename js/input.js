/* ============================================================
   CLAUDERIM — input.js
   Keyboard + mouse. Action mapping, edge detection (pressed),
   and world-space cursor.
   ============================================================ */
"use strict";

const BINDS = {
  up: ["KeyW", "ArrowUp"],
  down: ["KeyS", "ArrowDown"],
  left: ["KeyA"],
  right: ["KeyD"],
  turnL: ["ArrowLeft"],   // first-person: turn (mouse-look does this too)
  turnR: ["ArrowRight"],
  toggleview: ["KeyV"],
  sprint: ["ShiftLeft", "ShiftRight"],
  roll: ["Space"],
  interact: ["KeyE"],
  flask: ["KeyR"],
  quickuse: ["KeyT"],
  beltprev: ["BracketLeft"],     // cycle quick-belt left  (mouse wheel too)
  beltnext: ["BracketRight"],    // cycle quick-belt right
  favorites: ["KeyZ"],           // Skyrim-style quick-select overlay
  dismisstip: ["KeyH"],          // acknowledge/close a tutorial hint
  photo: ["KeyP"],
  crouch: ["ControlLeft", "ControlRight", "KeyX"],
  cast: ["KeyQ"],
  aim: ["KeyF"],                  // hold to draw equipped bow
  edict1: ["Digit1"], edict2: ["Digit2"], edict3: ["Digit3"], edict4: ["Digit4"], edict5: ["Digit5"],
  menu: ["Tab", "KeyI"],
  map: ["KeyM"],
  journal: ["KeyJ"],
  character: ["KeyC"],
  pause: ["Escape"],
};

// pristine defaults, so rebinds can be reset and saved binds layered over them
const DEFAULT_BINDS = {};
for (const k in BINDS) DEFAULT_BINDS[k] = BINDS[k].slice();

const Input = {
  keys: {},          // code -> bool
  pressedSet: {},    // code -> bool (cleared each frame)
  mouse: { x: 640, y: 360, down: false, rdown: false, pressed: false, rpressed: false },
  wheel: 0,          // accumulated scroll this frame (sign), cleared in endFrame
  captureRebind: null, // action id being rebound, or null
  onRebindDone: null,  // callback after a capture resolves

  init(canvas) {
    this.applyBinds();
    window.addEventListener("keydown", e => {
      // intercept while rebinding a control (Escape cancels)
      if (this.captureRebind) {
        e.preventDefault();
        if (e.code !== "Escape") this.assignBind(this.captureRebind, e.code);
        const cb = this.onRebindDone; this.captureRebind = null; this.onRebindDone = null;
        if (cb) cb();
        return;
      }
      if (e.repeat) { if (e.code === "Tab") e.preventDefault(); return; }
      this.keys[e.code] = true;
      this.pressedSet[e.code] = true;
      if (["Space", "Tab", "ControlLeft"].includes(e.code)) e.preventDefault();
      audioInit();
    });
    window.addEventListener("keyup", e => { this.keys[e.code] = false; });
    window.addEventListener("blur", () => {
      this.keys = {}; this.mouse.down = false; this.mouse.rdown = false;
      // pause the world when focus leaves, so you don't die to a tab-switch
      if (G.settings.pauseOnBlur && typeof UI !== "undefined" && G.state === "play") UI.openMenu("system");
    });

    canvas.addEventListener("mousemove", e => {
      // pointer-locked first person: relative mouse turns the head
      if (typeof document !== "undefined" && document.pointerLockElement === canvas) {
        if (G.player && G.viewMode === "fp" && G.state === "play") {
          this.applyLook(e.movementX || 0, e.movementY || 0);
        }
        return;
      }
      const r = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) * (G.W / r.width);
      this.mouse.y = (e.clientY - r.top) * (G.H / r.height);
    });
    canvas.addEventListener("mousedown", e => {
      audioInit();
      // first click in first-person captures the mouse
      if (G.viewMode === "fp" && G.state === "play" &&
          canvas.requestPointerLock && document.pointerLockElement !== canvas) {
        try { canvas.requestPointerLock(); } catch (err) { /* unsupported */ }
      }
      if (e.button === 0) { this.mouse.down = true; this.mouse.pressed = true; }
      if (e.button === 2) { this.mouse.rdown = true; this.mouse.rpressed = true; }
    });
    window.addEventListener("mouseup", e => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.rdown = false;
    });
    canvas.addEventListener("contextmenu", e => e.preventDefault());
    canvas.addEventListener("wheel", e => {
      if (G.state === "play") { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }
    }, { passive: false });
  },

  // mouse-look math, factored for sanity: mouse up looks UP
  applyLook(dx, dy) {
    const sens = G.settings.sens || 1;
    const inv = G.settings.invertY ? -1 : 1;
    G.player.facing += dx * 0.0028 * sens;
    // pitch > 0 tilts the view DOWN (horizon rises); mouse-down (dy>0) should look down
    G.player.fpPitch = U.clamp((G.player.fpPitch || 0) + dy * 0.0017 * sens * inv, -0.3, 0.3);
  },

  act(name) {
    const codes = BINDS[name];
    if (!codes) return false;
    for (const c of codes) if (this.keys[c]) return true;
    return false;
  },

  pressed(name) {
    const codes = BINDS[name];
    if (!codes) return false;
    for (const c of codes) if (this.pressedSet[c]) return true;
    return false;
  },

  // one-frame edge for a raw key code (for context menus that bypass BINDS)
  pressedRaw(code) { return !!this.pressedSet[code]; },

  /* ---- rebinding ---- */
  // layer any saved overrides over the pristine defaults
  applyBinds() {
    for (const k in DEFAULT_BINDS) BINDS[k] = DEFAULT_BINDS[k].slice();
    const saved = (G.settings && G.settings.binds) || {};
    for (const k in saved) if (DEFAULT_BINDS[k] && saved[k] && saved[k].length) BINDS[k] = saved[k].slice();
  },
  assignBind(action, code) {
    if (!DEFAULT_BINDS[action]) return;
    BINDS[action] = [code];
    G.settings.binds = G.settings.binds || {};
    G.settings.binds[action] = [code];
    G.saveSettings();
  },
  resetBinds() {
    for (const k in DEFAULT_BINDS) BINDS[k] = DEFAULT_BINDS[k].slice();
    if (G.settings) G.settings.binds = {};
    if (G.saveSettings) G.saveSettings();
  },

  // world-space aim point: cursor in top-down, dead ahead in first person
  worldX() {
    if (G.viewMode === "fp" && G.player) return G.player.x + Math.cos(G.player.facing) * 220;
    return this.mouse.x + G.camera.x;
  },
  worldY() {
    if (G.viewMode === "fp" && G.player) return G.player.y + Math.sin(G.player.facing) * 220;
    return this.mouse.y + G.camera.y;
  },

  endFrame() {
    this.pressedSet = {};
    this.mouse.pressed = false;
    this.mouse.rpressed = false;
    this.wheel = 0;
  },
};
