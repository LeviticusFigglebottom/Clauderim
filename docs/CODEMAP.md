# CLAUDERIM — Code Map

Exhaustive system-by-system reference for the codebase. Companion to the
top-level `CLAUDE.md` (operational guide / change recipes), `docs/DESIGN.md`
(tuning rationale) and `docs/LORE.md` (world bible). Line numbers are
approximate — grep the named symbol.

All files are plain `<script>` globals (`"use strict";`, no modules). Load order
is the dependency graph (see `CLAUDE.md`). The conventions: data tables are
`const TABLE = {…}` keyed by `lower_snake_case` id, each ending with
`for (const id in TABLE) TABLE[id].id = id;` (never hand-write `.id`). All art is
procedural canvas vectors. Worldgen is deterministic via `U.mulberry32`; runtime
AI/spawning uses raw `Math.random`.

---

## 1. Foundations — `util.js` (`U`, `TAU`) and `state.js` (`G`)

**`U` (util.js):** deterministic RNG + math + DOM helpers.
- RNG: `mulberry32(seed)→fn`, `hashStr(s)`, `hash2(x,y,seed)`, `randi/randf/choice/shuffle`, `weighted(rng, [{w,…}])`.
- Noise: `vnoise(x,y,seed)`, `fbm(x,y,seed,octaves,lac,gain)`.
- Math: `clamp, lerp, smoothstep, dist, dist2, angTo, angDiff, angApproach, approach`.
- Format: `fmt(n)` (1.2k/1.0m), `cap, roman`.
- DOM: `el(id), mk(tag,cls,html), show(id), hide(id), esc(s)`.

**`G` (state.js):** the global singleton every system reads/writes. Key fields:
- Flow: `state` (`title|chargen|play|menu|dialogue|shrine|station|dead|ending|help`),
  `prevState`, `setState(s)` (records prevState).
- World: `seed`, `cycle` (NG+ depth), `player`, `map`, `maps{}` (interior cache),
  `overworld`, `entities[]`, `projectiles[]`, `particles[]`, `floats[]`,
  `corpsePile[]`, `camera{x,y,shake,shakeMag}`, `time{day,hour}`,
  `weather{kind,t,next,intensity}`, `lightning`.
- Persistence deltas: `flags{}`, `openedChests{}`, `slainBosses{}`,
  `discoveredShrines{}`, `discoveredPois{}`, `lostEmbers{mapId,x,y,amount}|null`.
- Combat/time: `bossFight`, `gauntletActive`, `dt`, `rdt` (real dt, survives
  hitstop), `elapsed`, `frame`, `slowmo` (KYR), `hitstop`, `slowmoAim`,
  `viewMode` (`"fp"|"top"`), `saveSlot`.
- `settings{music,sfx,screenShake,showDamage,renderScale,viewDist,grain,showFps,
  fov,sens,invertY}` — persisted separately via `saveSettings`/`loadSettings`
  (localStorage key `clauderim_settings`).
- Helpers: `msg(text,cls)`, `banner(title,sub)`, `questToast(title,sub)`,
  `float(x,y,text,color,size)`, `shake(mag,dur)`, `darkness()` (0=noon→1=night,
  nudged by `flags.ending_chosen`). `main.js` attaches `G.onPlayerDeath` and
  `G.restAtInn`.

---

## 2. World — `world.js` (`World`, `TILE`, `T`, `D`, `B`, …)

**Constants:** `TILE=32`; tile enum `T` (`DEEPWATER 0, WATER 1, SAND 2, GRASS 3,
MEADOW 4, FORESTFLOOR 5, ROCK 6, SNOW 7, SWAMP 8, ASH 9, ROAD 10, BRIDGE 11,
FLOOR_WOOD 12, FLOOR_STONE 13, WALL_WOOD 14, WALL_STONE 15, SNOWROCK 16, LAVA 17,
VOID 18`); `SOLID_TILES`, `SLOW_TILES` (SWAMP/SAND → `slowAt`=0.72); deco enum
`D` (0=NONE…21=BOARD) + `SOLID_DECO`; biome enum
`B {HEART 0, FOREST 1, MIRE 2, FROST 3, ASHLAND 4, COAST 5}`, `BIOME_NAMES`,
`BIOME_TABLE_KEYS = ["heartlands","forest","mire","frostpeaks","ashlands","coast"]`,
`GATHER_BY_BIOME`.

**Map object** (from `World.getMap(id)`, cached in `G.overworld`/`G.maps`):
`{ id, name, w, h, tiles:Uint8Array(w*h) (row-major y*w+x), deco:Uint8Array,
biome:Uint8Array|null, outdoor, portals[], shrines[], chests[], pickups[],
npcs[], spawners[], encounters[], encDead{}, safeZones[], lights[], stations[],
poiList[] (overworld only), bossArena, statues[] }`. Interiors add
`ambient ("crypt|cave|keep|temple|undermarch")`, `arrival{x,y}`, optional
`graves[]`. All stored positions are **pixels** (`tx*TILE+16`); gen works in tile
coords.
- `portals[]`: `{id,x,y,to,toPoi?,name,lockedBy?,poiId?,exit?}`.
- `stations[]`: `{kind,x,y,flag?}`, kind ∈ `smith|alchemy|enchant|board|campfire|
  well|vault|waylamp|gauntlet|passcairn`.
