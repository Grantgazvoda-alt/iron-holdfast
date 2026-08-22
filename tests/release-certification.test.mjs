import test from "node:test";
import assert from "node:assert/strict";
import * as logic from "../src/logic.js";

function build(player = "castellan") {
  return logic.setup([player]);
}

function act(state, action) {
  return logic.applyAction(state, state.seat, action);
}

function step(state, n = 1) {
  let current = state;
  for (let i = 0; i < n; i++) current = logic.tick(current);
  return current;
}

function view(state) {
  return logic.viewFor(state, state.seat);
}

function findGrass(state, x0 = state.kx, y0 = state.ky) {
  const v = view(state);
  for (let r = 0; r < 10; r++) {
    for (let y = Math.max(1, y0 - r); y <= Math.min(v.H - 2, y0 + r); y++) {
      for (let x = Math.max(1, x0 - r); x <= Math.min(v.W - 2, x0 + r); x++) {
        if (x === state.kx && y === state.ky) continue;
        if (state.map[y * v.W + x] === "g" && !state.buildings.some((b) => b.hp > 0 && b.x === x && b.y === y)) {
          return { x, y };
        }
      }
    }
  }
  throw new Error("no buildable grass tile found");
}

function assertFiniteNumbers(value, path = "root") {
  if (typeof value === "number") {
    assert.ok(Number.isFinite(value), `${path} must be finite`);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertFiniteNumbers(v, `${path}[${i}]`));
    return;
  }
  for (const [k, v] of Object.entries(value)) assertFiniteNumbers(v, `${path}.${k}`);
}

test("contract, deterministic setup, serialization, and player-specific seed", () => {
  assert.equal(logic.meta.game, "Iron Holdfast");
  assert.equal(logic.meta.minPlayers, 1);
  assert.equal(logic.meta.maxPlayers, 1);
  for (const name of ["setup", "validateAction", "applyAction", "tick", "isGameOver", "viewFor"]) {
    assert.equal(typeof logic[name], "function", `${name} must be exported`);
  }

  const a = build("castellan");
  const b = build("castellan");
  const c = build("another-player");
  assert.deepEqual(a, b, "same player must produce identical initial state");
  assert.notDeepEqual(a.map, c.map, "different player seeds should produce different maps");
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(a)));
  assertFiniteNumbers(a);
});

test("validation rejects malformed, unauthorized, blocked, and unaffordable actions", () => {
  const s = build();
  assert.equal(logic.validateAction(s, s.seat, null).ok, false);
  assert.equal(logic.validateAction(s, s.seat, { type: "unknown" }).ok, false);
  assert.equal(logic.validateAction(s, s.seat, { type: "build", b: "house", x: -1, y: 2 }).ok, false);
  assert.equal(logic.validateAction(s, s.seat, { type: "build", b: "house", x: s.kx, y: s.ky }).ok, false);

  const waterIndex = s.map.indexOf("w");
  assert.ok(waterIndex >= 0, "generated map must contain water");
  assert.equal(
    logic.validateAction(s, s.seat, { type: "build", b: "house", x: waterIndex % 40, y: Math.floor(waterIndex / 40) }).ok,
    false,
  );
  assert.equal(logic.validateAction(s, s.seat, { type: "train", u: "spearman" }).ok, false);
  assert.equal(logic.validateAction(s, s.seat, { type: "move", ids: [999999], x: s.kx + 1, y: s.ky }).ok, false);
  assert.equal(logic.validateAction(s, s.seat, { type: "research", tech: "not-a-tech" }).ok, false);

  const broke = { ...s, res: { wood: 0, stone: 0, gold: 0, iron: 0, food: 0 } };
  const spot = findGrass(broke);
  assert.equal(logic.validateAction(broke, broke.seat, { type: "build", b: "barracks", ...spot }).ok, false);
});

test("build, overlap protection, training, movement, and view redaction work together", () => {
  let s = build();
  const spot = findGrass(s);
  const beforeWood = s.res.wood;
  const beforeStone = s.res.stone;
  const buildAction = { type: "build", b: "barracks", ...spot };
  assert.equal(logic.validateAction(s, s.seat, buildAction).ok, true);
  s = act(s, buildAction);
  assert.equal(s.buildings.length, 1);
  assert.equal(s.res.wood, beforeWood - 14);
  assert.equal(s.res.stone, beforeStone - 10);
  assert.equal(logic.validateAction(s, s.seat, buildAction).ok, false, "occupied tile must be rejected");

  s = { ...s, res: { ...s.res, gold: 200, iron: 200, wood: 200, stone: 200 } };
  const trainAction = { type: "train", u: "spearman" };
  assert.equal(logic.validateAction(s, s.seat, trainAction).ok, true);
  s = act(s, trainAction);
  const unit = s.units.find((u) => u.f === "p");
  assert.ok(unit, "trained unit must exist");
  assert.ok(Number.isInteger(unit.id));

  const destination = findGrass(s, s.kx + 3, s.ky);
  const moveAction = { type: "move", ids: [unit.id], x: destination.x, y: destination.y };
  assert.equal(logic.validateAction(s, s.seat, moveAction).ok, true);
  s = act(s, moveAction);
  assert.equal(s.units.find((u) => u.id === unit.id).tx, destination.x);

  const publicView = view(s);
  assert.equal("rng" in publicView, false, "internal RNG seed must not leak to client view");
  assert.equal("seat" in publicView, false, "internal seat identifier must not leak through game view");
  assert.equal("pendingWave" in publicView, false, "internal wave queue must not leak through game view");
});

