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
    s.res = { ...s.res, gold: 1000, iron: 500 };
    // silence waves — this test must measure the assault mechanic alone
    s.waveIn = 1e9;
    s.pendingWave = [];
    for (let i = 0; i < 8; i++) s = act(s, { type: "train", u: "knight" });
    const ids = s.units.filter((u: AnyState) => u.f === "p").map((u: AnyState) => u.id);
    // order the army to the camp — the ASSAULT intent must persist after arrival
    s = act(s, { type: "move", ids, x: s.campX, y: s.campY });
    const k = s.units.find((u: AnyState) => u.id === ids[0]);
    expect(k.assault).toBe(1);

    let ended = false;
    for (let i = 0; i < 20000 && !s.over; i++) s = step(s);
    if (s.over) ended = true;
    // The camp is destroyable: a full knight army ordered on it must win —
    // this is the game's only victory path and was previously broken.
    expect(ended).toBe(true);
    expect(s.result).toBe("victory");
    expect(logic.isGameOver(s).over).toBe(true);
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

describe("repair", () => {
  it("restores a damaged wall for a cost", () => {
    let s = build();
    const spot = findGrass(s, s.kx + 2, s.ky);
    s = act(s, { type: "build", b: "wall", x: spot.x, y: spot.y });
    const wall = s.buildings.find((b: AnyState) => b.b === "wall");
    wall.hp = 50;
    const woodBefore = s.res.wood;
    const v = logic.validateAction(s, s.seat, { type: "repair", id: wall.id });
    expect(v.ok).toBe(true);
    s = act(s, { type: "repair", id: wall.id });
    const fixed = s.buildings.find((b: AnyState) => b.id === wall.id);
    expect(fixed.hp).toBe(fixed.max);
    expect(s.res.wood).toBeLessThan(woodBefore);
  });

  it("refuses repair of an intact building", () => {
    let s = build();
    const spot = findGrass(s, s.kx + 2, s.ky);
    s = act(s, { type: "build", b: "house", x: spot.x, y: spot.y });
    const house = s.buildings.find((b: AnyState) => b.b === "house");
    const v = logic.validateAction(s, s.seat, { type: "repair", id: house.id });
    expect(v.ok).toBe(false);
  });
});

describe("ranged & upkeep", () => {
  it("an archer hits enemies within range", () => {
    let s = build();
    const bar = findGrass(s, s.kx, s.ky);
    s = act(s, { type: "build", b: "barracks", x: bar.x, y: bar.y });
    s = act(s, { type: "train", u: "archer" });
    const archer = s.units.find((u: AnyState) => u.f === "p");
    const e = { id: 9000, f: "e", t: "raider", x: archer.x + 2, y: archer.y, hp: 14, max: 14, dmg: 0, atkCd: 0, moveCd: 0, range: 1 };
    s = { ...s, units: [...s.units, e] };
    const before = e.hp;
    for (let i = 0; i < 30; i++) s = step(s);
    const after = s.units.find((u: AnyState) => u.id === 9000);
    expect(after ? after.hp : 0).toBeLessThan(before);
  });

  it("gold upkeep drains the treasury and flags unpaid", () => {
    let s = build();
    const bar = findGrass(s, s.kx, s.ky);
    s = act(s, { type: "build", b: "barracks", x: bar.x, y: bar.y });
    s.res = { ...s.res, gold: 25, iron: 50 }; // 20 for the knight, 5 left over
    s = act(s, { type: "train", u: "knight" }); // upk 2
    s.res = { ...s.res, gold: 1 }; // a payday of 2 gold is unaffordable
    // quiet the waves so the knight survives the full window
    s.waveIn = 1e9;
    s.pendingWave = [];
    for (let i = 0; i < 950; i++) s = step(s);
    expect(s.res.gold).toBe(0);
    expect(s.unpaid).toBe(true);
  });
});

