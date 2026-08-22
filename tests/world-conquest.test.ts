import { describe, expect, it } from "vitest";
import {
  applyTownAssault,
  campaignOutcome,
  continueAfterRegionalVictory,
  isWorldAssaultAction,
  validateTownAssault,
} from "../src/world-conquest";

function state() {
  return {
    over: false,
    result: null,
    camp: { hp: 600, max: 600, destroyed: 0 },
    world: {
      day: 4,
      army: { x: 4, y: 4, troops: 30, supply: 80, path: [[5, 4]], wait: 1 },
      towns: [
        { i: 0, name: "Alderford", x: 2, y: 2, faction: 0, troops: 10 },
        { i: 1, name: "Bramhall", x: 4, y: 4, faction: 1, troops: 8 },
      ],
      lords: [
        { id: 1, name: "Roderick", troops: 0, defeated: true },
        { id: 2, name: "Isolde", troops: 0, defeated: true },
      ],
    },
  };
}

describe("world conquest", () => {
  it("recognizes only the assault action", () => {
    expect(isWorldAssaultAction({ type: "world_assault_town" })).toBe(true);
    expect(isWorldAssaultAction({ type: "world_resupply" })).toBe(false);
    expect(isWorldAssaultAction(null)).toBe(false);
  });

  it("requires a living army on a hostile settlement", () => {
    expect(validateTownAssault(state())).toEqual({ ok: true });
    const empty = state();
    empty.world.army.troops = 0;
    expect(validateTownAssault(empty)).toEqual({ ok: false, error: "your army has no troops" });
    const friendly = state();
    friendly.world.towns[1].faction = 0;
    expect(validateTownAssault(friendly)).toEqual({ ok: false, error: "no hostile settlement here" });
  });

  it("captures a weak settlement and pays casualties", () => {
    const result = applyTownAssault(state());
    expect(result.assault.captured).toBe(true);
    expect(result.assault.attackerLosses).toBeGreaterThan(0);
    expect(result.state.world.army.troops).toBeLessThan(30);
    expect(result.state.world.army.path).toBeNull();
    expect(result.state.world.towns[1].faction).toBe(0);
    expect(result.state.world.towns[1].troops).toBeGreaterThan(0);
  });

  it("requires repeated costly assaults against a strong garrison", () => {
    const s = state();
    s.world.army.troops = 20;
    s.world.towns[1].troops = 40;
    const result = applyTownAssault(s);
    expect(result.assault.captured).toBe(false);
    expect(result.assault.defenderRemaining).toBeGreaterThan(0);
    expect(result.state.world.towns[1].faction).toBe(1);
    expect(result.state.world.army.troops).toBeLessThan(20);
  });

  it("declares campaign victory only after map, rivals, and camp are all beaten", () => {
    const s = state();
    s.world.towns[1].faction = 0;
    s.camp = { hp: 0, max: 600, destroyed: 1 };
    expect(campaignOutcome(s)).toEqual({ over: true, result: "campaign_victory" });

    const campAlive = state();
    campAlive.world.towns[1].faction = 0;
    expect(campaignOutcome(campAlive)).toEqual({ over: false });
  });

  it("declares campaign defeat when no army and no friendly settlement remain", () => {
    const s = state();
    s.world.army.troops = 0;
    s.world.towns = s.world.towns.map((town) => ({ ...town, faction: 1 }));
    expect(campaignOutcome(s)).toEqual({ over: true, result: "campaign_defeat" });
  });

  it("turns the old camp victory into a regional victory that can continue", () => {
    const s = state();
    s.over = true;
    s.result = "victory";
    s.camp = { hp: 0, max: 600, destroyed: 1 };
    const next = continueAfterRegionalVictory(s);
    expect(next.over).toBe(false);
    expect(next.result).toBeNull();
    expect(next.camp.destroyed).toBe(1);
  });
});
