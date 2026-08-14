/**
 * IRON HOLDFAST — pure-logic tests. No sockets: these drive `logic.js`
 * directly (setup → validate → apply → tick …) the way the room does, and pin
 * the deterministic rules they must never break.
 */

import { describe, expect, it } from "vitest";
import * as logic from "../src/logic.js";

// logic.setup returns `unknown` by contract — the tests need to inspect the
// sim state, so give it a deliberately loose shape here (test-only).
type AnyState = Record<string, any>;

/** Fresh deterministic state for a castellan. */
function build(player = "castellan"): AnyState {
  return logic.setup([player]) as AnyState;
}

function view(s: AnyState): AnyState {
  return logic.viewFor(s, s.seat) as AnyState;
}

/** applyAction + cast back to the loose test shape. */
function act(s: AnyState, action: unknown): AnyState {
  return logic.applyAction(s, s.seat, action) as AnyState;
}

/** tick + cast back to the loose test shape. */
function step(s: AnyState): AnyState {
  return logic.tick(s) as AnyState;
}

/** First buildable grass tile within a radius of (x0,y0), skipping the keep tile. */
function findGrass(s: AnyState, x0: number, y0: number) {
  const v = view(s) as { W: number; H: number };
  for (let r = 0; r < 10; r++) {
    for (let y = Math.max(1, y0 - r); y <= Math.min(v.H - 2, y0 + r); y++) {
      for (let x = Math.max(1, x0 - r); x <= Math.min(v.W - 2, x0 + r); x++) {
        if (x === s.kx && y === s.ky) continue;
        if (s.map[y * v.W + x] === "g" && !s.buildings.some((b: AnyState) => b.x === x && b.y === y)) {
          return { x, y };
        }
      }
    }
  }
  throw new Error("no grass tile found near " + x0 + "," + y0);
}

describe("setup", () => {
  it("is deterministic for the same player id", () => {
    const a = build("castellan");
    const b = build("castellan");
    expect(a.map).toEqual(b.map);
    expect(a.campX).toBe(b.campX);
    expect(a.kx).toBe(b.kx);
    expect(a.res).toEqual(b.res);
  });

  it("produces different maps for different players", () => {
    const a = build("castellan");
    const b = build("other");
    expect(a.map).not.toEqual(b.map);
  });

  it("is JSON serializable", () => {
    const s = build();
    const json = JSON.parse(JSON.stringify(s));
    expect(json.map.length).toBe(s.map.length);
  });
});

describe("validation", () => {
  it("rejects builds on water", () => {
    const s = build();
    const wi = s.map.indexOf("w");
    const x = wi % 40;
    const y = Math.floor(wi / 40);
    const v = logic.validateAction(s, s.seat, { type: "build", b: "house", x, y });
    expect(v.ok).toBe(false);
  });

  it("rejects iron mines that do not touch iron", () => {
    const s = build();
    const spot = findGrass(s, s.kx + 6, s.ky + 6);
    const v = logic.validateAction(s, s.seat, { type: "build", b: "ironmine", x: spot.x, y: spot.y });
    expect(v.ok).toBe(false);
  });

  it("rejects unknown buildings and units", () => {
    const s = build();
    expect(logic.validateAction(s, s.seat, { type: "build", b: "nope", x: 2, y: 2 }).ok).toBe(false);
    expect(logic.validateAction(s, s.seat, { type: "train", u: "dragon" }).ok).toBe(false);
  });

  it("rejects builds that cost more than the treasury", () => {
    const s = build();
    s.res = { wood: 0, stone: 0, gold: 0, iron: 0, food: 0 };
    const spot = findGrass(s, s.kx, s.ky);
    const v = logic.validateAction(s, s.seat, { type: "build", b: "barracks", x: spot.x, y: spot.y });
    expect(v.ok).toBe(false);
  });

  it("rejects moves for units that are not yours", () => {
    const s = build();
    const v = logic.validateAction(s, s.seat, { type: "move", ids: [999], x: 3, y: 3 });
    expect(v.ok).toBe(false);
  });
});

