# CLAUDE.md — working in CLAUDERIM

Operational guide for editing this repo safely. Read this first; the exhaustive
system-by-system reference is in **`docs/CODEMAP.md`**. World bible is
`docs/LORE.md`; tuning rationale is `docs/DESIGN.md`.

> **CLAUDERIM — The Shattered March** is a zero-dependency, zero-build browser
> action-RPG (Skyrim use-based growth + Dark Souls stamina combat). ~11.5k lines
> of vanilla JS + Canvas + WebAudio. It renders in **both** first-person (a
> software raycaster) and top-down, sharing one world and one set of systems.

## Run & test

```bash
# Play: just open index.html (or serve for clean reloads)
python3 -m http.server 8080      # → http://localhost:8080

# Test: headless, no deps, no build. THIS IS THE GATE — run it after every change.
node test/smoke.js               # prints "ALL SMOKE TESTS PASSED", exit 0; exit 1 on any failure
```

There is **no package.json, no bundler, no module system**. The smoke test loads
the real game by scraping `<script src>` tags from `index.html`, shimming
`document`/`window`/`canvas`/`localStorage`, and `vm`-eval'ing every JS file in
order into one persistent context. 143 assertions cover worldgen, combat,
leveling, inventory, save/load, quests, bosses, death/respawn, NG+, fishing,
conjuration, the FP raycaster math, and a 1200-frame input soak.

## Architecture: load order is the dependency graph

Scripts load in this fixed order (`index.html`); a file may only use globals
declared by an earlier file. Globals share one flat namespace (top-level
`const`/`class`).

| Load order | File | Exposes | Role |
|---|---|---|---|
| 1 | `js/util.js` | `U`, `TAU` | seeded RNG (`U.mulberry32`), value-noise/fBm, math, DOM helpers |
| 2 | `js/state.js` | `G` | the global state singleton — every system reads/writes `G` |
| 3–9 | `js/data_*.js` | data tables | content (see below); each self-injects `.id` via a trailing loop |
| 10 | `js/world.js` | `World`, `TILE`, `T`,`D`,`B`, `SPAWN_TABLES`-consumer | overworld+interior gen, collision, biomes, spawners |
| 11 | `js/entities.js` | `Entity`,`Enemy`,`Ally`,`NPC`,`Hazard`,`Projectile`,`FX`,`Spawn` | enemy AI, boss pattern engine, NPCs, projectiles, particles |
| 12 | `js/player.js` | `Player`, `LEVEL_COST`, `SKILL_XP_TO_NEXT` | the Emberborn: stats, inventory, equip, action state machine |
| 13 | `js/combat.js` | `Combat` | the full damage pipeline, both directions |
| 14 | `js/quests.js` | **`QS`** (not `Quests`), `SIGIL_ITEMS` | quest state machine, journal, compass |
| 15 | `js/audio.js` | **`Sfx`, `Music`**, `audioInit()` (no `Audio` global) | procedural WebAudio SFX + generative score |
| 16 | `js/save.js` | `SaveSys`, `SAVE_PREFIX` | localStorage save slots (deltas only) |
| 17 | `js/input.js` | `Input`, `BINDS` | keyboard/mouse, pointer-lock mouse-look |
| 18 | `js/render.js` | `Render`, `CHUNK`, `TILE_COLORS` | top-down renderer (chunk-cached terrain, vector chars, HUD) |
| 19 | `js/render_fp.js` | `RenderFP` | first-person raycaster (depends on `Render` + `TILE_COLORS`) |
| 20 | `js/ui.js` | `UI` | every DOM screen: menus, dialogue, shops, crafting, shrine, endings |
| 21 | `js/main.js` | `Game` (+ attaches `G.onPlayerDeath`, `G.restAtInn`) | boot, game loop, transitions, interaction, death/respawn, clock |

