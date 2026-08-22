import { describe, expect, it } from "vitest";
import {
  personalityForLord,
  stepRivalStrategy,
  strategicPath,
} from "../src/world-lords";

function state() {
  return {
    time: 1,
    world: {
      W: 7,
      H: 5,
      cells: new Array(35).fill(0),
      day: 3,
      army: { x: 1, y: 1, troops: 16, supply: 80 },
      towns: [
        { i: 0, name: "Alderford", x: 1, y: 1, faction: 0, troops: 12 },
        { i: 1, name: "Bramhall", x: 5, y: 1, faction: 1, troops: 18 },
        { i: 2, name: "Dunmoor", x: 5, y: 3, faction: 2, troops: 10 },
        { i: 3, name: "Erith", x: 3, y: 3, faction: 2, troops: 20 },
      ],
      lords: [
        { id: 1, name: "Lord Roderick", x: 5, y: 1, troops: 20, path: null },
        { id: 2, name: "Lady Isolde", x: 5, y: 3, troops: 18, path: null },
        { id: 3, name: "Lord Varric", x: 6, y: 4, troops: 14, path: null },
      ],
    },
  };
}

describe("rival lord strategy", () => {
  it("assigns stable personalities", () => {
    expect(personalityForLord({ id: 1 })).toBe("aggressive");
    expect(personalityForLord({ id: 2 })).toBe("defensive");
    expect(personalityForLord({ id: 99 })).toBe("raider");
  });

  it("routes around impassable mountains deterministically", () => {
    const s = state();
    s.world.cells[1 * 7 + 3] = 3;
    const path = strategicPath(s.world, 5, 1, 1, 1);
    expect(path).not.toBeNull();
    expect(path).not.toContainEqual([3, 1]);
    expect(path?.[path.length - 1]).toEqual([1, 1]);
    expect(strategicPath(s.world, 5, 1, 1, 1)).toEqual(path);
  });

  it("makes Roderick hunt a fight he believes he can win", () => {
    const next = stepRivalStrategy(state());
    const roderick = next.world.lords.find((lord: any) => lord.id === 1);
    expect(roderick.aiPersonality).toBe("aggressive");
    expect(roderick.aiTarget.kind).toBe("hunt_army");
    expect(roderick.aiTarget.x).toBe(1);
    expect(roderick.aiTarget.y).toBe(1);
  });

  it("makes Isolde defend her faction's threatened settlement", () => {
    const s = state();
    s.world.army = { ...s.world.army, x: 4, y: 3 };
    const next = stepRivalStrategy(s);
    const isolde = next.world.lords.find((lord: any) => lord.id === 2);
    expect(isolde.aiPersonality).toBe("defensive");
    expect(isolde.aiTarget.kind).toBe("defend_town");
    expect(isolde.aiTarget.label).toBe("Dunmoor");
  });

  it("makes a raider target the weakest player settlement", () => {
    const s = state();
    s.world.towns.push({ i: 4, name: "Thinwatch", x: 2, y: 4, faction: 0, troops: 2 });
    const next = stepRivalStrategy(s);
    const varric = next.world.lords.find((lord: any) => lord.id === 3);
    expect(varric.aiPersonality).toBe("raider");
    expect(varric.aiTarget.kind).toBe("raid_weak_town");
    expect(varric.aiTarget.label).toBe("Thinwatch");
  });

  it("keeps defeated/recovering rivals out of normal movement", () => {
    const s = state();
    s.world.lords[0] = {
      ...s.world.lords[0],
      troops: 0,
      defeated: true,
      recoveryUntilDay: 6,
      path: [[4, 1]],
    };
    const next = stepRivalStrategy(s);
    expect(next.world.lords[0].path).toBeNull();
    expect(next.world.lords[0].aiTarget).toBeNull();
  });
});
