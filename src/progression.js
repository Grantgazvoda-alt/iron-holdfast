import { UNITS, BUILDINGS, TECHS } from "./logic.js";

export const SAVE_VERSION = 1;
export const PATHS = Object.freeze({
  warden: [
    { id: "bulwark", level: 2, effect: { defenseAura: 0.05 } },
    { id: "steadfast", level: 4, effect: { moraleRecovery: 0.08 } },
    { id: "master_builder", level: 7, effect: { repairEfficiency: 0.1 } },
  ],
  marshal: [
    { id: "drillmaster", level: 2, effect: { cohesionRecovery: 0.08 } },
    { id: "forced_march", level: 4, effect: { formationMove: 0.06 } },
    { id: "commanding_presence", level: 7, effect: { commandRadius: 0.12 } },
  ],
  vanguard: [
    { id: "battle_hardened", level: 2, effect: { staminaRecovery: 0.06 } },
    { id: "weapon_master", level: 4, effect: { recoverySpeed: 0.05 } },
    { id: "rallying_charge", level: 7, effect: { rallyOnCharge: 0.08 } },
  ],
});

export function xpForLevel(level) {
  const l = Math.max(1, Math.trunc(level || 1));
  return Math.round(100 * Math.pow(l - 1, 1.45));
}

export function levelFromXp(xp) {
  const value = Math.max(0, Math.trunc(xp || 0));
  let level = 1;
  while (level < 50 && value >= xpForLevel(level + 1)) level++;
  return level;
}

export function freshProfile(id = "commander") {
  return { version: SAVE_VERSION, id, xp: 0, level: 1, renown: 0, path: null, unlocks: [], battles: { played: 0, won: 0, lost: 0 }, officers: [], veteranUnits: [] };
}

export function normalizeProfile(raw = {}) {
  const base = freshProfile(typeof raw.id === "string" && raw.id ? raw.id : "commander");
  const xp = Math.max(0, Math.trunc(Number(raw.xp) || 0));
  const path = Object.hasOwn(PATHS, raw.path) ? raw.path : null;
  return {
    ...base,
    ...raw,
    version: SAVE_VERSION,
    xp,
    level: levelFromXp(xp),
    renown: Math.max(0, Math.trunc(Number(raw.renown) || 0)),
    path,
    unlocks: Array.isArray(raw.unlocks) ? [...new Set(raw.unlocks.filter((v) => typeof v === "string"))] : [],
    officers: Array.isArray(raw.officers) ? raw.officers : [],
    veteranUnits: Array.isArray(raw.veteranUnits) ? raw.veteranUnits : [],
    battles: { ...base.battles, ...(raw.battles || {}) },
  };
}

export function grantBattleResult(profile, { won = false, difficulty = 1, waves = 0, directCombat = false } = {}) {
  const p = normalizeProfile(profile);
  const d = Math.max(0.5, Math.min(2, Number(difficulty) || 1));
  const earnedXp = Math.round((35 + Math.max(0, waves) * 8 + (won ? 55 : 0) + (directCombat ? 15 : 0)) * d);
  const renown = won ? Math.round(10 * d) : Math.round(2 * d);
  const next = normalizeProfile({ ...p, xp: p.xp + earnedXp, renown: p.renown + renown, battles: { played: p.battles.played + 1, won: p.battles.won + (won ? 1 : 0), lost: p.battles.lost + (won ? 0 : 1) } });
  return { profile: next, earnedXp, earnedRenown: renown };
}

export function availableUnlocks(profile) {
  const p = normalizeProfile(profile);
  if (!p.path) return [];
  return PATHS[p.path].filter((node) => node.level <= p.level && !p.unlocks.includes(node.id));
}

export function unlock(profile, nodeId) {
  const p = normalizeProfile(profile);
  const node = availableUnlocks(p).find((candidate) => candidate.id === nodeId);
  if (!node) return { ok: false, profile: p, error: "unlock unavailable" };
  return { ok: true, profile: { ...p, unlocks: [...p.unlocks, node.id] }, node };
}
