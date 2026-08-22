import { describe, expect, it } from "vitest";
import {
  routeSupplyWeight,
  terrainBattleNote,
  terrainTacticalProfile,
} from "../src/world-terrain.js";

describe("overworld terrain tactics", () => {
  it("gives forest and hills real defensive value", () => {
    const forest = terrainTacticalProfile(1);
    const hill = terrainTacticalProfile(2);
    expect(forest.defender).toBeGreaterThan(1);
    expect(forest.ambush).toBeGreaterThan(0);
    expect(hill.defender).toBeGreaterThan(forest.defender);
    expect(hill.attacker).toBeLessThan(1);
  });

  it("penalizes a river-crossing attacker", () => {
    const river = terrainTacticalProfile(4);
    expect(river.attacker).toBeLessThan(1);
    expect(river.defender).toBeGreaterThan(1);
  });

  it("keeps mountains strategically impassable", () => {
    const mountain = terrainTacticalProfile(3);
    expect(Number.isFinite(mountain.marchTicks)).toBe(false);
    expect(Number.isFinite(mountain.supplyWeight)).toBe(false);
  });

  it("computes route burden from terrain instead of tile count alone", () => {
    const world = {
      W: 4,
      H: 2,
      cells: [0, 0, 1, 2, 0, 4, 3, 0],
    };
    expect(routeSupplyWeight(world, [[1, 0], [2, 0], [3, 0]])).toBe(5);
    expect(routeSupplyWeight(world, [[1, 1]])).toBe(1.5);
    expect(routeSupplyWeight(world, [[2, 1]])).toBe(Infinity);
  });

  it("produces player-readable terrain explanations", () => {
    expect(terrainBattleNote(1)).toMatch(/Forest/i);
    expect(terrainBattleNote(2)).toMatch(/High ground/i);
    expect(terrainBattleNote(4)).toMatch(/Crossing/i);
  });
});
