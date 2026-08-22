import { describe, expect, it } from "vitest";
import type { CampaignBattle } from "../src/campaign-battle.js";
import {
  applyCommanderAction,
  campaignBattleDifficulty,
  commanderView,
  isCommanderAction,
  rewardCampaignBattle,
} from "../src/campaign-progression";
import { freshProfile } from "../src/progression.js";

function battle(result: CampaignBattle["result"] = "victory"): CampaignBattle {
  return {
    v: 1,
    id: "1:1:2:2",
    status: "resolved",
    round: 8,
    day: 1,
    lordId: 1,
    lordName: "Roderick",
    x: 2,
    y: 2,
    terrain: 0,
    terrainName: "open ground",
    player: { troops: 12, morale: 60, casualties: 8 },
    enemy: { troops: 0, morale: 0, casualties: 20 },
    result,
    log: [],
  };
}

describe("campaign commander progression", () => {
  it("accepts only known commander actions", () => {
    expect(isCommanderAction({ type: "commander_choose_path", path: "marshal" })).toBe(true);
    expect(isCommanderAction({ type: "commander_choose_path", path: "wizard" })).toBe(false);
    expect(isCommanderAction({ type: "commander_unlock", nodeId: "drillmaster" })).toBe(true);
  });

  it("derives difficulty from initial army strengths", () => {
    expect(campaignBattleDifficulty(battle())).toBe(1);
    const hard = battle();
    hard.enemy = { troops: 0, morale: 0, casualties: 40 };
    expect(campaignBattleDifficulty(hard)).toBe(2);
  });

  it("awards XP, renown, and a win for campaign victory", () => {
    const reward = rewardCampaignBattle(freshProfile("grant"), battle("victory"));
    expect(reward.earnedXp).toBeGreaterThan(0);
    expect(reward.earnedRenown).toBeGreaterThan(0);
    expect(reward.profile.battles.played).toBe(1);
    expect(reward.profile.battles.won).toBe(1);
  });

  it("records defeat without pretending it was a win", () => {
    const reward = rewardCampaignBattle(freshProfile("grant"), battle("defeat"));
    expect(reward.profile.battles.played).toBe(1);
    expect(reward.profile.battles.lost).toBe(1);
    expect(reward.profile.battles.won).toBe(0);
  });

  it("locks a commander path once deliberately chosen", () => {
    const profile = freshProfile("grant");
    const chosen = applyCommanderAction(profile, { type: "commander_choose_path", path: "marshal" });
    expect(chosen.ok).toBe(true);
    if (!chosen.ok) return;
    expect(chosen.profile.path).toBe("marshal");
    const change = applyCommanderAction(chosen.profile, { type: "commander_choose_path", path: "vanguard" });
    expect(change.ok).toBe(false);
  });

  it("exposes progression data without leaking mutable profile internals", () => {
    const view = commanderView(freshProfile("grant"));
    expect(view).toMatchObject({ level: 1, xp: 0, renown: 0, path: null });
    expect(Array.isArray(view.availableUnlocks)).toBe(true);
  });
});