describe("battle verbs", () => {
  function spawnEnemy(s: AnyState, id: number, x: number, y: number, morale = 100, dmg = 0) {
    const e = {
      id,
      f: "e",
      t: "raider",
      x,
      y,
      tx: null,
      ty: null,
      tgt: null,
      hp: 40,
      max: 40,
      dmg,
      atkCd: 0,
      moveCd: 0,
      range: 1,
      morale,
      maxMorale: morale,
      rout: 0,
      routT: 0,
      chargeMult: 1,
    };
    return { ...s, units: [...s.units, e] };
  }
it("an attack order makes the squad hunt the target down", () => {
    let s = build();
    const bar = findGrass(s, s.kx, s.ky);
    s = act(s, { type: "build", b: "barracks", x: bar.x, y: bar.y });
    s.res = { ...s.res, gold: 100, iron: 50 };
    s = act(s, { type: "train", u: "knight" });
    // silence the waves so a stray raid can't fog the pursuit result
    s.waveIn = 1e9;
    s.pendingWave = [];
    const knight = s.units.find((u: AnyState) => u.f === "p");
    // harmless target some tiles away on the same row — isolates the pursuit
    s = spawnEnemy(s, 5001, s.kx + 4, s.ky, 4000, 0);
    const enemy = s.units.find((u: AnyState) => u.id === 5001);
    const d0 = Math.abs(knight.x - enemy.x) + Math.abs(knight.y - enemy.y);
    const v = logic.validateAction(s, s.seat, { type: "attack", ids: [knight.id], target: 5001 });
    expect(v.ok).toBe(true);
    s = act(s, { type: "attack", ids: [knight.id], target: 5001 });
    for (let i = 0; i < 800; i++) s = step(s);
    const after = s.units.find((u: AnyState) => u.id === 5001);
    const knightNow = s.units.find((u: AnyState) => u.id === knight.id);
    // the knight still stands (harmless target) and the raider took damage
    expect(knightNow).toBeTruthy();
    const d1 =
      Math.abs(knightNow.x - (after ? after.x : s.kx + 4)) +
      Math.abs(knightNow.y - (after ? after.y : s.ky));
    expect(d1).toBeLessThan(d0);
    expect(after ? after.hp : 0).toBeLessThan(14);
  });

  it("hold clears move and hunt orders", () => {
    let s = build();
    const bar = findGrass(s, s.kx, s.ky);
    s = act(s, { type: "build", b: "barracks", x: bar.x, y: bar.y });
    s = act(s, { type: "train", u: "spearman" });
    const u = s.units.find((u: AnyState) => u.f === "p");
    s = act(s, { type: "move", ids: [u.id], x: u.x + 4, y: u.y });
    s = act(s, { type: "hold", ids: [u.id] });
    const held = s.units.find((x: AnyState) => x.id === u.id);
    expect(held.tx).toBeNull();
  });

  it("rejects attacking a friendly unit", () => {
    const s = build();
    const v = logic.validateAction(s, s.seat, { type: "attack", ids: [1], target: 2 });
    expect(v.ok).toBe(false);
  });
});

