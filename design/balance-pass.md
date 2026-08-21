# Iron Holdfast — World Slice: First Balance Pass

Scope: the Slice-1 overworld — army marching, supply, desertion, resupply. All numbers pulled verbatim from src/logic.js (stepWorld, worldPath, validateAction/applyAction world_march + world_resupply). No logic.js edits.

## Constants in effect (from src/logic.js)
| Knob | Value | Where |
|---|---|---|
| Overworld size | 24x16 (WWX, WWY) | const |
| Plain / river step cost | 1 tick | stepWorld `wait` threshold |
| Forest / hill step cost | 2 ticks | stepWorld `wait` threshold |
| Mountain | impassable | worldPath skips WT_MOUNTAIN |
| Supply day length | 40 ticks | `dayAcc % 40 === 0` |
| Rations | 1 supply / troop / day | `needy = army.troops` |
| Deserter rate | 20%/day, floor, min 1 | `max(1, floor(troops * 0.2))` |
| Supply cap | 200 | world_resupply |
| Resupply amount | min(20, 200 - supply), clamp 200 | world_resupply apply |

## Travel cost
- Movement is tick-gated per step: plain/river = 1 tick, forest/hill = 2 ticks. An army never teleports; a march of N plain tiles takes N ticks.
- worldPath equates forest and hill (both cost 2); mountain has no route; river and plain both cost 1.
- First-pass verdict: even and predictable; keep plain=1 / hill=2. Flag: forest is as slow as hill yet grants no defensive perk — candidate terrain lever.

## Desertion curve (0 supply)
- With no supply, each day loses max(1, floor(troops*0.2)) and supply stays pinned at 0.
- Curve for 10 troops: 8 → 7 → 6 → 5 → 4 → 3 → 2 → 1 → 0 (9 days, ~6 min live at 500ms ticks).
- First-pass: 20% is steep for a lone start (40 supply = ~4 days of travel for 10). Lever: 0.2 → 0.15 if early game reads too lethal; deferred pending play data (test makes it a 1-line change).

## Supply cap (200) + resupply clamp
- Resupply does supply = min(200, supply + min(20, 200 - supply)): tops up ≤20/day, never exceeds 200; at ≥200 action rejected ("already supplied").
- Requires standing on a faction-0 town.
- First-pass: 20/town vs cap 200 = 10 refills to full. Keep.

## marchCooldown
- No dedicated cooldown field; the step cadence is exported behavior through army.wait (1 plain / 2 forest·hill). Tested as the march gate.

## Determinism
- Every fixture seeded from setup('balance'); no Math.random / Date / timers.

## Proposed tuning (NOT edited — pending play data)
- desertion 0.2 → 0.15 if early game too lethal.
- forest: grant a small bonus or set cost=plain to differentiate from hill.

---
*Crafted by the Data & Balance Engineer of the AI-12 studio team.*