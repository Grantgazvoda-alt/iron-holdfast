import { describe, expect, it } from "vitest";
import {
  FORMATIONS,
  COMMANDER_PROFILES,
  formationSlots,
  cohesionScore,
  formationModifiers,
  chooseAttackSector,
  choosePosture,
} from "../src/tactics.js";

describe("premium tactics foundation", () => {
  it("defines five distinct formations", () => {
    expect(Object.keys(FORMATIONS)).toEqual(["line", "shieldwall", "loose", "wedge", "reserve"]);
    expect(FORMATIONS.shieldwall.defense).toBeGreaterThan(FORMATIONS.line.defense);
    expect(FORMATIONS.wedge.charge).toBeGreaterThan(FORMATIONS.line.charge);
    expect(FORMATIONS.loose.missile).toBeGreaterThan(FORMATIONS.line.missile);
  });

  it("generates deterministic formation slots", () => {
    const a = formationSlots("line", 12, 20, 10, Math.PI / 4);
    const b = formationSlots("line", 12, 20, 10, Math.PI / 4);
    expect(a).toEqual(b);
    expect(a).toHaveLength(12);
  });

  it("creates a wedge that gains ranks with depth", () => {
    const slots = formationSlots("wedge", 9, 0, 0, 0);
    expect(slots).toHaveLength(9);
    expect(slots[0].rank).toBe(0);
    expect(Math.max(...slots.map((s) => s.rank))).toBeGreaterThan(1);
  });

  it("reports full cohesion when units occupy their slots", () => {
    const slots = formationSlots("shieldwall", 6, 10, 10, 0);
    const units = slots.map((s) => ({ x: s.x, y: s.y }));
    expect(cohesionScore(units, slots)).toBe(1);
  });

  it("degrades formation bonuses as cohesion collapses", () => {
    const ordered = formationModifiers("shieldwall", 1);
    const broken = formationModifiers("shieldwall", 0);
    expect(ordered.defense).toBeGreaterThan(1);
    expect(broken.defense).toBe(1);
    expect(broken.morale).toBe(1);
  });

  it("gives each commander a distinct tactical identity", () => {
    expect(COMMANDER_PROFILES.red_wolf.preferredFormation).toBe("wedge");
    expect(COMMANDER_PROFILES.blackthorn.rangedBias).toBeGreaterThan(0.8);
    expect(COMMANDER_PROFILES.iron_viper.weakPointBias).toBe(1);
    expect(COMMANDER_PROFILES.ashen_crown.heavyBias).toBe(1);
  });

  it("Iron Viper prefers a vulnerable sector over a strong wall", () => {
    const pick = chooseAttackSector("iron_viper", [
      { id: "gate", wallStrength: 0.9, defenderStrength: 0.8, vulnerability: 0.1, distance: 0.2 },
      { id: "east", wallStrength: 0.2, defenderStrength: 0.25, vulnerability: 0.95, distance: 0.45 },
    ]);
    expect(pick?.sector.id).toBe("east");
  });

  it("Red Wolf assaults an open breach", () => {
    expect(choosePosture("red_wolf", { ownMorale: 0.9, ownStrength: 1, enemyStrength: 1, breachOpen: true })).toBe("assault");
  });

  it("Blackthorn harasses when there is no breach", () => {
    expect(choosePosture("blackthorn", { ownMorale: 0.8, ownStrength: 1, enemyStrength: 1, breachOpen: false })).toBe("harass");
  });

  it("all commanders withdraw when badly broken", () => {
    for (const id of Object.keys(COMMANDER_PROFILES)) {
      expect(choosePosture(id, { ownMorale: 0.1, ownStrength: 0.3, enemyStrength: 1 })).toBe("withdraw");
    }
  });
});
