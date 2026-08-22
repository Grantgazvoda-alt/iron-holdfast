import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_SAVE_VERSION,
  campaignSnapshotSummary,
  exportCampaignSnapshot,
  importCampaignSnapshot,
  normalizeCampaignGame,
} from "../src/campaign-save";

function game() {
  return normalizeCampaignGame({
    status: "playing",
    seats: ["grant"],
    claims: { grant: "socket-1" },
    state: {
      time: 123,
      world: {
        day: 7,
        army: { troops: 18 },
        towns: [
          { faction: 0 },
          { faction: 0 },
          { faction: 1 },
        ],
      },
    },
    result: null,
  });
}

describe("campaign save schema", () => {
  it("normalizes pre-versioned room state into the current schema", () => {
    const normalized = game();
    expect(normalized.saveVersion).toBe(CAMPAIGN_SAVE_VERSION);
    expect(normalized.commander?.id).toBe("grant");
    expect(normalized.lastRewardedBattleId).toBeNull();
    expect(normalized.difficulty).toBe("standard");
  });

  it("exports a deterministic checkpoint without live socket claims", () => {
    const snapshot = exportCampaignSnapshot(game());
    expect(snapshot.version).toBe(CAMPAIGN_SAVE_VERSION);
    expect(snapshot.savedAtTick).toBe(123);
    expect(snapshot.difficulty).toBe("standard");
    expect(snapshot).not.toHaveProperty("claims");
  });

  it("imports a version-0 snapshot and binds it to the current seat", () => {
    const imported = importCampaignSnapshot(
      {
        version: 0,
        status: "playing",
        state: { time: 50, world: { day: 2, army: { troops: 9 }, towns: [] } },
      },
      "grant",
    );
    expect(imported.saveVersion).toBe(CAMPAIGN_SAVE_VERSION);
    expect(imported.seats).toEqual(["grant"]);
    expect(imported.commander?.id).toBe("grant");
    expect(imported.difficulty).toBe("standard");
    expect(imported.claims).toEqual({});
  });

  it("preserves difficulty from a version-1 style snapshot when present", () => {
    const imported = importCampaignSnapshot(
      {
        version: 1,
        status: "playing",
        difficulty: "warlord",
        state: { time: 50, world: { day: 2, army: { troops: 9 }, towns: [] } },
      },
      "grant",
    );
    expect(imported.difficulty).toBe("warlord");
  });

  it("rejects snapshots from a future incompatible version", () => {
    expect(() =>
      importCampaignSnapshot({ version: CAMPAIGN_SAVE_VERSION + 1, state: {} }, "grant"),
    ).toThrow(/newer game version/);
  });

  it("summarizes campaign progress without exposing the full save", () => {
    expect(campaignSnapshotSummary(game())).toEqual({
      version: CAMPAIGN_SAVE_VERSION,
      status: "playing",
      difficulty: "standard",
      tick: 123,
      day: 7,
      armyTroops: 18,
      settlementsHeld: 2,
      settlementsTotal: 3,
      commanderLevel: 1,
    });
  });
});
