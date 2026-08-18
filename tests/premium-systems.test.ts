import { describe, expect, it } from "vitest";
import { createOrder, normalizeGroup, tacticalSnapshot } from "../src/tactical-orders.js";
import { ARMOR, WEAPONS, blockResult, meleeDamage, projectileAt, recoverStamina } from "../src/combat-model.js";
import { availableUnlocks, freshProfile, grantBattleResult, normalizeProfile, unlock } from "../src/progression.js";

describe("tactical orders", () => {
  it("deduplicates group membership and clamps facing", () => {
    const g = normalizeGroup({ id: "alpha", unitIds: [1, 1, 2], formation: "shieldwall", facing: 99 });
    expect(g.unitIds).toEqual([1, 2]);
    expect(g.formation).toBe("shieldwall");
    expect(g.facing).toBeLessThanOrEqual(Math.PI);
  });
  it("rejects invalid orders and normalizes valid targets", () => {
    expect(createOrder("dance").ok).toBe(false);
    const order = createOrder("move", { x: 12, y: 7 });
    expect(order.ok).toBe(true);
    expect(order.order?.target).toEqual({ x: 12, y: 7 });
  });
  it("calculates an ordered formation snapshot", () => {
    const group = normalizeGroup({ id: "a", unitIds: [1, 2], formation: "line", anchor: { x: 5, y: 5 } });
    const snap = tacticalSnapshot(group, [{ id: 1, x: 4.5, y: 5 }, { id: 2, x: 5.5, y: 5 }]);
    expect(snap.cohesion).toBeGreaterThan(0.8);
  });
});

describe("grounded combat model", () => {
  it("gives spear more reach than sword", () => expect(WEAPONS.spear.reach).toBeGreaterThan(WEAPONS.sword.reach));
  it("plate mitigates sword slashes more than cloth", () => {
    const cloth = meleeDamage({ weapon: "sword", armor: "cloth", attackType: "slash" });
    const plate = meleeDamage({ weapon: "sword", armor: "plate", attackType: "slash" });
    expect(plate).toBeLessThan(cloth);
  });
  it("supports deterministic parry windows", () => {
    expect(blockResult({ incoming: 30, shieldCoverage: 0.9, facingDot: 1, blockStamina: 30, parryWindow: true }).outcome).toBe("parry");
  });
  it("applies gravity to arrows", () => {
    const early = projectileAt({ velocityX: 20, velocityZ: 8, time: 0.25 });
    const late = projectileAt({ velocityX: 20, velocityZ: 8, time: 2 });
    expect(late.x).toBeGreaterThan(early.x);
    expect(late.z).toBeLessThan(early.z + 20);
  });
  it("heavy armor slows stamina recovery", () => {
    const cloth = recoverStamina(20, 100, 1, { armor: "cloth" });
    const plate = recoverStamina(20, 100, 1, { armor: "plate" });
    expect(cloth).toBeGreaterThan(plate);
    expect(ARMOR.plate.weight).toBeGreaterThan(ARMOR.cloth.weight);
  });
});

describe("commander progression", () => {
  it("normalizes malformed profiles safely", () => {
    const p = normalizeProfile({ xp: -99, path: "invalid", unlocks: ["x", "x", 4] });
    expect(p.xp).toBe(0);
    expect(p.path).toBeNull();
    expect(p.unlocks).toEqual(["x"]);
  });
  it("rewards wins and tracks battle history", () => {
    const result = grantBattleResult(freshProfile("grant"), { won: true, waves: 5, difficulty: 1.5, directCombat: true });
    expect(result.earnedXp).toBeGreaterThan(100);
    expect(result.profile.battles.won).toBe(1);
    expect(result.profile.renown).toBeGreaterThan(0);
  });
  it("gates path unlocks by commander level", () => {
    const p = normalizeProfile({ ...freshProfile(), xp: 1000, path: "warden" });
    const available = availableUnlocks(p);
    expect(available.length).toBeGreaterThan(0);
    const result = unlock(p, available[0].id);
    expect(result.ok).toBe(true);
  });
});
