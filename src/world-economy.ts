export const WORLD_ECONOMY = Object.freeze({
  taxPerFriendlyTownPerDay: 2,
  supplyPerGold: 5,
  maxSupplyPurchase: 20,
  supplyCap: 200,
});

export interface ResupplyQuote {
  supplyAdded: number;
  goldCost: number;
}

function finiteInt(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : fallback;
}

function friendlyTownAtArmy(world: any): any | null {
  if (!world?.army || !Array.isArray(world.towns)) return null;
  return (
    world.towns.find(
      (town: any) =>
        town?.faction === 0 && town.x === world.army.x && town.y === world.army.y,
    ) ?? null
  );
}

/**
 * Advance tax income exactly once for each elapsed world day. This is pure and
 * idempotent: calling it repeatedly with the same state never mints extra gold.
 */
export function stepWorldEconomy(state: any): any {
  if (!state?.world || !state?.res) return state;
  const world = state.world;
  const day = finiteInt(world.day);
  const hasLedger = Number.isInteger(world.lastTaxDay);
  const lastTaxDay = hasLedger ? finiteInt(world.lastTaxDay) : day;
  if (day <= lastTaxDay) {
    if (hasLedger) return state;
    return { ...state, world: { ...world, lastTaxDay: day } };
  }

  const friendlyTowns = Array.isArray(world.towns)
    ? world.towns.filter((town: any) => town?.faction === 0).length
    : 0;
  const elapsedDays = day - lastTaxDay;
  const income = elapsedDays * friendlyTowns * WORLD_ECONOMY.taxPerFriendlyTownPerDay;

  return {
    ...state,
    res: {
      ...state.res,
      gold: finiteInt(state.res.gold) + income,
    },
    world: {
      ...world,
      lastTaxDay: day,
      lastTaxIncome: income,
    },
  };
}

export function quotePaidWorldResupply(state: any): ResupplyQuote | null {
  const world = state?.world;
  if (!world?.army || !friendlyTownAtArmy(world)) return null;
  const current = finiteInt(world.army.supply);
  if (current >= WORLD_ECONOMY.supplyCap) return null;
  const room = WORLD_ECONOMY.supplyCap - current;
  const supplyAdded = Math.min(WORLD_ECONOMY.maxSupplyPurchase, room);
  const goldCost = Math.max(1, Math.ceil(supplyAdded / WORLD_ECONOMY.supplyPerGold));
  return { supplyAdded, goldCost };
}

export function validatePaidWorldResupply(
  state: any,
): { ok: true; quote: ResupplyQuote } | { ok: false; error: string } {
  if (!state?.world) return { ok: false, error: "no world" };
  if (!friendlyTownAtArmy(state.world)) {
    return { ok: false, error: "no friendly town here" };
  }
  if (finiteInt(state.world.army?.supply) >= WORLD_ECONOMY.supplyCap) {
    return { ok: false, error: "already supplied" };
  }
  const quote = quotePaidWorldResupply(state);
  if (!quote) return { ok: false, error: "cannot resupply" };
  if (finiteInt(state.res?.gold) < quote.goldCost) {
    return { ok: false, error: `need ${quote.goldCost} gold for supplies` };
  }
  return { ok: true, quote };
}

export function applyPaidWorldResupply(state: any): any {
  const verdict = validatePaidWorldResupply(state);
  if (!verdict.ok) return state;
  const { supplyAdded, goldCost } = verdict.quote;
  return {
    ...state,
    res: {
      ...state.res,
      gold: finiteInt(state.res.gold) - goldCost,
    },
    world: {
      ...state.world,
      army: {
        ...state.world.army,
        supply: Math.min(
          WORLD_ECONOMY.supplyCap,
          finiteInt(state.world.army.supply) + supplyAdded,
        ),
      },
      lastSupplyPurchase: { supplyAdded, goldCost, day: finiteInt(state.world.day) },
    },
  };
}
