import { describe, expect, it } from "vitest";
import * as logic from "../src/commander-logic.js";

type AnyState = Record<string, any>;

function build(): AnyState { return logic.setup(["castellan"]) as AnyState; }
function reset(s: AnyState, count: number, ability: string): AnyState {
  return logic.applyAction(s, s.seat, { type: "resetGame", count, ability }) as AnyState;
}

describe("enemy commander configuration", () => {
  it("defaults to one soldier commander", () => {
    const s = build();
    expect(s.npcConfig).toEqual({ count: 1, ability: "soldier" });
    expect(s.npcCommanders).toHaveLength(1);
  });

  it("validates count and ability server-side", () => {
    const s = build();
    expect(logic.validateAction(s, s.seat, { type: "resetGame", count: 4, ability: "warlord" }).ok).toBe(true);
    expect(logic.validateAction(s, s.seat, { type: "resetGame", count: 9, ability: "warlord" }).ok).toBe(false);
    expect(logic.validateAction(s, s.seat, { type: "resetGame", count: 2, ability: "dragon" }).ok).toBe(false);
  });

  it("creates a clean run with the selected commanders", () => {
    let s = build();
    s.time = 42; s.wave = 3; s.res.wood = 999;
    s = reset(s, 4, "veteran");
    expect(s.time).toBe(0);
    expect(s.wave).toBe(0);
    expect(s.npcConfig).toEqual({ count: 4, ability: "veteran" });
    expect(s.npcCommanders).toHaveLength(4);
    expect(s.events[0].text).toContain("4 enemy commanders");
  });

  it("warlord commanders increase wave pressure and tag spawned enemies", () => {
    let s = reset(build(), 4, "warlord");
    s.waveIn = 0;
    for (let i = 0; i < 80 && !s.units.some((u: AnyState) => u.f === "e"); i++) s = logic.tick(s) as AnyState;
    const enemies = s.units.filter((u: AnyState) => u.f === "e");
    expect(enemies.length).toBeGreaterThan(0);
    expect(enemies.some((u: AnyState) => u.commander >= 1 && u.commander <= 4)).toBe(true);
  });
});
