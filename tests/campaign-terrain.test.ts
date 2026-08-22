import { describe, expect, it } from "vitest";
import { createCampaignBattle, stepCampaignBattle } from "../src/campaign-battle.js";

function world(terrain: number) {
  const cells = new Array(25).fill(0);
  cells[2 * 5 + 2] = terrain;
  return {
    W: 5,
    H: 5,
    cells,
    day: 2,
    army: { x: 2, y: 2, troops: 100, supply: 200 },
    lords: [{ id: 1, name: "Roderick", x: 2, y: 2, troops: 100 }],
  };
}

describe("terrain changes campaign battle outcomes", () => {
  it("high ground reduces defender casualties from the same frontal advance", () => {
    const plain = stepCampaignBattle(createCampaignBattle(world(0), 1), "advance", "advance");
    const hill = stepCampaignBattle(createCampaignBattle(world(2), 1), "advance", "advance");
    expect(hill.enemy.casualties).toBeLessThan(plain.enemy.casualties);
  });

  it("forest cover both protects the defender and creates opening ambush pressure", () => {
    const plain = stepCampaignBattle(createCampaignBattle(world(0), 1), "advance", "advance");
    const forest = stepCampaignBattle(createCampaignBattle(world(1), 1), "advance", "advance");
    expect(forest.enemy.casualties).toBeLessThanOrEqual(plain.enemy.casualties);
    expect(forest.player.casualties).toBeGreaterThanOrEqual(plain.player.casualties);
  });

  it("river crossings punish the attacking force", () => {
    const plain = stepCampaignBattle(createCampaignBattle(world(0), 1), "charge", "hold");
    const river = stepCampaignBattle(createCampaignBattle(world(4), 1), "charge", "hold");
    expect(river.enemy.casualties).toBeLessThan(plain.enemy.casualties);
  });
});
