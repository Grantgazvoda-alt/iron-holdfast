export interface TownAssaultResult {
  captured: boolean;
  attackerLosses: number;
  defenderLosses: number;
  attackerRemaining: number;
  defenderRemaining: number;
  townName: string;
}

export type CampaignOutcome =
  | { over: false }
  | { over: true; result: "campaign_victory" | "campaign_defeat" };

function finiteInt(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : fallback;
}

function assaultTarget(state: any): any | null {
  const world = state?.world;
  if (!world?.army || !Array.isArray(world.towns)) return null;
  return (
    world.towns.find(
      (town: any) =>
        town?.faction !== 0 && town.x === world.army.x && town.y === world.army.y,
    ) ?? null
  );
}

export function isWorldAssaultAction(action: unknown): boolean {
  if (typeof action !== "object" || action === null || Array.isArray(action)) return false;
  return (action as Record<string, unknown>).type === "world_assault_town";
}

export function validateTownAssault(
  state: any,
): { ok: true } | { ok: false; error: string } {
  if (!state?.world?.army) return { ok: false, error: "no world army" };
  if (finiteInt(state.world.army.troops) <= 0) {
    return { ok: false, error: "your army has no troops" };
  }
  const target = assaultTarget(state);
  if (!target) return { ok: false, error: "no hostile settlement here" };
  if (finiteInt(target.troops) <= 0) return { ok: true };
  return { ok: true };
}

/**
 * Resolve one deterministic assault exchange. Repeated assaults are allowed,
 * but every attempt costs real troops. A settlement flips only if defenders
 * reach zero while at least one attacker survives.
 */
export function applyTownAssault(state: any): { state: any; assault: TownAssaultResult } {
  const verdict = validateTownAssault(state);
  if (!verdict.ok) throw new Error(verdict.error);
  const world = state.world;
  const target = assaultTarget(state);
  if (!target) throw new Error("no hostile settlement here");

  const attackers = finiteInt(world.army.troops);
  const defenders = finiteInt(target.troops);
  const defenderLosses = Math.min(
    defenders,
    Math.max(1, Math.floor(attackers * 0.42)),
  );
  const attackerLosses = Math.min(
    attackers,
    defenders <= 0 ? 0 : Math.max(1, Math.ceil(defenders * 0.32)),
  );
  const attackerRemaining = Math.max(0, attackers - attackerLosses);
  const defenderRemaining = Math.max(0, defenders - defenderLosses);
  const captured = defenderRemaining === 0 && attackerRemaining > 0;

  const towns = world.towns.map((town: any) => {
    if (town.i !== target.i) return { ...town };
    return {
      ...town,
      faction: captured ? 0 : town.faction,
      troops: captured ? Math.max(1, Math.floor(attackerRemaining * 0.15)) : defenderRemaining,
      capturedDay: captured ? finiteInt(world.day) : town.capturedDay,
    };
  });

  const next = {
    ...state,
    world: {
      ...world,
      army: {
        ...world.army,
        troops: attackerRemaining,
        path: null,
        wait: 0,
      },
      towns,
      lastTownAssault: {
        townId: target.i,
        townName: String(target.name || "Settlement"),
        captured,
        attackerLosses,
        defenderLosses,
        day: finiteInt(world.day),
      },
    },
  };

  return {
    state: next,
    assault: {
      captured,
      attackerLosses,
      defenderLosses,
      attackerRemaining,
      defenderRemaining: captured ? 0 : defenderRemaining,
      townName: String(target.name || "Settlement"),
    },
  };
}

export function campaignOutcome(state: any): CampaignOutcome {
  const world = state?.world;
  if (!world?.army || !Array.isArray(world.towns)) return { over: false };
  const friendly = world.towns.filter((town: any) => town?.faction === 0);
  const allSettlements = world.towns.length > 0 && friendly.length === world.towns.length;
  const allRivalsDefeated = Array.isArray(world.lords)
    ? world.lords.every((lord: any) => finiteInt(lord?.troops) <= 0 || lord?.defeated === true)
    : true;
  const regionalCampDestroyed = state?.camp?.destroyed === 1 || finiteInt(state?.camp?.hp) <= 0;

  if (allSettlements && allRivalsDefeated && regionalCampDestroyed) {
    return { over: true, result: "campaign_victory" };
  }

  if (finiteInt(world.army.troops) <= 0 && friendly.length === 0) {
    return { over: true, result: "campaign_defeat" };
  }
  return { over: false };
}

/**
 * The original siege engine calls a destroyed camp an immediate victory. In a
 * kingdom campaign that is only the home-region battle. Clear the legacy `over`
 * marker once, preserving `camp.destroyed`, so the world campaign can continue.
 */
export function continueAfterRegionalVictory(state: any): any {
  if (
    state?.result !== "victory" ||
    !state?.world ||
    !(state?.camp?.destroyed === 1 || finiteInt(state?.camp?.hp) <= 0)
  ) {
    return state;
  }
  return {
    ...state,
    over: false,
    result: null,
    camp: { ...state.camp, destroyed: 1, hp: 0 },
  };
}
