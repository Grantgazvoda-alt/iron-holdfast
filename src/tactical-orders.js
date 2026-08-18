import { FORMATIONS, formationSlots, cohesionScore, formationModifiers } from "./tactics.js";

export const ORDER_TYPES = Object.freeze(["move", "hold", "attack", "retreat", "focus"]);

function finite(v, fallback = 0) {
  return Number.isFinite(v) ? Number(v) : fallback;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function normalizeGroup(raw = {}) {
  const ids = Array