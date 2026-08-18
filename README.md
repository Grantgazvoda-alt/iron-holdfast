# Iron Holdfast

Real-time medieval castle-siege RTS (Stronghold-inspired), playable in-browser.

Build an economy (houses, farms, wood/iron/gold, food). Construct walls, towers, barracks, and a tech tree. Command soldiers in Total War–style battle control (click-to-charge, hold-to-hold, morale/routing). Destroy the enemy keep (600 HP) to win; your keep losing HP to zero loses.

Fixed 0.5s deterministic server ticks — the simulation (`src/logic.js`) stays pure (no clocks, no RNG, no imports), all sprites/terrain drawn on Canvas2D, all SFX synthesized with WebAudio. No external art assets.

## Play

Open the deployed URL, or run locally:

```bash
cd app
bun install
bun run dev
bun test           # 54 vitest tests
bun run check:logic  # determinism contract
```

## Repositories

- Primary: `iron-holdfast`
- Source mirror: `iron-holdfast-source`

Latest art-pass code (`buildingSprite` caching, grass blades, shaded buildings, golden-hour atmosphere) is included in both.