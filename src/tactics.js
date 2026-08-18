// Iron Holdfast premium tactical foundation.
// Pure deterministic helpers: no clocks, random calls, network or mutable globals.

export const FORMATIONS = {
  line: { id: "line", label: "Line", spacing: 1, cohesion: 1.0, defense: 1.0, missile: 1.0, charge: 1.0 },
  shieldwall: { id: "shieldwall", label: "Shield Wall", spacing: 1, cohesion: 1.25, defense: 1.3, missile: 0.75, charge: 0.65 },
  loose: { id: "loose", label: "Loose", spacing: 2, cohesion: 0.75, defense: 0.85, missile: 1.2, charge: 0.8 },
  wedge: { id: "wedge", label: "Wedge", spacing: 1, cohesion: 0.9, defense: 0.85, missile: 0.7, charge: 1.35 },
  reserve: { id: "reserve", label: "Reserve", spacing: 2, cohesion: 1.1, defense: 1.05, missile: 0.85, charge: 0.9 },
};

export const COMMANDER_PROFILES = {
  red_wolf: {
    id: "red_wolf",
    name: "The Red Wolf",
    aggression: 0.95,
    patience: 0.2,
    rangedBias: 0.15,
    weakPointBias: 0.35,
    heavyBias: 0.55,
    preferredFormation: "wedge",
  },
  blackthorn: {
    id: "blackthorn",
    name: "Blackthorn",
    aggression: 0.55,
    patience: 0.65,
    rangedBias: 0.9,
    weakPointBias: 0.55,
    heavyBias: 0.15,
    preferredFormation: "loose",
  },
  iron_viper: {
    id: "iron_viper",
    name: "Iron Viper",
    aggression: 0.6,
    patience: 0.8,
    rangedBias: 0.4,
    weakPointBias: 1.0,
    heavyBias: 0.25,
    preferredFormation: "line",
  },
  ashen_crown: {
    id: "ashen_crown",
    name: "Ashen Crown",
    aggression: 0.7,
    patience: 0.75,
    rangedBias: 0.3,
    weakPointBias: 0.6,
    heavyBias: 1.0,
    preferredFormation: "shieldwall",
  },
};

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function rotate(x, y, facing) {
  const c = Math.cos(facing);
  const s = Math.sin(facing);
  return { x: x * c - y * s, y: x * s + y * c };
}

/**
 * Generate stable slot positions around an anchor for a unit group.
 * Returned positions are presentation/simulation targets; collision/pathing still
 * belongs to the authoritative game simulation.
 */
export function formationSlots(formationId, count, anchorX, anchorY, facing = 0) {
  const f = FORMATIONS[formationId] || FORMATIONS.line;
  const n = clamp(Math.trunc(count || 0), 0, 64);
  const slots = [];
  if (!n) return slots;

  if (f.id === "wedge") {
    let placed = 0;
    for (let row = 0; placed < n; row++) {
      const width = row * 2 + 1;
      for (let col = 0; col < width && placed < n; col++) {
        const local = rotate((col - row) * f.spacing, row * f.spacing, facing);
        slots.push({ x: anchorX + local.x, y: anchorY + local.y, rank: row });
        placed++;
      }
    }
    return slots;
  }

  const columns = f.id === "shieldwall"
    ? Math.min(n, 10)
    : f.id === "reserve"
      ? Math.min(n, 5)
      : Math.max(1, Math.ceil(Math.sqrt(n * 1.8)));

  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / columns);
    const col = i % columns;
    const width = Math.min(columns, n - row * columns);
    const lateral = (col - (width - 1) / 2) * f.spacing;
    const depth = row * f.spacing;
    const local = rotate(lateral, depth, facing);
    slots.push({ x: anchorX + local.x, y: anchorY + local.y, rank: row });
  }
  return slots;
}

/** A bounded cohesion score from 0..1 based on distance from assigned slots. */
export function cohesionScore(units, slots) {
  if (!Array.isArray(units) || !units.length || !Array.isArray(slots) || !slots.length) return 0;
  const n = Math.min(units.length, slots.length);
  let error = 0;
  for (let i = 0; i < n; i++) {
    const dx = Number(units[i].x || 0) - slots[i].x;
    const dy = Number(units[i].y || 0) - slots[i].y;
    error += Math.sqrt(dx * dx + dy * dy);
  }
  const avg = error / n;
  return clamp(1 - avg / 5, 0, 1);
}

export function formationModifiers(formationId, cohesion = 1) {
  const f = FORMATIONS[formationId] || FORMATIONS.line;
  const c = clamp(Number(cohesion) || 0, 0, 1);
  // Formation bonuses degrade gracefully as a formation becomes disordered.
  const blend = (value) => 1 + (value - 1) * c;
  return {
    defense: blend(f.defense),
    missile: blend(f.missile),
    charge: blend(f.charge),
    morale: blend(f.cohesion),
  };
}

/**
 * Score a battlefield sector for a particular commander. Higher is a more
 * desirable attack sector. Inputs are intentionally generic so the game loop can
 * feed walls, gates, towers, defenders and terrain without making this module
 * own world state.
 */
export function scoreAttackSector(profileId, sector) {
  const p = COMMANDER_PROFILES[profileId] || COMMANDER_PROFILES.red_wolf;
  const wall = clamp(Number(sector.wallStrength ?? 0), 0, 1);
  const defenders = clamp(Number(sector.defenderStrength ?? 0), 0, 1);
  const rangedThreat = clamp(Number(sector.rangedThreat ?? 0), 0, 1);
  const vulnerability = clamp(Number(sector.vulnerability ?? 0), 0, 1);
  const distance = clamp(Number(sector.distance ?? 0), 0, 1);
  const breach = sector.breached ? 1 : 0;

  return (
    breach * (1.4 + p.aggression * 0.8) +
    vulnerability * (0.8 + p.weakPointBias * 1.6) -
    wall * (0.8 + p.patience * 0.35) -
    defenders * (0.65 - p.heavyBias * 0.25) -
    rangedThreat * (0.45 - p.rangedBias * 0.2) -
    distance * (0.2 + p.aggression * 0.25)
  );
}

export function chooseAttackSector(profileId, sectors) {
  if (!Array.isArray(sectors) || !sectors.length) return null;
  let best = null;
  for (let i = 0; i < sectors.length; i++) {
    const sector = sectors[i];
    const score = scoreAttackSector(profileId, sector);
    // Stable deterministic tie-break: lower array index wins.
    if (!best || score > best.score) best = { index: i, sector, score };
  }
  return best;
}

/** Choose a tactical posture from deterministic battlefield pressure. */
export function choosePosture(profileId, context = {}) {
  const p = COMMANDER_PROFILES[profileId] || COMMANDER_PROFILES.red_wolf;
  const ownMorale = clamp(Number(context.ownMorale ?? 1), 0, 1);
  const ownStrength = clamp(Number(context.ownStrength ?? 1), 0, 2);
  const enemyStrength = clamp(Number(context.enemyStrength ?? 1), 0, 2);
  const breach = Boolean(context.breachOpen);

  if (ownMorale < 0.25 || ownStrength < enemyStrength * 0.45) return "withdraw";
  if (breach && p.aggression > 0.55) return "assault";
  if (p.rangedBias > 0.7 && !breach) return "harass";
  if (p.patience > 0.7 && ownStrength < enemyStrength * 1.15) return "probe";
  if (ownStrength > enemyStrength * (1.1 - p.aggression * 0.2)) return "advance";
  return "hold";
}
