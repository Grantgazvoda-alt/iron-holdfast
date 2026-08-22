import {
  FIELD_ORDERS,
  type CampaignBattle,
  type CampaignBattleOrder,
} from "./campaign-battle.js";

export interface CampaignBattleOrderAction {
  type: "campaign_battle_order";
  order: CampaignBattleOrder;
}

export function isCampaignBattleOrderAction(action: unknown): action is CampaignBattleOrderAction {
  if (typeof action !== "object" || action === null || Array.isArray(action)) return false;
  const record = action as Record<string, unknown>;
  return (
    record.type === "campaign_battle_order" &&
    typeof record.order === "string" &&
    Object.prototype.hasOwnProperty.call(FIELD_ORDERS, record.order)
  );
}

/**
 * Rival field-order policy. Pure and deterministic: same battle snapshot gives
 * the same order, so hibernation/replay never changes a campaign result.
 */
export function enemyCampaignBattleOrder(battle: CampaignBattle): CampaignBattleOrder {
  if (battle.enemy.morale < 30) return "withdraw";
  if (battle.enemy.troops > battle.player.troops * 1.25) return "charge";
  if (battle.enemy.troops < battle.player.troops * 0.7) return "hold";
  return battle.round % 3 === 2 ? "charge" : "advance";
}