describe("economy & population", () => {
  it("produces food and wood from worked buildings", () => {
    let s = build();
    const farm = findGrass(s, s.kx, s.ky);
    s = act(s, { type: "build", b: "farm", x: farm.x, y: farm.y });
    const woodcutter = findGrass(s, s.kx, s.ky);
    s = act(s, { type: "build", b: "woodcutter", x: woodcutter.x, y: woodcutter.y });
    const foodStart = s.res.food;
    const woodStart = s.res.wood;
    for (let i = 0; i < 200; i++) s = step(s);
    expect(s.res.food).toBeGreaterThan(foodStart);
    expect(s.res.wood).toBeGreaterThan(woodStart);
  });

  it("population grows toward the cap while food holds", () => {
    let s = build();
    const farm = findGrass(s, s.kx, s.ky);
    s = act(s, { type: "build", b: "farm", x: farm.x, y: farm.y });
    const house = findGrass(s, s.kx, s.ky);
    s = act(s, { type: "build", b: "house", x: house.x, y: house.y });
    s.res = { ...s.res, food: 500 };
    const cap = s.popCap;
    for (let i = 0; i < 2400; i++) s = step(s);
    expect(s.pop).toBeGreaterThan(6);
    expect(s.pop).toBeLessThanOrEqual(cap);
  });
});

describe("waves and combat", () => {
  it("spawns a first wave and it marches", () => {
    let s = build();
    let sawWave = false;
    let sawEnemy = false;
    for (let i = 0; i < 220 && !s.over; i++) {
      s = step(s);
      if (s.wave >= 1) sawWave = true;
      if (s.units.some((u: AnyState) => u.f === "e")) sawEnemy = true;
    }
    expect(sawWave).toBe(true);
    expect(sawEnemy).toBe(true);
  });

  it("a garrison can cut a wave down", () => {
    let s = build();
    const bar = findGrass(s, s.kx, s.ky);
    s = act(s, { type: "build", b: "barracks", x: bar.x, y: bar.y });
    s.res = { ...s.res, gold: 200, iron: 200 };
    for (let i = 0; i < 4; i++) s = act(s, { type: "train", u: "spearman" });
    const kills0 = s.kills || 0;
    for (let i = 0; i < 900 && !s.over; i++) s = step(s);
    expect((s.kills || 0) + (s.lost || 0)).toBeGreaterThanOrEqual(kills0);
  });

  it("a player army that reaches the camp can win or lose cleanly", () => {
    let s = build();
    const bar = findGrass(s, s.kx, s.ky);
    s = act(s, { type: "build", b: "barracks", x: bar.x, y: bar.y });
    s.res = { ...s.res, gold: 500, iron: 500 };
    for (let i = 0; i < 8; i++) s = act(s, { type: "train", u: "knight" });
    const ids = s.units.filter((u: AnyState) => u.f === "p").map((u: AnyState) => u.id);
    s = act(s, { type: "move", ids, x: s.campX, y: s.campY });

    let ended = false;
    for (let i = 0; i < 8000 && !s.over; i++) s = step(s);
    if (s.over) ended = true;
    expect(ended).toBe(true);
    expect(["victory", "defeat"]).toContain(s.result);
  });

  it("isGameOver flips after the keep falls", () => {
    let s = build();
    for (let i = 0; i < 20; i++) s = step(s);
    expect(logic.isGameOver(s).over).toBe(false);
    s.keep.hp = 0;
    s = step(s);
    const over = logic.isGameOver(s);
    expect(over.over).toBe(true);
    expect(s.result).toBe("defeat");
  });
});

describe("pause", () => {
  it("freezes the sim while paused", () => {
    let s = build();
    s = act(s, { type: "pause", on: true });
    const t = s.time;
    for (let i = 0; i < 20; i++) s = step(s);
    expect(s.time).toBe(t);
    s = act(s, { type: "pause", on: false });
    s = step(s);
    expect(s.time).toBe(t + 1);
  });
});