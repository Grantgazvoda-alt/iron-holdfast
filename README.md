# Iron Holdfast

A real-time medieval castle-siege builder (Stronghold 2–inspired), playable in the browser at [iron-empire.higgsfield.app](https://iron-empire.higgsfield.app).

## Overview

Build a fortress, manage an economy, raise an army, and defend against escalating enemy waves — destroy the enemy camp to win.

- **Real-time** — a fixed 0.5s server tick drives every rule; no turns.
- **Deterministic** — game logic (`src/logic.js`) is pure: no clocks, no RNG calls, no timers. Maps are seeded.
- **Economy chain** — houses, farms, woodcutter, quarry, iron mine, gold, food. 9 building types, walls, towers, barracks.
- **Combat** — Total War–style battle control: charge (click a target), hold (X), red hunt lines, morale & routing (break → flee → rally), charge-impact bonus damage, 4-tech barracks tree (Drill / Longbow / Plate / Heraldry).
- **Win** — destroy the enemy camp (600 HP). **Lose** — your keep hits 0 HP.
- **Procedural art & audio** — all sprites/terrain drawn on canvas; all SFX synthesized with WebAudio. No external assets.
- **UX** — minimap, pause, reset, auto-pause on disconnect, 7-step tutorial overlay, mobile touch (tap/drag/pinch).

## Stack

- **Client** — vanilla Canvas2D renderer (`public/client.js`), WebSocket protocol.
- **Server** — Cloudflare Workers (TanStack Start) via `src/worker.ts` + `src/room.ts` real-time room loop.
- **Tests** — Vitest: 54 tests across protocol, logic, meta, and state suites.
- **Checks** — `bun run check:logic` enforces the pure-logic determinism contract; `npx tsc --noEmit` type-checks; `node --check public/client.js` validates client syntax.

## Run locally

```bash
cd app
bun install
bun run dev          # dev server
bun test             # run the 54 vitest tests
bun run check:logic  # pure-logic contract
```

## Design

`design/plan.md` documents the design intent; `design/assets.csv` is the asset manifest; `design/launch-copy.md` is the launch copy package.