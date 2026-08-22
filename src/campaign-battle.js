// Deterministic campaign encounter coordinator for the overworld.
//
// This module has no timers, I/O, or random calls. It operates only on JSON-like
// state passed by the authoritative room, so the same world + orders always
// produce the same battle outcome. It intentionally stays separate from
// logic.js until the transition layer is fully covered by tests.

export const CAMPAIGN_BATTLE_VERSION = 1;

export const FIELD_ORDERS = Object.freeze({
  hold: Object.freeze({ attack: 0.82, defense: 1.28, morale: 1 }),
  advance: Object.freeze({ attack: 1.0, defense: 1.0, morale: 2 }),
  charge: Object.freeze({ attack: 1.32, defense: 0.78, morale: -4 }),
  withdraw: Object.freeze({ attack: 0.45, defense: 1.12, morale: 5 }),
});

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const int = (value, fallback = 0) => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;

function terrainProfile(terrain) {
  // Mirrors current overworld terrain codes without importing logic.js, keeping
  // this coordinator dependency-light and independently testable.
  // 0 plain, 1 forest, 2 hill, 3 mountain, 4 river.
  if (terrain === 1) return { attacker: 0.92, defender: 1.12, name: "forest" };
  if (terrain === 2) return { attacker: 0.9, defender: 1.18, name: "hill" };
  if (terrain === 4) return { attacker: 0.86, defender: 1.08, name: "river crossing" };
  return { attacker: 1, defender: 1, name: "open ground" };
}

export function detectWorldEncounter(world) {
  if (!world?.army || !Array.isArray(world.lords)) return null;
  const day = int(world.day);
  const candidates = world.lords
    .filter((lord) =>
      int(lord.troops) > 0 &&
      int(lord.recoveryUntilDay) <= day &&
      lord.x === world.army.x &&
      lord.y === world.army.y,
    )
    .sort((a, b) => int(a.id) - int(b.id));
  return candidates[0] ?? null;
}

export function createCampaignBattle(world, lordId) {
  if (!world?.army) throw new Error("world army required");
  const lord = (world.lords || []).find((entry) => entry.id === lordId);
  if (!lord) throw new Error("rival lord not found");
  if (lord.x !== world.army.x || lord.y !== world.army.y) {
    throw new Error("armies are not in contact");
  }
  if (int(world.army.troops) <= 0 || int(lord.troops) <= 0) {
    throw new Error("both armies need troops");
  }

  const terrain = world.cells?.[world.army.y * world.W + world.army.x] ?? 0;
  const day = int(world.day);
  return {
    v: CAMPAIGN_BATTLE_VERSION,
    id: `${day}:${int(lord.id)}:${int(world.army.x)}:${int(world.army.y)}`,
    status: "active",
    round: 0,
    day,
    lordId: lord.id,
    lordName: String(lord.name || `Lord ${lord.id}`),
    x: int(world.army.x),
    y: int(world.army.y),
    terrain,
    terrainName: terrainProfile(terrain).name,
    player: { troops: int(world.army.troops), morale: 100, casualties: 0 },
    enemy: { troops: int(lord.troops), morale: 100, casualties: 0 },
    result: null,
    log: [`Encountered ${String(lord.name || "a rival lord")} on ${terrainProfile(terrain).name}.`],
  };
}

function sideLosses(attacker, defender, attackOrder, defendOrder, terrain, attackerIsPlayer) {
  if (attacker.troops <= 0 || defender.troops <= 0) return 0;
  const attack = FIELD_ORDERS[attackOrder] || FIELD_ORDERS.advance;
  const defense = FIELD_ORDERS[defendOrder] || FIELD_ORDERS.advance;
  const ground = terrainProfile(terrain);
  const terrainAttack = attackerIsPlayer ? ground.attacker : 1;
  const terrainDefense = attackerIsPlayer ? ground.defender : 1;
  const strengthRatio = clamp(attacker.troops / Math.max(1, defender.troops), 0.45, 2.2);
  const pressure = attack.attack * terrainAttack * strengthRatio;
  const protection = defense.defense * terrainDefense;
  const rate = clamp(0.055 * pressure / protection, 0.02, 0.16);
  return Math.min(defender.troops, Math.max(1, Math.floor(attacker.troops * rate)));
}

export function stepCampaignBattle(battle, playerOrder = "advance", enemyOrder = "advance") {
  if (!battle || battle.status !== "active") return battle;
  const pOrder = FIELD_ORDERS[playerOrder] ? playerOrder : "advance";
  const eOrder = FIELD_ORDERS[enemyOrder] ? enemyOrder : "advance";
  const player = { ...battle.player };
  const enemy = { ...battle.enemy };

  // Simultaneous losses: both values are derived from the same pre-round state.
  const enemyLoss = sideLosses(player, enemy, pOrder, eOrder, battle.terrain, true);
  const playerLoss = sideLosses(enemy, player, eOrder, pOrder, battle.terrain, false);
  player.troops = Math.max(0, player.troops - playerLoss);
  enemy.troops = Math.max(0, enemy.troops - enemyLoss);
  player.casualties += playerLoss;
  enemy.casualties += enemyLoss;

  const pMoraleDelta = (FIELD_ORDERS[pOrder].morale || 0) - playerLoss * 2 + enemyLoss;
  const eMoraleDelta = (FIELD_ORDERS[eOrder].morale || 0) - enemyLoss * 2 + playerLoss;
  player.morale = clamp(player.morale + pMoraleDelta, 0, 100);
  enemy.morale = clamp(enemy.morale + eMoraleDelta, 0, 100);

  let status = "active";
  let result = null;
  if (enemy.troops <= 0 || enemy.morale <= 0) {
    status = "resolved";
    result = "victory";
  } else if (player.troops <= 0 || player.morale <= 0) {
    status = "resolved";
    result = "defeat";
  } else if (pOrder === "withdraw" && battle.round >= 1 && player.morale >= 35) {
    status = "resolved";
    result = "withdrawn";
  } else if (eOrder === "withdraw" && battle.round >= 1 && enemy.morale >= 35) {
    status = "resolved";
    result = "enemy_withdrew";
  }

  const round = battle.round + 1;
  return {
    ...battle,
    round,
    status,
    result,
    player,
    enemy,
    log: [
      ...(battle.log || []),
      `Round ${round}: ${pOrder} vs ${eOrder}; player -${playerLoss}, enemy -${enemyLoss}.`,
    ].slice(-12),
  };
}

export function reconcileCampaignBattle(world, battle) {
  if (!world || !battle || battle.status !== "resolved") {
    throw new Error("resolved campaign battle required");
  }
  const next = {
    ...world,
    army: { ...world.army, troops: int(battle.player.troops), path: null, wait: 0 },
    lords: (world.lords || []).map((lord) => ({ ...lord })),
  };
  const lord = next.lords.find((entry) => entry.id === battle.lordId);
  if (!lord) throw new Error("battle rival no longer exists");

  lord.troops = int(battle.enemy.troops);
  lord.path = null;
  lord.wait = 0;
  if (battle.result === "victory" || lord.troops <= 0) {
    lord.troops = 0;
    lord.recoveryUntilDay = int(next.day) + 3;
    lord.defeated = true;
  } else if (battle.result === "enemy_withdrew") {
    lord.recoveryUntilDay = int(next.day) + 1;
  }

  if (battle.result === "defeat" || next.army.troops <= 0) {
    next.army.troops = 0;
    next.army.defeated = true;
  } else if (battle.result === "withdrawn") {
    next.army.withdrawn = true;
  }
  return next;
}
