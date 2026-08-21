/**
 * World-slice balance regression tests: travel cost, desertion curve,
 * supply cap + resupply clamp, and per-tile march (step) gate.
 *
 * Pure & deterministic: fixtures are seeded by setup('balance') and then we
 * hand-build the overworld we fully control — no Math.random, no timers, no dates.
 * Every magic number below mirrors a constant in src/logic.js.
 *
 * Run with: bun test
 */
import { describe, it, expect } from "bun:test";
import * as logic from "../src/logic.js";

// Terrain codes — mirrored from logic.js WT_* consts (exported).
const PLAIN = logic.WT_PLAIN; // 0
const FOREST = logic.WT_FOREST; // 1
const HILL = logic.WT_HILL; // 2
const MOUNTAIN = logic.WT_MOUNTAIN; // 3

// 40 world ticks = 1 supply day (logic.js stepWorld: `dayAcc % 40 === 0`).
const TICKS_PER_DAY = 40;

// Deserter model from stepWorld: lose = max(1, floor(troops * 0.2)) per day.
const desertion = (troops: number) =>
  Math.max(0, troops - Math.max(1, Math.floor(troops * 0.2)));

/** Blank all-plain overworld with a fully controlled army. */
function world(army: { x: number; y: number; troops: number; supply: number }) {
  const s = logic.setup(["balance"]) as any;
  s.world = {
    W: logic.WWX,
    H: logic.WWY,
    cells: new Array(logic.WWX * logic.WWY).fill(PLAIN),
    day: 0,
    lords: [],
    towns: [],
    army: { ...army, path: null, wait: 0 },
  };
  return s;
}

describe("world slice · travelCost thresholds", () => {
  it("rejects marching into mountain (impassable, cost ∞)", () => {
    const s = world({ x: 2, y: 2, troops: 10, supply: 100 });
    s.world.cells[5 * logic.WWX + 5] = MOUNTAIN;
    const r = logic.validateAction(s, "p", { type: "world_march", x: 5, y: 5 });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("impassable terrain");
  });

  it("accepts a march onto reachable ground and lays a 4-step path", () => {
    const s = world({ x: 2, y: 2, troops: 10, supply: 100 });
    const r = logic.validateAction(s, "p", { type: "world_march", x: 6, y: 2 });
    expect(r.ok).toBe(true);
    const s2 = logic.applyAction(s, "p", { type: "world_march", x: 6, y: 2 });
    expect(Array.isArray(s2.world.army.path)).toBe(true);
    expect(s2.world.army.path.length).toBe(4);
    expect(s2.world.army.path[s2.world.army.path.length - 1]).toEqual([6, 2]);
  });

  it("moves exactly one plain tile per tick (cost 1)", () => {
    const s = world({ x: 2, y: 2, troops: 10, supply: 100 });
    s.world.army.path = [
      [3, 2],
      [4, 2],
      [5, 2],
    ];
    const after = logic.tick(s);
    expect([after.world.army.x, after.world.army.y]).toEqual([3, 2]);
  });

  it("slows to one forest/hill tile per two ticks (cost 2)", () => {
    const s = world({ x: 2, y: 2, troops: 10, supply: 100 });
    s.world.cells[2 * logic.WWX + 3] = FOREST;
    s.world.army.path = [
      [3, 2],
      [4, 2],
    ];
    const t1 = logic.tick(s);
    expect([t1.world.army.x, t1.world.army.y]).toEqual([2, 2]); // still waiting
    const t2 = logic.tick(t1);
    expect([t2.world.army.x, t2.world.army.y]).toEqual([3, 2]);
  });

  it("rejects an out-of-bounds march", () => {
    const s = world({ x: 2, y: 2, troops: 10, supply: 100 });
    const r = logic.validateAction(s, "p", { type: "world_march", x: -1, y: 2 });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("out of bounds");
  });
});

