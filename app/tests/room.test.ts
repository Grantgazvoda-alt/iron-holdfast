/**
 * Room behaviour, exercised through real WebSockets in workerd.
 *
 * These tests are the safety net for the whole games migration: every existing
 * game speaks the wire protocol asserted here, so a regression in this file is a
 * regression in every migrated game. They deliberately drive the PUBLIC surface
 * (connect, send frames, read frames) rather than poking at internals.
 */

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

/** Open a socket to a room and collect frames as they arrive. */
async function open(room = "main") {
  const res = await SELF.fetch(`https://game.test/ws/${room}`, {
    headers: { Upgrade: "websocket" },
  });
  expect(res.status).toBe(101);
  const ws = res.webSocket;
  if (!ws) throw new Error("no webSocket on the upgrade response");
  ws.accept();

  const frames: unknown[] = [];
  ws.addEventListener("message", (event: MessageEvent) => {
    const data = typeof event.data === "string" ? event.data : "";
    // Keepalive auto-responses are not protocol traffic.
    if (data === "__pong") return;
    try {
      frames.push(JSON.parse(data));
    } catch {
      frames.push(data);
    }
  });

  /** Wait for the next frame matching `pred` (frames can arrive out of step). */
  const next = async (pred: (f: any) => boolean, label: string) => {
    for (let i = 0; i < 100; i++) {
      const hit = frames.find(pred);
      if (hit) return hit as any;
      await scheduler.wait(10);
    }
    throw new Error(`timed out waiting for ${label}; got ${JSON.stringify(frames)}`);
  };

  return {
    ws,
    frames,
    next,
    send: (msg: unknown) => ws.send(JSON.stringify(msg)),
    state: () => next((f) => f?.type === "state", "a state frame"),
    error: () => next((f) => f?.type === "error", "an error frame"),
  };
}

/**
 * A fresh room name per call. Durable Object state persists across tests in the
 * pool, so reusing a literal name would inherit the previous test's seats and
 * make the suite order-dependent.
 */
let seq = 0;
function uniq(label: string): string {
  seq += 1;
  return `${label}-${seq}-${crypto.randomUUID().slice(0, 6)}`;
}

describe("routing", () => {
  it("rejects a non-upgrade request to /ws instead of waking a room", async () => {
    const res = await SELF.fetch("https://game.test/ws");
    expect(res.status).toBe(426);
  });

  it("rejects a room name that isn't a short safe label", async () => {
    const res = await SELF.fetch("https://game.test/ws/../../etc/passwd", {
      headers: { Upgrade: "websocket" },
    });
    // Either the URL normalises away or the guard rejects it — never a 101.
    expect(res.status).not.toBe(101);
  });

  it("404s a non-asset, non-ws path for a non-HTML request", async () => {
    const res = await SELF.fetch("https://game.test/api/nope");
    expect(res.status).toBe(404);
  });
});

describe("joining", () => {
  it("waits for a second player, then starts the game", async () => {
    const r_start_flow = uniq("start-flow");
    const a = await open(r_start_flow);
    a.send({ type: "join", playerId: "alice" });
    const waiting = await a.state();
    expect(waiting.status).toBe("waiting");
    expect(waiting.seats).toEqual(["alice"]);
    expect(waiting.you).toBe("alice");
    expect(waiting.view).toBeNull();
    expect(waiting.meta.game).toBe("Tic-Tac-Toe");

    const b = await open(r_start_flow);
    b.send({ type: "join", playerId: "bob" });
    const playing = await b.next(
      (f) => f?.type === "state" && f.status === "playing",
      "the game to start",
    );
    expect(playing.seats).toEqual(["alice", "bob"]);
    expect(playing.connected).toBe(2);
    // Both players are told; the board is dealt.
    expect(playing.view.board).toEqual(Array(9).fill(null));

    a.ws.close();
    b.ws.close();
  });

  it("gives each player their OWN view of the same room", async () => {
    const r_views = uniq("views");
    const a = await open(r_views);
    const b = await open(r_views);
    a.send({ type: "join", playerId: "alice" });
    b.send({ type: "join", playerId: "bob" });

    const forA = await a.next((f) => f?.type === "state" && f.status === "playing", "A playing");
    const forB = await b.next((f) => f?.type === "state" && f.status === "playing", "B playing");
    expect(forA.you).toBe("alice");
    expect(forB.you).toBe("bob");
    expect(forA.view.yourMark).toBe("X");
    expect(forB.view.yourMark).toBe("O");
    // X moves first, so exactly one of them is on turn.
    expect(forA.view.yourTurn).toBe(true);
    expect(forB.view.yourTurn).toBe(false);

    a.ws.close();
    b.ws.close();
  });

  it("refuses to act before joining", async () => {
    const r_no_join = uniq("no-join");
    const a = await open(r_no_join);
    a.send({ type: "action", action: { cell: 0 } });
    expect((await a.error()).error).toBe("join first");
    a.ws.close();
  });
});

