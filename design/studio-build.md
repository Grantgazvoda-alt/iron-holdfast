# Studio Build Wave — feel-audit fixes (12-employee pass)

Full studio (Directors, Designers, Engineer, Feel, Art, Audio, UX) reviewed the feel-audit findings and produced the following build plan, consolidated from the wave.

## Priority fixes (from feeling, highest-first)
1. **Battle-order + terrain read-out on the command HUD** (H1)
   - Land: `client.js` battle panel, per-unit readout "Order: Hold(1.28 def) · Terrain: hill(defender+)"
   - Asset-free, Canvas2D; wire player-order action via the existing action path (no new sim).
2. **Rival-strength telegraph on the world map** (H2, H1)
   - Show each rival's troop count + personality icon on their token (drawWorld), pre-engagement.
3. **Supply-ribbon legibility** (H3)
   - Persistent supply/desertion meter on the world view; warn at ≤25%.
4. **Forest-vs-hill differentiation** (balance)
   - Candidate: forest supplyWeight 2→1.5, marchTicks 2→1.5 (keep hill at 2) — makes forest a route-light choice, hill the defensive wall.
5. **Economy idempotence audit** — verify no double-tax/double-charge between core stepWorld + stepWorldEconomy/applyPaidWorldResupply (ledger guards lastTaxDay/lastSupplyPurchase).

## Fear-gate additions
- H1: ≥3/5 testers can state the active order + why it matters after one battle.
- H3: supply meter understood at a glance; no "did I run out?" confusion.
- H2: no surprise wipes unannounced.

## Audio (8 cues request)
New order-change sting, rival-sighted horn, supply-low pulse — WebAudio, non-blocking.

## Content
- Rival-lord insight line on first sight ("He holds the ford with 40 blades — and he knows it."), journal reacts on low supply.

---
_Compiled by the studio build wave; artifacts landed in repo (see design/feel-audit-review.md, this doc)._