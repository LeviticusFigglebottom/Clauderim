/* ============================================================
   CLAUDERIM — audio.js
   Procedural WebAudio: synthesized SFX and a generative
   ambient score with moods (title / world / town / dungeon /
   boss). No audio assets; everything is oscillators & noise.
   ============================================================ */
"use strict";

let AC = null;
let masterGain = null, musicGain = null, sfxGain = null;

function audioInit() {
  if (AC) return true;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    AC = new Ctx();
    masterGain = AC.createGain(); masterGain.gain.value = 0.55; masterGain.connect(AC.destination);
    musicGain = AC.createGain(); musicGain.gain.value = 0.4; musicGain.connect(masterGain);
    sfxGain = AC.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(masterGain);
    return true;
  } catch (e) { return false; }
}

/* ---------------- SFX ---------------- */

/* recipe: [type, freqStart, freqEnd, dur, vol, noiseAmt] */
const SFX_TABLE = {
  swing:        ["sawtooth", 300, 90, 0.12, 0.18, 0.35],
  swing_heavy:  ["sawtooth", 220, 50, 0.2, 0.24, 0.45],
  hit_flesh:    ["square", 140, 60, 0.1, 0.3, 0.7],
  hurt:         ["square", 180, 70, 0.14, 0.3, 0.5],
  block:        ["square", 520, 320, 0.08, 0.22, 0.5],
  block_raise:  ["triangle", 200, 260, 0.07, 0.1, 0.1],
  parry:        ["triangle", 900, 1400, 0.18, 0.3, 0.2],
  guardbreak:   ["sawtooth", 300, 60, 0.4, 0.32, 0.6],
  stagger:      ["square", 240, 90, 0.18, 0.25, 0.4],
  roll:         ["triangle", 150, 70, 0.16, 0.12, 0.5],
  step:         ["triangle", 70, 45, 0.07, 0.05, 0.85],
  splash:       ["sine", 300, 90, 0.3, 0.18, 0.85],
  bite:         ["sine", 700, 380, 0.18, 0.25, 0.3],
  bow:          ["triangle", 600, 180, 0.14, 0.2, 0.3],
  cast_charge:  ["sine", 220, 480, 0.3, 0.12, 0],
  cast:         ["sine", 700, 280, 0.2, 0.2, 0.15],
  explode:      ["sawtooth", 120, 30, 0.5, 0.4, 0.9],
  slam:         ["sawtooth", 90, 28, 0.5, 0.42, 0.8],
  breath:       ["sawtooth", 160, 110, 0.25, 0.12, 0.85],
  flask:        ["sine", 380, 660, 0.35, 0.18, 0],
  drink:        ["sine", 300, 520, 0.25, 0.15, 0],
  throw:        ["triangle", 350, 120, 0.12, 0.14, 0.3],
  equip:        ["square", 240, 200, 0.07, 0.12, 0.4],
  deny:         ["square", 160, 110, 0.16, 0.15, 0],
  pickup:       ["sine", 520, 780, 0.12, 0.16, 0],
  coin:         ["sine", 880, 1240, 0.1, 0.16, 0],
  chest:        ["triangle", 200, 420, 0.3, 0.2, 0.2],
  door:         ["sawtooth", 90, 60, 0.4, 0.2, 0.5],
  shrine:       ["sine", 440, 880, 0.9, 0.22, 0],
  levelup:      ["sine", 520, 1040, 0.7, 0.25, 0],
  skillup:      ["sine", 660, 990, 0.3, 0.16, 0],
  quest:        ["sine", 590, 880, 0.4, 0.2, 0],
  quest_done:   ["sine", 520, 1300, 0.8, 0.25, 0],
  victory:      ["sine", 440, 1320, 1.2, 0.3, 0],
  edict:        ["sawtooth", 70, 200, 0.7, 0.4, 0.3],
  kyr:          ["sine", 1200, 80, 1.4, 0.25, 0],
  read:         ["triangle", 300, 360, 0.15, 0.1, 0.2],
  craft:        ["square", 420, 380, 0.12, 0.2, 0.6],
  ui:           ["sine", 600, 560, 0.05, 0.08, 0],
  death:        ["sawtooth", 200, 30, 2.2, 0.4, 0.4],
  growl:        ["sawtooth", 110, 70, 0.4, 0.22, 0.5],
  squelch:      ["sine", 160, 60, 0.3, 0.2, 0.8],
  roar:         ["sawtooth", 90, 140, 0.7, 0.35, 0.6],
  hiss:         ["sawtooth", 800, 300, 0.35, 0.12, 0.95],
  man:          ["square", 160, 120, 0.25, 0.15, 0.3],
  moan:         ["sine", 140, 80, 0.8, 0.18, 0.3],
  whisper:      ["sine", 900, 500, 0.6, 0.08, 0.95],
};

