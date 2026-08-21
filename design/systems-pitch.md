# OPEN-WORLD KINGDOM — Systems Pitch

Slice: one lord, one army, one world. Builds on src/logic.js (genWorld / worldPath / stepWorld; army + 2 rival lords; W toggle).

## Core loop

Each day (40 ticks) the player reads the world and commits one action: march to a tile, resupply at a settlement or depot, build, or hold/tax. Marching spends supply (plain 1 / rough 2 per tile). stepWorld then ticks: supply drains, desertion bleeds the army at max(1, floor(.2T))/day at 0 supply, settlements mint gold, and the two rival lords move, seize settlements, and raid your camp. Gold from taxed controlled settlements funds resupply and builds; builds (garrison, depot) hold settlements and extend army reach; held settlements pay taxes. The loop closes on the win-state — control every settlement and destroy the rival camp — or on loss when the army dies or the camp falls. Every choice is a supply-vs-gold-vs-territory trade; the world map is the scoreboard.

## S1 — Economic loop (resources / build / tax)

| Flow | Rate / trigger | Coupling |
|---|---|---|
| Tax | controlled settlement mints gold each day | funds resupply + builds (S2, S1) |
| Build | spend gold: garrison (defense) or depot (resupply point) | garrison holds vs rivals (S3); depot cuts resupply cost (S2) |
| Control | held settlement = income + army anchor | control is the win numerator (S4) |

## S2 — Army & supply

| Rule | Value | Coupling |
|---|---|---|
| Travel cost | plain 1 / rough 2 supply per tile | route choice = supply budget (S1 funds it) |
| Day length | 40 ticks | paces all drains |
| Desertion | 0 supply → max(1, floor(.2T))/day | punishes overreach; rivals pounce (S3) |
| Resupply | at settlement/depot, gold → supply to cap | economy's main gold sink (S1) |

## S3 — Rival-lord AI tension

| Trigger | Behavior | Coupling |
|---|---|---|
| Undefended settlement | rival captures it | cuts your tax base (S1) |
| Player low supply / small army | rival attacks the army | exploits desertion window (S2) |
| Rival camp threatened | rival defends, counter-raids | win-state needs the assault (S4) |
| Player depot | rival raids it | breaks resupply (S2) |

## S4 — Win-state

| Condition | Check | Coupling |
|---|---|---|
| Control all settlements | owner count each day | economy payoff (S1) |
| Destroy rival camp | assault with army ≥ camp defense | army payoff (S2) |
| Loss: army 0 or camp destroyed | each day after ticks | rivals enforce it (S3) |

## Razor-thin cuts (out of scope)
| Cut | Why out |
|---|---|
| Unit roster & combat micro | one army strength stat; combat resolved in stepWorld |
| Diplomacy / alliances / peace | rivals always hostile — tension is structural |
| Fog of war, dynamic events, seasons | full visibility; deterministic world |

---
*Crafted by the Systems & World Designer of the AI-12 studio team.*