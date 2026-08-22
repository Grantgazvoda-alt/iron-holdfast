export type CampaignBattleOrder = "hold" | "advance" | "charge" | "withdraw";

export interface CampaignBattleSide {
  troops: number;
  morale: number;
  casualties: number;
}

export interface CampaignBattle {
  v: number;
  id: string;
  status: "active" | "resolved";
  round: number;
  day: number;
  lordId: number;
  lordName: string;
  x: number;
  y: number;
  terrain: number;
  terrainName: string;
  player: CampaignBattleSide;
  enemy: CampaignBattleSide;
  result: "victory" | "defeat" | "withdrawn" | "enemy_withdrew" | null;
  log: string[];
}

export const CAMPAIGN_BATTLE_VERSION: number;
export const FIELD_ORDERS: Readonly<
  Record<CampaignBattleOrder, Readonly<{ attack: number; defense: number; morale: number }>>
>;

export function detectWorldEncounter(world: any): any | null;
export function createCampaignBattle(world: any, lordId: number): CampaignBattle;
export function stepCampaignBattle(
  battle: CampaignBattle,
  playerOrder?: CampaignBattleOrder,
  enemyOrder?: CampaignBattleOrder,
): CampaignBattle;
export function reconcileCampaignBattle(world: any, battle: CampaignBattle): any;
