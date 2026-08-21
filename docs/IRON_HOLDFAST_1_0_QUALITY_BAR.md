# Iron Holdfast 1.0 — Fully Working Game Quality Bar

## Product goal
Build an incredible castle-warfare game that works end to end on mobile and web. The game must feel complete, not like a collection of disconnected prototypes.

## Core player loop
1. Start or reset a siege reliably.
2. Choose 1–4 enemy NPC commanders and their ability tier.
3. Build economy, defenses, walls, towers and barracks in Command Mode.
4. Train and command a garrison while enemy commanders conduct coordinated siege waves.
5. Enter First-Person Battle Mode without leaving the authoritative siege state.
6. Fight directly with responsive controls, then return to Command Mode at any time.
7. Win by defeating the enemy camp or lose when the keep falls.
8. Start another siege cleanly without stale state, broken controls or reconnect issues.

## Non-negotiable functional gates
- No dead buttons, placeholder controls or routes.
- New Siege/reset clears simulation state deterministically while retaining the selected NPC setup.
- 1, 2, 3 and 4 NPC commander configurations all run without crashes or invalid state.
- Recruit, Soldier, Veteran and Warlord ability tiers produce bounded, testable difficulty changes.
- Existing economy/build/train/repair/tech mechanics continue to work.
- Command Mode and First-Person Battle Mode share one server-authoritative room state.
- Client code never supplies trusted damage, health, resources, ownership or victory results.
- Switching modes preserves room and player identity.
- A routed/dead unit cannot remain under first-person control.
- Victory and defeat overlays appear once and reset correctly on a new siege.
- Reconnect restores authoritative state without duplicating or stealing the active seat.

## First-person battle quality bar
- Desktop: WASD, mouse look, attack, brace/block and sprint are responsive.
- Mobile: movement stick, touch look, attack, brace and sprint work in landscape without page scrolling.
- Controlled soldier can move and attack only through validated server intents.
- Camera and HUD remain usable at common mobile aspect ratios and safe-area insets.
- First-person mode can return to Command Mode at any time.
- No separate or forked battle simulation is allowed.

## Warfare direction
Grounded medieval combat rather than gratuitous gore:
- weapon reach, timing and recovery;
- stamina and encumbrance;
- shield coverage and parry windows;
- armor protection;
- projectile travel/drop for bows;
- morale, routing and formation cohesion;
- gate, wall, tower and choke-point advantages;
- siege pressure and breaches;
- readable positional audio and hit feedback.

## NPC commander direction
Each commander must become identifiable and strategically distinct over time. Initial ability tiers may alter bounded values such as wave pressure, unit composition, health, damage and morale. Later commander personalities should differ in tactics rather than simply receiving larger numbers.

Planned commander identities:
- The Red Wolf — aggressive frontal pressure.
- Blackthorn — ranged/skirmisher emphasis.
- Iron Viper — opportunistic weak-point targeting.
- Ashen Crown — heavier late-wave siege pressure.

## Mobile/web performance gates
- Desktop target: stable 60 FPS in representative battles.
- Mobile minimum target: stable 30 FPS in representative battles; 60 FPS on capable devices.
- No unbounded DOM nodes, particles, audio nodes or per-frame allocations.
- Adaptive quality/LOD is preferred over frame-rate collapse.

## Verification gates before calling 1.0 fully working
- Dependency install from lockfile.
- Typecheck.
- Existing logic tests.
- Room/server tests.
- Commander/reset tests.
- Production build.
- Desktop Chrome/Firefox/Safari smoke tests.
- iOS Safari and Android Chrome touch tests.
- Command → Battle → Command journey test.
- New Siege with every NPC count and every ability tier.
- Victory, defeat, reconnect and reset regression tests.
- Representative battle performance profile.

## Release governance
Merging verified development work into `main` is separate from production deployment. Production publication must be explicitly approved and the live customer path must be verified after deployment.
