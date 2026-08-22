/**
 * `Room` — one multiplayer room, as a Durable Object.
 *
 * A room owns its players' WebSockets and all game state. One DO instance per
 * room id (`env.ROOMS.idFromName(room)`), so two rooms never share state and an
 * idle room costs nothing (see HIBERNATION below).
 *
 * This file is the TRUSTED half of the game: it speaks the wire protocol, owns
 * the sockets, and persists state. It calls `./logic.js` — the game-specific
 * half, six pure functions — for every game decision. Editing a game means
 * editing `logic.js`; you should rarely need to touch this file.
 *
 * ── WIRE PROTOCOL (unchanged from the previous games engine) ─────────────
 *   in:  {type:"join", playerId} | {type:"action", action} | {type:"reset"}
 *   out: {type:"state", status, seats, you, connected, view, result, meta}
 *        {type:"error", error}
 *
 * ── logic.js CONTRACT (pure functions over JSON state) ───────────────────
 *   meta {game, minPlayers, maxPlayers}
 *   setup(players) · validateAction(state, playerId, action)
 *   applyAction(state, playerId, action) · isGameOver(state)
 *   viewFor(state, playerId)
 *
 * ── HIBERNATION ─────────────────────────────────────────────────────────
 * Sockets are accepted with `ctx.acceptWebSocket`, so a room with no traffic is
 * evicted from memory while its connections STAY OPEN, and is revived on the
 * next message. An idle room therefore bills no duration. Two consequences:
 *   * never keep game state in instance fields — it will not survive eviction.
 *     Everything lives in `ctx.storage` (SQLite-backed, per room).
 *   * a connection's identity rides on the socket itself
 *     (`serializeAttachment`), because an in-memory map does not survive.
 */

import { DurableObject } from "cloudflare:workers";

import type { Env } from "./env";
import {
  createCampaignBattle,
  detectWorldEncounter,
  reconcileCampaignBattle,
  stepCampaignBattle,
  type CampaignBattle,
} from "./campaign-battle.js";
import { enemyCampaignBattleOrder, isCampaignBattleOrderAction } from "./campaign-room";
import * as logic from "./logic.js";
import { parseClientMessage } from "./protocol";
import {
  applyPaidWorldResupply,
  stepWorldEconomy,
  validatePaidWorldResupply,
} from "./world-economy";

/** Server-authoritative room state. Persisted; `view` is derived per player. */
interface Game {
  /** waiting = not enough players yet · playing · over */
  status: "waiting" | "playing" | "over";
  /** playerIds in join order; the first `maxPlayers` get seats, the rest spectate. */
  seats: string[];
  /** Whatever `logic.setup()` returned, advanced by `logic.applyAction()`. */
  state: unknown;
  /** Whatever `logic.isGameOver()` returned once it ended. */
  result: unknown;
  /** Active/resolved overworld army encounter. Persisted across hibernation. */
  campaignBattle?: CampaignBattle | null;
  /**
   * playerId -> connId of the connection that claimed that seat. Persisted so
   * socket ownership survives hibernation; used to refuse seat hijacking.
   */
  claims?: Record<string, string>;
}

/** connId -> playerId. Persisted: the sockets outlive this object's memory. */
type Conns = Record<string, string>;

/** One outbound message. `to` is a connId, a list of them, or "*" for everyone. */
interface Out {
  to: string | string[];
  data: unknown;
}

/** What a handler may return: messages, or messages plus an alarm request. */
type Dispatchable = Out[] | { out?: Out[]; wakeIn?: number | null } | void;

/** A brand-new room state. */
export function freshGame(): Game {
  return {
    status: "waiting",
    seats: [],
    state: null,
    result: null,
    campaignBattle: null,
    claims: {},
  };
}

export function resolveMeta(
  raw: unknown,
): { game: string; minPlayers: number; maxPlayers: number } {
  const meta = (raw ?? {}) as Record<string, unknown>;
  const players = Array.isArray(meta.players) ? (meta.players as unknown[]) : [];
  const seats = (value: unknown, fallback: number): number =>
    Number.isInteger(value) && (value as number) >= 1 ? (value as number) : fallback;

  const minPlayers = seats(meta.minPlayers, seats(players[0], 1));
  const maxPlayers = seats(meta.maxPlayers, seats(players[1], minPlayers));
  const named = [meta.game, meta.name, meta.title].find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
  return {
    game: named ?? "Game",
    minPlayers,
    maxPlayers: Math.max(minPlayers, maxPlayers),
  };
}

const META = resolveMeta(logic.meta);
const TICK_MS = 500;
const PING = "__ping";
const PONG = "__pong";

