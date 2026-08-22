const PLAYER_KEY = "hf:game:playerId";
const SAFE_ID = /^[A-Za-z0-9_-]{6,48}$/;
const SAFE_ROOM = /^[A-Za-z0-9_-]{1,64}$/;

function freshPlayerId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID().replaceAll("-", "").slice(0, 20);
  }
  return `${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`.slice(0, 20);
}

export function playerId(storage = globalThis.localStorage) {
  let id = storage?.getItem?.(PLAYER_KEY) || "";
  if (!SAFE_ID.test(id)) {
    id = freshPlayerId();
    storage?.setItem?.(PLAYER_KEY, id);
  }
  return id;
}

export function roomId(search = globalThis.location?.search || "", storage = globalThis.localStorage) {
  const requested = new URLSearchParams(search).get("room") || "";
  if (SAFE_ROOM.test(requested)) return requested;
  return `solo-${playerId(storage)}`;
}

export const sessionRules = Object.freeze({
  playerKey: PLAYER_KEY,
  safeId: SAFE_ID,
  safeRoom: SAFE_ROOM,
});
