import { describe, expect, it } from "vitest";
import {
  WORLD_ECONOMY,
  applyPaidWorldResupply,
  quotePaidWorldResupply,
  stepWorldEconomy,
  validatePaidWorldResupply,
} from "../src/world-economy";

function state() {
  return {
    res: { gold: 10, wood: 0, stone: 0, iron: 0, food: 0 },
    world: {
      day: 0,
      army: { x: 2, y: 2, troops: 10, supply: 40 },
      towns: [
        { i: 0, name: "Alderford", x: 2, y: 2, faction: 0, troops: 10 },
        { i: 1, name: "Bramhall", x: 4, y: 4, faction: 1, troops: 12 },
      ],
    },
  };
}

describe("world economy", () => {
  it("initializes the tax ledger without retroactive income", () => {
    const s = state();
    s.world.day = 4;
    const next = stepWorldEconomy(s);
    expect(next.res.gold).toBe(10);
    expect(next.world.lastTaxDay).toBe(4);
  });

  it("mints taxes once per elapsed day from friendly towns only", () => {
    let s: any = stepWorldEconomy(state());
    s = { ...s, world: { ...s.world, day: 3 } };
    const taxed = stepWorldEconomy(s);
    expect(taxed.res.gold).toBe(10 + 3 * WORLD_ECONOMY.taxPerFriendlyTownPerDay);
    expect(taxed.world.lastTaxDay).toBe(3);
    expect(stepWorldEconomy(taxed)).toBe(taxed);
  });

  it("scales tax income with conquered friendly towns", () => {
    let s: any = stepWorldEconomy(state());
    s.world = {
      ...s.world,
      day: 1,
      towns: s.world.towns.map((town: any) => ({ ...town, faction: 0 })),
    };
    const taxed = stepWorldEconomy(s);
    expect(taxed.res.gold).toBe(10 + 2 * WORLD_ECONOMY.taxPerFriendlyTownPerDay);
  });

  it("quotes 20 supply for four gold at normal capacity", () => {
    expect(quotePaidWorldResupply(state())).toEqual({ supplyAdded: 20, goldCost: 4 });
  });

  it("prorates a near-cap purchase instead of charging a full batch", () => {
    const s = state();
    s.world.army.supply = 199;
    expect(quotePaidWorldResupply(s)).toEqual({ supplyAdded: 1, goldCost: 1 });
  });

  it("requires enough gold and a friendly town", () => {
    const poor = state();
    poor.res.gold = 3;
    expect(validatePaidWorldResupply(poor)).toEqual({
      ok: false,
      error: "need 4 gold for supplies",
    });

    const hostile = state();
    hostile.world.towns[0].faction = 1;
    expect(validatePaidWorldResupply(hostile)).toEqual({
      ok: false,
      error: "no friendly town here",
    });
  });

  it("deducts gold and adds supply without exceeding the cap", () => {
    const next = applyPaidWorldResupply(state());
    expect(next.res.gold).toBe(6);
    expect(next.world.army.supply).toBe(60);

    const nearCap = state();
    nearCap.world.army.supply = 199;
    const capped = applyPaidWorldResupply(nearCap);
    expect(capped.res.gold).toBe(9);
    expect(capped.world.army.supply).toBe(200);
  });
});
