/**
 * THE GAME. Replace this file to build your own — the room, the client harness
 * and the deploy stay exactly as they are.
 *
 * Rules (enforced by `bun run check:logic`, and by the platform at deploy):
 *   * export exactly these six names;
 *   * NO imports and NO timers — this module is pure game rules, nothing else;
 *   * every function is PURE: no Date.now(), no Math.random(), no I/O. The room
 *     replays and persists these results, so a nondeterministic game desyncs.
 *     Need randomness? Derive it from state (e.g. a seed you put in `setup`).
 *   * state must be JSON-serializable — it is written to room storage.
 *
 * What ships here is tic-tac-toe: small enough to read in one sitting, complete
 * enough to show every part of the contract (turn enforcement, per-player views,
 * end detection).
 *
 * See ../AGENTS.md for the full guide.
 */

export const meta = {
  game: "Tic-Tac-Toe",
  minPlayers: 2,
  maxPlayers: 2,
};

/** Seated players become X and O, in join order. */
export function setup(players) {
  return {
    board: Array(9).fill(null),
    marks: { [players[0]]: "X", [players[1]]: "O" },
    turn: players[0],
    players: [...players],
  };
}

/**
 * The gatekeeper: the client is untrusted, so every condition for a legal move
 * is checked here — right player, in-range cell, cell empty.
 */
export function validateAction(state, playerId, action) {
  if (state.turn !== playerId) return { ok: false, error: "not your turn" };
  const cell = action && action.cell;
  if (!Number.isInteger(cell) || cell < 0 || cell > 8) {
    return { ok: false, error: "cell must be an integer 0-8" };
  }
  if (state.board[cell] !== null) return { ok: false, error: "cell already taken" };
  return { ok: true };
}

/** Place the mark and pass the turn. Returns a NEW state; never mutates. */
export function applyAction(state, playerId, action) {
  const board = [...state.board];
  board[action.cell] = state.marks[playerId];
  const next = state.players.find((p) => p !== playerId) ?? playerId;
  return { ...state, board, turn: next };
}

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function isGameOver(state) {
  for (const [a, b, c] of LINES) {
    const mark = state.board[a];
    if (mark && mark === state.board[b] && mark === state.board[c]) {
      const winner = state.players.find((p) => state.marks[p] === mark) ?? null;
      return { over: true, winner, line: [a, b, c] };
    }
  }
  if (state.board.every((cell) => cell !== null)) {
    return { over: true, winner: null, draw: true };
  }
  return { over: false };
}

/**
 * Tic-tac-toe has no hidden information, so everyone sees the same board — only
 * `yourMark` and `yourTurn` differ. In a game WITH secrets (a card hand, fog of
 * war), omit them here: whatever this returns is the only thing that client
 * ever receives.
 */
export function viewFor(state, playerId) {
  return {
    board: state.board,
    turn: state.turn,
    yourMark: state.marks[playerId] ?? null,
    yourTurn: state.turn === playerId,
  };
}