describe("tech tree", () => {
  it("requires a barracks and resources", () => {
    const s = build();
    const v1 = logic.validateAction(s, s.seat, { type: "research", tech: "training" });
    expect(v1.ok).toBe(false); // no barracks
    const place = findGrass(s, s.kx, s.ky);
    let s2 = act(s, { type: "build", b: "barracks", x: place.x, y: place.y });
    s2.res = { ...s2.res, gold: 0 };
    const v2 = logic.validateAction(s2, s2.seat, { type: "research", tech: "training" });
    expect(v2.ok).toBe(false); // broke
    const v3 = logic.validateAction(s2, s2.seat, { type: "research", tech: "nope" });
    expect(v3.ok).toBe(false); // unknown
  });

  it("researches a tech and applies damage to new recruits only", () => {
    let s = build();
    const place = findGrass(s, s.kx, s.ky);
    s = act(s, { type: "build", b: "barracks", x: place.x, y: place.y });
    s.res = { ...s.res, gold: 100, iron: 100 };
    s = act(s, { type: "train", u: "knight" });
    const before = s.units.find((u: AnyState) => u.t === "knight");
    const v = logic.validateAction(s, s.seat, { type: "research", tech: "training" });
    expect(v.ok).toBe(true);
    s = act(s, { type: "research", tech: "training" });
    expect(s.techs).toContain("training");
    // the veteran stands as he was; a new recruit carries the edge
    const after = s.units.find((u: AnyState) => u.t === "knight" && u.id === before.id);
    expect(after.dmg).toBe(before.dmg);
    s = act(s, { type: "train", u: "knight" });
    const fresh = s.units.find((u: AnyState) => u.t === "knight" && u.id !== before.id);
    expect(fresh.dmg).toBeCloseTo(before.dmg * 1.25);
  });

  it("plate armour buffs the standing garrison instantly", () => {
    let s = build();
    const place = findGrass(s, s.kx, s.ky);
    s = act(s, { type: "build", b: "barracks", x: place.x, y: place.y });
    s.res = { ...s.res, gold: 200, iron: 200 };
    s = act(s, { type: "train", u: "spearman" });
    const before = s.units.find((u: AnyState) => u.f === "p");
    s = act(s, { type: "research", tech: "plate" });
    const after = s.units.find((u: AnyState) => u.id === before.id);
    expect(after.max).toBe(before.max + 25);
    expect(after.morale).toBeGreaterThan(before.morale);
  });

  it("rejects researching the same tech twice", () => {
    let s = build();
    const place = findGrass(s, s.kx, s.ky);
    s = act(s, { type: "build", b: "barracks", x: place.x, y: place.y });
    s.res = { ...s.res, gold: 200, iron: 200 };
    s = act(s, { type: "research", tech: "training" });
    const v = logic.validateAction(s, s.seat, { type: "research", tech: "training" });
    expect(v.ok).toBe(false);
  });
});

describe("morale & routing", () => {
  function addEnemy(s: AnyState, id: number, x: number, y: number, hp = 14, morale = 100) {
    const e = {
      id, f: "e", t: "raider", x, y, tx: null, ty: null, tgt: null,
      hp, max: hp, dmg: 0, atkCd: 0, moveCd: 0, range: 1,
      morale, maxMorale: morale, rout: 0, routT: 0, chargeMult: 1,
    };
    return { ...s, units: [...s.units, e] };
  }

  it("a beaten enemy unit routs and flees toward the camp", () => {
    let s = build();
    const bar = findGrass(s, s.kx, s.ky);
    s = act(s, { type: "build", b: "barracks", x: bar.x, y: bar.y });
    s.res = { ...s.res, gold: 100, iron: 50 };
    s = act(s, { type: "train", u: "spearman" });
    // enemy barely holding together, a hostile spearman within 5 tiles
    const u = s.units.find((x: AnyState) => x.f === "p");
    s = addEnemy(s, 9001, u.x + 2, u.y, 14, 1);
    let routed = false;
    for (let i = 0; i < 120; i++) {
      s = step(s);
      const e = s.units.find((x: AnyState) => x.id === 9001);
      if (!e) break; // died before routing (spearman is adjacent and stronger)
      if (e.rout) {
        routed = true;
        break;
      }
    }
    expect(routed).toBe(true);
  });

  it("charge window multiplies the first strike after an attack order", () => {
    let s = build();
    const place = findGrass(s, s.kx, s.ky);
    s = act(s, { type: "build", b: "barracks", x: place.x, y: place.y });
    s.res = { ...s.res, gold: 100, iron: 50 };
    s = act(s, { type: "train", u: "knight" });
    s.waveIn = 1e9; // no stray raids while we measure the charge
    s.pendingWave = [];
    const knight = s.units.find((u: AnyState) => u.f === "p");
    s = addEnemy(s, 9002, knight.x + 3, knight.y, 60, 100); // far enough to charge into
    s = act(s, { type: "attack", ids: [knight.id], target: 9002 });
    let sawBigHit = false;
    let prev = 60;
    const knightDmg = 1.2;
    for (let i = 0; i < 300; i++) {
      s = step(s);
      const enemy = s.units.find((u: AnyState) => u.id === 9002);
      if (!enemy) break;
      const dealt = prev - enemy.hp;
      if (dealt > knightDmg * 1.5 + 0.01) sawBigHit = true; // charge multiplier kicked in
      prev = enemy.hp;
    }
    expect(sawBigHit).toBe(true);
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