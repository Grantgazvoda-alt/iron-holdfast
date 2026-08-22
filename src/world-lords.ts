import { terrainRouteCost } from "./world-terrain.js";

export type LordPersonality = "aggressive" | "defensive" | "raider";

export const LORD_PERSONALITIES: Readonly<Record<number, LordPersonality>> = Object.freeze({
  1: "aggressive",
  2: "defensive",
});

function finiteInt(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : fallback;
}

function manhattan(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Cost-aware deterministic Dijkstra path using the shared terrain contract. */
export function strategicPath(
  world: any,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
): number[][] | null {
  if (!world || !Array.isArray(world.cells)) return null;
  if (sx === tx && sy === ty) return [];
  const width = finiteInt(world.W);
  const height = finiteInt(world.H);
  if (!width || !height) return null;
  if (tx < 0 || ty < 0 || tx >= width || ty >= height) return null;

  const size = width * height;
  const dist = new Array<number>(size).fill(Infinity);
  const prev = new Array<number>(size).fill(-1);
  const visited = new Array<boolean>(size).fill(false);
  const index = (x: number, y: number) => y * width + x;
  const start = index(sx, sy);
  const target = index(tx, ty);
  dist[start] = 0;

  for (let pass = 0; pass < size; pass++) {
    let current = -1;
    let best = Infinity;
    for (let i = 0; i < size; i++) {
      const value = dist[i] ?? Infinity;
      if (!(visited[i] ?? false) && value < best) {
        best = value;
        current = i;
      }
    }
    if (current === -1 || current === target) break;
    visited[current] = true;
    const x = current % width;
    const y = Math.floor(current / width);
    const currentDistance = dist[current] ?? Infinity;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const next = index(nx, ny);
      const cost = terrainRouteCost(world.cells[next]);
      if (!Number.isFinite(cost)) continue;
      const candidate = currentDistance + cost;
      const nextDistance = dist[next] ?? Infinity;
      if (candidate < nextDistance) {
        dist[next] = candidate;
        prev[next] = current;
      }
    }
  }

  if (!Number.isFinite(dist[target] ?? Infinity)) return null;
  const path: number[][] = [];
  let cursor = target;
  while (cursor !== start && cursor !== -1) {
    path.unshift([cursor % width, Math.floor(cursor / width)]);
    cursor = prev[cursor] ?? -1;
  }
  return cursor === start ? path : null;
}

function chooseAggressiveTarget(world: any, lord: any) {
  const army = world.army;
  const distance = manhattan(lord, army);
  const favorable = finiteInt(lord.troops) >= finiteInt(army.troops) * 0.8;
  if (favorable || distance <= 6) {
    return { x: army.x, y: army.y, kind: "hunt_army", label: "player army" };
  }
  const playerTowns = (world.towns || []).filter((town: any) => town?.faction === 0);
  playerTowns.sort((a: any, b: any) => manhattan(lord, a) - manhattan(lord, b) || finiteInt(a.i) - finiteInt(b.i));
  const town = playerTowns[0];
  return town
    ? { x: town.x, y: town.y, kind: "raid_town", label: String(town.name || "settlement") }
    : { x: army.x, y: army.y, kind: "hunt_army", label: "player army" };
}

function chooseDefensiveTarget(world: any, lord: any) {
  const faction = finiteInt(lord.id);
  const ownTowns = (world.towns || []).filter((town: any) => finiteInt(town?.faction) === faction);
  if (!ownTowns.length) return chooseAggressiveTarget(world, lord);
  const army = world.army;
  ownTowns.sort((a: any, b: any) => {
    const threatA = manhattan(army, a);
    const threatB = manhattan(army, b);
    if (threatA !== threatB) return threatA - threatB;
    if (finiteInt(a.troops) !== finiteInt(b.troops)) return finiteInt(a.troops) - finiteInt(b.troops);
    return finiteInt(a.i) - finiteInt(b.i);
  });
  const threatened = ownTowns[0];
  if (manhattan(army, threatened) <= 8) {
    return {
      x: threatened.x,
      y: threatened.y,
      kind: "defend_town",
      label: String(threatened.name || "settlement"),
    };
  }
  const weakest = [...ownTowns].sort(
    (a: any, b: any) => finiteInt(a.troops) - finiteInt(b.troops) || finiteInt(a.i) - finiteInt(b.i),
  )[0];
  return {
    x: weakest.x,
    y: weakest.y,
    kind: "guard_town",
    label: String(weakest.name || "settlement"),
  };
}

function chooseRaiderTarget(world: any, lord: any) {
  const targets = (world.towns || []).filter((town: any) => town?.faction === 0);
  targets.sort(
    (a: any, b: any) =>
      finiteInt(a.troops) - finiteInt(b.troops) ||
      manhattan(lord, a) - manhattan(lord, b) ||
      finiteInt(a.i) - finiteInt(b.i),
  );
  const target = targets[0];
  return target
    ? { x: target.x, y: target.y, kind: "raid_weak_town", label: String(target.name || "settlement") }
    : chooseAggressiveTarget(world, lord);
}

export function personalityForLord(lord: any): LordPersonality {
  return LORD_PERSONALITIES[finiteInt(lord?.id)] ?? "raider";
}

/**
 * Re-plan every 20 base ticks (and immediately when personality is first added).
 * Movement itself remains owned by logic.js; this layer only chooses destinations.
 */
export function stepRivalStrategy(state: any): any {
  const world = state?.world;
  if (!world?.army || !Array.isArray(world.lords)) return state;
  const time = finiteInt(state.time);
  const day = finiteInt(world.day);
  let changed = false;

  const lords = world.lords.map((lord: any) => {
    const personality = personalityForLord(lord);
    const recovering = finiteInt(lord.recoveryUntilDay) > day || finiteInt(lord.troops) <= 0;
    if (recovering) {
      if (lord.aiPersonality === personality && !lord.path) return lord;
      changed = true;
      return { ...lord, aiPersonality: personality, path: null, aiTarget: null };
    }

    const shouldPlan = !lord.aiPersonality || time % 20 === 0 || !lord.path || !lord.path.length;
    if (!shouldPlan) return lord;

    const target =
      personality === "aggressive"
        ? chooseAggressiveTarget(world, lord)
        : personality === "defensive"
          ? chooseDefensiveTarget(world, lord)
          : chooseRaiderTarget(world, lord);
    const path = strategicPath(world, lord.x, lord.y, target.x, target.y);
    changed = true;
    return {
      ...lord,
      aiPersonality: personality,
      aiTarget: target,
      path,
      wait: 0,
    };
  });

  return changed ? { ...state, world: { ...world, lords } } : state;
}
