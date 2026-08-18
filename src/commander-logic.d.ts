export const meta: { game: string; minPlayers: number; maxPlayers: number };
export function setup(players: string[]): unknown;
export function tick(state: unknown): unknown;
export function validateAction(state: unknown, playerId: string, action: unknown): { ok: true } | { ok: false; error?: string };
export function applyAction(state: unknown, playerId: string, action: unknown): unknown;
export function isGameOver(state: unknown): { over: false } | { over: true; winner?: string | null; [key: string]: unknown };
export function viewFor(state: unknown, playerId: string): unknown;
