// Shared deterministic overworld terrain contract.
// Codes match logic.js: 0 plain, 1 forest, 2 hill, 3 mountain, 4 river.

export const WORLD_TERRAIN = Object.freeze({
  0: Object.freeze({ code: 0, name: "open ground", marchTicks: 1, supplyWeight: 1, attacker: 1, defender: 1, ambush: 0 }),
  1: Object.freeze({ code: 1, name: "forest", marchTicks: 1.5, supplyWeight: 1.5, attacker: 0.9, defender: 1.15, ambush: 0.12 }),
  2: Object.freeze({ code: 2, name: "hill", marchTicks: 2, supplyWeight: 2, attacker: 0.88, defender: 1.22, ambush: 0 }),
  3: Object.freeze({ code: 3, name: "mountain", marchTicks: Infinity, supplyWeight: Infinity, attacker: 0, defender: 2, ambush: 0 }),
  4: Object.freeze({ code: 4, name: "river crossing", marchTicks: 1, supplyWeight: 1.5, attacker: 0.82, defender: 1.12, ambush: 0 }),
});

const FALLBACK = WORLD_TERRAIN[0];

export function terrainTacticalProfile(code) {
  return WORLD_TERRAIN[code] || FALLBACK;
}

export function terrainRouteCost(code) {
  return terrainTacticalProfile(code).supplyWeight;
}

export function routeSupplyWeight(world, path) {
  if (!world || !Array.isArray(world.cells) || !Array.isArray(path)) return Infinity;
  let total = 0;
  for (const step of path) {
    if (!Array.isArray(step) || step.length < 2) return Infinity;
    const x = Number(step[0]);
    const y = Number(step[1]);
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= world.W || y >= world.H) {
      return Infinity;
    }
    const profile = terrainTacticalProfile(world.cells[y * world.W + x]);
    if (!Number.isFinite(profile.supplyWeight)) return Infinity;
    total += profile.supplyWeight;
  }
  return total;
}

export function terrainBattleNote(code) {
  const profile = terrainTacticalProfile(code);
  if (code === 1) return "Forest cover slows movement and rewards the defending army; ambush pressure is possible.";
  if (code === 2) return "High ground strongly favors the defender and punishes frontal attacks.";
  if (code === 4) return "Crossing water exposes the attacking army before contact.";
  if (code === 3) return "Mountains are impassable to campaign armies.";
  return "Open ground offers no inherent positional advantage.";
}