- `bossArena`: `{boss:"boss_x", x1,y1,x2,y2 (px AABB), bossX,bossY}`.
- `poiList[]`: `{id,name,kind:"town|tower|dungeon|camp|battlefield",tx,ty,interior?,
  discovered?,hidden?,lockedBy?}`.

**Spatial queries:** `tileAt/decoAtTile`, `solidAtTile`, `circleBlocked(map,px,py,r)`
(also enforces the sealed boss gate when `G.bossFight`/`bossArena` active),
`moveCircle` (collision-aware mover used by player/combat/AI), `steerMove(map,e,ang,sp)`
(local steering fan-out — **no A\***), `lineClear` (LOS), `biomeAtPx`, `regionNameAt`,
`slowAt`, `inArena`, `nearSafeZone`, `poiById`, `revealPoi`.

**Generation pipeline:**
- `genOverworld(seed)`: `mulberry32(seed^0xBEEF)` → per-cell fBm tile/deco/biome
  (frost if north, ashland if west, mire SE, else fBm forest/heartlands) → 17
  hardcoded POIs → stamp helpers (`stampEmberfall/Duskmere/Frosthollow/Watchtower/
  WhitePass/Strand`, then `stampDungeonMouth` per interior POI) → `carveRoad` ×9 →
  shrines + `stampCamp` ×3 → `scatterPickups` (240 plants + 50 iron veins) →
  spawner grid (every 24 tiles) + camp spawners.
- `genInterior(id)`: seed `G.seed ^ hashStr(id)`; `switch(id)` →
  `genRoomsDungeon` (reject-sampled rooms + L-corridors; keeps/crypts/citadel) /
  `genCaveDungeon` (4-pass cellular automata + largest-region flood fill +
  guaranteed entrance→boss corridor; caves/chapel/undermarch) / `genGauntlet`
  (fixed 30×30 pit). All call `populateDungeon` (encounters, chests, gatherables,
  graves, torches).

**Spawners:** `spawners[i] = {x,y,r,table,max,members[],cd,camp?}`.
`World.updateSpawners(dt)` (outdoor, per-frame): cooldown + member cull; player must
be 380–1000px away; town/`pass_at_rest` suppression; `U.weighted(Math.random,
SPAWN_TABLES[s.table])`; `new Enemy`; **7% elite roll** (`makeElite`, skipped for
`critter`). `World.restReset()` (the bonfire rule): clears `encDead`, resets
spawners, un-takes pickups, removes live non-boss enemies — called on rest/death/
cycle (mutates cached maps; a new cycle wipes `G.maps`/`G.overworld`).

---

## 3. Entities — `entities.js` (`Entity`,`Enemy`,`Ally`,`NPC`,`Hazard`,`Projectile`,`FX`,`Spawn`)

**`Entity`** base: `x,y,r,facing,hp,hpMax,dead,flashT,staggerT,bobT,poise,poiseMax,
status{}`.

**`Enemy extends Entity`** (`new Enemy(typeId,x,y)`; `def = ENEMY_TYPES[typeId]`):
adds `encIdx, homeX/homeY (leash anchor), state ("idle|patrol|chase|attack|flee|
return"), stateT, attackCd, wanderT/wanderAng, projCd, summons[], aware (0..1
detection), spdMult, engaged, patternCds{}, phase, activePattern, blocking,
lastHitBy, elite, dmgMult, emberMult`. Constructor scales hp/dmg/poise/embers by
`G.cycle` (skips `critter`). `makeElite()`: hp×1.7, dmg→×1.4, poise×1.5, embers ×3
(applied at kill).
- `Enemy.update(dt)`: status tick, regen, poise regen, stagger early-return;
  detection (range × crouch 0.42 × darkness × behind 0.55) builds `aware`→
  `enterChase`/`enterFlee`; state machine (idle/patrol/flee/chase/attack/return);
  `resolveStrike` → `Projectile.spawn` or `Combat.enemyHitPlayer`; separation push.
  KYR uses scaled `tdt` for attack/pattern timers, real `dt` for cooldowns/status.
- `updateBoss(tdt,dt)`: arena seal/engage (`inArena` → `engaged=true`,
  `G.bossFight=this`, `UI.showBossBar`, `Music.setMood("boss")`, banner); phase-2 at
  `hp/hpMax<=phase2.at`; pattern selection filtered by cooldown + range gates +
  summon cap; `runPattern` wind→act→rec; `executePattern` per `kind`
  (swing/slam/charge/volley/summon/breath) — **kinds are hard-switched here**.

**`NPC extends Entity`** (`def = NPC_DEFS[id]`): day/night schedule via
`anchorX/anchorY` getters (home when `hour>=21||hour<6.5`, else day post),
commutes, idle-wanders, barks `def.bark` near the player.