Data files: `data_items.js` (`ITEMS`, `SCALE_MULT`, recipes, `ENCHANTS`, `LOOT`,
`FISH_TABLES`, `HONE_TIERS`), `data_spells.js` (`SPELLS`, `EDICTS`),
`data_perks.js` (`SKILL_DEFS`, `ATTR_DEFS`, `ORIGINS`), `data_enemies.js`
(`ENEMY_TYPES`, `SPAWN_TABLES`, `GAUNTLET_WAVES`), `data_lore.js` (`BOOKS`),
`data_quests.js` (`QUESTS`), `data_dialogue.js` (`NPC_DEFS`, `DIALOGUES`).

## House style (match this)

- `"use strict";` + a `/* ===== banner ===== */` header at the top of every file.
- **Namespaced globals**: systems are object literals (`Game`, `World`, `Combat`,
  `QS`, `UI`, `Input`, `SaveSys`, `Sfx`, `Music`, `FX`, `Spawn`) or classes
  (`Player`, `Enemy`…). No ES modules, no imports/exports.
- **Content ids are `lower_snake_case`** (`iron_sword`, `boss_korvash`,
  `mq_ember`, `oh_1`). Data tables self-inject `.id` (`for (const id in X) X[id].id = id`) —
  **never hand-write an `id` field**, never key two entries the same.
- **All art is procedural canvas vectors** — there are no image/sprite assets.
  Entities draw from `def.look.shape ∈ {beast, blob, wisp, crawler, humanoid}`.
- **Determinism**: worldgen flows through `U.mulberry32(seed)`; geometry is never
  saved, only regenerated. Runtime AI/spawn randomness uses raw `Math.random` on
  purpose (not reproducible).
- **Lore voice**: every item/enemy/book/NPC carries terse, melancholic,
  region-flavored flavor text. Regions have fixed rhetorical voices (see
  `docs/LORE.md` → "Regional voice"). Match the giver's voice when extending.
- **CSS theme** (`css/style.css`): serif (`--serif`), `font-weight:400`, uppercase
  wide-letter-spaced headings, palette `--gold #c9a86a / --ember #e07b39 /
  --bone #d8d0c0 / --ash #8a8378 / --blood #8e2f2f`, dark translucent `.panel`s.
  Visibility toggles via the `.hidden` class (`U.show`/`U.hide`).

## Change recipes — touch ALL the listed places

Because everything is referenced by string id across files, additions are
multi-file. (Full detail + line numbers in `docs/CODEMAP.md`.)

- **New item** → `ITEMS` in `data_items.js`. If it needs an effect: weapons read
  `dmg/scale/reach/edmg/bonusVs/leech` in `combat.js`; consumable `use.*` keys
  (`hp/stam/mag/embers/cure/buff/throw`) are handled in `player.js` — an
  unrecognized key is silently ignored. New `edmg`/`edef` element → add a resist
  branch in `combat.js` (only `fire/frost/shock/poison` are handled).
- **New enemy** → `ENEMY_TYPES`; add to a `SPAWN_TABLES` biome and/or
  `GAUNTLET_WAVES`. `behavior ∈ {melee,lunger,archer,caster,swarm,flee}`;
  `archer`/`caster` need a `proj`. `look.shape` must be one of the five shapes.
  Keep base stats un-scaled (NG+ `G.cycle` and elite ×1.7 multiply automatically;
  `critter` tag is exempt). Always end `loot` with a bare `{ w }` miss-weight.
- **New boss** → an `ENEMY_TYPES` entry with `boss:true`, `patterns:[…]`,
  `phase2`, `drops`, `intro`, optional `grantsEdict`. **Pattern `kind` strings**
  (`swing/slam/charge/volley/summon/breath`) are hard-switched in
  `entities.js executePattern/runPattern` — a new kind needs engine code. A boss
  needs a `bossArena` (set by worldgen) and only takes damage once `e.engaged`.
