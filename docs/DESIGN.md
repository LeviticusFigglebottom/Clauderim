# CLAUDERIM — Systems Design

How the Skyrim and Dark Souls inheritances are fused, and the numbers behind them.

## Design pillars

1. **Stamina is the verb budget** (Souls). Every meaningful action — attack, block, roll,
   sprint — spends from one green bar. Mistakes are stamina debts that arrive as damage.
2. **Growth by doing** (Skyrim). Swing axes → axe skill rises. Get hit in plate → Heavy
   Armor rises. Skills gate perks; perks change *how* you play, not just numbers
   (wider parry windows, time-dilated aiming, cheat-death).
3. **Risk-carried wealth** (Souls). Embers are XP-currency carried on the body. Banking them
   (leveling at shrines) is the only safety. Death stakes them in the world.
4. **The rest contract** (Souls). Shrines give everything — heal, flask, save, travel — and
   take one thing: the world wakes back up.
5. **Lore lives in objects** (both). Every item has a voice line of setting; books are
   the deep archive; NPCs only know what their region would know.

## Combat resolution

### Player → enemy

```
dmg = weapon.dmg
    × (1 + Σ scaleMult[letter] × (attr − 8) × 0.035)     # S=1.0 A=.75 B=.55 C=.38 D=.22 E=.08
    × (1 + skillLevel × 0.005)
    × perk multipliers
    × 1.65 if heavy
    × sneak multiplier if target unaware (×2–6, daggers up to ×9 with perks)
then: armor 50/(50+armor×2.5), elemental resist %, tag bonus (silver vs undead ×1.3)
then: poise -= poiseDmg → stagger at 0; bosses stagger too, at 200–350 poise
```

### Enemy → player, gauntlet order

1. **i-frames** (roll): negate. Roll i-frames 0.34s/0.28s/0.20s by load tier (<40%/<75%/≤100%).
2. **Parry**: blocking begun within 0.18s (×1.5 with Riposte) of impact, attacker non-boss →
   attacker staggered 1.6s, no damage.
3. **Block**: frontal 100° → damage × (1 − block%) at a stamina cost scaled by shield
   stability; stamina exhausted → guard break (unless Bulwark).
4. **Ward/armor/resists**, then **status riders**, then **poise check**, then **Undimmed**
   (once-per-rest 1-HP save) before death.

### Boss engine

Bosses are data-driven pattern lists (`swing / slam / charge / volley / summon / breath`)
with per-pattern cooldowns and range gates, plus a phase-2 trigger at ~50% HP that adds
patterns and speed. Arenas seal while the boss lives. Telegraphs: 0.5–1.0s red-flash windups,
extended ×1.6 for slams and breaths.

## Economy tuning

- Level cost: `floor(80 × level^1.55)` embers (Souls-curve).
- Skill XP to next: `80 + 14 × level`; a perk point every 5th skill level.
- Common enemies: 11–160 embers; Wardens 1.5k–3.4k; the Pale King 8k.
- Shops buy at 40% of value. Flask heals 60, 3 charges base, +1 from the Lampwright's quest.

## World generation

- Overworld: position-zoned biomes with fBm-wobbled borders (so handcrafted POI coordinates
  always land in the right biome), fBm detail for trees/rocks/water, lakes from a low-pass
  noise field, ocean ring, greedy jittered roads that bridge water.
- Interiors: rooms-and-corridors (keeps, crypts, the Citadel) or 4-pass cellular automata
  with largest-region flood fill (caves, the chapel, the Matron's Hollow); guaranteed
  entrance→boss corridor; pre-boss shrine; chests, encounters and reagents seeded
  deterministically from `worldSeed ^ hash(mapId)`.
- Spawning: coarse spawner grid (24-tile pitch) with biome tables, active in a 380–1000px
  annulus around the player, suppressed near towns; camps get heavier dedicated spawners.

## Performance notes

- Terrain renders from 16×16-tile cached chunk canvases (LRU ~110).
- Enemies beyond 1300px are frozen; particles capped at 600; corpses fade in 10s.
- Lighting is a single offscreen darkness layer with `destination-out` radial punches.
- The world minimap is baked once per seed at 1px/tile.

## Second-pass systems

- **Weapon honing** at any forge: +8% damage per tier, three tiers
  (iron → steel → silver/ember costs). Stored per weapon id on the player.
- **Cooking** at campfires (camps, towns, the inn hearth): hunted meat becomes
  travel food with regen buffs. Wildlife (deer, hares) flees, drops meat and hides.
- **Ashen elites**: ~7% of overworld spawns roll elite — ×1.7 HP, ×1.4 damage,
  ×3 embers, smoldering aura. Never wildlife.
- **Quick belt**: a 6-slot belt that auto-fills with consumables as you find them;
  cycle the active slot with the mouse wheel or **[ ]** and use it with **T**. Weapons
  and spells can be hand-assigned to slots for quick-swap (inventory / Magic menus).
- **Grave-searching** in crypts: 40% goods, 32% dust, 28% the tenant objects.
- **The Undermarch**: hidden 78×78 super-dungeon under the Great Sink, with three
  questable way-lamps and the optional superboss *Echo of Ald* (Aldsbane,
  Circlet of the First).
- **NPC schedules**: townsfolk hold day posts and walk home at 21:00.
- **AI honesty**: ranged enemies need line-of-sight; melee steers around
  obstacles; rear approach halves detection; dormant bosses are damage-immune
  (no gate-sniping); KYR slows enemy attack timers, not just their feet.
- **Feel**: hit-stop on heavy connects/parries/boss kills, low-HP vignette,
  sealed-arena fog walls, terrain edge blending, canopy sway, footstep
  animation, biome ambient motes (fireflies, drifting embers, frost glints,
  marsh spores), compass/minimap pips for lost embers.

## Persistence model

Geometry is never saved — it regenerates from the seed. Saves store only deltas:
player serialization, clock, flags, opened chests, slain bosses, discovered shrines/POIs,
per-map dead encounters and taken pickups, and any lost-ember stake.
