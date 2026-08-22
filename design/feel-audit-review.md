# Feel-Audit Review (code-grounded)

Review of design/feel-audit.md hypotheses against the shipped campaign code at aef61cb. Each hypothesis is tested against the actual module semantics, not vibes.

## H1 — Battle math reads stat-y, not tactical
**Code check:** `campaign-battle.js` is deterministic and readable — `FIELD_ORDERS` (hold/advance/charge/withdraw) map to attack×defense×morale modifiers; terrain profile feeds `ground.attacker/defender/ambush`; `strengthRatio = clamp(troops/defender, 0.45, 2.2)`; rate clamped 0.02–0.16. This means a player *can* attribute a loss to a property: order chosen, terrain, or ratio — it's not hidden dice. **Hypothesis holds as a risk, not a confirmed bug**: the math is legible, but the *interface* must surface the current orders (hold/charge/withdraw) + terrain read so the player can actually reason. If the UI never tells the player what order is active, the math *feels* random even though it isn't — that would be the H1 failure mode.
**Verdict: GATE — needs the UI read-out (selected order + terrain modifier) + loss-attribution probe in Session B. If it surfaces, H1 passes.**

## H2 — Difficulty spikes unannounced
**Code check:** `campaign-difficulty.ts` multiplies rival troops (×0.85/1/1.2) and starting supply (×1.25/1/0.85) by *campaign* difficulty — it does **not** touch per-wave pacing. Core wave spawns are deterministic from `wave` index. That means any perceived spike is either (a) the player picked `warlord` (rival ×1.2 → visible in setup), or (b) the world-supply pinch (lower start supply) creating a quiet doom-clock, not a sudden wave burst. **The code does not announce difficulty changes mid-run, and supply decay is a slow burn — so an "unannounced spike" is unlikely unless a single rival shows up way stronger.** Check: does the UI surface rival troop count before they're met? If not, the ×1.2 warlord is a surprise.
- **Verdict (ACTION):** before Session B, add a "rival strength" readout on the world map (troop count + personality). That closes the H2 surprise class cheaply.

## H3 — Supply pressure too gentle OR too harsh
**Code check:** `world-economy.ts`: tax 2/town/day, supply purchased (5 supply/gold, tap 20, cap 200); starting supply × difficulty. Desertion in `stepWorld` at 0 supply: 20%/day floor. A 10-troop army with 40 supply: 0 supply → dead in ~9 days (~4.5 min). At 200 cap with tax 2/town (≈5 towns = 10 gold/day = 50 supply/day), resupply keeps pace. **Middle-feel question is code-real**: too-slow economy → the player never risks a march; too-fast → supply never binds. Given defaults (5 supply/gold, 2 tax/town) the medium feels reachable but thin — the "5 passes under gentle + soft-reset under harsh" gate is testable as designed.
- **Verdict (H3):** HOLD — run Session C rotation; the code defaults are defensible, but the `warlord` starting-supply ×0.85 + rival ×1.2 combo is likely the tuned "too harsh" test case.

## Summary of code-grounded gates
1. **H1** depends on the UI surfacing orders + terrain — add that readout before feel Session B.
2. **H2** — add "rival strength" on the world map; difficulty is setup-declared, not surprise.
3. **H3** — rotation is the right test; defaults are balanced on paper, watch the warlord combo.
4. Metrics M1–M5 legible — M4 (camp-assault win rate) remains the single-block gate.