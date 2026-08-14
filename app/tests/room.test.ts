/**
 * IRON HOLDFAST — protocol tests through real WebSockets in workerd.
 *
 * The game is single-player real-time: one join starts a match immediately,
 * the server ticks it (500ms per step), and every player-visible fact arrives
 * through the same wire protocol every game shares.
 */

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

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
    if (data === "__pong") return;
    try {
      frames.push(JSON.parse(data));
    } catch {
      frames.push(data);
    }
  });

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
    expect(res.status).not.toBe(101);
  });

  it("404s a non-asset, non-ws path for a non-HTML request", async () => {
    const res = await SELF.fetch("https://game.test/api/nope");
    expect(res.status).toBe(404);
  });
});

describe("joining", () => {
  it("starts the match immediately for the single player", async () => {
    const room = uniq("solo");
    const a = await open(room);
    a.send({ type: "join", playerId: "castellan" });
    const playing = await a.state();
    expect(playing.status).toBe("playing");
    expect(playing.seats).toEqual(["castellan"]);
    expect(playing.you).toBe("castellan");
    expect(playing.connected).toBe(1);
    expect(playing.view).not.toBeNull();
    expect(playing.view.map).toBeTruthy();
    expect(playing.view.keep.hp).toBeGreaterThan(0);
    expect(playing.meta.game).toBe("Iron Holdfast");
    a.ws.close();
  });

  it("refuses to act before joining", async () => {
    const a = await open(uniq("early"));
    a.send({ type: "action", action: { type: "pause", on: true } });
    expect((await a.error()).error).toBe("join first");
    a.ws.close();
  });

  it("keeps a spectator watching but powerless", async () => {
    const r = uniq("spec");
    const x = await open(r);
    const s = await open(r);
    x.send({ type: "join", playerId: "castellan" });
    await x.next((f) => f?.type === "state" && f.status === "playing", "playing");

    s.send({ type: "join", playerId: "watcher" });
    const asWatcher = await s.state();
    expect(asWatcher.seats).toEqual(["castellan"]);
    expect(asWatcher.connected).toBe(2);

    s.frames.length = 0;
    s.send({ type: "action", action: { type: "build", b: "house", x: 1, y: 1 } });
    expect((await s.error()).error).toBe("spectators cannot act");
    s.frames.length = 0;
    s.send({ type: "reset" });
    expect((await s.error()).error).toBe("spectators cannot reset");
    x.ws.close();
    s.ws.close();
  });
});

describe("build economy", () => {
  it("places a house and charges the cost", async () => {
    const r = uniq("build");
    const a = await open(r);
    a.send({ type: "join", playerId: "castellan" });
    const start = await a.state();

    // find a grassy tile near the keep to build on
    const { kx, ky } = start.view;
    const x = kx + 2;
    const y = ky;
    a.frames.length = 0;
    a.send({ type: "action", action: { type: "build", b: "house", x, y } });

    const after = await a.next(
      (f) =>
        f?.type === "state" &&
        f.view?.buildings?.some((b: any) => b.b === "house" && b.x === x && b.y === y),
      "the house to land",
    );
    expect(after.view.res.wood).toBeLessThan(start.view.res.wood);
    expect(after.view.popCap).toBeGreaterThanOrEqual(start.view.popCap + 4);
    a.ws.close();
  });

  it("rejects an illegal placement and a barren build", async () => {
    const r = uniq("illegal");
    const a = await open(r);
    a.send({ type: "join", playerId: "castellan" });
    await a.state();
    a.frames.length = 0;

    // clone a spot on water
    const view = (await a.state()).view;
    const water = view.map.indexOf("w");
    const wx = water % view.W;
    const wy = Math.floor(water / view.W);
    a.send({ type: "action", action: { type: "build", b: "house", x: wx, y: wy } });
    expect((await a.error()).error).toMatch(/terrain|out of bounds/);

    // an iron mine far from iron
    a.frames.length = 0;
    a.send({ type: "action", action: { type: "build", b: "ironmine", x: 3, y: 3 } });
    const err = await a.error();
    expect(err.error).toMatch(/iron/);
    a.ws.close();
  });
});

describe("garrison", () => {
  it("requires a barracks, then trains a spearman", async () => {
    const r = uniq("train");
    const a = await open(r);
    a.send({ type: "join", playerId: "castellan" });
    const start = await a.state();

    a.frames.length = 0;
    a.send({ type: "action", action: { type: "train", u: "spearman" } });
    expect((await a.error()).error).toMatch(/barracks/);

    // build a barracks near the keep
    const { kx, ky } = start.view;
    a.frames.length = 0;
    a.send({ type: "action", action: { type: "build", b: "barracks", x: kx + 1, y: ky } });
    await a.next(
      (f) => f?.type === "state" && f.view?.buildings?.some((b: any) => b.b === "barracks"),
      "barracks",
    );

    a.frames.length = 0;
    a.send({ type: "action", action: { type: "train", u: "spearman" } });
    const trained = await a.next(
      (f) => f?.type === "state" && f.view?.units?.some((u: any) => u.f === "p"),
      "spearman",
    );
    expect(trained.view.units.some((u: any) => u.t === "spearman")).toBe(true);
    a.ws.close();
  });
});

describe("input hygiene", () => {
  it("rejects a non-JSON frame", async () => {
    const a = await open(uniq("badjson"));
    a.ws.send("not json at all");
    expect((await a.error()).error).toBe("invalid json");
    a.ws.close();
  });

  it("rejects an oversized action payload", async () => {
    const a = await open(uniq("bigact"));
    a.send({ type: "join", playerId: "castellan" });
    await a.state();
    a.frames.length = 0;
    a.send({ type: "action", action: { blob: "x".repeat(6_000) } });
    expect((await a.error()).error).toBe("action too large");
    a.ws.close();
  });

  it("rejects an unknown message type", async () => {
    const a = await open(uniq("badtype"));
    a.send({ type: "definitely-not-a-thing" });
    expect((await a.error()).error).toMatch(/unknown message type/);
    a.ws.close();
  });
});

describe("persistence", () => {
  it("survives a reconnect: state persists and the seat is reclaimed", async () => {
    const r = uniq("persist");
    const first = await open(r);
    first.send({ type: "join", playerId: "castellan" });
    await first.state();
    first.ws.close();

    const again = await open(r);
    again.send({ type: "join", playerId: "castellan" });
    const restored = await again.state();
    expect(restored.status).toBe("playing");
    expect(restored.seats).toEqual(["castellan"]);
    expect(restored.view).not.toBeNull();
    again.ws.close();
  });
});

describe("reset", () => {
  it("restarts the hold with a fresh state", async () => {
    const r = uniq("reset");
    const a = await open(r);
    a.send({ type: "join", playerId: "castellan" });
    await a.state();
    a.frames.length = 0;
    a.send({ type: "reset" });
    const fresh = await a.next(
      (f) => f?.type === "state" && f.status === "playing" && f.result === null,
      "a fresh hold",
    );
    expect(fresh.view.time).toBe(0);
    a.ws.close();
  });
});