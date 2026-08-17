# IRON HOLDFAST — real-time castle siege builder (mode S, jam scale)

A single-player REAL-TIME medieval castle-builder in the Stronghold 2 vein:
build a keep, run a population economy, raise walls and an army, and survive
(and destroy) an enemy warcamp that sends escalating siege waves. Plays like a
Stronghold 2 mission: constant pressure, no turns, one linear run to victory
or the fall of the keep.

Play clock: the room's alarm loop ticks the simulation in fixed 500 ms steps
(`TICK_MS`), running `logic.tick()` (an extra export alongside the six required
ones — permitted; the checker asserts presence, not absence). Every tick
advances `state.time`, runs production, population, unit AI and enemy AI
deterministically from a seeded PRNG; events the player must see go into
`state.events[]` and the client renders them as toasts/banners.

## §1 Profile

| Axis | Choice |
|---|---|
| Time | **real-time**, fixed server tick (0.5 s); pause via action |
| Space | discrete grid — wide map (32×22), tile-based |
| Player agency | god-hand + direct unit command (move orders, auto-engage) |
| Conflict | vs the enemy camp (waves of raiders and siege rams) + scarcity |
| Content | authored map generated from a seed (deterministic), fixed sprite kit |
| Outcome | win = destroy enemy camp · lose = keep falls (HP 0) |
| Players | solo (1 seat) — rooms + spectating kept for platform parity |
| Session | 8–20 min per run; reset replays with a fresh seeded map |
| Engagement | growth/accumulation (castle grows) + execution (micro of walls/units) |

**Strictness:** S. Determinism (§13.1) and smoke (reference route test) run
mandatory. **Budgets:** draw_call_budget ~150 (one canvas, prerendered tile
layer); worst-case scene = 32×22 map + 40 units + 12 projectiles → target 60 fps
on desktop; pixelRatio cap 1.5.

## §2 Laws — patterns to learn (in order)

1. **Chain the economy**: a production building needs a worker (population)
   and food feeds workers; build houses to raise the cap, then farms.
2. **Walls change everything**: enemies breach stone at a cost — walling the
   approach wins time; towers are the damage, walls are the time.
3. **Diversify or starve**: gold pays soldiers, food pays bread, wood builds
   scaffolding — a one-resource economy collapses at the first big wave.
4. **Go finish it**: waves escalate each time the camp survives; the run is a
   race between your siege of the camp and its siege of you. (Comeback test:
   down to a keep at 20 HP a wall + towers + 6 spearmen can still flip it.)

**L2 checks:** every building placed → visible tile change → income per tick →
unit trainability. **L4:** raids can't kill you before warning (banner at camp
mustering) → the undecided horizon is the wave timer vs your siege progress.

## §3 Concept

**Formula:** the player feels like the castellan of a castle under creeping,
inevitable siege, because the game visibly spends their last-resource decisions
(wall vs food vs army) and then tests them with a wave that levels the exact
thing they skimped on.

Pillars: **mechanics** is load-bearing (economy → wall/army → siege); aesthetics
(single painterly medieval kit, warm light) supports readability — the two
factions are red-vs-blue tokens at a glance; **story** from the wave banners
("The North March musters…"). Tech: deterministic 0.5s-tick server sim; the
client is a pure renderer of the authoritative view.

## §4 Verbs

| Verb | Object | Immediate effect | Later consequence |
|---|---|---|---|
| build | building type × buildable tile | sprite appears, gold/wood spent | income per tick, train unlock |
| move | units (boxed) → tile | pathing order issued | engage timing, flanking |
| train | unit types in barracks | gold/food spent, spawn at keep | damage per tick in fights |
| pause | — | alarm loop halts | no progress while away |
| (auto) | workers/enemies | ai: produce / march toward camp/castle | rations, wave arrival |

Strong: **build** (terrain, adjacency, 4 resources, walls) and **siege race**.

## §5 Prototype (routes in vitest; analytic checks here)

Balanced by table (checked once in tests):

| Building | Cost | Production/tick | Workers |
|---|---|---|---|
| House | 10 wood, 5 gold | +2 pop cap | 0 |
| Farm | 15 wood | +1 food (worker) | 1 |
| Woodcutter | 10 wood | +1 wood | 1 |
| Quarry | 25 wood, 10 gold | +1 stone | 1 |
| Iron mine | on iron vein | +1 iron | 1 |
| Gold mine | on gold vein | +1 gold | 1 |
| Barracks | 15 wood, 20 stone | train spearmen/knights | 0 |
| Wall | 8 stone | HP 100, blocks | 0 |
| Tower | 25 stone, 15 wood | HP 120, +2 dmg/ticks | 0 |
| Keep (given) | — | HP 200, spawn | 0 |
| Camp (enemy) | — | HP 600, waves scale ×1.25 | 0 |

Units: Spearman (gold 5, food 1, HP 20, dmg 2, upkeep 1/20s), Archer (gold 8,
wood 3, HP 12, dmg 3 ranged, upkeep 1/25s), Enemy raider (HP 10, dmg 2), Enemy
siege ram (HP 60, dmg 8 vs walls; slow). Upkeep eats gold per tick; starving
gold ⇒ wage default, units refuse orders at −50.

**Sanity constants:** keep 4×4-times exposed; first wave ~tick 120 (60s) with
6 raiders; camp waves escalate size +8/tick every 75 s; destruction of camp
ends the run (no endless).

## §6 determinism & rules

Every piece of game time is `state.time` advanced by fixed ticks; all rolls
come from a Mulberry32 PRNG (state.rng) advanced explicitly. No Date.now,
Math.random, timers or imports in `logic.js`. `state.events[]` drains into the
client. Everything is JSON-serializable.

## smoke (test in tests/room.test.ts)

1. join → playing immediately (1 player)
2. build house + farm ⇒ population +1; 20 ticks ⇒ food, wood increase
3. mine + barracks; recruit spearman → unit spawns
4. tick until first wave → enemies active, keep loses HP only if knocked
5. ensure that on keep 0, `isGameOver` → over

## Thresholds

- First wave must allow ≥ 6 free spawns (no PvP insta-loss).
- x victory ≥550 enemies destroyed across a full route — no soft lock.
- logic hostile to cheating: only validated build/recruit/move actions reach
  set; validate rejects illegal tiles, unaffordable builds, off-map moves.