describe("world slice · desertionCurve (0 supply days → 0 army)", () => {
  it("starves an idle 10-troop army to 0 following the 20%-floor curve", () => {
    let s: any = world({ x: 2, y: 2, troops: 10, supply: 0 });
    const observed: number[] = [];
    for (let d = 0; d < 40; d++) {
      for (let i = 0; i < TICKS_PER_DAY; i++) s = logic.tick(s);
      observed.push(s.world.army.troops);
    }
    let t = 10;
    const expected: number[] = [];
    for (let d = 0; d < 40; d++) {
      t = desertion(t);
      expected.push(t);
    }
    expect(observed).toEqual(expected);
    expect(observed[observed.length - 1]).toBe(0); // fully gone
  });

  it("pins supply at 0 while there are mouths to feed", () => {
    let s: any = world({ x: 2, y: 2, troops: 5, supply: 0 });
    for (let d = 0; d < 5; d++) {
      for (let i = 0; i < TICKS_PER_DAY; i++) s = logic.tick(s);
      expect(s.world.army.supply).toBe(0);
    }
  });
});

describe("world slice · supply cap (200) + resupply clamp", () => {
  function atTown(supply: number) {
    const s = world({ x: 3, y: 3, troops: 10, supply });
    s.world.towns = [{ i: 0, name: "Alderford", x: 3, y: 3, faction: 0, troops: 5 }];
    return s;
  }

  it("rejects resupply when already at the 200 cap", () => {
    const r = logic.validateAction(atTown(200), "p", { type: "world_resupply" });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("already supplied");
  });

  it("requires standing on a friendly (faction 0) town", () => {
    const s = atTown(100);
    s.world.towns = [{ i: 0, name: "Unfriendly", x: 9, y: 9, faction: 1, troops: 5 }];
    const r = logic.validateAction(s, "p", { type: "world_resupply" });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("no friendly town here");
  });

  it("accepts resupply on a friendly town below the cap", () => {
    const r = logic.validateAction(atTown(100), "p", { type: "world_resupply" });
    expect(r.ok).toBe(true);
  });

  it("adds min(20, 200 - supply) and never exceeds 200", () => {
    const a = logic.applyAction(atTown(100), "p", { type: "world_resupply" });
    expect(a.world.army.supply).toBe(120); // +20, below cap

    const b = logic.applyAction(atTown(190), "p", { type: "world_resupply" });
    expect(b.world.army.supply).toBe(200); // climbs to cap

    const c = logic.applyAction(atTown(199), "p", { type: "world_resupply" });
    expect(c.world.army.supply).toBe(200); // clamped
  });

  it("repeated refills reach exactly 200, then are rejected", () => {
    let s = atTown(0);
    let max = 0;
    for (let i = 0; i < 12; i++) {
      s = logic.applyAction(s, "p", { type: "world_resupply" });
      max = Math.max(max, s.world.army.supply);
    }
    expect(max).toBe(200);
    expect(s.world.army.supply).toBe(200);
    const r = logic.validateAction(s, "p", { type: "world_resupply" });
    expect(r.error).toBe("already supplied");
  });
});

describe("world slice · marchCooldown (per-tile step gate)", () => {
  it("advances one tile per tick — no teleport along the path", () => {
    let s: any = world({ x: 2, y: 2, troops: 10, supply: 100 });
    s.world.army.path = [
      [3, 2],
      [4, 2],
      [5, 2],
    ];
    const positions: number[][] = [];
    for (let i = 0; i < 3; i++) {
      s = logic.tick(s);
      positions.push([s.world.army.x, s.world.army.y]);
    }
    expect(positions).toEqual([
      [3, 2],
      [4, 2],
      [5, 2],
    ]);
    expect(s.world.army.path).toBeNull(); // arrived, march cleared
  });

  it("honors the 2-tick gate when the first step is into a slow tile", () => {
    let s: any = world({ x: 2, y: 2, troops: 10, supply: 100 });
    s.world.cells[2 * logic.WWX + 3] = HILL;
    s.world.army.path = [
      [3, 2],
      [4, 2],
    ];
    s = logic.tick(s);
    expect([s.world.army.x, s.world.army.y]).toEqual([2, 2]); // wait=1 < 2
  });
});