**`Ally extends Entity`**: conjured `sprite`/`lantern`; orbits player, sprite
auto-fires `Projectile`s (`from:"player"`).

**`Projectile`** (static; plain objects in `G.projectiles`):
`Projectile.spawn(o)→{x,y,vx,vy,dmg,dtype,color,from,radius,pierce,slow,magBurn,
sneak,life,r,hitSet:Set,spell,crit}`; `Projectile.update(dt)` integrates, hits via
`Combat.projectileHit`/`projectileHitPlayer`, `Combat.explode` on radius.

**`Hazard extends Entity`**: `{kind:"poison_pool|fire_field|frost_field",life:7,tick,
color}`; ticks AOE `Combat.damagePlayer` every 0.5s (undodgeable). Spawned by boss
`slam.leaves`.

**`FX`** (particles → `G.particles`, cap 600): `burst, blood, slash, ring, cone,
sparkle`, + `FX.update(dt)` integrates particles and `G.floats`.

**`Spawn.populate(map)`**: rebuilds `G.entities` from `map.encounters`/`npcs`/
`bossArena` on every map enter / rest / load.

---

## 4. Player — `player.js` (`Player`, `LEVEL_COST`, `SKILL_XP_TO_NEXT`)

`Player extends Entity`, instantiated as `G.player` (in `Game.newGame` and
`Player.deserialize`). Full shape:
- Identity: `name, origin`.
- Attributes (6): `attrs{vig,end,mnd,str,fin,wil}`.
- Progression: `level, embers, gold, perkPoints, perks{perkId:true}`.
- Skills (13): `skills{onehand,twohand,archery,block,lightarmor,heavyarmor,
  destruction,restoration,sneak,smithing,alchemy,speech,enchanting}` each `{lvl,xp}`.
- Inventory/equip: `inventory[{id,n}]` (gold NOT here), `equip{weapon,ranged,shield,
  head,body,legs,trinket}`, `honing{itemId:tier0-3}`, `enchants{itemId:[enchId]}`,
  `quickItem`.
- Magic: `spells[], equippedSpell, edicts[], edictCds{}`.
- Flask: `flask{max:3,charges:3,heal:60}`.
- Vitals: `hp/hpMax (80+vig·14+…), stam/stamMax (60+end·9), mag/magMax (40+mnd·11+…),
  poise/poiseMax (poiseTotal()=30+…)`.
- Action FSM: `atk{phase:"wind|strike|rec",t,heavy,…,hit}, queuedAtk, holdT/holding,
  rollT/rollDir/rollCd, blocking/blockT, draw{t}, cast{spell,t}|{flask,t},
  crouched/sprinting/moving/moveAng, iframes, stamLock, stepT, fpPitch, undimmedUsed`.
- Status/buffs: `status{burn,poison,frost,bleed}` (seconds), `buffs{id:{t,…}}`.
- Meta: `respawn{map,x,y,shrine}, quests{id:{stage,counts,done}}, readBooks{},
  bestiary{id:kills}, statsKills/Deaths/Fish`.

**Action timing** (`Player.update(dt)`): light vs heavy split at LMB-hold 0.32s;
swing = `(1/spd)·(heavy?1.5:1)` split wind 0.4 / strike 0.15 / rec 0.45;
`queuedAtk` combo-buffers. Block parry window `0.18·(bl_2?1.5)` via `blockT`.
Roll tiers by `loadRatio()`: <0.4 i-frames 0.34 / <0.75 0.28 / ≥0.75 0.20; >1.0
can't roll; roll cancels atk/cast/draw. Bow power `clamp(t/0.8,0.3,1)`. Sprint
speed 205 (base 132). Sneak ×0.55. `la_4`/`la_3` perks tweak roll i-frames/cost.

**Skills/leveling:** `gainSkill(id,xp)` — `SKILL_XP_TO_NEXT=80+lvl·14`, cap 100,
**perk point every `lvl%5`**. `levelUp(attr)` costs `LEVEL_COST=floor(80·level^1.55)`
embers, full-restores. `buyPerk` needs `perkPoints>0` + `skill.lvl>=req`
(10/25/45/70). `hasPerk(pid)` is the runtime check (string-keyed, silent on typo).

**Inventory/equip:** `addItem/removeItem/countItem/hasItem` (gold special-cased to
`this.gold`; removeItem auto-unequips). `equipItem(id)` routes by `type` (+`slot`
for armor), toggles, 2H clears shield, recomputes hpMax/magMax. Derived:
`equipLoad()`, `equipLoadMax()=40+end·3+str`, `armorTotal()`, `resist(dtype)`
(cap 80), `poiseTotal()`. `serialize`/`deserialize` define the save schema
(deserialize backfills new skills/fields).

---

## 5. Combat — `combat.js` (`Combat`)

**Player → enemy:**
- `weaponDamage(p,w,heavy)`: `w.dmg × (1+tier·0.08) × (1+Σ SCALE_MULT[letter]·
  max(0,attr−8)·0.035) × (1+skill·0.005) × perks × (heavy?1.65)`.
  `SCALE_MULT={S:1.0,A:.75,B:.55,C:.38,D:.22,E:.08}`.
