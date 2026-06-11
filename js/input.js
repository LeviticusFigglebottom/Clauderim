/* ============================================================
   CLAUDERIM — input.js
   Keyboard + mouse. Action mapping, edge detection (pressed),
   and world-space cursor.
   ============================================================ */
"use strict";

const BINDS = {
  up: ["KeyW", "ArrowUp"],
  down: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
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
      const r = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) * (G.W / r.width);
      this.mouse.y = (e.clientY - r.top) * (G.H / r.height);
    });
    canvas.addEventListener("mousedown", e => {
      audioInit();
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

  worldX() { return this.mouse.x + G.camera.x; },
  worldY() { return this.mouse.y + G.camera.y; },

  endFrame() {
    this.pressedSet = {};
    this.mouse.pressed = false;
    this.mouse.rpressed = false;
  },
};
