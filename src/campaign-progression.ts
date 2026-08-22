import type { CampaignBattle } from "./campaign-battle.js";
import {
  PATHS,
  availableUnlocks,
  freshProfile,
  grantBattleResult,
  normalizeProfile,
  unlock,
  type CommanderProfile,
} from "./progression.js";

export type CommanderPath = "warden" | "marshal" | "vanguard";

export type CommanderAction =
  | { type: "commander_choose_path"; path: CommanderPath }
  | { type: "commander_unlock"; nodeId: string };

export function isCommanderAction(action: unknown): action is CommanderAction {
  if (typeof action !== "object" || action === null || Array.isArray(action)) return false;
  const record = action as Record<string, unknown>;
  if (record.type === "commander_choose_path") {
    return typeof record.path === "string" && Object.prototype.hasOwnProperty.call(PATHS, record.path);
  }
  return record.type === "commander_unlock" && typeof record.nodeId === "string" && record.nodeId.length > 0;
}

export function campaignBattleDifficulty(battle: CampaignBattle): number {
  const playerStart = Math.max(1, battle.player.troops + battle.player.casualties);
  const enemyStart = Math.max(1, battle.enemy.troops + battle.enemy.casualties);
  return Math.max(0.5, Math.min(2, enemyStart / playerStart));
}

export function rewardCampaignBattle(
  profile: CommanderProfile | null | undefined,
  battle: CampaignBattle,
): { profile: CommanderProfile; earnedXp: number; earnedRenown: number } {
  const normalized = normalizeProfile(profile ?? freshProfile("commander"));
  if (battle.status !== "resolved") {
    return { profile: normalized, earnedXp: 0, earnedRenown: 0 };
  }
  return grantBattleResult(normalized, {
    won: battle.result === "victory" || battle.result === "enemy_withdrew",
    difficulty: campaignBattleDifficulty(battle),
    waves: 0,
    directCombat: false,
  });
}

export function applyCommanderAction(
  profile: CommanderProfile,
  action: CommanderAction,
): { ok: true; profile: CommanderProfile } | { ok: false; profile: CommanderProfile; error: string } {
  const current = normalizeProfile(profile);
  if (action.type === "commander_choose_path") {
    if (current.path && current.path !== action.path) {
      return { ok: false, profile: current, error: "commander path already chosen" };
    }
    return { ok: true, profile: { ...current, path: action.path } };
  }

  const result = unlock(current, action.nodeId);
  if (!result.ok) {
    return { ok: false, profile: result.profile, error: result.error ?? "unlock unavailable" };
  }
  return { ok: true, profile: result.profile };
}

export function commanderView(profile: CommanderProfile) {
  const p = normalizeProfile(profile);
  return {
    id: p.id,
    level: p.level,
    xp: p.xp,
    renown: p.renown,
    path: p.path,
    unlocks: [...p.unlocks],
    battles: { ...p.battles },
    availableUnlocks: availableUnlocks(p).map((node) => ({ id: node.id, level: node.level })),
  };
}