- `playerStrike(p,heavy)`: reach/arc; sneak mult (`w.sneakMult||2`; dagger+`sn_2`→6;
  `sn_4`×1.5) when target idle/patrol/return; enchant `edmg/leech/bonusVs` riders;
  → `applyDamage`.
- `applyDamage(e,info)` order: boss gate (`def.boss && !engaged`→0) → phys
  `50/(50+armor·2.5)` / resist `1−res/100` → `bonusVs` tag ×1.3 → enemy block ×0.25
  → element riders (status, `shock` flat) → hp → poise → stagger (0.65s, boss 1.1s)
  → `killEnemy` / `bossFelled`.
- `playerShoot`/`projectileHit`: bow dmg ×power, `ar_4` crit; spell projectiles grant
  destruction XP, apply frost/burn (×2 with `de_3`).
- `killEnemy`: stats, bestiary, `Game.onBountyKill`, embers `round(def.embers·
  (elite?3:1)·emberMult)`, `U.weighted` loot + `def.drops`, `QS.onKill`. `bossFelled`:
  `G.slainBosses`, drops, `def.grantsEdict`→`learnEdict`, `QS.onBoss`.

**Enemy → player** (`enemyHitPlayer`/`projectileHitPlayer`/`explode`/`Hazard` →
`damagePlayer`): i-frames → parry (non-boss) → block/guard-break → ward → armor
`80/(80+armorTotal())` / resist (cap 80) → status riders → poise/stagger
(small-hit immunity with `ha_4`) → **Undimmed** (`re_4`, `!undimmedUsed`: hp=1,
iframes 1.2) → else `G.onPlayerDeath()`.

**Status** (`tickStatus(ent,dt)`, both sides): timers `{burn,poison,frost,bleed}`,
refresh-to-max; DoT burn 6/s, poison 4/s, bleed 5/s; frost = movement slow only
(player ×0.6, enemy ×0.55); `shock` = instant flat damage, never a timer.

---

## 6. Quests — `quests.js` (`QS`, `SIGIL_ITEMS`)

State on `p.quests[id]={stage,counts{},done}`; `stage(id)` returns `-1|0..n|999`.
`SIGIL_ITEMS = ["sigil_grave","sigil_mire","sigil_frost","sigil_ash"]`.
- `start(id)` (toast, hooks, retro boss-credit), `advance(id)` (clears counts),
  `complete(id)` (**consumes collect items**, grants `rewards{gold,embers,items,
  flaskUp}`, sets `completeFlag`), `hooksFor(id,stage)` (stage-entry side effects,
  e.g. reveal Warden POIs).
- Event hooks (from combat): `onKill(typeId)`, `onBoss(bossId)`. `onTalk` is a
  near-noop — **talk stages advance via dialogue `action`s** in data_dialogue.js.
- `update()` (polled from main/ui) handles `collect/sigils/flag/flags/reach`.
- Journal/compass: `objectiveText(id)` (live `(cur/N)`), `journalEntries()` (main
  before side), `currentTargetPoi()` (compass star), `sigilCount`, `flagCount`.

Driven mainly by **data_dialogue.js (~90 `QS.*` call sites)** + main.js polling +
combat kill/boss hooks.

---

## 7. Content data tables

### data_items.js
- `ITEMS` (the spine, 7 consumers). Common fields: `name,type,weight,value,rarity,
  lore` + injected `id`. `type ∈ weapon|bow|staff|shield|armor|trinket|consumable|
  ingredient|material|tool|key|currency`.
  - weapon: `wclass(1h|2h|dagger|spear), skill(onehand|twohand), dmg,spd,reach,stam,
    poiseDmg, scale{str/fin/wil→S..E}`, opt `twoHanded,edmg{el:n},bonusVs,sneakMult,
    leech`.
  - bow: `skill:"archery",twoHanded, dmg,spd,stam,poiseDmg, scale{fin}`.
  - staff: `skill:"destruction", spellPower (×spell power), scale{wil}`.
  - shield: `skill:"block", block(%), stability`, opt `edef`.
  - armor: `slot(head|body|legs), kind(light|heavy), armor`, opt `edef{el:%},
    sneakBonus`.
  - trinket: `slot:"trinket", bonus{hpRegen|magRegen|maxMag|stamRegen|poise|maxHp}`.
  - consumable: `use{hp|stam|mag|embers|cure(string)|buff{id,dur,…}|throw{dmg,dtype,
    radius}}` — unrecognized `use` keys ignored.
