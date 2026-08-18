import * as base from "./logic.js";

export const meta = base.meta;

const ABILITIES = {
  recruit: { label: "Recruit", hp: 0.9, dmg: 0.85, morale: 0.9, pressure: 0 },
  soldier: { label: "Soldier", hp: 1, dmg: 1, morale: 1, pressure: 1 },
  veteran: { label: "Veteran", hp: 1.15, dmg: 1.18, morale: 1.08, pressure: 2 },
  warlord: { label: "Warlord", hp: 1.35, dmg: 1.35, morale: 1.18, pressure: 3 },
};
const COMMANDER_NAMES = ["The Red Wolf", "Blackthorn", "Iron Viper", "Ashen Crown"];
function normalizeConfig(raw) {
  const count = Math.max(1, Math.min(4, Number.isInteger(raw?.count) ? raw.count : 1));
  const ability = Object.hasOwn(ABILITIES, raw?.ability) ? raw.ability : "soldier";
  return { count, ability };
}
function commanderList(config) {
  const tier = ABILITIES[config.ability];
  return COMMANDER_NAMES.slice(0, config.count).map((name, index) => ({ id: index + 1, name, ability: config.ability, abilityLabel: tier.label }));
}
function decorateFresh(state, config) {
  const npcConfig = normalizeConfig(config);
  return { ...state, npcConfig, npcCommanders: commanderList(npcConfig), commanderSpawnCursor: 0 };
}
export function setup(players) { return decorateFresh(base.setup(players), { count: 1, ability: "soldier" }); }
export function validateAction(state, playerId, action) {
  if (action?.type === "resetGame") {
    const config = normalizeConfig(action);
    if (action.count !== config.count) return { ok: false, error: "npc count must be 1 to 4" };
    if (action.ability !== config.ability) return { ok: false, error: "unknown npc ability" };
    return { ok: true };
  }
  return base.validateAction(state, playerId, action);
}
export function applyAction(state, playerId, action) {
  if (action?.type === "resetGame") {
    const fresh = decorateFresh(base.setup([state?.seat || playerId]), action);
    fresh.events = [{ id: 1, kind: "intro", t: 0, text: `A new siege begins against ${fresh.npcConfig.count} enemy commander${fresh.npcConfig.count === 1 ? "" : "s"} at ${ABILITIES[fresh.npcConfig.ability].label} ability.` }];
    fresh.eventId = 1;
    return fresh;
  }
  return base.applyAction(state, playerId, action);
}
function extraWaveFor(config, wave) {
  const tier = ABILITIES[config.ability];
  const extra = Math.max(0, (config.count - 1) * 2 + tier.pressure);
  const queue = [];
  for (let i = 0; i < extra; i++) {
    if (config.ability === "warlord" && wave >= 3 && i % 5 === 4) queue.push("brute");
    else if ((config.ability === "veteran" || config.ability === "warlord") && i % 3 === 2) queue.push("skirmisher");
    else queue.push("raider");
  }
  return queue;
}
function buffNewEnemies(previous, next, config) {
  const prior = new Set((previous.units || []).filter((u) => u.f === "e").map((u) => u.id));
  const tier = ABILITIES[config.ability];
  let cursor = next.commanderSpawnCursor || 0;
  const units = (next.units || []).map((u) => {
    if (u.f !== "e" || prior.has(u.id)) return u;
    const commander = cursor % config.count; cursor += 1;
    return { ...u, commander: commander + 1, hp: Math.max(1, u.hp * tier.hp), max: Math.max(1, u.max * tier.hp), dmg: u.dmg * tier.dmg, morale: Math.min(100, (u.morale || 65) * tier.morale), maxMorale: Math.min(100, (u.maxMorale || 65) * tier.morale) };
  });
  return { ...next, units, commanderSpawnCursor: cursor };
}
export function tick(state) {
  const config = normalizeConfig(state?.npcConfig);
  const prepared = { ...state, npcConfig: config, npcCommanders: commanderList(config) };
  if (!prepared.pendingWave && Number.isFinite(prepared.waveIn)) {
    const tier = ABILITIES[config.ability];
    prepared.waveIn = Math.max(0, prepared.waveIn - Math.max(0, config.count - 1 + tier.pressure - 1));
  }
  let next = base.tick(prepared);
  if ((next.wave || 0) > (prepared.wave || 0) && Array.isArray(next.pendingWave)) next = { ...next, pendingWave: [...next.pendingWave, ...extraWaveFor(config, next.wave)] };
  return buffNewEnemies(prepared, next, config);
}
export function isGameOver(state) { return base.isGameOver(state); }
export function viewFor(state, playerId) {
  const view = base.viewFor(state, playerId); const config = normalizeConfig(state?.npcConfig);
  return { ...view, npcConfig: config, npcCommanders: commanderList(config), units: view.units.map((u) => { const source = state.units.find((raw) => raw.id === u.id); return source?.commander ? { ...u, commander: source.commander } : u; }) };
}
