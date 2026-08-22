import { describe, expect, it } from "vitest";
import {
  createCampaignBattle,
  detectWorldEncounter,
  reconcileCampaignBattle,
  stepCampaignBattle,
} from "../src/campaign-battle.js";

function world() {
  return {
    W: 6,
    H: 6,
    cells: new Array(36).fill(0),
    day: 4,
    army: { x: 2, y: 2, troops: 20, supply: 60, path: [[3, 2]], wait: 0 },
    lords: [
      { id: 2, name: "Lady Isolde", x: 2, y: 2, troops: 18, supply: 20, path: [[1, 2]], wait: 0 },
      { id: 1, name: "Lord Roderick", x: 2, y: 2, troops: 16, supply: 20, path: null, wait: 0 },
    ],
  };
}

describe("campaign battle coordinator", () => {
  it("detects contact deterministically and picks the lowest rival id", () => {
    const encounter = detectWorldEncounter(world());
    expect(encounter?.id).toBe(1);
    expect(encounter?.name).toBe("Lord Roderick");
  });

  it("ignores defeated/recovering rivals", () => {
    const w = world();
    w.lords[1].recoveryUntilDay = 7;
    const encounter = detectWorldEncounter(w);
    expect(encounter?.id).toBe(2);
  });

  it("creates the same battle from the same world state", () => {
    const a = createCampaignBattle(world(), 1);
    const b = createCampaignBattle(world(), 1);
    expect(a).toEqual(b);
    expect(a.id).toBe("4:1:2:2");
    expect(a.status).toBe("active");
  });

  it("rejects battles when armies are not in contact", () => {
    const w = world();
    w.lords[1].x = 4;
    expect(() => createCampaignBattle(w, 1)).toThrow("armies are not in contact");
  });

  it("resolves battle rounds deterministically", () => {
    const initial = createCampaignBattle(world(), 1);
    const a = stepCampaignBattle(initial, "hold", "charge");
    const b = stepCampaignBattle(initial, "hold", "charge");
    expect(a).toEqual(b);
    expect(a.round).toBe(1);
    expect(a.player.troops).toBeLessThan(initial.player.troops);
    expect(a.enemy.troops).toBeLessThan(initial.enemy.troops);
  });

  it("does not create duplicate progression after resolution", () => {
    const initial = createCampaignBattle(world(), 1);
    const resolved = { ...initial, status: "resolved", result: "victory" };
    expect(stepCampaignBattle(resolved, "charge", "hold")).toBe(resolved);
  });

  it("reconciles casualties and freezes both movement paths", () => {
    const initial = createCampaignBattle(world(), 1);
    const resolved = {
      ...initial,
      status: "resolved",
      result: "enemy_withdrew",
      player: { ...initial.player, troops: 14, casualties: 6 },
      enemy: { ...initial.enemy, troops: 8, casualties: 8 },
    };
    const next = reconcileCampaignBattle(world(), resolved);
    expect(next.army.troops).toBe(14);
    expect(next.army.path).toBeNull();
    const lord = next.lords.find((entry) => entry.id === 1)!;
    expect(lord.troops).toBe(8);
    expect(lord.path).toBeNull();
    expect(lord.recoveryUntilDay).toBe(5);
  });

  it("marks a defeated rival for deterministic recovery", () => {
    const initial = createCampaignBattle(world(), 1);
    const resolved = {
      ...initial,
      status: "resolved",
      result: "victory",
      player: { ...initial.player, troops: 12, casualties: 8 },
      enemy: { ...initial.enemy, troops: 0, casualties: 16 },
    };
    const next = reconcileCampaignBattle(world(), resolved);
    const lord = next.lords.find((entry) => entry.id === 1)!;
    expect(lord.troops).toBe(0);
    expect(lord.defeated).toBe(true);
    expect(lord.recoveryUntilDay).toBe(7);
  });

  it("makes player defeat an explicit campaign consequence", () => {
    const initial = createCampaignBattle(world(), 1);
    const resolved = {
      ...initial,
      status: "resolved",
      result: "defeat",
      player: { ...initial.player, troops: 0, casualties: 20 },
      enemy: { ...initial.enemy, troops: 7, casualties: 9 },
    };
    const next = reconcileCampaignBattle(world(), resolved);
    expect(next.army.troops).toBe(0);
    expect(next.army.defeated).toBe(true);
  });
});
