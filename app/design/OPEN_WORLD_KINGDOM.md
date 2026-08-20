# Iron Holdfast — Open World Kingdom

**Design intent:** evolve Iron Holdfast from a single-siege RTS into an open-world-with-armies strategy game in the spirit of Mount & Blade II, Total War, Stronghold, and Conqueror's Blade — original code, no proprietary assets. The player walks a living overworld, raises and commands armies, feeds them or they desert, fights rival lords, and besieges keeps to take the map.

**Constraints (hard):**
- `src/logic.js` stays pure: no `Date.now()`, `Math.random()`, imports, timers (enforced by `bun run check:logic`). All randomness from the seeded map RNG.
- Real-time loop drives through `room.ts` `wakeIn`/`onWake` (TICK_MS = 500).
- Client renders with Canvas2D only; all art/audio procedural.
- Every slice ships with vitest coverage; 54+ tests must stay green.
- Single-player first; the room protocol and `viewFor` contract remain backward compatible.

---

## 1. Vision & core loop

The macro loop, one "kingdom run":

1. **Walk the world** — your army (lord + troops) moves freely on an open overworld map with terrain (plains, forest, hills, river crossings, mountains).
2. **Raise armies** — visit towns/villages to recruit troops (spearmen/archers/knights), buy food and supplies.
3. **Manage supply** — every troop eats per day; armies starve, lose morale, and desert without food.
4. **Battle rivals** — enemy lords roam with their own armies; intercept them for open-field battles (resolving through the existing battle engine), or avoid them.
5. **Siege keeps** — attack enemy towns/keeps; successful sieges convert regions to your faction.
6. **Take the map** — conquest win condition: own >X% of regions, or destroy the enemy capital.

Session framing: a full kingdom run is one "campaign" — the existing siege defense remains as the keep-defense layer within the player's home region.

---

## 2. The world

- **Map:** deterministic seeded grid (reuse `rngFrom(seed)`), e.g. 60×40 tiles for slice 1, expandable.
- **Regions:** the grid is partitioned into ~8–12 named regions; each region has exactly one **settlement** (village/town/keep) that can be owned by the player or an AI lord.
- **Terrain tiles:** plains (fast), forest (slow, ambush cover), hills (defensive), river (crossing at fords only), mountain (blocked), road tiles (fast travel) connecting settlements.
- **Lords:** 3–5 rival lords with home settlements, one army each, personalities (aggressive/defensive/raider). They roam, raid, garrison, and pursue the player if strong.
- **Day/night + seasons (later slices):** travel speed and supply use scale; not in slice 1.

## 3. Armies

- An **army** = 1 lord + N troop squads (each squad = type + count + morale + supply burden).
- Army capacity grows with rank (slice 2: commander progression).
- **Formations & commands (slice 2):** reuse existing formation/commander AI on the world map for battle resolution.
- **Battle resolution:** when two armies meet, the battle plays out in the existing real-time engine (`setup`/`tick` with both armies as combatants) rather than an abstract dice roll — keep the drama.

## 4. Supply, food, desertion

- Every troop consumes food per tick while outside a settlement that has a granary.
- Food carried as army supply; settlements produce food over time.
- Supply chain: buy at settlements → carry → consume on march → resupply at friendly towns or by foraging (slower, riskier).
- Starvation: below zero supply → morale decays → units desert (routed home or to the nearest town) → army shrinks.

## 5. Travel & events

- Player issues march orders: click target tile → army pathfinds (BFS on terrain weights), moves per tick at terrain speed.
- **Encounter layer:** passing near enemy lords, forests, or fords can trigger events (ambush, forage success, toll). Events resolve deterministically from the seeded RNG.
- Movement continues while the player manages town/recruit screens — the world is alive.

## 6. Economy & recruitment

- Settlements: village (cheap food/recruits), town (all troop types + gear), castle (garrison + siege defense).
- Recruitment costs gold + region reputation; reputation from liberating/supplying regions.
- Player gold from taxes (owned settlements) + battle loot + trade (slice 3).

## 7. Factions & victory

- 4 factions: player's crown, 2–3 AI lords, and the **enemy camp** (existing wave system becomes the enemy faction's army).
- Victory: control 60% of settlements + destroy the enemy capital keep (the existing 600 HP camp).
- Defeat: player's capital keep falls (existing lose condition) or the player's army is destroyed while no settlement remains.

## 8. Architecture mapping (existing code)

| Concern | Where |
|---|---|
| Pure world sim (map, lords, armies, supply, travel) | `logic.js` — new pure functions + state fields, tick() advances world |
| Room loop / real-time | `room.ts` — unchanged; world advances in the same 0.5s tick |
| Wire protocol | `protocol.ts` — extend action types: `world_march`, `world_recruit`, `world_buy`, `world_attack`, `world_garriss`; `viewFor` adds `world` |
| Client render | `client.js` — overworld canvas pass (army tokens, settlements, terrain), world UI panel, minimap for world |
| UI shell | `index.html` — world/town screens, army panel, supply bar |
| Tests | `tests/logic.test.ts` (world/supply/travel), `tests/room.test.ts` (protocol), release certs |

## 9. Slice plan (each slice playable + tested)

- **Slice 1 (this build):** world map, player army token, 2 rival lords, settlement graph, march orders, BFS travel, supply/food consumption + desertion, minimal world render + HUD. Battles deferred to slice 2 (armies just intercept and stop).
- **Slice 2:** battle resolution between armies via existing engine, formations on the world map, commander progression/rank.
- **Slice 3:** recruitment/economy depth (taxes, trade, reputation), town screens, equipment.
- **Slice 4:** sieges of settlements with the existing wall/tower/building sim; region conquest; victory conditions.
- **Slice 5:** enemy capital campaign finale, seasons/days, events layer, save/resume of campaigns.

## 10. Acceptance criteria (slice 1)

1. `logic.js` stays pure (check:logic passes).
2. World map deterministic per seed; armies move toward march targets at terrain-correct speed.
3. Supply drains per tick while marching; desertion removes troops at zero supply.
4. Two rival lords roam deterministically (seeded AI).
5. Client renders world, army token, settlements, supply bar; march via click.
6. All existing tests stay green + new world tests pass.
7. Deploys to `iron-empire.higgsfield.app` when the platform backend recovers.

*End of design doc — slice 1 begins below.*
