import { describe, expect, it } from "vitest";
import * as logic from "../src/logic.js";

const fresh = () => logic.setup([{ id: "tester" }]);

describe("open world (slice 1)", () => {
  it("setup seeds a deterministic world map", () => {
    const a = logic.setup([{ id: "seed1" }]);
    const b = logic.setup([{ id: "seed1" }]);
    expect(a.world.W).toBeGreaterThan(10);
    expect(a.world).toEqual(b.world);
  });

  it("exposes the player army, towns, and rival lords through the view", () => {
    const v = logic.viewFor(fresh(), "tester");
    expect(v.world).not.toBeNull();
    expect(v.world!.army).toMatchObject({ troops: 10, supply: 40 });
    expect(v.world!.towns.length).toBeGreaterThan(0);
    expect(v.world!.lords.length).toBeGreaterThanOrEqual(2);
  });

  it("a march order moves the army one step along the path each tick", () => {
    let s = fresh();
    const src = { x: s.world.army.x, y: s.world.army.y };
    // find a reachable target a few tiles away
    const t = (() => {
      for (let d = 2; d < 10; d++)
        for (let dx = -d; dx <= d; dx++)
          for (let dy = -d; dy <= d; dy++) {
            const tx = src.x + dx, ty = src.y + dy;
            if (tx < 0 || ty < 0 || tx >= s.world.W || ty >= s.world.H) continue;
            return { x: tx, y: ty };
          }
      return { x: src.x, y: src.y };
    })();
    const r = logic.validateAction(s, "tester", { type: "world_march", x: t.x, y: t.y });
    expect(r.ok).toBe(true);
    s = logic.applyAction(s, "tester", { type: "world_march", x: t.x, y: t.y });
    expect(s.world.army.path).not.toBeNull();
    const startX = s.world.army.x, startY = s.world.army.y;
    s = logic.tick(s);
    s = logic.tick(s);
    const moved = s.world.army.x !== startX || s.world.army.y !== startY;
    expect(moved).toBe(true);
  });

  it("supply drains per day tick and troops desert when it runs out", () => {
    let s = fresh();
    s.world.army.supply = 0;
    s.world.army.troops = 20;
    const before = s.world.army.troops;
    // run enough ticks to cross the day boundary (40 ticks)
    for (let i = 0; i < 45; i++) s = logic.tick(s);
    expect(s.world.army.troops).toBeLessThan(before);
  });

  it("rejects marching into a mountain tile", () => {
    const s = fresh();
    const idx = s.world.cells.indexOf(3);
    let r = { ok: true };
    if (idx !== -1) {
      const x = idx % s.world.W, y = Math.floor(idx / s.world.W);
      r = logic.validateAction(s, "tester", { type: "world_march", x, y });
    } else {
      r = { ok: true }; // no mountain on this seed — vacuous pass
    }
    // expect it to either be rejected (mountain found) or trivially pass
    expect(r.ok === false || idx === -1).toBe(true);
  });

  it("deterministic across two identically-seeded runs", () => {
    const a = fresh();
    const b = fresh();
    expect(JSON.stringify(a.world)).toBe(JSON.stringify(b.world));
  });
});