import type { CampaignBattle } from "./campaign-battle.js";
import { freshProfile, normalizeProfile, type CommanderProfile } from "./progression.js";

export const CAMPAIGN_SAVE_VERSION = 1;

export interface PersistedCampaignGame {
  saveVersion: number;
  status: "waiting" | "playing" | "over";
  seats: string[];
  state: any;
  result: unknown;
  campaignBattle: CampaignBattle | null;
  commander: CommanderProfile | null;
  lastRewardedBattleId: string | null;
  claims: Record<string, string>;
}

function statusOf(value: unknown): PersistedCampaignGame["status"] {
  return value === "playing" || value === "over" ? value : "waiting";
}

export function normalizeCampaignGame(raw: any): PersistedCampaignGame {
  const seats = Array.isArray(raw?.seats)
    ? raw.seats.filter((value: unknown): value is string => typeof value === "string")
    : [];
  const claims =
    raw?.claims && typeof raw.claims === "object" && !Array.isArray(raw.claims)
      ? Object.fromEntries(
          Object.entries(raw.claims).filter(
            ([key, value]) => typeof key === "string" && typeof value === "string",
          ),
        ) as Record<string, string>
      : {};
  const commander = raw?.commander
    ? normalizeProfile(raw.commander)
    : seats[0]
      ? freshProfile(seats[0])
      : null;

  return {
    saveVersion: CAMPAIGN_SAVE_VERSION,
    status: statusOf(raw?.status),
    seats,
    state: raw?.state ?? null,
    result: raw?.result ?? null,
    campaignBattle: raw?.campaignBattle ?? null,
    commander,
    lastRewardedBattleId:
      typeof raw?.lastRewardedBattleId === "string" ? raw.lastRewardedBattleId : null,
    claims,
  };
}

/**
 * Build a user-owned, JSON-serializable checkpoint without connection claims.
 * `savedAtTick` is simulation time, not wall-clock time, preserving determinism.
 */
export function exportCampaignSnapshot(game: PersistedCampaignGame) {
  const normalized = normalizeCampaignGame(game);
  return {
    version: CAMPAIGN_SAVE_VERSION,
    savedAtTick:
      typeof normalized.state?.time === "number" && Number.isFinite(normalized.state.time)
        ? Math.max(0, Math.floor(normalized.state.time))
        : 0,
    status: normalized.status,
    state: normalized.state,
    result: normalized.result,
    campaignBattle: normalized.campaignBattle,
    commander: normalized.commander,
    lastRewardedBattleId: normalized.lastRewardedBattleId,
  };
}

export function importCampaignSnapshot(raw: any, seatId: string): PersistedCampaignGame {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("invalid campaign snapshot");
  }
  const version = Number(raw.version ?? 0);
  if (version > CAMPAIGN_SAVE_VERSION) {
    throw new Error("campaign snapshot is from a newer game version");
  }

  // Version 0 is the pre-versioning shape: state/result/campaignBattle/commander.
  const migrated = {
    saveVersion: CAMPAIGN_SAVE_VERSION,
    status: raw.status,
    seats: [seatId],
    state: raw.state ?? null,
    result: raw.result ?? null,
    campaignBattle: raw.campaignBattle ?? null,
    commander: raw.commander ?? freshProfile(seatId),
    lastRewardedBattleId: raw.lastRewardedBattleId ?? null,
    claims: {},
  };
  return normalizeCampaignGame(migrated);
}

export function campaignSnapshotSummary(raw: any) {
  const game = normalizeCampaignGame(raw);
  const world = game.state?.world;
  const towns = Array.isArray(world?.towns) ? world.towns : [];
  return {
    version: game.saveVersion,
    status: game.status,
    tick: Number(game.state?.time ?? 0),
    day: Number(world?.day ?? 0),
    armyTroops: Number(world?.army?.troops ?? 0),
    settlementsHeld: towns.filter((town: any) => town?.faction === 0).length,
    settlementsTotal: towns.length,
    commanderLevel: game.commander?.level ?? 1,
  };
}
