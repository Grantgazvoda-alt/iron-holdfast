# Iron Holdfast — First-Person Battle Upgrade

Status: active development
Branch: `feature/first-person-battle-mobile-web`

## Product decision

Preserve the existing real-time castle/economy command mode and add a second, optional **First-Person Battle Mode** that lets a player enter the battlefield as a soldier/commander during a live siege. Both views must operate on the same authoritative battle state rather than becoming two disconnected games.

## Target experience

1. Build and command the hold from the existing strategic view.
2. Select **Enter Battle** during a siege.
3. Take direct control of a garrison combatant in first person.
4. Fight on walls, courtyards, gates, towers, and exterior approaches while the strategic simulation continues.
5. Return to command view at any time.

## Realistic warfare direction

"Realistic" means grounded systems and presentation rather than gratuitous gore:

- weapon reach, wind-up, recovery, stamina and encumbrance;
- directional melee attacks, blocks/parries and shield coverage;
- bow draw time, projectile travel/drop and ammunition;
- armor classes and location-aware protection;
- morale, suppression/fear, routing and formation cohesion;
- collision-aware walls, gates, towers and choke points;
- friendly-unit obstruction and formation spacing;
- siege pressure, gate breaches and defensive elevation advantages;
- positional audio, impact feedback and readable hit confirmation.

Combat outcomes remain server-authoritative. The browser sends player intent, never trusted damage results.

## Cross-platform requirements

### Desktop web
- WASD movement.
- Pointer-lock mouse look.
- Left click attack/fire.
- Right click block/aim.
- Shift sprint, Space contextual movement, R reload/nock where applicable.
- Escape releases pointer lock without corrupting battle state.

### Mobile web
- Left virtual stick for movement.
- Right-side drag region for camera/look.
- Large attack, block/aim, sprint and interact controls within thumb reach.
- Touch controls must use Pointer Events and prevent accidental page scrolling/zoom gestures inside the game surface.
- No gameplay action may depend on hover, right-click, keyboard, or pointer lock.
- Respect safe-area insets and both portrait warning / landscape gameplay layouts.

## Architecture

### Phase 1 — battle-mode foundation
- Add explicit client `command` vs `firstPerson` presentation modes.
- Add cross-platform input abstraction that normalizes keyboard/mouse/touch into movement/look/action intents.
- Add first-person HUD and touch controls.
- Add first-person camera renderer that derives its scene from the existing authoritative world view.
- Keep existing RTS controls untouched when command mode is active.

### Phase 2 — authoritative direct-control protocol
- Extend protocol with bounded `battleInput` intents: movement vector, look heading/pitch, attack, block/aim, sprint, interact and controlled unit id.
- Server validates player ownership/eligibility, action cadence, stamina, weapon state and collision.
- Server simulation owns position, damage, projectiles, deaths and respawn/control transfer.
- Add anti-spam/rate limits and sequence numbers.

### Phase 3 — grounded combat simulation
- Melee reach/arcs and recovery windows.
- Shields/parries.
- Bow projectile ballistics.
- Armor and stamina.
- Formation/morale interaction.
- Gate/wall/tower combat spaces.

### Phase 4 — presentation and performance
- WebGL renderer behind capability detection, with a low-spec fallback.
- Instanced troops/props and LOD budgets.
- Spatial audio and battlefield ambience.
- Adaptive render scale for mobile thermals/battery.
- Asset compression and lazy loading.

## Performance budgets

Initial targets, to be validated on representative hardware:

- Desktop: stable 60 FPS target during normal battle load.
- Modern mobile: 30 FPS minimum target; 60 FPS on capable devices.
- Input-to-local-camera response should feel immediate; authoritative reconciliation must not cause large visible snaps.
- Avoid unbounded particles, DOM entities, audio nodes or per-frame allocations.

These are engineering targets, not claims about the current build.

## QA matrix

### Existing regression gates
- Existing logic tests.
- Existing room/server tests.
- Existing state/meta tests.
- Typecheck.
- Production build.

### New battle-mode tests
- command mode remains default and existing RTS actions still work;
- entering/exiting first-person mode preserves simulation state;
- desktop input normalization;
- touch input normalization and multi-touch pointer ownership;
- server rejects invalid controlled unit IDs;
- server rejects impossible movement/action rates;
- damage is never accepted directly from the client;
- dead/routed units cannot be controlled;
- mobile viewport/safe-area behavior;
- reconnect restores authoritative controlled-unit state;
- first-person mode does not pause or fork the strategic simulation.

## Release gates

No production deployment until:

1. regression suite passes;
2. direct-control server tests pass;
3. desktop Chrome/Firefox/Safari smoke tests pass;
4. iOS Safari and Android Chrome touch tests pass on real or representative devices;
5. performance profile meets the minimum mobile target under a representative siege;
6. no client-authoritative damage/movement trust path exists;
7. founder explicitly approves production deployment.

## First vertical slice

The first playable milestone should be deliberately narrow:

- Enter Battle / Return to Command toggle.
- Control one eligible spearman.
- Walk/look/sprint.
- One melee attack and shield block.
- Server-authoritative hit validation against nearby enemy units.
- Desktop mouse/keyboard and mobile dual-stick/touch controls.
- Existing siege continues around the controlled soldier.

Once that slice is fun, stable and performant, expand to archers, knights, wall/tower traversal, projectile ballistics, richer animation, siege equipment and higher-fidelity visuals.
