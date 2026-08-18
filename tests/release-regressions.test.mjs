import test from "node:test";
import assert from "node:assert/strict";
import * as logic from "../src/logic.js";

function build(player) {
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

function prepareAssault(seed) {
  let state = build(seed);
  const bar = findGrass(state);
  state = act(state, { type: "build", b: "barracks", ...bar });
  state = {
    ...state,
    res: { ...state.res, gold: 5000, iron: 5000 },
    waveIn: 1e9,
    pendingWave: [],
  };
  for (let i = 0; i < 8; i++) state = act(state, { type: "train", u: "knight" });
  const ids = state.units.filter((u) => u.f === "p").map((u) => u.id);
  const order = { type: "move", ids, x: state.campX, y: state.campY };
  assert.equal(logic.validateAction(state, state.seat, order).ok, true);
  return act(state, order);
}

test("camp remains reachable across multiple deterministic map seeds", () => {
  for (const seed of ["victory-case", "victory-detour-b", "victory-detour-c", "victory-detour-d"]) {
    let state = prepareAssault(seed);
    for (let i = 0; i < 20000 && !state.over; i++) state = step(state);
    assert.equal(state.over, true, `${seed}: assault never reached a terminal state`);
    assert.equal(state.result, "victory", `${seed}: full knight assault did not destroy camp`);
  }
});

test("wave director continues after the first wave queue drains", () => {
  let state = build("wave-director-regression");
  state = {
    ...state,
    keep: { hp: 1_000_000, max: 1_000_000 },
  };
  for (let i = 0; i < 700 && state.wave < 2; i++) state = step(state);
  assert.ok(state.wave >= 2, `expected at least wave 2, got wave ${state.wave}`);
});

test("enemy killed earlier in a tick cannot make a ghost attack", () => {
  let state = build("ghost-action-regression");
  const bar = findGrass(state);
  state = act(state, { type: "build", b: "barracks", ...bar });
  state = { ...state, res: { ...state.res, gold: 100, iron: 100 }, waveIn: 1e9, pendingWave: [] };
  state = act(state, { type: "train", u: "knight" });

  const knight = state.units.find((u) => u.f === "p");
  knight.atkCd = 0;
  const enemy = {
    id: 900001,
    f: "e",
    t: "raider",
    x: knight.x + 1,
    y: knight.y,
    tx: null,
    ty: null,
    tgt: null,
    hp: 0.1,
    max: 14,
    dmg: 50,
    atkCd: 0,
    moveCd: 0,
    range: 1,
    morale: 100,
    maxMorale: 100,
    rout: 0,
    routT: 0,
    chargeMult: 1,
  };
  state = { ...state, units: [...state.units, enemy] };
  const hpBefore = knight.hp;
  state = step(state);
  const survivor = state.units.find((u) => u.id === knight.id);
  assert.ok(survivor, "player knight unexpectedly died");
  assert.equal(survivor.hp, hpBefore, "dead enemy acted after being killed earlier in the same tick");
  assert.equal(state.units.some((u) => u.id === enemy.id), false, "dead enemy was not reaped");
});
