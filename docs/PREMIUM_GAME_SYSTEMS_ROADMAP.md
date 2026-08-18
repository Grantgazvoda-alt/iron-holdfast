# Iron Holdfast — Premium Strategy/RPG Systems Roadmap

## North star
Iron Holdfast should compete on depth and feel with premium strategy and RPG games while remaining its own game. Its differentiator is one continuous authoritative war: build and govern a holdfast, command armies tactically, then personally enter the same battle in first person.

We benchmark genre leaders for quality, readability, tactical depth, progression, battle scale, responsiveness, AI and presentation. We do not copy protected code, art, maps, characters, narrative, UI assets or proprietary content.

## Pillar 1 — Living campaign
- Persistent player commander profile.
- Renown, command experience and specialization progression.
- Holdfast upgrades that create strategic tradeoffs rather than linear stat inflation.
- Officers/captains with traits, morale effects and battlefield roles.
- Army veterancy and unit history.
- Dynamic events: shortages, deserters, refugees, merchants, mercenaries, disease risk, weather pressure and political demands.
- Campaign map after the battle sandbox is stable: territories, roads, resources, settlements, enemy strongholds and seasonal pressure.

## Pillar 2 — Tactical army command
- Unit groups and formation selection.
- Line, shield wall, loose, wedge and reserve formations.
- Facing, frontage, cohesion and formation movement.
- Attack, defend, hold, retreat, flank and focus-fire orders.
- Morale influenced by casualties, commander proximity, flanking, exhaustion and local advantage.
- Terrain effects: elevation, mud, forests, choke points, walls and gates.
- Commander AI personalities that choose tactics, not merely stat multipliers.

## Pillar 3 — First-person warfare
- Seamless Command → Battle → Command transition using the same room state.
- Direct control of eligible soldiers and eventually officers.
- Stamina, sprint, encumbrance and recovery.
- Directional melee attacks with reach, wind-up and recovery.
- Shield coverage, block stamina and timed parries.
- Armor zones and weapon-vs-armor effectiveness.
- Bow draw, projectile velocity/drop and ammunition.
- Contextual wall, gate, ladder and siege interactions.
- Strong hit, block, near-miss and positional-audio feedback without relying on gratuitous gore.

## Pillar 4 — Siege simulation
- Gates with breach states and repair windows.
- Wall segments with structural health.
- Ladders, rams, siege towers and artillery as later systems.
- Defenders gain elevation/choke advantages but can be isolated.
- Fire, structural damage and supply pressure as bounded systems.
- Attacker objectives beyond mindless keep rushing: breach, suppress towers, capture gatehouse, destroy supply, assault keep.

## Pillar 5 — Enemy commanders
Initial identities:
- The Red Wolf — frontal aggression, rapid pressure, melee preference.
- Blackthorn — skirmishers, ranged harassment and spacing.
- Iron Viper — probes weak defenses and redirects toward vulnerable sectors.
- Ashen Crown — patient escalation, heavy troops and late siege pressure.

Each AI commander should expose deterministic tactical preferences to the authoritative simulation. Difficulty changes reaction quality, coordination and bounded resources; personality changes decisions.

## Pillar 6 — RPG progression
Three commander paths initially:

### Warden
Defense, fortification, morale recovery, shield formations and siege endurance.

### Marshal
Formation control, army mobility, reinforcement efficiency and command radius.

### Vanguard
Direct-combat stamina, weapon handling, rally effects and first-person battlefield leadership.

Progression must unlock meaningful play styles rather than pay-to-win power. Competitive integrity remains possible later.

## Pillar 7 — Presentation
- Readable medieval visual language with distinct friendly/enemy silhouettes.
- Weather, fog, smoke, banners, firelight and battlefield ambience within performance budgets.
- Commander portraits and heraldry.
- Context-sensitive music intensity.
- Spatial battle audio and directional threat cues.
- Cinematic victory/defeat moments that do not block replay flow.
- Higgsfield may supply approved concept art, animation, audio and 3D source assets; GitHub remains canonical for game source and asset manifests.

## Pillar 8 — Mobile and web
- Desktop: keyboard/mouse and pointer lock.
- Mobile: dual-zone movement/look plus contextual action controls.
- Responsive command UI with touch-sized targets.
- Adaptive render scale, LOD and effects budgets.
- 30 FPS minimum target on representative modern mobile hardware; 60 FPS target on capable devices/desktop.
- No critical action may require hover or right-click.

## Authoritative architecture
- Server owns resources, ownership, movement validation, damage, morale, projectiles, unit death, objectives and victory.
- Client sends bounded intents and performs presentation/prediction only.
- Deterministic simulation logic remains separately testable.
- Save/reconnect/reset cannot fork authoritative state.
- Future multiplayer uses the same trust boundary rather than retrofitting anti-cheat later.

## Development sequence

### Milestone A — Fully working siege sandbox
- Clean reset/New Siege.
- 1–4 configurable enemy commanders.
- Stable economy/build/train/repair/tech loop.
- Command ↔ first-person transition.
- Victory, defeat and replay.
- CI/typecheck/tests/build green.

### Milestone B — Tactical command
- Groups/formations.
- Facing/cohesion/morale expansion.
- Commander personality AI.
- Gate/wall tactical objectives.

### Milestone C — Combat feel
- Stamina.
- Melee timing/reach.
- Shields/parries.
- Armor.
- Archery ballistics.
- Improved animation/audio feedback.

### Milestone D — RPG layer
- Commander profile.
- Renown/XP.
- Warden/Marshal/Vanguard progression.
- Officer traits and unit veterancy.
- Persistent save schema with migration/versioning.

### Milestone E — Premium siege content
- Rams/ladders/siege towers/artillery.
- Weather and battlefield modifiers.
- More maps/holdfast layouts.
- Scenario objectives and commander encounters.

### Milestone F — Campaign
Only after the battle sandbox is consistently fun and reliable: campaign territories, settlements, resources, diplomacy/event systems and long-form progression.

## Release gates
No feature is considered done merely because code exists. It must have an accessible player path, authoritative validation where required, regression coverage, responsive behavior, and runtime verification. Production deployment remains a separate approval-gated action.
