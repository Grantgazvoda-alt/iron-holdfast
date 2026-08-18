import { FORMATIONS, formationSlots, cohesionScore, formationModifiers } from "./tactics.js";

export const ORDER_TYPES = Object.freeze(["move", "hold", "attack", "retreat", "focus"]);

function finite(v, fallback = 0) {
  return Number.isFinite(v) ? Number(v) : fallback;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function normalizeGroup(raw = {}) {
  const ids = Array.isArray(raw.unitIds)
    ? [...new Set(raw.unitIds.filter((id) => Number.isInteger(id) && id > 0))]
    : [];
  const formation = Object.hasOwn(FORMATIONS, raw.formation) ? raw.formation : "line";
  const anchor = {
    x: finite(raw.anchor?.x, 0),
    y: finite(raw.anchor?.y, 0),
  };
  const facing = clamp(finite(raw.facing, 0), -Math.PI, Math.PI);
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id.slice(0, 48) : "group",
    unitIds: ids.slice(0, 64),
    formation,
    anchor,
    facing,
    order: raw.order && ORDER_TYPES.includes(raw.order.type) ? raw.order : { type: "hold" },
  };
}

export function createOrder(type, target = null) {
  if (!ORDER_TYPES.includes(type)) return { ok: false, error: "unknown tactical order" };
  if (type === "move" || type === "retreat") {
    if (!Number.isFinite(target?.x) || !Number.isFinite(target?.y)) return { ok: false, error: "order needs a position" };
    return { ok: true, order: { type, target: { x: Number(target.x), y: Number(target.y) } } };
  }
  if (type === "attack" || type === "focus") {
    if (!Number.isInteger(target?.id) || target.id <= 0) return { ok: false, error: "order needs a target id" };
    return { ok: true, order: { type, target: { id: target.id } } };
  }
  return { ok: true, order: { type: "hold" } };
}

export function assignFormation(group, formation, anchor = group?.anchor, facing = group?.facing) {
  const g = normalizeGroup(group);
  return normalizeGroup({ ...g, formation, anchor, facing });
}

export function tacticalSnapshot(group, allUnits = []) {
  const g = normalizeGroup(group);
  const byId = new Map(allUnits.map((u) => [u.id, u]));
  const members = g.unitIds.map((id) => byId.get(id)).filter(Boolean);
  const slots = formationSlots(g.formation, members.length, g.anchor.x, g.anchor.y, g.facing);
  const cohesion = cohesionScore(members, slots);
  return {
    group: g,
    members: members.map((u) => u.id),
    slots,
    cohesion,
    modifiers: formationModifiers(g.formation, cohesion),
  };
}

export function pruneGroup(group, allUnits = []) {
  const living = new Set(allUnits.filter((u) => u && u.hp > 0).map((u) => u.id));
  const g = normalizeGroup(group);
  return { ...g, unitIds: g.unitIds.filter((id) => living.has(id)) };
}
