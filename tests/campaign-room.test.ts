import { describe, expect, it } from "vitest";
import {
  enemyCampaignBattleOrder,
  isCampaignBattleOrderAction,
} from "../src/campaign-room";
import type { CampaignBattle } from "../src/campaign-battle.js";

function battle(overrides: Partial<CampaignBattle> = {}): CampaignBattle {
  return {
    v: 1,
    id: "4:1:2:2",
    status: "active",
    round: 0,
    day: 4,
    lordId: 1,
    lordName: "Lord Roderick",
    x: 2,
    y: 2,
    terrain: 0,
    terrainName: "open ground",
    player: { troops: 20, morale: 100, casualties: 0 },
    enemy: { troops: 18, morale: 100, casualties: 0 },
    result: null,
    log: [],
    ...overrides,
  };
}

describe("campaign room boundary", () => {
  it("accepts only known field-order actions", () => {
    expect(isCampaignBattleOrderAction({ type: "campaign_battle_order", order: "hold" })).toBe(true);
    expect(isCampaignBattleOrderAction({ type: "campaign_battle_order", order: "advance" })).toBe(true);
    expect(isCampaignBattleOrderAction({ type: "campaign_battle_order", order: "charge" })).toBe(true);
    expect(isCampaignBattleOrderAction({ type: "campaign_battle_order", order: "withdraw" })).toBe(true);
    expect(isCampaignBattleOrderAction({ type: "campaign_battle_order", order: "teleport" })).toBe(false);
    expect(isCampaignBattleOrderAction({ type: "build", order: "hold" })).toBe(false);
    expect(isCampaignBattleOrderAction(null)).toBe(false);
  });

  it("withdraws a rival whose morale is breaking", () => {
    const b = battle({ enemy: { troops: 18, morale: 20, casualties: 2 } });
    expect(enemyCampaignBattleOrder(b)).toBe("withdraw");
  });

  it("charges when the rival has a decisive numbers advantage", () => {
    const b = battle({
      player: { troops: 10, morale: 80, casualties: 0 },
      enemy: { troops: 20, morale: 80, casualties: 0 },
    });
    expect(enemyCampaignBattleOrder(b)).toBe("charge");
  });

  it("holds when badly outnumbered", () => {
    const b = battle({
      player: { troops: 30, morale: 80, casualties: 0 },
      enemy: { troops: 12, morale: 80, casualties: 0 },
    });
    expect(enemyCampaignBattleOrder(b)).toBe("hold");
  });

  it("uses a stable round cadence for otherwise even fights", () => {
    expect(enemyCampaignBattleOrder(battle({ round: 0 }))).toBe("advance");
    expect(enemyCampaignBattleOrder(battle({ round: 2 }))).toBe("charge");
    expect(enemyCampaignBattleOrder(battle({ round: 3 }))).toBe("advance");
  });
});
