import { readFile, writeFile } from "node:fs/promises";

const path = "src/logic.js";
let source = await readFile(path, "utf8");

function replaceOnce(label, before, after) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${label}: expected source block was not found`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`${label}: source block was found more than once`);
  }
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

replaceOnce(
  "dead enemies must not act after being killed earlier in the same tick",
  `  for (const u of enemies) {\n    u.moveCd -= 1;\n    u.atkCd -= 1;`,
  `  for (const u of enemies) {\n    // Players act first in the tick. An enemy killed by that attack must not\n    // get a final ghost attack or movement before the reap phase below.\n    if (u.hp <= 0) continue;\n    u.moveCd -= 1;\n    u.atkCd -= 1;`,
);

replaceOnce(
  "greedy pathing",
  `function stepToward(s, u, tx, ty, buildingAt) {\n  const cx = u.x;\n  const cy = u.y;\n  const cd = Math.abs(cx - tx) + Math.abs(cy - ty);\n  let best = null;\n  let bd = cd;\n  for (const [dx, dy] of DIRS) {\n    const nx = cx + dx;\n    const ny = cy + dy;\n    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;\n    if (!PASSABLE[s.map[xy(nx, ny)]]) continue;\n    if (buildingAt.has(nx + "," + ny)) continue;\n    const d = Math.abs(nx - tx) + Math.abs(ny - ty);\n    if (d < bd) {\n      bd = d;\n      best = [nx, ny];\n    }\n  }\n  if (!best) return false;\n  u.x = best[0];\n  u.y = best[1];\n  return true;\n}`,
  `function stepToward(s, u, tx, ty, buildingAt) {\n  const cx = u.x;\n  const cy = u.y;\n  if (cx === tx && cy === ty) return false;\n  if (tx < 0 || ty < 0 || tx >= W || ty >= H) return false;\n\n  const start = xy(cx, cy);\n  const goal = xy(tx, ty);\n  if (!PASSABLE[s.map[goal]]) return false;\n\n  // Deterministic breadth-first search. The old mover only accepted a step\n  // that reduced Manhattan distance, which made units permanently stick on\n  // lakes and other obstacles whenever the shortest real route needed one\n  // sideways/backward detour. The map is only 40x26, so a bounded BFS is small\n  // and deterministic. Live buildings remain blockers.\n  const previous = new Int32Array(W * H);\n  previous.fill(-1);\n  const queue = new Int32Array(W * H);\n  let head = 0;\n  let tail = 0;\n  previous[start] = start;\n  queue[tail++] = start;\n\n  // If walls make the true goal unreachable, route toward the closest reachable\n  // frontier instead. That gets siege units adjacent to the blocking structure,\n  // where the existing combat code attacks the wall/tower rather than freezing.\n  let best = start;\n  let bestDistance = manhattan(cx, cy, tx, ty);\n  let foundGoal = false;\n\n  while (head < tail && !foundGoal) {\n    const current = queue[head++];\n    const x = current % W;\n    const y = Math.floor(current / W);\n    for (const [dx, dy] of DIRS) {\n      const nx = x + dx;\n      const ny = y + dy;\n      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;\n      const next = xy(nx, ny);\n      if (previous[next] !== -1) continue;\n      if (!PASSABLE[s.map[next]]) continue;\n      if (buildingAt.has(nx + "," + ny)) continue;\n      previous[next] = current;\n      queue[tail++] = next;\n\n      const d = manhattan(nx, ny, tx, ty);\n      if (d < bestDistance) {\n        best = next;\n        bestDistance = d;\n      }\n      if (next === goal) {\n        best = goal;\n        foundGoal = true;\n        break;\n      }\n    }\n  }\n\n  if (best === start) return false;\n\n  // Walk predecessors backward from the chosen reachable target until the first\n  // step after the current tile is found. Fixed DIRS order makes ties stable.\n  let next = best;\n  while (previous[next] !== start) {\n    next = previous[next];\n    if (next < 0 || previous[next] < 0) return false;\n  }\n  u.x = next % W;\n  u.y = Math.floor(next / W);\n  return true;\n}`,
);

replaceOnce(
  "completed wave queue must clear",
  `    s.pendingWave = s.pendingWave.slice(n);\n  }\n  return s;`,
  `    s.pendingWave = s.pendingWave.slice(n);\n    // An empty array is truthy. Leaving it in state would make !pendingWave\n    // false forever and permanently stop the director after wave one.\n    if (s.pendingWave.length === 0) s.pendingWave = null;\n  }\n  return s;`,
);

await writeFile(path, source);
console.log("Applied deterministic obstacle-aware pathing, siege-frontier routing, ghost-action guard, and wave-queue cleanup.");
