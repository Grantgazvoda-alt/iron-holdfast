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
// ── campaign-battle + world-lords balance regressions ──────────────────────

describe("campaign battle · deterministic field resolution", () => {
  const base = () => ({
    v: 1,
    id: "t:1:2:2",
    status: "active",
    round: 0,
    day: 1,
    lordId: 1,
    x: 2,
    y: 2,
    terrain: 0, // plain
    player: { troops: 10, morale: 100, casualties: 0 },
    enemy: { troops: 10, morale: 100, casualties: 0 },
    result: null,
    log: [],
  });
  const cm = () => import("../src/campaign-battle.js");

  it("identical inputs → identical outcomes (no randomness)", async () => {
    const cb = await cm();
    const a = cb.stepCampaignBattle(base(), "advance", "advance");
    const b = cb.stepCampaignBattle(base(), "advance", "advance");
    expect(a.player.casualties).toBe(b.player.casualties);
    expect(a.enemy.casualties).toBe(b.enemy.casualties);
    expect(a).toEqual(b);
  });

  it("equal armies with equal orders trade symmetric-ish losses; none exceed troops", async () => {
    const cb = await cm();
    const r = cb.stepCampaignBattle(base(), "advance", "advance");
    expect(r.player.troops).toBeGreaterThanOrEqual(0);
    expect(r.enemy.troops).toBeGreaterThanOrEqual(0);
    expect(r.player.casualties).toBeLessThanOrEqual(100);
    expect(r.enemy.casualties).toBeLessThanOrEqual(100);
    expect(Math.abs(r.player.casualties - r.enemy.casualties)).toBeLessThanOrEqual(10);
  });

  it("stronger army wins over the long run (strength ratio clamp respects 0.45–2.2)", async () => {
    const cb = await cm();
    let b = base();
    b.player.troops = 300;
    b.enemy.troops = 10;
    for (let i = 0; i < 20 && b.status === "active"; i++) b = cb.stepCampaignBattle(b, "charge", "advance");
    expect(b.enemy.troops).toBe(0);
    expect(b.status).not.toBe("active");
    expect(b.result).toBeDefined();
  });

  it("withdraw never lets a side exploit a 0-divisor (no NaN)", async () => {
    const cb = await cm();
    const b = base();
    b.enemy.troops = 0;
    const r = cb.stepCampaignBattle(b, "withdraw", "advance");
    expect(Number.isFinite(r.player.troops)).toBe(true);
    expect(Number.isFinite(r.enemy.troops)).toBe(true);
    expect(Number.isNaN(r.player.troops)).toBe(false);
  });

  it("does not consume Date.now/Math.random (determinism contract for sim)", async () => {
    const src = await (await import("node:fs")).promises.readFile("src/campaign-battle.js", "utf8");
    expect(src).not.toMatch(/Math\.random|Date\s*\.\s*now/);
  });
});

describe("world economy · tax & paid resupply (deterministic)", () => {
  const eco = () => import("../src/world-economy.ts");

  it("taxPerFriendlyTownPerDay mints 2 gold/day/town via stepWorldEconomy", async () => {
    const m = await eco();
    const s = {
      world: {
        W: 4,
        H: 4,
        cells: new Array(16).fill(0),
        day: 5,
        towns: [
          { x: 1, y: 1, faction: 0 },
          { x: 2, y: 2, faction: 0 },
        ],
        lastTaxDay: 3,
        army: { troops: 10, supply: 100, x: 1, y: 1, path: null, wait: 0 },
        lords: [],
      },
      res: { gold: 0 },
    };
    const r = m.stepWorldEconomy(s);
    expect(r.res.gold).toBe(8); // 2 towns × (5-0) days × 2 gold
    expect(r.world.lastTaxDay).toBe(5);
    // idempotent — re-running with same day mints nothing
    const r2 = m.stepWorldEconomy(r);
    expect(r2.res.gold).toBe(8);
  });

  it("paid resupply respects cap 200 and cost supplyPerGold=5", async () => {
    const m = await eco();
    const s = {
      world: {
        W: 4,
        H: 4,
        cells: new Array(16).fill(0),
        day: 6,
        towns: [{ i: 0, name: "Alderford", x: 1, y: 1, faction: 0 }],
        army: { x: 1, y: 1, troops: 10, supply: 190 },
        lords: [],
      },
      res: { gold: 100 },
    };
    expect(m.WORLD_ECONOMY.supplyCap).toBe(200);
    expect(m.WORLD_ECONOMY.supplyPerGold).toBe(5);
    expect(m.WORLD_ECONOMY.maxSupplyPurchase).toBe(20);

    const quote = m.quotePaidWorldResupply(s);
    expect(quote).not.toBeNull();
    if (quote) {
      expect(quote.goldCost).toBeGreaterThan(0);
      expect(quote.supplyAdded).toBeGreaterThan(0);
      // applying never exceeds cap
      const after = m.applyPaidWorldResupply(s);
      expect(after.world.army.supply).toBeLessThanOrEqual(200);
    }
  });

  it("validatePaidResupply rejects standing on a non-friendly tile", async () => {
    const m = await eco();
    const s = {
      world: {
        W: 4,
        H: 4,
        cells: new Array(16).fill(0),
        day: 6,
        towns: [{ i: 0, name: "Unfriendly", x: 9, y: 9, faction: 1 }],
        army: { x: 9, y: 9, troops: 10, supply: 100 },
        lords: [],
      },
      res: { gold: 0 },
    };
    const r = m.validatePaidWorldResupply(s);
    expect(r.ok).toBe(false);
  });
});
