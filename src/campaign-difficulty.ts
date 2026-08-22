export type CampaignDifficulty = "squire" | "standard" | "warlord";

export interface CampaignDifficultyProfile {
  id: CampaignDifficulty;
  name: string;
  description: string;
  rivalTroopMultiplier: number;
  startingSupplyMultiplier: number;
}

export const CAMPAIGN_DIFFICULTIES: Readonly<Record<CampaignDifficulty, Readonly<CampaignDifficultyProfile>>> = Object.freeze({
  squire: Object.freeze({
    id: "squire",
    name: "Squire",
    description: "A forgiving first campaign with smaller rival hosts and deeper starting stores.",
    rivalTroopMultiplier: 0.85,
    startingSupplyMultiplier: 1.25,
  }),
  standard: Object.freeze({
    id: "standard",
    name: "Standard",
    description: "The intended Iron Holdfast campaign balance.",
    rivalTroopMultiplier: 1,
    startingSupplyMultiplier: 1,
  }),
  warlord: Object.freeze({
    id: "warlord",
    name: "Warlord",
    description: "Larger rival hosts and tighter starting logistics for veteran commanders.",
    rivalTroopMultiplier: 1.2,
    startingSupplyMultiplier: 0.85,
  }),
});

export interface CampaignDifficultyAction {
  type: "campaign_set_difficulty";
  difficulty: CampaignDifficulty;
}

export function normalizeCampaignDifficulty(value: unknown): CampaignDifficulty {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(CAMPAIGN_DIFFICULTIES, value)
    ? (value as CampaignDifficulty)
    : "standard";
}

export function isCampaignDifficultyAction(action: unknown): action is CampaignDifficultyAction {
  if (typeof action !== "object" || action === null || Array.isArray(action)) return false;
  const record = action as Record<string, unknown>;
  return (
    record.type === "campaign_set_difficulty" &&
    typeof record.difficulty === "string" &&
    Object.prototype.hasOwnProperty.call(CAMPAIGN_DIFFICULTIES, record.difficulty)
  );
}

/** Apply exactly once to a freshly-created deterministic world state. */
export function applyCampaignDifficulty(state: any, rawDifficulty: unknown): any {
  if (!state?.world?.army || !Array.isArray(state.world.lords)) return state;
  const difficulty = normalizeCampaignDifficulty(rawDifficulty);
  if (state.world.difficultyApplied) return state;
  const profile = CAMPAIGN_DIFFICULTIES[difficulty];
  const world = {
    ...state.world,
    difficulty,
    difficultyApplied: true,
    army: {
      ...state.world.army,
      supply: Math.max(
        0,
        Math.min(200, Math.round(Number(state.world.army.supply || 0) * profile.startingSupplyMultiplier)),
      ),
    },
    lords: state.world.lords.map((lord: any) => ({
      ...lord,
      troops: Math.max(1, Math.round(Number(lord.troops || 0) * profile.rivalTroopMultiplier)),
    })),
  };
  return { ...state, world };
}
