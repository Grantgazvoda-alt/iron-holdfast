import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_DIFFICULTIES,
  applyCampaignDifficulty,
  isCampaignDifficultyAction,
  normalizeCampaignDifficulty,
} from "../src/campaign-difficulty";

function state() {
  return {
    world: {
      army: { supply: 40, troops: 10 },
      lords: [
        { id: 1, troops: 20 },
        { id: 2, troops: 30 },
      ],
    },
  };
}

describe("campaign difficulty", () => {
  it("normalizes unknown values to standard", () => {
    expect(normalizeCampaignDifficulty("warlord")).toBe("warlord");
    expect(normalizeCampaignDifficulty("pay-to-win")).toBe("standard");
    expect(normalizeCampaignDifficulty(null)).toBe("standard");
  });

  it("validates only known difficulty actions", () => {
    expect(
      isCampaignDifficultyAction({ type: "campaign_set_difficulty", difficulty: "squire" }),
    ).toBe(true);
    expect(
      isCampaignDifficultyAction({ type: "campaign_set_difficulty", difficulty: "nightmare" }),
    ).toBe(false);
  });

  it("makes Squire genuinely more forgiving", () => {
    const next = applyCampaignDifficulty(state(), "squire");
    expect(next.world.army.supply).toBeGreaterThan(40);
    expect(next.world.lords[0].troops).toBeLessThan(20);
  });

  it("makes Warlord genuinely harder", () => {
    const next = applyCampaignDifficulty(state(), "warlord");
    expect(next.world.army.supply).toBeLessThan(40);
    expect(next.world.lords[0].troops).toBeGreaterThan(20);
  });

  it("standard preserves intended starting balance", () => {
    const next = applyCampaignDifficulty(state(), "standard");
    expect(next.world.army.supply).toBe(40);
    expect(next.world.lords.map((lord: any) => lord.troops)).toEqual([20, 30]);
  });

  it("applies only once so hibernation/reload cannot multiply difficulty", () => {
    const once = applyCampaignDifficulty(state(), "warlord");
    expect(applyCampaignDifficulty(once, "warlord")).toBe(once);
  });

  it("contains no commercial or paid modifiers", () => {
    for (const profile of Object.values(CAMPAIGN_DIFFICULTIES)) {
      expect(profile).not.toHaveProperty("price");
      expect(profile).not.toHaveProperty("purchase");
      expect(profile).not.toHaveProperty("sku");
    }
  });
});
