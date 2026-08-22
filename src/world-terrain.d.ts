export interface WorldTerrainProfile {
  code: number;
  name: string;
  marchTicks: number;
  supplyWeight: number;
  attacker: number;
  defender: number;
  ambush: number;
}

export const WORLD_TERRAIN: Readonly<Record<number, Readonly<WorldTerrainProfile>>>;
export function terrainTacticalProfile(code: number): Readonly<WorldTerrainProfile>;
export function terrainRouteCost(code: number): number;
export function routeSupplyWeight(world: any, path: unknown[]): number;
export function terrainBattleNote(code: number): string;
