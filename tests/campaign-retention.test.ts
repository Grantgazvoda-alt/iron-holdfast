import { describe, expect, it } from "vitest";
import {
  campaignAchievements,
  nextCampaignGoal,
  retentionView,
} from "../src/campaign-retention";
import { freshProfile } from "../src/progression.js";

function state() {
  return {
    world: {
      army: { troops: 18 },
      towns: [
        { faction: 0 },
        { faction: 0 },
        { faction: 1 },
        { faction: 2 },
      ],
    },
  };
}

describe("campaign retention", () => {
  it("earns first blood from persisted commander wins", () => {
    const commander = freshProfile("grant");
    commander.battles.won = 1;
    commander.battles.played = 1;
    const firstBlood = campaignAchievements(state(), commander, null).find(
      (achievement) => achievement.id === "first_blood",
    );
    expect(firstBlood?.earned).toBe(true);
  });

  it("tracks half-map conquest from authoritative settlement ownership", () => {
    const achievement = campaignAchievements(state(), freshProfile("grant"), null).find(
      (item) => item.id === "land_grabber",
    );
    expect(achievement).toMatchObject({ earned: true, progress: 2, target: 2 });
  });

  it("only awards the iron crown for full campaign victory", () => {
    const lost = campaignAchievements(state(), freshProfile("grant"), {
      result: "campaign_defeat",
    }).find((item) => item.id === "iron_crown");
    const won = campaignAchievements(state(), freshProfile("grant"), {
      result: "campaign_victory",
    }).find((item) => item.id === "iron_crown");
    expect(lost?.earned).toBe(false);
    expect(won?.earned).toBe(true);
  });

  it("always provides a concrete next campaign goal", () => {
    const next = nextCampaignGoal(state(), freshProfile("grant"), null);
    expect(next.id.length).toBeGreaterThan(0);
    expect(next.label.length).toBeGreaterThan(0);
  });

  it("summarizes earned and total milestone counts", () => {
    const view = retentionView(state(), freshProfile("grant"), null);
    expect(view.totalCount).toBe(5);
    expect(view.earnedCount).toBeGreaterThanOrEqual(1);
    expect(view.earnedCount).toBeLessThanOrEqual(view.totalCount);
  });
});
