import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_COSMETICS,
  cosmeticAvailability,
} from "../src/campaign-cosmetics";
import { freshProfile } from "../src/progression.js";

describe("campaign cosmetics", () => {
  it("contains no gameplay or pay-to-win commercial class", () => {
    expect(CAMPAIGN_COSMETICS.length).toBeGreaterThan(0);
    for (const cosmetic of CAMPAIGN_COSMETICS) {
      expect(cosmetic.commercialClass).toBe("cosmetic_only");
      expect(["banner", "crest", "title"]).toContain(cosmetic.slot);
      expect(cosmetic).not.toHaveProperty("damage");
      expect(cosmetic).not.toHaveProperty("troops");
      expect(cosmetic).not.toHaveProperty("supply");
      expect(cosmetic).not.toHaveProperty("price");
    }
  });

  it("ships the founding standard unlocked", () => {
    const available = cosmeticAvailability(freshProfile("grant"), []);
    expect(available.find((item) => item.id === "banner_ironhold")?.unlocked).toBe(true);
  });

  it("gates achievement cosmetics by authoritative achievements", () => {
    const profile = freshProfile("grant");
    const locked = cosmeticAvailability(profile, []);
    const unlocked = cosmeticAvailability(profile, ["first_blood"]);
    expect(locked.find((item) => item.id === "crest_first_blood")?.unlocked).toBe(false);
    expect(unlocked.find((item) => item.id === "crest_first_blood")?.unlocked).toBe(true);
  });

  it("gates prestige cosmetics by commander progression", () => {
    const profile = freshProfile("grant");
    profile.level = 5;
    profile.renown = 100;
    const available = cosmeticAvailability(profile, []);
    expect(available.find((item) => item.id === "banner_veteran")?.unlocked).toBe(true);
    expect(available.find((item) => item.id === "title_lord_marshal")?.unlocked).toBe(true);
  });
});