describe("playing", () => {
  /** Seat two players in a fresh room and return both sockets, X first. */
  async function seated(room: string) {
    const x = await open(room);
    const o = await open(room);
    x.send({ type: "join", playerId: "x-player" });
    o.send({ type: "join", playerId: "o-player" });
    await x.next((f) => f?.type === "state" && f.status === "playing", "playing");
    await o.next((f) => f?.type === "state" && f.status === "playing", "playing");
    x.frames.length = 0;
    o.frames.length = 0;
    return { x, o };
  }

  it("applies a legal move and tells BOTH players", async () => {
    const r_legal_move = uniq("legal-move");
    const { x, o } = await seated(r_legal_move);
    x.send({ type: "action", action: { cell: 4 } });

    const seenByX = await x.state();
    const seenByO = await o.state();
    expect(seenByX.view.board[4]).toBe("X");
    expect(seenByO.view.board[4]).toBe("X");
    // The turn passed.
    expect(seenByX.view.yourTurn).toBe(false);
    expect(seenByO.view.yourTurn).toBe(true);

    x.ws.close();
    o.ws.close();
  });

  it("enforces turn order (the client cannot move out of turn)", async () => {
    const r_turn_order = uniq("turn-order");
    const { x, o } = await seated(r_turn_order);
    o.send({ type: "action", action: { cell: 0 } });
    expect((await o.error()).error).toBe("not your turn");
    x.ws.close();
    o.ws.close();
  });

  it("rejects an occupied cell and an out-of-range cell", async () => {
    const r_bad_cells = uniq("bad-cells");
    const { x, o } = await seated(r_bad_cells);
    x.send({ type: "action", action: { cell: 0 } });
    await o.state();
    o.frames.length = 0;

    o.send({ type: "action", action: { cell: 0 } });
    expect((await o.error()).error).toBe("cell already taken");
    o.frames.length = 0;

    o.send({ type: "action", action: { cell: 99 } });
    expect((await o.error()).error).toMatch(/0-8/);

    x.ws.close();
    o.ws.close();
  });

  it("detects a win and freezes the game", async () => {
    const r_win = uniq("win");
    const { x, o } = await seated(r_win);
    // X: 0,1,2 · O: 3,4
    for (const [who, cell] of [
      [x, 0],
      [o, 3],
      [x, 1],
      [o, 4],
      [x, 2],
    ] as const) {
      who.send({ type: "action", action: { cell } });
      await who.next(
        (f) => f?.type === "state" && f.view?.board?.[cell] !== null,
        `cell ${cell} to land`,
      );
    }

    const over = await x.next((f) => f?.type === "state" && f.status === "over", "game over");
    expect(over.result.winner).toBe("x-player");
    expect(over.result.line).toEqual([0, 1, 2]);

    // A move after the end is refused.
    o.frames.length = 0;
    o.send({ type: "action", action: { cell: 5 } });
    expect((await o.error()).error).toBe("game is not in progress");

    x.ws.close();
    o.ws.close();
  });

  it("resets to a fresh board on request", async () => {
    const r_reset = uniq("reset");
    const { x, o } = await seated(r_reset);
    x.send({ type: "action", action: { cell: 0 } });
    await x.state();
    x.frames.length = 0;

    x.send({ type: "reset" });
    const fresh = await x.next(
      (f) => f?.type === "state" && f.view?.board?.every((c: unknown) => c === null),
      "a cleared board",
    );
    expect(fresh.status).toBe("playing");
    expect(fresh.result).toBeNull();

    x.ws.close();
    o.ws.close();
  });
});

