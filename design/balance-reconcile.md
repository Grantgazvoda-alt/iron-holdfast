# Balance Reconcile — core logic.js vs GH campaign modules
Verified against src/logic.js, src/world-economy.ts, src/campaign-battle.js, src/campaign-difficulty.ts at HEAD b872311. Values read from source (not guessed).

## 1. Shared constants — do they match?

| Constant | Core (logic.js) | New module value | Status |
|---|---|---|---|
| Supply cap | 200 (world_resupply) | `WORLD_ECONOMY.supplyCap = 200` | ✅ MATCH |
| Resupply per use | `min(20, 200 - supply)` | `WORLD_ECONOMY.maxSupplyPurchase = 20`, gold cost `supplyPerGold = 5` | ✅ MATCH (+ gold sink now exists) |
| Travel cost | plain 1 / forest·hill 2 tick-gated | campaign modules re-use worldPath; no fork | ✅ MATCH (no redefinition) |
| Desertion rate | max(1, floor(0.2·T))/day @ 0 supply | campaign-battle morale uses 0–100 separately; no desertion redefinition | ✅ NO CONFLICT |
| Battle strength ratio | — (new) | `clamp(attacker/defender, 0.45, 2.2)` | NEW — feed, not conflict |

## 2. Real conflicts found: none.
The campaign layer extends rather than re-tunes the core constants: it adds supply purchasing (`supplyPerGold=5` → 1 gold buys 5 supply), tax (`taxPerFriendlyTownPerDay=2`), difficulty lenses (rival ×0.85/1/1.2, starting supply ×1.25/1/0.85), and field-battle math. All feed off the same 200-cap, 20-per-tap resupply the core exposes.

## 3. Invariants the new math must not break (kept from studio pass)
1. **Supply never negative** — economy purchasing clamps via `room = cap - current`; desertion pins supply at 0. OK in source.
2. **Army/troops never NaN** — `int()` coerces finite, `Math.max(1, defender.troops)` guards div-by-zero; strength ratio bounded [0.45, 2.2]. OK.
3. **Desertion wiped before reforms** — no reform writes mid-tick; tax/battle run on day-bounds after stepWorld desertion. Verify on playtest, no violation found.

## 4. Follow-up (small, deferred)
- Forest-vs-hill still undifferentiated (both cost 2) — studio flag; candidate terrain lever for a future pass.
- Difficulty affects rival troops + start supply only; desertion curve untouched — consider `desertionMultiplier` on `warlord` as a follow-up knob (design decision pending).