- **New spell/edict** → `SPELLS`/`EDICTS`. `kind` is switched in `combat.js`
  (`bolt/self/nova/summon`; edict `force/drain/time/breath`) — a new kind does
  nothing without combat code. ⚠ spell `cure` is an **array**; item `use.cure` is
  a **string**. Edict `key` must stay `"1".."5"` (matches `BINDS` `edict1..edict5`;
  the player/HUD loops cap at 5 — `ond` is the fifth, granted by Maerodric).
- **New perk** → add to a `SKILL_DEFS[x].perks` (id `<2-letter>_<1..4>`, req
  10/25/45/70) **AND** wire its effect with `p.hasPerk("id")` in
  `combat.js`/`player.js`. ⚠ `hasPerk` is string-keyed and fails **silently** — a
  perk with no `hasPerk` branch is a dead, purchasable point. (All current trees are
  wired — smithing in `combat.js weaponDamage`/`armorTotal`/forge UI, alchemy via
  `alchemyPotency`/`useConsumable`, sneak in `entities.js` detection. Keep it so.)
- **New quest** → `QUESTS` in `data_quests.js`. `talk`-kind objectives do **not**
  auto-advance — a dialogue `action` must call `QS.advance/complete` or the quest
  soft-locks. `kill`/`flags` hints must contain literal `(0/N)` for the live-count
  regex. `collect` items are **consumed** on completion.
- **New dialogue/NPC** → `NPC_DEFS` + `DIALOGUES` (same key). `entry[]` is
  first-passing-`cond` wins, end with `{cond:()=>true, node:"hub"}`. If a choice
  `action` opens a station (`UI.openShop/openCraft`, `G.restAtInn`) set
  `next:null` — navigation is skipped because `G.state` changed.
- **New tile type** → `T` enum (`world.js`) **AND** `TILE_COLORS` (`render.js`)
  **AND** both renderers. ⚠ FP floor-casting uses hardcoded numeric tile IDs
  (0,1,17,18) and `render.js` assumes terrain transitions only for `t <= T.BRIDGE`
  — reordering the enum breaks the baked `Uint8Array` maps and both renderers.
  Runtime tile edits won't show until `Render.chunkCache.clear()`.
- **New entity render** → top-down branch in `Render.drawEntity` (by class or
  `look.shape`); FP `gatherSprites`/`shapeH` in `render_fp.js`.
- **New menu tab** → `<button data-tab="x" class="menu-tab">` in `index.html` +
  `case "x"` in `UI.renderMenu` + a `renderX()`; optional hotkey in `BINDS` +
  `Game.handleMetaKeys`.
- **New station** (shop/craft/board all share `#station-screen` + `station` state)
  → an `openY()` that `setState("station")` + renders `#station-panel` + a close
  button → `closeStation()`; reach it from `Game.findInteractable`/`interact` or a
  dialogue action.
- **New saved field** → edit **both** `SaveSys.save` and `SaveSys.load` (with a
  default for old saves — there is no migration code, defaults are the only
  forward-compat). Per-map state also needs `collectMapState` + the load replay.
  `Player.serialize`/`deserialize` is the player schema; `deserialize` backfills
  missing skills — follow that pattern.
- **New SFX** → a recipe row in `SFX_TABLE` (`audio.js`), play with
  `Sfx.play("name")`. **New music mood** → `MOODS` + `Music.setMood`. Gated by
  `G.settings.sfx`/`.music`; nothing plays until `audioInit()` (first input).
- **New onboarding hint** → `G.tip("uniqueKey", text)` at the trigger site. Shows once
  per character (gold italic `msg-line.hint`), then remembered in `player.seenHints`
  (already in `serialize`/`deserialize`). The **quick belt** (`player.belt`/`beltSel`,
  wheel/`[ ]`/`T`) and **favorites** (`player.favorites`, `Z` → `UI.openFavorites`, a
  pausing `"favorites"` state with `1–9` hotkeys + reorder, plus 3 **gear loadouts**
  `player.loadouts`/`saveLoadout`/`applyLoadout`) both store type-tagged
  `{type:"item"|"spell",id}` and have `beltToggle`/`favoriteToggle`/`isFavorite` — extend
  their menu hooks in `ui.js`.

