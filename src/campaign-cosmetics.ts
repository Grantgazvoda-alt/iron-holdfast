import type { CommanderProfile } from "./progression.js";

export interface CosmeticUnlock {
  level?: number;
  renown?: number;
  achievement?: string;
}

export interface CampaignCosmetic {
  id: string;
  name: string;
  slot: "banner" | "crest" | "title";
  description: string;
  unlock: CosmeticUnlock;
  commercialClass: "cosmetic_only";
}

export const CAMPAIGN_COSMETICS: readonly CampaignCosmetic[] = Object.freeze([
  {
    id: "banner_ironhold",
    name: "Ironhold Standard",
    slot: "banner",
    description: "The founding black-and-gold standard of Iron Holdfast.",
    unlock: {},
    commercialClass: "cosmetic_only",
  },
  {
    id: "crest_first_blood",
    name: "Broken Spear Crest",
    slot: "crest",
    description: "A field crest earned after the first rival-lord victory.",
    unlock: { achievement: "first_blood" },
    commercialClass: "cosmetic_only",
  },
  {
    id: "banner_veteran",
    name: "Veteran's Pennon",
    slot: "banner",
    description: "A weathered command pennon for level-five commanders.",
    unlock: { level: 5 },
    commercialClass: "cosmetic_only",
  },
  {
    id: "title_lord_marshal",
    name: "Lord Marshal",
    slot: "title",
    description: "A prestige title for commanders who earn 100 renown.",
    unlock: { renown: 100 },
    commercialClass: "cosmetic_only",
  },
  {
    id: "crest_iron_crown",
    name: "Iron Crown Crest",
    slot: "crest",
    description: "A conquest crest reserved for a completed kingdom campaign.",
    unlock: { achievement: "iron_crown" },
    commercialClass: "cosmetic_only",
  },
]);

export function cosmeticAvailability(
  commander: CommanderProfile | null | undefined,
  earnedAchievementIds: readonly string[] = [],
) {
  const level = Math.max(1, Number(commander?.level || 1));
  const renown = Math.max(0, Number(commander?.renown || 0));
  const earned = new Set(earnedAchievementIds);
  return CAMPAIGN_COSMETICS.map((cosmetic) => {
    const levelOk = cosmetic.unlock.level == null || level >= cosmetic.unlock.level;
    const renownOk = cosmetic.unlock.renown == null || renown >= cosmetic.unlock.renown;
    const achievementOk =
      cosmetic.unlock.achievement == null || earned.has(cosmetic.unlock.achievement);
    return {
      id: cosmetic.id,
      name: cosmetic.name,
      slot: cosmetic.slot,
      description: cosmetic.description,
      unlocked: levelOk && renownOk && achievementOk,
      commercialClass: cosmetic.commercialClass,
    };
  });
}