const Sfx = {
  lastPlay: {},
  play(name) {
    if (!G.settings.sfx) return;
    if (!audioInit()) return;
    if (AC.state === "suspended") { AC.resume(); }
    let recipe = SFX_TABLE[name];
    if (!recipe && name.startsWith("die_")) {
      recipe = SFX_TABLE[name.slice(4)];
      if (recipe) recipe = [recipe[0], recipe[1] * 0.7, 30, recipe[3] * 1.8, recipe[4], recipe[5]];
    }
    if (!recipe) return;
    // throttle identical sfx
    const now = AC.currentTime;
    if (this.lastPlay[name] && now - this.lastPlay[name] < 0.05) return;
    this.lastPlay[name] = now;

    const [type, f0, f1, dur, vol, noiseAmt] = recipe;
    const t0 = now;
    if (vol > 0 && noiseAmt < 1) {
      const o = AC.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0 * (0.94 + Math.random() * 0.12), t0);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
      const g = AC.createGain();
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g); g.connect(sfxGain);
      o.start(t0); o.stop(t0 + dur + 0.02);
    }
    if (noiseAmt > 0) {
      const len = Math.max(1, (dur * AC.sampleRate) | 0);
      const buf = AC.createBuffer(1, len, AC.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = AC.createBufferSource(); src.buffer = buf;
      const g = AC.createGain();
      g.gain.setValueAtTime(vol * noiseAmt, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      const filt = AC.createBiquadFilter();
      filt.type = "lowpass"; filt.frequency.value = Math.max(f0 * 4, 400);
      src.connect(filt); filt.connect(g); g.connect(sfxGain);
      src.start(t0);
    }
  },
};

/* ---------------- music ---------------- */

/* chord pools per mood (semitone offsets from root, root hz) */
const MOODS = {
  title:   { root: 110, chords: [[0, 3, 7], [-2, 2, 5], [0, 5, 8], [-4, 0, 3]], pace: 6.5, vol: 0.5, type: "sine" },
  world:   { root: 130.8, chords: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [2, 5, 9]], pace: 7, vol: 0.32, type: "sine" },
  town:    { root: 146.8, chords: [[0, 4, 7], [4, 7, 11], [5, 9, 12], [0, 4, 9]], pace: 6, vol: 0.34, type: "triangle" },
  dungeon: { root: 98, chords: [[0, 3, 7], [-1, 3, 6], [0, 1, 7], [-4, 0, 3]], pace: 8.5, vol: 0.3, type: "sine" },
  boss:    { root: 87.3, chords: [[0, 3, 6], [0, 1, 7], [-2, 1, 4], [0, 3, 8]], pace: 3.2, vol: 0.45, type: "sawtooth" },
};

const Music = {
  mood: null,
  timer: null,
  chordIdx: 0,

  setMood(mood) {
    if (this.mood === mood) return;
    this.mood = mood;
    this.chordIdx = 0;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (!G.settings.music || !mood) return;
    if (!audioInit()) return;
    this.scheduleNext(0.2);
  },

  scheduleNext(delay) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (!G.settings.music || !this.mood || !AC) return;
      this.playChord();
      const m = MOODS[this.mood];
      this.scheduleNext(m.pace * (0.9 + Math.random() * 0.25));
    }, delay * 1000);
  },

  playChord() {
    const m = MOODS[this.mood];
    if (!m || AC.state === "suspended") return;
    const chord = m.chords[this.chordIdx % m.chords.length];
    this.chordIdx += (Math.random() < 0.8) ? 1 : 2;
    const t0 = AC.currentTime;
    const dur = m.pace * 1.25;
    for (let i = 0; i < chord.length; i++) {
      const freq = m.root * Math.pow(2, chord[i] / 12) * (i === 0 ? 1 : (Math.random() < 0.3 ? 2 : 1));
      const o = AC.createOscillator();
      o.type = m.type;
      o.frequency.value = freq;
      const g = AC.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(m.vol / chord.length, t0 + dur * 0.3);
      g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(musicGain);
      o.start(t0); o.stop(t0 + dur + 0.05);
    }
    // boss pulse: low thump
    if (this.mood === "boss") {
      for (let b = 0; b < 4; b++) {
        const tb = t0 + b * (MOODS.boss.pace / 4);
        const o = AC.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(70, tb);
        o.frequency.exponentialRampToValueAtTime(35, tb + 0.18);
        const g = AC.createGain();
        g.gain.setValueAtTime(0.4, tb);
        g.gain.exponentialRampToValueAtTime(0.001, tb + 0.2);
        o.connect(g); g.connect(musicGain);
        o.start(tb); o.stop(tb + 0.25);
      }
    }
  },
};
