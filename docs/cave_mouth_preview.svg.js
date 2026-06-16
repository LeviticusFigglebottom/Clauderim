/* generates docs/cave_mouth_preview.svg — a code-faithful top-down mockup of the
   dungeon entrance, before vs after, using CLAUDERIM's real tile colours and the
   exact boulder/rock polygon shapes from render.js drawDeco. */
"use strict";
const fs = require("fs");
const TILE = 32;
const C = { grass: "#4e7a3a", grass2: "#5d8a42", stone: "#393733", void_: "#070708",
  boulder: "#5d574e", rock: "#6e6a62", pillar: "#cfc8ba", pillarCap: "#e6e0d2" };

function rock(cx, cy, s, fill) {
  // mirrors render.js drawDeco case ROCK/BOULDER
  return `<g>
    <ellipse cx="${cx}" cy="${cy + 5 * s}" rx="${10 * s}" ry="${4 * s}" fill="rgba(0,0,0,0.25)"/>
    <polygon points="${cx - 9 * s},${cy + 5 * s} ${cx - 5 * s},${cy - 6 * s} ${cx + 4 * s},${cy - 8 * s} ${cx + 9 * s},${cy + 5 * s}" fill="${fill}"/>
    <polygon points="${cx - 5 * s},${cy - 6 * s} ${cx + 4 * s},${cy - 8 * s} ${cx},${cy - 2 * s}" fill="rgba(255,255,255,0.10)"/>
  </g>`;
}
function stoneTile(tx, ty) {
  let s = `<rect x="${tx * TILE}" y="${ty * TILE}" width="${TILE}" height="${TILE}" fill="${C.stone}"/>`;
  for (let i = 1; i < 4; i++) s += `<line x1="${tx * TILE}" y1="${ty * TILE + i * 8}" x2="${tx * TILE + TILE}" y2="${ty * TILE + i * 8}" stroke="rgba(0,0,0,0.35)" stroke-width="1"/>`;
  s += `<line x1="${tx * TILE + 16}" y1="${ty * TILE}" x2="${tx * TILE + 16}" y2="${ty * TILE + TILE}" stroke="rgba(0,0,0,0.25)" stroke-width="1"/>`;
  return s;
}
function voidTile(tx, ty) { return `<rect x="${tx * TILE}" y="${ty * TILE}" width="${TILE}" height="${TILE}" fill="${C.void_}"/>`; }
function portal(tx, ty) { return `<ellipse cx="${tx * TILE + 16}" cy="${ty * TILE + 16}" rx="13" ry="17" fill="rgba(5,5,10,0.92)" filter="url(#soft)"/>`; }
function grass(W, H) {
  let s = `<rect width="${W}" height="${H}" fill="${C.grass}"/>`;
  for (let i = 0; i < 80; i++) { const x = (i * 137) % W, y = (i * 89) % H, r = 4 + (i % 4) * 3;
    s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.grass2}" opacity="0.25"/>`; }
  return s;
}
function pillar(tx, ty) { // old D.PILLAR look — a pale column with a cap
  const x = tx * TILE + 16, y = ty * TILE + 16;
  return `<rect x="${x - 4}" y="${y - 22}" width="8" height="30" fill="${C.pillar}"/>
          <rect x="${x - 8}" y="${y - 26}" width="16" height="8" fill="${C.pillarCap}"/>`;
}

const PW = 14 * TILE, PH = 12 * TILE, mtx = 7, mty = 5;
function panel(after) {
  let g = grass(PW, PH);
  // dark stone recess (both versions share the throat)
  for (let x = mtx - 1; x <= mtx + 1; x++) g += stoneTile(x, mty - 1);
  g += stoneTile(mtx - 1, mty) + stoneTile(mtx + 1, mty) + voidTile(mtx, mty);
  if (!after) {
    g += pillar(mtx - 2, mty) + pillar(mtx + 2, mty);
  } else {
    g += rock(mtx * TILE - 2 * TILE + 16, (mty - 1) * TILE + 16, 1.4, C.boulder);
    g += rock(mtx * TILE + 2 * TILE + 16, (mty - 1) * TILE + 16, 1.4, C.boulder);
    g += rock(mtx * TILE - 2 * TILE + 16, mty * TILE + 16, 1.4, C.boulder);
    g += rock(mtx * TILE + 2 * TILE + 16, mty * TILE + 16, 1.4, C.boulder);
    g += rock((mtx - 3) * TILE + 16, (mty + 1) * TILE + 16, 1, C.rock);
    g += rock((mtx + 3) * TILE + 16, (mty + 1) * TILE + 16, 1, C.rock);
    g += rock((mtx - 2) * TILE + 16, (mty + 2) * TILE + 16, 1, C.rock);
    g += rock((mtx + 2) * TILE + 16, (mty + 2) * TILE + 16, 1, C.rock);
    g += rock((mtx - 1) * TILE + 16, (mty + 3) * TILE + 16, 1, C.rock);
    g += rock((mtx + 1) * TILE + 16, (mty + 3) * TILE + 16, 1, C.rock);
  }
  g += portal(mtx, mty + 1);
  return g;
}

const W = PW * 2 + 60, H = PH + 70;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Georgia, serif">
  <defs><filter id="soft"><feGaussianBlur stdDeviation="1.5"/></filter></defs>
  <rect width="${W}" height="${H}" fill="#0b0a08"/>
  <text x="${W / 2}" y="26" fill="#c9a86a" font-size="18" text-anchor="middle" letter-spacing="3">CLAUDERIM — DUNGEON ENTRANCE (top-down)</text>
  <g transform="translate(20,44)"><rect x="-2" y="-2" width="${PW + 4}" height="${PH + 4}" fill="none" stroke="#4a4030"/>${panel(false)}
    <text x="${PW / 2}" y="${PH + 18}" fill="#8a8378" font-size="14" text-anchor="middle">BEFORE — brick block + pillars</text></g>
  <g transform="translate(${PW + 40},44)"><rect x="-2" y="-2" width="${PW + 4}" height="${PH + 4}" fill="none" stroke="#c9a86a"/>${panel(true)}
    <text x="${PW / 2}" y="${PH + 18}" fill="#c9a86a" font-size="14" text-anchor="middle">AFTER — cave mouth in heaped rock</text></g>
</svg>`;
fs.writeFileSync(__dirname + "/cave_mouth_preview.svg", svg);
console.log("wrote docs/cave_mouth_preview.svg (" + svg.length + " bytes)");
