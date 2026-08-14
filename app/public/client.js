/**
 * The client net harness + a tic-tac-toe renderer.
 *
 * Split deliberately: `connect()` below is game-agnostic plumbing you keep, and
 * `render()` is the part you rewrite for your own game. The server is
 * authoritative — this file never decides anything, it only sends intents
 * ({type:"action"}) and draws whatever `view` comes back.
 */

// ── net (keep this) ────────────────────────────────────────────────────────

/** Room from ?room=, so two tabs can share a game. Same name = same room. */
const room = new URLSearchParams(location.search).get("room") || "main";

/**
 * A stable per-browser identity, so a reload rejoins the same seat instead of
 * consuming a new one. Not a security boundary — the server treats playerId as a
 * claim, which is fine for casual games.
 */
function playerId() {
  const key = "hf:game:playerId";
  let id = localStorage.getItem(key);
  if (!id) {
    id = Math.random().toString(36).slice(2, 10);
    localStorage.setItem(key, id);
  }
  return id;
}

const PING = "__ping";
const PONG = "__pong";

let socket = null;
let retry = 0;

function connect() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${proto}//${location.host}/ws/${encodeURIComponent(room)}`);

  socket.addEventListener("open", () => {
    retry = 0;
    setStatus("connected");
    send({ type: "join", playerId: playerId() });
  });

  socket.addEventListener("message", (event) => {
    // The server answers keepalives without waking the room; ignore them.
    if (event.data === PONG) return;
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    if (msg.type === "state") render(msg);
    else if (msg.type === "error") setStatus(msg.error, true);
  });

  socket.addEventListener("close", () => {
    // Exponential backoff, capped: a room that is briefly unreachable should not
    // get hammered by every open tab.
    retry = Math.min(retry + 1, 6);
    const wait = 500 * 2 ** (retry - 1);
    setStatus(`disconnected — retrying in ${Math.round(wait / 1000)}s`, true);
    setTimeout(connect, wait);
  });
}

function send(msg) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
}

// Keep the socket warm through idle periods (the server auto-answers these).
setInterval(() => {
  if (socket?.readyState === WebSocket.OPEN) socket.send(PING);
}, 30_000);

// ── view (rewrite this for your game) ─────────────────────────────────────

const boardEl = document.querySelector("#board");
const statusEl = document.querySelector("#status");
const metaEl = document.querySelector("#meta");

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("error", isError);
}

function render(msg) {
  const { status, view, result, meta, connected, seats } = msg;
  metaEl.textContent = `${meta.game} · room “${room}” · ${connected} connected · ${seats.length}/${meta.maxPlayers} seated`;

  if (status === "waiting") {
    setStatus(`waiting for players (${seats.length}/${meta.minPlayers})`);
  } else if (status === "over") {
    setStatus(result?.draw ? "draw" : result?.winner === view?.yourMark ? "you win" : "game over");
  } else {
    setStatus(view?.yourTurn ? "your turn" : "opponent's turn");
  }

  boardEl.innerHTML = "";
  const cells = view?.board ?? Array(9).fill(null);
  cells.forEach((mark, i) => {
    const cell = document.createElement("button");
    // textContent, never innerHTML: server data is never treated as markup.
    cell.textContent = mark ?? "";
    cell.className = "cell";
    cell.disabled = Boolean(mark) || status !== "playing" || !view?.yourTurn;
    cell.addEventListener("click", () => send({ type: "action", action: { cell: i } }));
    boardEl.append(cell);
  });

  const won = result?.line ?? [];
  for (const i of won) boardEl.children[i]?.classList.add("win");
}

document.querySelector("#reset").addEventListener("click", () => send({ type: "reset" }));

connect();