test("economy produces resources and population never exceeds cap", () => {
  let s = build();
  let farm = findGrass(s);
  s = act(s, { type: "build", b: "farm", ...farm });
  const woodcutter = findGrass(s);
  s = act(s, { type: "build", b: "woodcutter", ...woodcutter });
  const house = findGrass(s);
  s = act(s, { type: "build", b: "house", ...house });
  s = { ...s, res: { ...s.res, food: 500 } };
  const foodStart = s.res.food;
  const woodStart = s.res.wood;
  const cap = s.popCap;
  s = step(s, 2400);
  assert.ok(s.res.food >= 0);
  assert.ok(s.res.wood > woodStart);
  assert.ok(s.pop <= cap);
  assert.ok(s.pop >= 6);
  assertFiniteNumbers(s);
  assert.ok(foodStart > 0);
});

test("pause freezes time and resume advances exactly one tick", () => {
  let s = build();
  s = act(s, { type: "pause", on: true });
  const t = s.time;
  s = step(s, 25);
  assert.equal(s.time, t);
  s = act(s, { type: "pause", on: false });
  s = step(s);
  assert.equal(s.time, t + 1);
});

test("waves spawn, IDs stay unique, and simulation remains serializable", () => {
  let s = build();
  let sawWave = false;
  let sawEnemy = false;
  for (let i = 0; i < 300 && !s.over; i++) {
    s = step(s);
    if (s.wave >= 1) sawWave = true;
    if (s.units.some((u) => u.f === "e")) sawEnemy = true;
  }
  assert.equal(sawWave, true);
  assert.equal(sawEnemy, true);
  const ids = s.units.map((u) => u.id);
  assert.equal(new Set(ids).size, ids.length, "unit IDs must remain unique");
  assert.doesNotThrow(() => JSON.stringify(s));
  assertFiniteNumbers(s);
});

test("repair restores a damaged building and charges resources", () => {
  let s = build();
  const spot = findGrass(s);
  s = act(s, { type: "build", b: "wall", ...spot });
  const wall = s.buildings.find((b) => b.b === "wall");
  wall.hp = 50;
  const woodBefore = s.res.wood;
  assert.equal(logic.validateAction(s, s.seat, { type: "repair", id: wall.id }).ok, true);
  s = act(s, { type: "repair", id: wall.id });
  const fixed = s.buildings.find((b) => b.id === wall.id);
  assert.equal(fixed.hp, fixed.max);
  assert.ok(s.res.wood < woodBefore);
  assert.equal(logic.validateAction(s, s.seat, { type: "repair", id: wall.id }).ok, false);
});

test("research is gated, cannot duplicate, and affects new recruits", () => {
  let s = build();
  assert.equal(logic.validateAction(s, s.seat, { type: "research", tech: "training" }).ok, false);
  const spot = findGrass(s);
  s = act(s, { type: "build", b: "barracks", ...spot });
  s = { ...s, res: { ...s.res, gold: 500, iron: 500, wood: 500, stone: 500 } };
  s = act(s, { type: "train", u: "knight" });
  const veteran = s.units.find((u) => u.t === "knight");
  assert.equal(logic.validateAction(s, s.seat, { type: "research", tech: "training" }).ok, true);
  s = act(s, { type: "research", tech: "training" });
  assert.equal(logic.validateAction(s, s.seat, { type: "research", tech: "training" }).ok, false);
  s = act(s, { type: "train", u: "knight" });
  const fresh = s.units.find((u) => u.t === "knight" && u.id !== veteran.id);
  assert.ok(fresh.dmg > veteran.dmg, "new recruit should receive research damage bonus");
});

test("victory and defeat both terminate cleanly", () => {
  let defeat = build("defeat-case");
  defeat.keep.hp = 0;
  defeat = step(defeat);
  assert.equal(defeat.result, "defeat");
  assert.equal(logic.isGameOver(defeat).over, true);

  let victory = build("victory-case");
  const bar = findGrass(victory);
  victory = act(victory, { type: "build", b: "barracks", ...bar });
  victory = { ...victory, res: { ...victory.res, gold: 1000, iron: 500 }, waveIn: 1e9, pendingWave: [] };
  for (let i = 0; i < 8; i++) victory = act(victory, { type: "train", u: "knight" });
  const ids = victory.units.filter((u) => u.f === "p").map((u) => u.id);
  const assault = { type: "move", ids, x: victory.campX, y: victory.campY };
  assert.equal(logic.validateAction(victory, victory.seat, assault).ok, true);
  victory = act(victory, assault);
  for (let i = 0; i < 20000 && !victory.over; i++) victory = step(victory);
  assert.equal(victory.over, true, "camp assault must reach a terminal state");
  assert.equal(victory.result, "victory", "full knight assault should destroy the camp");
  assert.equal(logic.isGameOver(victory).over, true);
});

test("multi-seed stress simulation does not produce NaN, Infinity, or corrupt JSON", () => {
  for (const player of ["stress-a", "stress-b", "stress-c", "stress-d"]) {
    let s = build(player);
    for (let i = 0; i < 5000 && !s.over; i++) s = step(s);
    assertFiniteNumbers(s, player);
    const roundTrip = JSON.parse(JSON.stringify(s));
    assert.equal(roundTrip.seat, player);
    if (s.over) assert.equal(logic.isGameOver(s).over, true);
  }
});
