import test from "node:test";
import assert from "node:assert/strict";
import { parseClientMessage } from "../src/protocol.ts";

test("rejects binary, malformed JSON, arrays, and unknown message types", () => {
  assert.equal(parseClientMessage(new ArrayBuffer(8)).ok, false);
  assert.equal(parseClientMessage("not-json").ok, false);
  assert.equal(parseClientMessage("[]").ok, false);
  assert.equal(parseClientMessage(JSON.stringify({ type: "mystery" })).ok, false);
});

test("normalizes bounded join identifiers without accepting arbitrary objects", () => {
  const numeric = parseClientMessage(JSON.stringify({ type: "join", playerId: 12345 }));
  assert.deepEqual(numeric, { ok: true, msg: { type: "join", playerId: "12345" } });

  const long = "x".repeat(200);
  const joined = parseClientMessage(JSON.stringify({ type: "join", playerId: long }));
  assert.equal(joined.ok, true);
  assert.equal(joined.msg.playerId.length, 64);

  assert.equal(parseClientMessage(JSON.stringify({ type: "join", playerId: {} })).ok, false);
  assert.equal(parseClientMessage(JSON.stringify({ type: "join", playerId: "" })).ok, false);
});

test("rejects oversized frames and oversized persisted action payloads", () => {
  const hugeFrame = JSON.stringify({ type: "join", playerId: "x".repeat(20_000) });
  const frame = parseClientMessage(hugeFrame);
  assert.equal(frame.ok, false);
  assert.equal(frame.error, "message too large");

  const action = parseClientMessage(JSON.stringify({ type: "action", action: { blob: "x".repeat(5_000) } }));
  assert.equal(action.ok, false);
  assert.equal(action.error, "action too large");
});

test("accepts bounded actions and reset without trusting action semantics", () => {
  const action = { type: "move", ids: [1], x: 2, y: 3 };
  assert.deepEqual(parseClientMessage(JSON.stringify({ type: "action", action })), {
    ok: true,
    msg: { type: "action", action },
  });
  assert.deepEqual(parseClientMessage(JSON.stringify({ type: "reset" })), {
    ok: true,
    msg: { type: "reset" },
  });
});
