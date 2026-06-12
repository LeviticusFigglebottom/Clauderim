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
  crouch: ["ControlLeft", "ControlRight", "KeyX"],
  cast: ["KeyQ"],
  aim: ["KeyF"],                  // hold to draw equipped bow
  edict1: ["Digit1"], edict2: ["Digit2"], edict3: ["Digit3"], edict4: ["Digit4"],
  menu: ["Tab", "KeyI"],
  map: ["KeyM"],
  journal: ["KeyJ"],
  character: ["KeyC"],
  pause: ["Escape"],
};

const Input = {
  keys: {},          // code -> bool
  pressedSet: {},    // code -> bool (cleared each frame)
  mouse: { x: 640, y: 360, down: false, rdown: false, pressed: false, rpressed: false },

  init(canvas) {
    window.addEventListener("keydown", e => {
      if (e.repeat) { if (e.code === "Tab") e.preventDefault(); return; }
      this.keys[e.code] = true;
      this.pressedSet[e.code] = true;
      if (["Space", "Tab", "ControlLeft"].includes(e.code)) e.preventDefault();
      audioInit();
    });
    window.addEventListener("keyup", e => { this.keys[e.code] = false; });
    window.addEventListener("blur", () => { this.keys = {}; this.mouse.down = false; this.mouse.rdown = false; });

    canvas.addEventListener("mousemove", e => {
      // pointer-locked first person: relative mouse turns the head
      if (typeof document !== "undefined" && document.pointerLockElement === canvas) {
        if (G.player && G.viewMode === "fp" && G.state === "play") {
          G.player.facing += (e.movementX || 0) * 0.0028;
          G.player.fpPitch = U.clamp((G.player.fpPitch || 0) - (e.movementY || 0) * 0.0017, -0.3, 0.3);
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
  },
};