describe("isolation and persistence", () => {
  it("keeps two rooms completely separate", async () => {
    const r_room_one = uniq("room-one");
    const r_room_two = uniq("room-two");
    const one = await open(r_room_one);
    const two = await open(r_room_two);
    one.send({ type: "join", playerId: "alice" });
    two.send({ type: "join", playerId: "bob" });

    const s1 = await one.state();
    const s2 = await two.state();
    // Each room saw only its own player.
    expect(s1.seats).toEqual(["alice"]);
    expect(s2.seats).toEqual(["bob"]);
    expect(s1.connected).toBe(1);
    expect(s2.connected).toBe(1);

    one.ws.close();
    two.ws.close();
  });

  it("survives a reconnect: state persists and the seat is reclaimed", async () => {
    const r_persist = uniq("persist");
    const first = await open(r_persist);
    first.send({ type: "join", playerId: "alice" });
    await first.state();
    // A second player so there is a real board to preserve.
    const other = await open(r_persist);
    other.send({ type: "join", playerId: "bob" });
    await first.next((f) => f?.type === "state" && f.status === "playing", "playing");
    first.send({ type: "action", action: { cell: 8 } });
    await first.state();
    first.ws.close();

    // Reconnecting with the SAME playerId rejoins the same seat and sees the
    // board as it was — proof the state lives in storage, not memory.
    const again = await open(r_persist);
    again.send({ type: "join", playerId: "alice" });
    const restored = await again.state();
    expect(restored.status).toBe("playing");
    expect(restored.seats).toEqual(["alice", "bob"]);
    expect(restored.view.board[8]).toBe("X");

    again.ws.close();
    other.ws.close();
  });

  it("drops a departed player from the connected count", async () => {
    const r_leave = uniq("leave");
    const a = await open(r_leave);
    const b = await open(r_leave);
    a.send({ type: "join", playerId: "alice" });
    b.send({ type: "join", playerId: "bob" });
    await a.next((f) => f?.type === "state" && f.connected === 2, "both connected");

    a.frames.length = 0;
    b.frames.length = 0;
    b.ws.close();
    const afterLeave = await a.next(
      (f) => f?.type === "state" && f.connected === 1,
      "the count to drop",
    );
    // The seat is kept (bob can reclaim it); only the connection went away.
    expect(afterLeave.seats).toEqual(["alice", "bob"]);
    a.ws.close();
  });
});

describe("untrusted input", () => {
  it("rejects a non-JSON frame", async () => {
    const r_bad_json = uniq("bad-json");
    const a = await open(r_bad_json);
    a.ws.send("not json at all");
    expect((await a.error()).error).toBe("invalid json");
    a.ws.close();
  });

  it("rejects a JSON array (not an object)", async () => {
    const r_bad_shape = uniq("bad-shape");
    const a = await open(r_bad_shape);
    a.ws.send(JSON.stringify([1, 2, 3]));
    expect((await a.error()).error).toBe("expected a json object");
    a.ws.close();
  });

  it("rejects an unknown message type", async () => {
    const r_bad_type = uniq("bad-type");
    const a = await open(r_bad_type);
    a.send({ type: "definitely-not-a-thing" });
    expect((await a.error()).error).toMatch(/unknown message type/);
    a.ws.close();
  });

  it("requires a playerId on join", async () => {
    const r_no_id = uniq("no-id");
    const a = await open(r_no_id);
    a.send({ type: "join" });
    expect((await a.error()).error).toBe("playerId required");
    a.frames.length = 0;
    a.send({ type: "join", playerId: "   " });
    // Whitespace is a real id per the previous engine's clamp; what must NOT
    // happen is a crash — assert we still get a protocol frame back.
    await a.next((f) => f?.type === "state" || f?.type === "error", "any protocol frame");
    a.ws.close();
  });

  it("refuses an oversized frame instead of persisting it", async () => {
    const r_too_big = uniq("too-big");
    const a = await open(r_too_big);
    a.send({ type: "join", playerId: "alice" });
    await a.state();
    a.frames.length = 0;
    // Well over the 16 KiB frame cap.
    a.send({ type: "action", action: { blob: "x".repeat(20_000) } });
    expect((await a.error()).error).toBe("message too large");
    a.ws.close();
  });

  it("refuses an oversized action payload", async () => {
    const r_big_action = uniq("big-action");
    const a = await open(r_big_action);
    a.send({ type: "join", playerId: "alice" });
    await a.state();
    a.frames.length = 0;
    // Under the frame cap, over the 4 KiB action cap.
    a.send({ type: "action", action: { blob: "x".repeat(6_000) } });
    expect((await a.error()).error).toBe("action too large");
    a.ws.close();
  });

  it("does not seat a spectator beyond maxPlayers, and refuses their actions", async () => {
    const r_spectator = uniq("spectator");
    const x = await open(r_spectator);
    const o = await open(r_spectator);
    const s = await open(r_spectator);
    x.send({ type: "join", playerId: "x-player" });
    o.send({ type: "join", playerId: "o-player" });
    await x.next((f) => f?.type === "state" && f.status === "playing", "playing");

    s.send({ type: "join", playerId: "watcher" });
    const asWatcher = await s.state();
    // Seated players are unchanged; the watcher is connected but not seated.
    expect(asWatcher.seats).toEqual(["x-player", "o-player"]);
    expect(asWatcher.connected).toBe(3);

    s.frames.length = 0;
    s.send({ type: "action", action: { cell: 0 } });
    expect((await s.error()).error).toBe("spectators cannot act");

    s.frames.length = 0;
    s.send({ type: "reset" });
    expect((await s.error()).error).toBe("spectators cannot reset");

    x.ws.close();
    o.ws.close();
    s.ws.close();
  });
});