export class Room extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
  }

  private async load(): Promise<{ game: Game; conns: Conns }> {
    const [game, conns] = await Promise.all([
      this.ctx.storage.get<Game>("game"),
      this.ctx.storage.get<Conns>("conns"),
    ]);
    return { game: game ?? freshGame(), conns: conns ?? {} };
  }

  private async save(game: Game, conns: Conns): Promise<void> {
    await this.ctx.storage.put({ game, conns });
  }

  private broadcast(game: Game, conns: Conns): Out[] {
    const connected = Object.keys(conns).length;
    return Object.entries(conns).map(([connId, playerId]) => ({
      to: connId,
      data: {
        type: "state",
        status: game.status,
        seats: game.seats,
        you: playerId,
        connected,
        view: game.state ? logic.viewFor(game.state, playerId) : null,
        result: game.result,
        campaignBattle: game.campaignBattle ?? null,
        meta: META,
      },
    }));
  }

  private error(connId: string, error: string): Out[] {
    return [{ to: connId, data: { type: "error", error } }];
  }

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected a websocket upgrade", { status: 426 });
    }
    const pair = new WebSocketPair();
    const server = pair[1]!;
    this.ctx.acceptWebSocket(server);
    const connId = crypto.randomUUID().slice(0, 8);
    server.serializeAttachment({ connId });
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  private connIdOf(ws: WebSocket): string | undefined {
    const att = ws.deserializeAttachment() as { connId?: string } | null;
    return att?.connId;
  }

  override async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const connId = this.connIdOf(ws);
    if (!connId) return;
    try {
      await this.dispatch(await this.onMessage(connId, raw));
    } catch (err) {
      console.error("room message failed:", err instanceof Error ? err.stack : String(err));
      try {
        ws.send(JSON.stringify({ type: "error", error: "server error" }));
      } catch {
        /* socket already gone */
      }
    }
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    const connId = this.connIdOf(ws);
    if (!connId) return;
    const { game, conns } = await this.load();
    if (conns[connId] === undefined) return;
    const seatedAs = conns[connId];
    delete conns[connId];
    if (game.claims && game.claims[seatedAs] === connId) {
      delete game.claims[seatedAs];
    }
    await this.save(game, conns);
    await this.dispatch(this.broadcast(game, conns));
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }

  override async alarm(): Promise<void> {
    try {
      await this.dispatch(await this.onWake());
    } catch (err) {
      console.error("room alarm failed:", err instanceof Error ? err.stack : String(err));
    }
  }

  private async onMessage(connId: string, raw: string | ArrayBuffer): Promise<Dispatchable> {
    const parsed = parseClientMessage(raw);
    if (!parsed.ok) return this.error(connId, parsed.error);
    const msg = parsed.msg;
    const { game, conns } = await this.load();

    if (msg.type === "join") {
      const already = game.seats.includes(msg.playerId);
      if (already) {
        const claims = game.claims ?? {};
        const ownerConn = claims[msg.playerId];
        if (ownerConn && conns[ownerConn]) {
          return { out: this.broadcast(game, conns), wakeIn: TICK_MS };
        }
      }
      conns[connId] = msg.playerId;
      if (!game.claims) game.claims = {};
      if (!already && game.seats.length < META.maxPlayers) {
        game.seats.push(msg.playerId);
        game.claims[msg.playerId] = connId;
      } else if (already) {
        game.claims[msg.playerId] = connId;
      }
      if (game.status === "waiting" && game.seats.length >= META.minPlayers) {
        game.state = stepWorldEconomy(logic.setup(game.seats));
        game.campaignBattle = null;
        game.status = "playing";
      } else if (game.status === "playing" && game.state && (game.state as any).paused) {
        game.state = logic.applyAction(game.state, msg.playerId, { type: "pause", on: false });
      }
      await this.save(game, conns);
      return { out: this.broadcast(game, conns), wakeIn: TICK_MS };
    }

    const playerId = conns[connId];
    if (!playerId) return this.error(connId, "join first");

    if (msg.type === "action") {
      if (game.status !== "playing") return this.error(connId, "game is not in progress");
      const owned = game.seats.includes(playerId) && game.claims?.[playerId] === connId;
      if (!owned) return this.error(connId, "spectators cannot act");

      if (game.campaignBattle?.status === "active") {
        if (!isCampaignBattleOrderAction(msg.action)) {
          return this.error(connId, "campaign battle requires a field order");
        }
        const battle = game.campaignBattle;
        const nextBattle = stepCampaignBattle(
          battle,
          msg.action.order,
          enemyCampaignBattleOrder(battle),
        );
        game.campaignBattle = nextBattle;
        if (nextBattle.status === "resolved") {
          const state = game.state as any;
          game.state = {
            ...state,
            world: reconcileCampaignBattle(state.world, nextBattle),
          };
        }
        await this.save(game, conns);
        return { out: this.broadcast(game, conns), wakeIn: TICK_MS };
      }

      const actionRecord =
        typeof msg.action === "object" && msg.action !== null && !Array.isArray(msg.action)
          ? (msg.action as Record<string, unknown>)
          : null;

      // Override Slice-1's free resupply path at the trusted boundary. The old
      // client action remains compatible, but every refill now costs treasury
      // gold according to world-economy.ts.
      if (actionRecord?.type === "world_resupply") {
        const verdict = validatePaidWorldResupply(game.state);
        if (!verdict.ok) return this.error(connId, verdict.error);
        game.state = applyPaidWorldResupply(game.state);
        await this.save(game, conns);
        return { out: this.broadcast(game, conns), wakeIn: TICK_MS };
      }

      const verdict = logic.validateAction(game.state, playerId, msg.action);
      if (!verdict.ok) return this.error(connId, verdict.error ?? "invalid action");
      game.state = logic.applyAction(game.state, playerId, msg.action);
      const end = logic.isGameOver(game.state);
      if (end.over) {
        game.status = "over";
        game.result = end;
      }
      await this.save(game, conns);
      return {
        out: this.broadcast(game, conns),
        wakeIn: game.status === "playing" ? TICK_MS : null,
      };
    }

    if (!(game.seats.includes(playerId) && game.claims?.[playerId] === connId)) {
      return this.error(connId, "spectators cannot reset");
    }
    const enough = game.seats.length >= META.minPlayers;
    game.state = enough ? stepWorldEconomy(logic.setup(game.seats)) : null;
    game.status = enough ? "playing" : "waiting";
    game.result = null;
    game.campaignBattle = null;
    await this.save(game, conns);
    return { out: this.broadcast(game, conns), wakeIn: enough ? TICK_MS : null };
  }

  private async onWake(): Promise<Dispatchable> {
    const { game, conns } = await this.load();
    if (game.status !== "playing" || !game.state) return { wakeIn: null };

    if (game.seats[0] && !Object.values(conns).includes(game.seats[0])) {
      game.state = logic.applyAction(game.state, (game.state as any).seat, {
        type: "pause",
        on: true,
      });
      await this.save(game, conns);
      return { out: [], wakeIn: null };
    }

    if ((game.state as any).paused) return { out: [], wakeIn: null };

    if (game.campaignBattle?.status === "active") {
      const battle = game.campaignBattle;
      const nextBattle = stepCampaignBattle(
        battle,
        "advance",
        enemyCampaignBattleOrder(battle),
      );
      game.campaignBattle = nextBattle;
      if (nextBattle.status === "resolved") {
        const state = game.state as any;
        game.state = {
          ...state,
          world: reconcileCampaignBattle(state.world, nextBattle),
        };
      }
      await this.save(game, conns);
      return { out: this.broadcast(game, conns), wakeIn: TICK_MS };
    }

    if (game.campaignBattle?.status === "resolved") {
      game.campaignBattle = null;
    }

    // The base deterministic game advances first. Kingdom taxes are then
    // derived from the resulting world day and recorded exactly once.
    game.state = stepWorldEconomy(logic.tick(game.state));
    const end = logic.isGameOver(game.state);
    if (end.over) {
      game.status = "over";
      game.result = end;
    }

    if (game.status === "playing") {
      const state = game.state as any;
      const encounter = detectWorldEncounter(state.world);
      if (encounter) {
        const world = {
          ...state.world,
          army: { ...state.world.army, path: null, wait: 0 },
          lords: state.world.lords.map((lord: any) =>
            lord.id === encounter.id ? { ...lord, path: null, wait: 0 } : { ...lord },
          ),
        };
        game.state = { ...state, world };
        game.campaignBattle = createCampaignBattle(world, encounter.id);
      }
    }

    await this.save(game, conns);
    return { out: this.broadcast(game, conns), wakeIn: game.status === "playing" ? TICK_MS : null };
  }

  private async dispatch(res: Dispatchable): Promise<void> {
    if (!res) return;
    const msgs = Array.isArray(res) ? res : (res.out ?? []);
    const wakeIn = Array.isArray(res) ? undefined : res.wakeIn;

    if (msgs.length) {
      const sockets = this.ctx.getWebSockets();
      const byId = new Map<string, WebSocket>();
      for (const s of sockets) {
        const id = this.connIdOf(s);
        if (id) byId.set(id, s);
      }
      for (const m of msgs) {
        if (!m) continue;
        const data = typeof m.data === "string" ? m.data : JSON.stringify(m.data);
        const targets =
          m.to === "*"
            ? sockets
            : Array.isArray(m.to)
              ? m.to.map((id) => byId.get(id)).filter((s): s is WebSocket => Boolean(s))
              : [byId.get(m.to)].filter((s): s is WebSocket => Boolean(s));
        for (const t of targets) {
          try {
            t.send(data);
          } catch {
            /* socket closed mid-fan-out; its close handler will clean up */
          }
        }
      }
    }

    if (wakeIn === null) await this.ctx.storage.deleteAlarm();
    else if (typeof wakeIn === "number") await this.ctx.storage.setAlarm(Date.now() + wakeIn);
  }
}