- `SCALE_MULT`, `RECIPES_SMITH/COOK/ALCH` (`{out,mats{id:qty},skillReq,note?}`;
  mats qty `0` = catalyst flavor), `HONE_TIERS` (3, +8%/tier), `ENCHANTS`
  (`{slot:"weapon|armor",mats,embers,desc,+effect: edmg|edef|leech|bonusVs|armor|
  maxHp|maxMag|stamRegen}`), `LOOT` (`chest_common|fine|rare`), `FISH_TABLES`
  (biome#→`[{w,id}]`).
- Elements `{fire,frost,shock,poison}`, rarities `{common,fine,rare,unique}` are
  global vocabularies. The Ember Flask is NOT an item (lives on the player).

### data_spells.js
- `SPELLS`: `name,school(destruction|restoration|conjuration),skill,cost,cast,kind,
  color,desc,id` + `learn:"start"|price`. `kind ∈ bolt|nova|self|summon`:
  bolt `{dmg,dtype,speed,radius,slow?,magBurn?,pierce?}`, nova `{dmg,dtype,radius}`,
  self `{heal|buff|cure(ARRAY)}`, summon `{summon:"sprite|lantern",dur}`. dtypes
  `fire|frost|shock`. ⚠ spell `cure` is an array (item `use.cure` is a string).
- `EDICTS` (the 4 shouts, ids `val/suth/kyr/thur`): `name,key("1".."4"),cooldown,
  kind,color,desc,source`. `kind ∈ force{range,arc,dmg,knock}|drain{range,dmg,heal}|
  time{dur,factor→G.slowmo}|breath{range,arc,dmg,burn}`. Hard-coupled to `sigil_*`
  items + the four Warden bosses.

### data_perks.js
- `SKILL_DEFS[skillId]={name,attr,desc,perks:[{id,name,req,desc}]}` — exactly 4
  perks/skill, req 10/25/45/70, ids `<2-letter>_<1..4>` (`oh_*,th_*,ar_*,bl_*,la_*,
  ha_*,de_*,re_*,sn_*,sm_*,al_*,sp_*,en_*`). **Effects are NOT data-driven** —
  each perk only does something if a `p.hasPerk("id")` branch exists in
  combat/player. `desc` is decorative.
- `ATTR_DEFS` (6: vig/end/mnd/str/fin/wil). `ORIGINS[id]={name,tag,desc,attrs{},
  skills{},gear{slot:itemId},items[[id,n]],spells?[]}` (4: marchwarden/hexen/stray/
  hewer). `gear` keys must be valid equip slots; referenced item/spell ids must exist.

### data_enemies.js
- `ENEMY_TYPES[id]`: `name,hp,dmg,spd,r,reach,windup,strike,recover,poise,poiseDmg,
  armor,resist{el:%},aggro,deaggro,embers,behavior,tags[],look{shape,body,trim,size,
  …flags},loot[],voice` + opt `edmg,proj{dmg,dtype,speed,color,cd},regen,canBlock,
  drops[[id,n]],dropsOnce`. `behavior ∈ melee|lunger|archer|caster|swarm|flee`;
  `look.shape ∈ beast|blob|wisp|crawler|humanoid`. Load-bearing tags: `critter`
  (no scaling/elite), `spirit` (blades pass through), `undead` (silver `bonusVs`).
  `loot` ends with a bare `{w}` miss-weight.
- Boss adds `boss:true,title,intro(ALLCAPS),patterns[],phase2{at,spdMult,announce,
  addPatterns[]},drops,grantsEdict?(val/suth/kyr/thur),mini?`. Pattern `kind ∈
  swing{range}|slam{range,radius,dmgMult,leaves?(poison_pool|fire_field|frost_field)}|
  charge{minRange,dmgMult}|volley{count,aimed?,proj{…,arcSpread?}}|summon{type,count,
  max}|breath{range,arc,dmg,dtype}` — engine in entities.js. Damage-immune until
  `engaged`.
- `SPAWN_TABLES[biome] = [{w,id,pack:[min,max]}]` (keys = BIOME_TABLE_KEYS +
  `whitepass`). `GAUNTLET_WAVES = [[[enemyId,count],…], …]`.

### data_lore.js
- `BOOKS[id]={title,author,text}`. `injectBooks()` (ui.js) turns each into a
  carryable `book_<id>` item and stocks vendors; `readBook` renders escaped text
  (no HTML, `*emphasis*` literal). Voice: literary, aphoristic; keep cosmology
  consistent (First Ember dying → Emberborn sparks → Pale King Maerodric hoards it).

### data_quests.js
- `QUESTS[id]={name,type(main|side),stages:[{journal,objective}],rewards{gold,embers,
  items,flaskUp},rewardText?,completeFlag?}`. `objective.kind ∈ talk{npc}|kill{enemy,
  count}|collect{item,count}|reach{poi}|boss{boss}|sigils{count}|flag{flag}|
  flags{prefix,count}` + `hint,targetPoi?`. ids `mq_*`/`sq_*`. Referenced enemy/npc/
  item/poi ids must exist. `kill`/`flags` hints need literal `(0/N)`. `talk` stages
  need a dialogue `action` to advance. `collect` items consumed on complete.

### data_dialogue.js (most code-heavy data file)
- `NPC_DEFS[id]={name,town,role,look{body,trim,hair},shop?{stock[],spells[]},bark}`.
- `DIALOGUES[id]={entry:[{cond:(p)=>bool,node}],nodes:{key:{text,choices:[{text,next,
  cond?,action?,cls?}]}}}` (same key as NPC_DEFS). entry = first-passing-cond wins,
  end with `{cond:()=>true,node:"hub"}`. choice `action(p)` runs before nav; if it
  changes `G.state` (opens station), set `next:null`. `cls:"persuade"` + `cond:p=>
  p.canPersuade()` for persuasion (`hasPerk("sp_2")` or speech≥40). Action vocabulary:
  `QS.start/advance/complete/stage/sigilCount`, `UI.openShop/openCraft`,
  `World.revealPoi`, `G.flags.x=`, `G.msg`, `G.restAtInn`, `p.addItem/removeItem/
  hasItem/gainSkill("speech")/learnEdict/gold+=`.

---

## 8. Renderers — `render.js` (`Render`) and `render_fp.js` (`RenderFP`)

Dispatch in `main.js`: `G.viewMode==="fp" ? RenderFP.draw() : Render.draw()`. Both
draw to `G.ctx`. **No image assets** — everything is procedural canvas vectors,
reused across views by drawing into scratch canvases. **FP depends on Render**
(`Render.drawDeco/drawEntity/weather/hud`, `TILE_COLORS`) — keep those signatures
stable.

**Top-down (`Render.draw`)** passes: integer camera → terrain chunks → animated
tiles → statics → corpses → birds → fishing line → short deco → **y-sorted
entities** (`drawEntity` dispatches by class then `look.shape`) → tall deco/canopy
→ projectiles → particles → `lighting()` (offscreen darkness + `destination-out`
punches) → `weather()` → floats → lightning → `hud()` → crosshair.
- Chunk cache `Render.chunkCache` (Map, `CHUNK=16`, pseudo-LRU cap 110); key
  `mapId:cx,cy`. `paintTile` builds terrain (transitions only for `t<=T.BRIDGE`).
  **Invalidation = `Render.chunkCache.clear()`** (`invalidateChunks` is dead code);
  runtime tile edits won't show until cleared.
- `drawEntity` early-outs ±80px; facing eased via `visFacing(e)` (`_vf`), with FP
  override `e._fpFace`.
- `hud()` (canvas, both views): vignette, HP `#a8392f`/stamina `#5d8a42`/magic
  `#3a6ea8` bars, embers/gold/flask/status text, bottom loadout, `compass()`,
  `minimap()` (prebaked `minimapCanvas`/`buildMinimap`), clock, objective tracker,
  optional frame meter. **Boss bar is DOM** (ui.js), not here.

**First-person (`RenderFP.draw`)**: internal `Uint32Array buf32` buffer (480/640/854
wide by `renderScale`). `FP_WALLS={WALL_WOOD,WALL_STONE,VOID,SNOWROCK}`,
`FP_MAXDIST=48`, `FP_WALL_H=1.6`, `FP_EYE=0.62`. Camera = player `facing` (yaw) +
`fpPitch` (clamped ±0.3) + head-bob/sway; `fov` field is `tan(halfangle)` (degrees
setting converted per frame). Order: ambient/fog/sky → per-row tables → DDA raycast
columns (wall texturing + sun-face light + fog) → sky/ceiling → floor casting
(hardcoded tile IDs: water 0/1, lava 17, oob 18) → celestials → starfield → light
pools → **billboards** (`gatherSprites` reuses `Render.drawEntity` at 2× into a
sprite cache keyed per fog bucket, cap 420; billboard cap 260; span-batched) →
birds/bobber → upscale → projected particles/floats → **viewmodel** (weapon by
`p.atk.phase` + `wclass`) → damage flash → shared `Render.weather/hud`.
- Adaptive `autoRes()` (hysteresis on frameMs EMA) only when `renderScale==="auto"`;
  `maxDist` near=36/far=48/vfar=64.

**Settings hooks:** FP-only `fov,viewDist,grain,sens,invertY,renderScale`;
both-views `screenShake,showFps,showDamage`. `G.darkness()` drives all
ambient/lighting; `G.weather`/`G.lightning` shared.

**Adding a tile type** → `TILE_COLORS` (`render.js`) + `paintTile` + `animatedTiles`
+ FP `FP_WALLS` (if solid) + FP floor magic numbers. **Adding an entity** →
`drawEntity` branch + FP `gatherSprites`/`shapeH`; light via `lightR`/`lightColor`.

---

## 9. UI — `ui.js` (`UI`)

`UI.init()` wires title buttons + generic `.menu-tab` clicks (`menuTab=
dataset.tab; renderMenu()`) and runs `injectBooks()`. State: `menuTab,selItem,
dlg{npcId,node},shrine,enchSel,chosenOrigin,bookOnly`.

Screens (builder → DOM target):
- Pause menu shell `openMenu/closeMenu/renderMenu` → `#menu-screen`/`#menu-content`;
  tabs: `renderInventory` (`#inv-detail`), `renderEquipment`, `renderCharacter`,
  `renderSkills` (perk trees), `renderMagic` (spell/edict equip), `renderJournal`
  (+bestiary), `renderMap` (`#worldmap-canvas`), `renderSystem` (settings + save
  slots; writes `G.settings` + `saveSettings`).
- Dialogue `openDialogue/renderDialogue/closeDialogue` → `#dialogue-box`/`#dlg-*`.
- Shrine `openShrine/renderShrine` → `#shrine-*` (modes main/level/travel:
  `restAtShrine`/`newCycle`/`fastTravel`/`levelUp`).
- Stations (all share `#station-screen`/`#station-panel`, `station` state):
  `openShop/renderShop`, `openCraft/renderCraft` (smith/alch/cook + honing),
  `openBoard/renderBoard` (bounties), `openEnchant/renderEnchant`, `openBook`,
  `openLoadList`, `openEndingChoice`.
- Boss bar `showBossBar/updateBossBar/hideBossBar` → `#boss-bar`/`#boss-name`/
  `#boss-bar-fill` (this is the DOM boss bar). Endings `runEnding` →
  `#ending-*`. Help `showHelp` → `#help-*`.

World ticks only in `play|dialogue|dead`, so opening menu/shrine/station/help
**pauses** the world (dialogue does not). `openMenu` nulls `p.draw`/`slowmoAim` and
exits pointer lock.

**Add a menu tab**: button in `index.html` + `case` in `renderMenu` + `renderX()`.
**Add a station**: `openY()`→`setState("station")`+render `#station-panel`+close→
`closeStation()`; reach from `Game.interact`/dialogue action.

---

## 10. Loop, input, audio, save

### main.js (`Game`)
- `boot()`: loadSettings → canvas/ctx → `RenderFP.applySettings` → `Input.init` →
  `Render.init` → `UI.init` → `fitScreen` → `Music.setMood("title")` → rAF loop.
- `loop(t)`: rAF first; `dt=min(0.05,…)` + `G.rdt` (real dt); `handleMetaKeys()`;
  **hitstop** zeroes world dt; if state∈`play|dialogue|dead` & dt>0 → `updateWorld`;
  render (FP/top) + `UI.updateBossBar`; photo mode; `Input.endFrame()` **last**.
- `updateWorld(dt)`: slowmo decay → `updateClock` → `p.update` → entities (within
  1300px; `slowmoAim` scales enemy dt to 0.55) → projectiles → FX → spawners →
  corpse age (>10s) → `QS.update()` (every 30f) → gauntlet/fishing/birds → ambient
  particles (cap 480) → music mood poll (every 90f) → region banner → interact
  prompt (`findInteractable` → `interact` on E).
- `handleMetaKeys()`: per-`G.state` key routing (V toggle, Tab/I/M/J/C/Esc menus).
- Session: `newGame(name,origin)`, `loadGame(slot)`, `newCycle()` (NG+).
- Maps: `enterMap(id,x,y)`, `usePortal` (lockedBy crypt_key/sigils), `fastTravel`.
- Interaction: `findInteractable()` (distance + FP look-angle weighting; kinds
  shrine/npc/chest/pickup/portal/vault/well/campfire/waylamp/passcairn/gauntlet/
  enchant/board/grave/statue/embers/fish) → `interact(t)` switch.
- Death: `onPlayerDeath()` (drops `G.lostEmbers`, zeroes embers, `setState("dead")`,
  3.6s → `respawn()`); `respawn()` (restore, `restReset`, enterMap, **save**).
- Clock: `updateClock(dt)` (`hour += dt/30`, weather + lightning).
- Subsystems: fishing, **bounties** (`genBounty/refreshBounties/onBountyKill`),
  **Gauntlet** (`startGauntletWave/updateGauntlet`), `restAtShrine` (the save rite:
  restore, `restReset`, +1h, refresh bounties, **save**).

### input.js (`Input`, `BINDS`)
- `BINDS`: up `W/↑`, down `S/↓`, left `A`, right `D`, turnL/R `←/→`, toggleview `V`,
  sprint `Shift`, roll `Space`, interact `E`, flask `R`, quickuse `T`, photo `P`,
  crouch `Ctrl/X`, cast `Q`, aim `F` (hold), edict1-4 `1-4`, menu `Tab/I`, map `M`,
  journal `J`, character `C`, pause `Esc`. **Attack/block are mouse** (not in BINDS):
  light `mouse.pressed`, heavy `mouse.down`, block `mouse.rdown`+shield.
- `act(name)` (held), `pressed(name)` (one-frame edge, cleared by `endFrame()`).
  `mouse{x,y,down,pressed,rdown,rpressed}`. `applyLook(dx,dy)`: `facing+=dx·0.0028·
  sens`, `fpPitch` clamped, `·invertY`. `worldX/worldY` (FP: 220px ahead). Pointer
  lock requested on first FP click. `audioInit()` on first input.

### audio.js (`Sfx`, `Music`, `audioInit`)
- `audioInit()`: one `AudioContext` (`master 0.55 → music 0.4 / sfx 0.9`); gated by
  browser autoplay (first input). Headless smoke test leaves `AudioContext`
  undefined → audio inert.
- `Sfx.play(name)` (gated by `settings.sfx`): synth from `SFX_TABLE[name]` recipe
  `[type,f0,f1,dur,vol,noise]`; `die_<base>` prefix = pitched-down death variant;
  50ms throttle. Names include swing/hit_flesh/hurt/block/parry/guardbreak/roll/
  step/bow/cast/explode/slam/breath/flask/equip/deny/pickup/coin/chest/door/shrine/
  levelup/skillup/quest/edict/kyr/death/growl/roar/hiss/thunder/shutter/ui …
- `Music.setMood(mood)` (gated by `settings.music`; `null` silences): generative
  chords from `MOODS[mood]` (`title/world/town/dungeon/boss`); boss adds thumps.
  Chosen by context (enterMap, safe-zone poll, death, boss).

### save.js (`SaveSys`, `SAVE_PREFIX="clauderim_save_"`)
- 3 slots (`slotKey(slot)=SAVE_PREFIX+1|2|3`). **Deltas only** — geometry regenerates
  from `seed`. `save(slot)` serializes `{version:1,savedAt,seed,time,mapId,viewMode,
  cycle,regionName,player(serialize()),flags,openedChests,slainBosses,
  discoveredShrines,discoveredPois,lostEmbers,bounties,mapState(collectMapState:
  per-map encDead/taken/revealed)}`. `load(slot)` restores scalars/deltas,
  `Player.deserialize`, regenerates overworld, replays mapState; **returns mapId**.
  No migration code — `load` defaults (`||{}`) are the only forward-compat.
- **Autosave**: `restAtShrine`, `respawn`, `newCycle`, ending "continue". Settings
  saved separately (`G.saveSettings`, key `clauderim_settings`).

---

## 11. test/smoke.js — the headless gate

`node test/smoke.js` (only Node built-ins `fs/path/vm`). Scrapes `<script src>`
from `index.html`, builds shims (`document/window/localStorage/canvas` — canvas
ctx is a no-op Proxy; `window.AudioContext=undefined`), `vm`-evals each file in
order into one persistent context (top-level `const`/`class` are visible across
evals). Helpers: `check(label,cond)` (143 assertions; `failures` → `process.exit(1)`,
else "ALL SMOKE TESTS PASSED"/exit 0), `run(code)` (eval into context), `frames(n)`
(drives rAF; throws if the loop stops scheduling).

Exercises the full lifecycle (boot → newGame → movement/dialogue/combat/craft/level/
shrine/portal/boss/sigils/death/respawn/save-load → NG+/endings → FP raycaster math
→ 1200-frame soak). **Not covered:** pixels, audio, real DOM/CSS, real input events,
wall-clock timers.

**Breaks the test if you:** touch `document/window/canvas/audio` at module load time
(must be inside functions); change a signature it calls; change a baked invariant
(10 shrines / 11 NPCs / 9 portals / honing +2=1.16× / quest stages 0/1/2/3/4/999 /
specific ids); or stop the main loop scheduling rAF. **Add a test** by appending a
section: `run("…setup…")` then `check(label, run("…expr…") === expected)`; stash
multi-step results on `G` scratch keys.

---

## 12. Cross-file identity reference (rename = multi-file change)

| id kind | defined in | referenced by (string) |
|---|---|---|
| item id | `ITEMS` | combat/player/ui/render, recipes, loot/drops, ORIGINS.gear/items, quest rewards, `book_<id>` |
| enemy/boss id | `ENEMY_TYPES` | SPAWN_TABLES, GAUNTLET_WAVES, summon `type`, `bossArena.boss`, quest enemy/boss, bestiary |
| spell/edict id | `SPELLS`/`EDICTS` | combat, ui, ORIGINS.spells, `grantsEdict`, BINDS (edict keys) |
| perk id (`oh_1`…) | `SKILL_DEFS` | `p.hasPerk("id")` in combat/player (silent if missing) |
| skill / attr / equip-slot key | `data_perks`/`player` | combat scaling, ORIGINS, ui, save schema |
| quest id (`mq_*`/`sq_*`) | `QUESTS` | data_dialogue (~90 `QS.*`), quests.js hooks |
| npc id | `NPC_DEFS` = `DIALOGUES` key | quest `npc`, entity spawns, `QS.onTalk` |
| node key | `DIALOGUES[npc].nodes` | same tree's `next`/`entry.node` |
| POI id | World `poiList` | quest `poi`/`targetPoi`, `World.revealPoi` |
| story flag | quests/dialogue | `flag`/`flags` objectives, `G.flags` checks, `ending_chosen` |
| tile/biome enum | `world.js` `T`/`B` | baked `Uint8Array` maps, both renderers (FP magic numbers) |
| namespace (`QS`,`Combat`,`World`,…) | each file | every consumer (e.g. `QS` ~90×) |
| serialize field | `Player.serialize`/`SaveSys.save` | must match `deserialize`/`load` + default |

Runtime contracts to preserve: `QS.stage()` → `-1/0..n/999`; bosses need
`e.engaged` to take damage; `look.shape` ∈ the five render shapes; data tables
auto-inject `.id`; `Input.endFrame()` runs last; `G.dt` (game) vs `G.rdt` (render).
