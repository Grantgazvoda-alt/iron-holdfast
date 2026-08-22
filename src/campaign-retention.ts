import type { CommanderProfile } from "./progression.js";

export interface CampaignAchievement {
  id: string;
  name: string;
  description: string;
  earned: boolean;
  progress: number;
  target: number;
}

function finiteInt(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : fallback;
}

export function campaignAchievements(
  state: any,
  commander: CommanderProfile | null | undefined,
  result: unknown,
): CampaignAchievement[] {
  const world = state?.world;
  const towns = Array.isArray(world?.towns) ? world.towns : [];
  const held = towns.filter((town: any) => town?.faction === 0).length;
  const total = towns.length;
  const wins = finiteInt(commander?.battles?.won);
  const played = finiteInt(commander?.battles?.played);
  const level = Math.max(1, finiteInt(commander?.level, 1));
  const campaignResult =
    typeof result === "object" && result !== null
      ? (result as Record<string, unknown>).result
      : result;

  return [
    {
      id: "first_blood",
      name: "First Blood",
      description: "Win your first field battle against a rival lord.",
      earned: wins >= 1,
      progress: Math.min(wins, 1),
      target: 1,
    },
    {
      id: "battle_hardened",
      name: "Battle Hardened",
      description: "Fight ten campaign field battles.",
      earned: played >= 10,
      progress: Math.min(played, 10),
      target: 10,
    },
    {
      id: "veteran_commander",
      name: "Veteran Commander",
      description: "Reach commander level 5.",
      earned: level >= 5,
      progress: Math.min(level, 5),
      target: 5,
    },
    {
      id: "land_grabber",
      name: "Land Grabber",
      description: "Control at least half of the kingdom's settlements.",
      earned: total > 0 && held * 2 >= total,
      progress: held,
      target: total > 0 ? Math.ceil(total / 2) : 1,
    },
    {
      id: "iron_crown",
      name: "The Iron Crown",
      description: "Complete a full kingdom conquest campaign.",
      earned: campaignResult === "campaign_victory",
      progress: campaignResult === "campaign_victory" ? 1 : 0,
      target: 1,
    },
  ];
}

export function nextCampaignGoal(
  state: any,
  commander: CommanderProfile | null | undefined,
  result: unknown,
): { id: string; label: string } {
  const achievements = campaignAchievements(state, commander, result);
  const next = achievements.find((achievement) => !achievement.earned);
  if (next) return { id: next.id, label: `${next.name}: ${next.progress}/${next.target}` };
  return { id: "mastery", label: "All campaign milestones complete — defend the crown." };
}

export function retentionView(
  state: any,
  commander: CommanderProfile | null | undefined,
  result: unknown,
) {
  const achievements = campaignAchievements(state, commander, result);
  return {
    achievements,
    earnedCount: achievements.filter((achievement) => achievement.earned).length,
    totalCount: achievements.length,
    nextGoal: nextCampaignGoal(state, commander, result),
  };
}
