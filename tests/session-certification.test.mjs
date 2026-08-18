import test from "node:test";
import assert from "node:assert/strict";
import { playerId, roomId, sessionRules } from "../public/session.js";

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    values,
  };
}

test("queryless installs get stable private rooms instead of global main", () => {
  const a = storage({ [sessionRules.playerKey]: "player_alpha_01" });
  const b = storage({ [sessionRules.playerKey]: "player_beta_02" });
  assert.equal(roomId("", a), "solo-player_alpha_01");
  assert.equal(roomId("", a), "solo-player_alpha_01");
  assert.equal(roomId("", b), "solo-player_beta_02");
  assert.notEqual(roomId("", a), roomId("", b));
  assert.notEqual(roomId("", a), "main");
});

test("explicit safe room links remain available for deliberate shared/test rooms", () => {
  const s = storage({ [sessionRules.playerKey]: "player_alpha_01" });
  assert.equal(roomId("?room=qa-room_123", s), "qa-room_123");
});

test("unsafe explicit room names fall back to the private install room", () => {
  const s = storage({ [sessionRules.playerKey]: "player_alpha_01" });
  assert.equal(roomId("?room=../../etc/passwd", s), "solo-player_alpha_01");
  assert.equal(roomId(`?room=${"x".repeat(80)}`, s), "solo-player_alpha_01");
});

test("corrupt local player identifiers are replaced with bounded safe identifiers", () => {
  const s = storage({ [sessionRules.playerKey]: "bad id / with spaces" });
  const id = playerId(s);
  assert.match(id, sessionRules.safeId);
  assert.equal(s.values.get(sessionRules.playerKey), id);
  assert.equal(roomId("", s), `solo-${id}`);
  assert.match(roomId("", s), sessionRules.safeRoom);
});
