/* ============================================================
   POCKET FRONTIER — audio.js
   Procedural chiptune with WebAudio: tiny SFX for every beat of
   battle, and a light looping arpeggio per scene. Everything is
   guarded so a missing AudioContext (or a headless run) is a
   silent no-op, never a crash.
   ============================================================ */
"use strict";

const Sound = {
  ctx: null, master: null, on: true,
  _loop: null, _cur: null,

  unlock() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.ctx = null; }
  },

  _note(freq, t0, dur, type, gain, dst) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || "square"; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dst || this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  },
  _noise(t0, dur, gain, filterFreq) {
    if (!this.ctx) return;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = filterFreq || 1800;
    const g = this.ctx.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0);
  },

  sfx(name) {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime;
    try {
      switch (name) {
        case "select": this._note(660, t, 0.08, "square", 0.18); break;
        case "deny": this._note(180, t, 0.14, "square", 0.2); break;
        case "hit": this._noise(t, 0.12, 0.25, 1200); this._note(160, t, 0.1, "square", 0.12); break;
        case "faint": this._note(440, t, 0.5, "sawtooth", 0.2); this._note(220, t + 0.05, 0.6, "sawtooth", 0.18); break;
        case "level": case "shine": [523, 659, 784, 1047].forEach((f, i) => this._note(f, t + i * 0.08, 0.2, "square", 0.16)); break;
        case "exp": this._note(880, t, 0.3, "sine", 0.08); break;
        case "heal": [523, 659, 784].forEach((f, i) => this._note(f, t + i * 0.1, 0.25, "sine", 0.14)); break;
        case "throw": this._noise(t, 0.15, 0.2, 2400); break;
        case "wobble": this._note(300, t, 0.1, "triangle", 0.16); break;
        case "caught": [659, 784, 988, 1319].forEach((f, i) => this._note(f, t + i * 0.09, 0.25, "square", 0.16)); break;
        case "break": this._noise(t, 0.25, 0.3, 1000); break;
        case "send": this._note(300, t, 0.12, "triangle", 0.16); this._note(500, t + 0.06, 0.12, "triangle", 0.14); break;
        case "evolve": [392, 494, 587, 784].forEach((f, i) => this._note(f, t + i * 0.14, 0.3, "square", 0.14)); break;
        default:
          if (name && name.indexOf("move_") === 0) {
            const type = name.slice(5);
            const f = { fire: 200, water: 520, electric: 900, grass: 440, ice: 700, normal: 330 }[type] || 330;
            this._noise(t, 0.14, 0.14, type === "electric" ? 3000 : 1600);
            this._note(f, t, 0.14, type === "electric" ? "sawtooth" : "square", 0.12);
          }
      }
    } catch (e) {}
  },

  // scene loops: [ [semitone offsets over a base], tempo ]
  _songs: {
    town: { base: 262, seq: [0, 4, 7, 4, 5, 9, 7, 4], type: "triangle", bpm: 108 },
    route: { base: 294, seq: [0, 7, 12, 7, 9, 4, 7, 2], type: "square", bpm: 132 },
    battle_wild: { base: 220, seq: [0, 3, 7, 10, 7, 3, 5, 2], type: "square", bpm: 156 },
    battle_trainer: { base: 233, seq: [0, 5, 7, 12, 10, 7, 5, 3], type: "square", bpm: 160 },
    battle_champ: { base: 196, seq: [0, 7, 3, 10, 5, 12, 7, 2], type: "sawtooth", bpm: 168 },
    victory: { base: 330, seq: [0, 4, 7, 12, 7, 12, 16, 12], type: "square", bpm: 140 },
  },

  music(name) {
    if (this._cur === name) return;
    this._cur = name;
    if (this._loop) { clearInterval(this._loop); this._loop = null; }
    if (!this.ctx || !this.on) return;
    const song = this._songs[name]; if (!song) return;
    const beat = 60 / song.bpm / 2;         // eighth notes
    let step = 0;
    const play = () => {
      if (!this.ctx || this._cur !== name) return;
      const t = this.ctx.currentTime + 0.02;
      const semi = song.seq[step % song.seq.length];
      const f = song.base * Math.pow(2, semi / 12);
      this._note(f, t, beat * 0.9, song.type, 0.05);
      if (step % 2 === 0) this._note(song.base / 2, t, beat * 1.4, "triangle", 0.06); // bass
      step++;
    };
    play();
    this._loop = setInterval(play, beat * 1000);
  },

  stop() { this._cur = null; if (this._loop) { clearInterval(this._loop); this._loop = null; } },
};

if (typeof module !== "undefined" && module.exports) module.exports = { Sound };