## Combat model (the load-bearing numbers)

- **Player→enemy** (`combat.js weaponDamage`/`playerStrike`/`applyDamage`):
  `dmg = base × (1 + tier·0.08 honing) × (1 + Σ SCALE_MULT[letter]·(attr−8)·0.035)
  × (1 + skill·0.005) × perks × (heavy?1.65) × sneak`, then enemy armor
  `50/(50+armor·2.5)`, resists `1−res/100`, `bonusVs` tag ×1.3, optional block
  ×0.25, status riders, then poise → stagger.
  `SCALE_MULT = {S:1.0, A:.75, B:.55, C:.38, D:.22, E:.08}`.
- **Enemy→player** (`damagePlayer`), gauntlet order: **i-frames** (roll negates) →
  **parry** (block raised <0.18s, non-boss → attacker staggered, negated) →
  **block** (frontal 100°, stamina cost, guard-break on empty) → ward → armor
  `80/(80+armorTotal())` / resist (capped 80%) → status riders → poise/stagger →
  **Undimmed** (`re_4`, once-per-rest 1-HP save via `undimmedUsed`).
- **Status** is a flat map of remaining-seconds timers `{burn,poison,frost,bleed}`,
  refresh-to-max (no stacking), ticked by `Combat.tickStatus`. `burn`6/s `poison`4/s
  `bleed`5/s DoT; `frost` is **slow-only** (no DoT). `shock` is **instant flat
  damage**, never a timer.
- **Embers = souls**: dropped on death into `G.lostEmbers` (one stake; a new death
  overwrites it), reclaimed on touch. Leveling spends embers:
  `LEVEL_COST = floor(80·level^1.55)`. Skill XP `SKILL_XP_TO_NEXT = 80 + lvl·14`;
  **a perk point every 5 skill levels** (`lvl % 5`, not 10 — the data_perks header
  comment is wrong, trust the code).

## Top gotchas

- **The namespace is `QS`, not `Quests`.** Audio is **`Sfx.play` / `Music.setMood`**,
  not `Audio.*`. Both are easy to get wrong from memory.
- **`G.dt` vs `G.rdt`**: gameplay uses `G.dt` (zeroed during hitstop / when paused);
  render easing must use `G.rdt` (real dt). KYR slow-mo (`G.slowmo`) scales an
  enemy-only `tdt` separately. `Input.endFrame()` must stay the **last** loop step.
- **World ticks only when `G.state ∈ {play, dialogue, dead}`.** Opening
  `menu`/`shrine`/`station`/`help` truly pauses; `dialogue` keeps simulating.
- **Bosses are damage-immune until `engaged`** (arena entered); the seal is enforced
  in `World.circleBlocked` via `G.bossFight` — a stale `G.bossFight` walls the arena.
- **Renaming a global namespace, an `attrs`/`skills`/`equip` key, a perk id, a tile
  enum value, or a `serialize` field cascades** across many string-keyed call sites
  (e.g. `QS` is referenced ~90×, mostly in `data_dialogue.js`).
- **The smoke test hard-codes invariants** (10 shrines, 11 NPCs, 9 portals,
  honing +2 = 1.16×, quest stages 0/1/2/3/4/999, specific ids). Balance/worldgen
  edits must keep these in sync or update `test/smoke.js`.
- **No file may touch `document`/`window`/`canvas`/audio at module load time** —
  only inside functions (`boot`/`init`/render/draw), or the smoke test aborts at
  load. Data + logic files (`util`, `state`, `data_*`, `world`, `entities`,
  `player`, `combat`, `quests`, `save`) must stay DOM-free.

## Git

Work on branch **`claude/vigilant-brahmagupta-72f6qy`**. Commit with clear
messages; push with `git push -u origin <branch>`. Do not open a PR unless asked.
