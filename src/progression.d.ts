export interface CommanderBattleRecord {
  played: number;
  won: number;
  lost: number;
}

export interface CommanderProfile {
  version: number;
  id: string;
  xp: number;
  level: number;
  renown: number;
  path: "warden" | "marshal" | "vanguard" | null;
  unlocks: string[];
  battles: CommanderBattleRecord;
  officers: unknown[];
  veteranUnits: unknown[];
}

export const SAVE_VERSION: number;
export const PATHS: Readonly<Record<"warden" | "marshal" | "vanguard", ReadonlyArray<any>>>;
export function xpForLevel(level: number): number;
export function levelFromXp(xp: number): number;
export function freshProfile(id?: string): CommanderProfile;
export function normalizeProfile(raw?: Partial<CommanderProfile>): CommanderProfile;
export function grantBattleResult(
  profile: CommanderProfile,
  result?: { won?: boolean; difficulty?: number; waves?: number; directCombat?: boolean },
): { profile: CommanderProfile; earnedXp: number; earnedRenown: number };
export function availableUnlocks(profile: CommanderProfile): any[];
export function unlock(
  profile: CommanderProfile,
  nodeId: string,
): { ok: boolean; profile: CommanderProfile; error?: string; node?: any };
