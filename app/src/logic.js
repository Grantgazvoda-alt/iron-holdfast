/**
 * IRON HOLDFAST — a real-time siege builder in the Stronghold 2 tradition.
 *
 * This module is THE GAME. It is pure and deterministic: no Date.now, no
 * Math.random, no imports, no timers. All time is a fixed 500ms tick driven by
 * `tick()`, all randomness comes from a seeded PRNG stored in state. The room
 * calls tick(state) every 500ms and the client renders viewFor(state).
 *
 * Contract (enforced by `bun run check:logic`): export meta, setup,
 * validateAction, applyAction, isGameOver, viewFor, plus `tick` for the
 * real-time loop. No other exports.
 */

export const meta = {
  game: "Iron Holdfast",
  minPlayers: 1,
  maxPlayers: 1,
};

// ── world ──────────────────────────────────────────────────────────────────

const W = 40;
const H = 26;

// terrain
const GRASS = "g";
const FOREST = "f";
const ROCK = "r";
const IRON = "i";
const GOLD = "a";
const WATER = "w";

const PASSABLE = { g: 1, f: 1, r: 1, i: 1, a: 1 };

const F_PLAYER = "p";
const F_ENEMY = "e";

// ── deterministic PRNG (mulberry32 stream) ────────────────────────────────

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rngFrom(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── map generation (seeded, deterministic) ────────────────────────────────

function xy(x, y) {
  return y * W + x;
}

function genMap(rng) {
  const map = new Array(W * H).fill(GRASS);
  const inside = (x, y) => x > 0 && y > 0 && x < W - 1 && y < H - 1;

  // border water
  for (let x = 0; x < W; x++) {
    map[xy(x, 0)] = WATER;
    map[xy(x, H - 1)] = WATER;
  }
  for (let y = 0; y < H; y++) {
    map[xy(0, y)] = WATER;
    map[xy(W - 1, y)] = WATER;
  }

  // a couple of lakes
  for (let n = 0; n < 3; n++) {
    const cx = 4 + Math.floor(rng() * (W - 8));
    const cy = 4 + Math.floor(rng() * (H - 8));
    const rr = 2 + Math.floor(rng() * 2);
    for (let y = cy - rr; y <= cy + rr; y++)
      for (let x = cx - rr; x <= cx + rr; x++) {
        if (inside(x, y) && rng() < 0.75) map[xy(x, y)] = WATER;
      }
  }

  // forests
  for (let n = 0; n < 18; n++) {
    const cx = 2 + Math.floor(rng() * (W - 4));
    const cy = 2 + Math.floor(rng() * (H - 4));
    const rr = 1 + Math.floor(rng() * 3);
    for (let y = cy - rr; y <= cy + rr; y++)
      for (let x = cx - rr; x <= cx + rr; x++) {
        if (inside(x, y) && map[xy(x, y)] === GRASS && rng() < 0.7) map[xy(x, y)] = FOREST;
      }
  }

  // rock outcrops
  for (let n = 0; n < 8; n++) {
    const cx = 4 + Math.floor(rng() * (W - 8));
    const cy = 4 + Math.floor(rng() * (H - 8));
    const rr = 1 + Math.floor(rng() * 2);
    for (let y = cy - rr; y <= cy + rr; y++)
      for (let x = cx - rr; x <= cx + rr; x++) {
        if (inside(x, y) && map[xy(x, y)] === GRASS && rng() < 0.5) map[xy(x, y)] = ROCK;
      }
  }

  // iron veins (4 tiles each)
  for (let n = 0; n < 3; n++) {
    const cx = 6 + Math.floor(rng() * (W - 12));
    const cy = 6 + Math.floor(rng() * (H - 12));
    for (let k = 0; k < 4; k++) {
      const x = cx + (rng() < 0.5 ? -1 : 1);
      const y = cy + (rng() < 0.5 ? -1 : 1);
      if (inside(x, y) && map[xy(x, y)] === GRASS) map[xy(x, y)] = IRON;
    }
  }

  // gold veins (3)
  for (let n = 0; n < 3; n++) {
    const cx = 6 + Math.floor(rng() * (W - 12));
    const cy = 6 + Math.floor(rng() * (H - 12));
    for (let k = 0; k < 3; k++) {
      const x = cx + (rng() < 0.5 ? -1 : 1);
      const y = cy + (rng() < 0.5 ? -1 : 1);
      if (inside(x, y) && map[xy(x, y)] === GRASS) map[xy(x, y)] = GOLD;
    }
  }

  // clear the keep plaza
  const kx = Math.floor(W / 2);
  const ky = Math.floor(H / 2);
  for (let y = ky - 4; y <= ky + 4; y++)
    for (let x = kx - 5; x <= kx + 5; x++) {
      if (inside(x, y)) map[xy(x, y)] = GRASS;
    }

  // enemy camp sits in a corner quadrant
  const campX = 3 + Math.floor(rng() * 3);
  const campY = 3 + Math.floor(rng() * 3);
  for (let y = campY - 1; y <= campY + 2; y++)
    for (let x = campX - 1; x <= campX + 3; x++) {
      if (inside(x, y)) map[xy(x, y)] = GRASS;
    }

  return { map, kx, ky, campX, campY };
}

// ── definitions ────────────────────────────────────────────────────────────

const BUILDINGS = {
  house: { cost: { wood: 12 }, name: "House", hp: 80, worker: 0, desc: "+4 population" },
  farm: { cost: { wood: 10 }, name: "Farm", hp: 60, worker: 1, desc: "+15 food / 90t" },
  woodcutter: { cost: { wood: 8 }, name: "Woodcutter", hp: 60, worker: 1, desc: "+4 wood / 12t" },
  quarry: { cost: { wood: 10, stone: 2 }, name: "Quarry", hp: 70, worker: 1, desc: "+4 stone / 18t" },
  ironmine: { cost: { wood: 14, stone: 4 }, name: "Iron Mine", hp: 70, worker: 1, desc: "+4 iron / 24t" },
  goldmine: { cost: { wood: 16, stone: 6 }, name: "Gold Mine", hp: 70, worker: 1, desc: "+4 gold / 30t" },
  barracks: { cost: { wood: 14, stone: 10 }, name: "Barracks", hp: 100, worker: 0, desc: "trains units" },
  wall: { cost: { wood: 4, stone: 2 }, name: "Wall", hp: 150, worker: 0, desc: "blocks enemies" },
  tower: { cost: { wood: 8, stone: 8 }, name: "Tower", hp: 130, worker: 0, desc: "shoots units" },
};

const PRODUCTION = {
  farm: { every: 90, food: 15 },
  woodcutter: { every: 12, wood: 4 },
  quarry: { every: 18, stone: 4 },
  ironmine: { every: 24, iron: 4 },
  goldmine: { every: 30, gold: 4 },
};

const UNITS = {
  spearman: { name: "Spearman", cost: { gold: 8, iron: 2 }, hp: 30, dmg: 0.55, atkCd: 10, range: 1, moveCd: 5, siege: 0.4, upk: 1 },
  archer: { name: "Archer", cost: { gold: 10, wood: 8 }, hp: 18, dmg: 0.5, atkCd: 14, range: 3, moveCd: 6, siege: 0.2, upk: 1 },
  knight: { name: "Knight", cost: { gold: 20, iron: 6 }, hp: 70, dmg: 1.2, atkCd: 12, range: 1, moveCd: 8, siege: 1.0, upk: 2 },
};

const ENEMY_UNITS = {
  raider: { name: "Raider", hp: 14, dmg: 0.5, atkCd: 10, range: 1, moveCd: 5 },
  skirmisher: { name: "Skirmisher", hp: 10, dmg: 0.35, atkCd: 16, range: 3, moveCd: 6 },
  brute: { name: "Brute", hp: 55, dmg: 1.4, atkCd: 12, range: 1, moveCd: 9 },
};

const DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

// ── setup ──────────────────────────────────────────────────────────────────

export function setup(players) {
  const seat = (players && players[0]) || "solo";
  const seed = hashStr(seat);
  const rng = rngFrom(seed ^ 0x51ab3d);
  const { map, kx, ky, campX, campY } = genMap(rng);

  const s = {
    v: 1,
    seat,
    time: 0,
    map,
    kx,
    ky,
    campX,
    campY,
    rng: seed ^ 0x51ab3d,
    keep: { hp: 400, max: 400 },
    camp: { hp: 600, max: 600, nextWave: 120, wave: 0 },
    res: { wood: 35, stone: 12, gold: 10, iron: 3, food: 20 },
    pop: 6,
    popCap: 6,
    houses: 0,
    nextPopIn: 40,
    buildings: [],
    units: [],
    nextId: 1,
    events: [],
    over: null,
    paused: false,
    stats: { kills: 0, lost: 0 },
  };
  pushEvent(s, "intro", "The keep of Iron Holdfast stands. Build an economy, raise walls, train a garrison — and destroy the enemy camp before its waves overwhelm you.");
  return s;
}

function pushEvent(s, kind, text) {
  s.eventId = (s.eventId || 0) + 1;
  s.events.push({ id: s.eventId, kind, text, t: s.time });
  if (s.events.length > 40) s.events.splice(0, s.events.length - 40);
}

// ── validation ─────────────────────────────────────────────────────────────

export function validateAction(state, playerId, action) {
  if (!action || typeof action !== "object") return { ok: false, error: "bad action" };
  switch (action.type) {
    case "build": {
      if (!BUILDINGS[action.b]) return { ok: false, error: "unknown building" };
      const x = action.x;
      const y = action.y;
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 1 || y < 1 || x >= W - 1 || y >= H - 1) {
        return { ok: false, error: "out of bounds" };
      }
      const tile = state.map[xy(x, y)];
      if (!PASSABLE[tile]) return { ok: false, error: "terrain blocks building here" };
      if (state.buildings.some((b) => b.hp > 0 && b.x === x && b.y === y)) {
        return { ok: false, error: "tile occupied" };
      }
      // the keep and the camp tiles must stay clear — enemies can only reach
      // the keep, and the camp is the only way to win
      if (x === state.kx && y === state.ky) return { ok: false, error: "occupied" };
      if (x === state.campX && y === state.campY) return { ok: false, error: "occupied" };
      if (action.b === "ironmine" && !adjacentTerrain(state, x, y, IRON)) {
        return { ok: false, error: "iron mine must touch an iron vein" };
      }
      if (action.b === "goldmine" && !adjacentTerrain(state, x, y, GOLD)) {
        return { ok: false, error: "gold mine must touch a gold vein" };
      }
      const cost = BUILDINGS[action.b].cost;
      for (const r of Object.keys(cost)) {
        if ((state.res[r] || 0) < cost[r]) return { ok: false, error: "not enough " + r };
      }
      return { ok: true };
    }
    case "train": {
      if (!UNITS[action.u]) return { ok: false, error: "unknown unit" };
      if (!state.buildings.some((b) => b.b === "barracks" && b.hp > 0)) {
        return { ok: false, error: "need a barracks first" };
      }
      const cost = UNITS[action.u].cost;
      for (const r of Object.keys(cost)) {
        if ((state.res[r] || 0) < cost[r]) return { ok: false, error: "not enough " + r };
      }
      return { ok: true };
    }
    case "move": {
      if (!Array.isArray(action.ids) || !action.ids.length) return { ok: false, error: "no units" };
      if (!Number.isInteger(action.x) || !Number.isInteger(action.y) || action.x < 0 || action.y < 0 || action.x >= W || action.y >= H) {
        return { ok: false, error: "out of bounds" };
      }
      for (const id of action.ids) {
        if (!state.units.some((u) => u.f === F_PLAYER && u.id === id)) {
          return { ok: false, error: "not your unit" };
        }
      }
      return { ok: true };
    }
    case "attack": {
      if (!Array.isArray(action.ids) || !action.ids.length) return { ok: false, error: "no units" };
      const target = Number.isInteger(action.target) ? action.target : null;
      if (target == null) return { ok: false, error: "no target" };
      const tgt = state.units.find((u) => u.id === target);
      if (!tgt || tgt.f !== F_ENEMY || tgt.hp <= 0) return { ok: false, error: "target is not an enemy" };
      for (const id of action.ids) {
        if (!state.units.some((u) => u.f === F_PLAYER && u.id === id)) {
          return { ok: false, error: "not your unit" };
        }
      }
      return { ok: true };
    }
    case "hold": {
      if (!Array.isArray(action.ids) || !action.ids.length) return { ok: false, error: "no units" };
      for (const id of action.ids) {
        if (!state.units.some((u) => u.f === F_PLAYER && u.id === id)) {
          return { ok: false, error: "not your unit" };
        }
      }
      return { ok: true };
    }
    case "repair": {
      const b = state.buildings.find((bb) => bb.id === action.id);
      if (!b) return { ok: false, error: "no such building" };
      if (b.hp >= b.max) return { ok: false, error: "already intact" };
      const cost = repairCost(b);
      for (const r of Object.keys(cost)) {
        if ((state.res[r] || 0) < cost[r]) return { ok: false, error: "not enough " + r };
      }
      return { ok: true };
    }
    case "pause": {
      if (typeof action.on !== "boolean") return { ok: false, error: "bad pause" };
      return { ok: true };
    }
    default:
      return { ok: false, error: "unknown action" };
  }
}

function repairCost(b) {
  const base = BUILDINGS[b.b].cost;
  const missing = 1 - b.hp / b.max;
  const cost = {};
  if (base.wood) cost.wood = Math.max(1, Math.ceil(base.wood * missing));
  if (base.stone) cost.stone = Math.max(1, Math.ceil(base.stone * missing));
  if (!base.wood && !base.stone) cost.wood = Math.max(1, Math.ceil(4 * missing));
  return cost;
}

function adjacentTerrain(s, x, y, t) {
  for (const [dx, dy] of DIRS) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    if (s.map[xy(nx, ny)] === t) return true;
  }
  return false;
}

// ── apply ──────────────────────────────────────────────────────────────────

export function applyAction(state, playerId, action) {
  switch (action.type) {
    case "build": {
      const def = BUILDINGS[action.b];
      const res = { ...state.res };
      for (const r of Object.keys(def.cost)) res[r] -= def.cost[r];
      const b = {
        id: state.nextId,
        b: action.b,
        x: action.x,
        y: action.y,
        hp: def.hp,
        max: def.hp,
        work: 0,
      };
      let popCap = state.popCap;
      if (action.b === "house") popCap += 4;
      const s = {
        ...state,
        res,
        nextId: state.nextId + 1,
        popCap,
        buildings: [...state.buildings, b],
      };
      pushEvent(s, "build", def.name + " finished.");
      if (action.b === "farm") pushEvent(s, "hint", "A worker was assigned: farms need peasants. More houses raise the cap.");
      return s;
    }
    case "train": {
      const def = UNITS[action.u];
      const res = { ...state.res };
      for (const r of Object.keys(def.cost)) res[r] -= def.cost[r];
      const u = {
        id: state.nextId,
        f: F_PLAYER,
        t: action.u,
        x: state.kx + 1,
        y: state.ky,
        tx: null,
        ty: null,
        tgt: null,
        hp: def.hp,
        max: def.hp,
        dmg: def.dmg,
        atkCd: 0,
        moveCd: 0,
        range: def.range,
        siege: def.siege,
        upk: def.upk || 0,
        upkAcc: 0,
      };
      const s = {
        ...state,
        res,
        nextId: state.nextId + 1,
        units: [...state.units, u],
      };
      pushEvent(s, "train", def.name + " joins the garrison.");
      return s;
    }
    case "move": {
      const units = state.units.map((u) => {
        if (u.f === F_PLAYER && action.ids.includes(u.id)) {
          // a march order overwrites any hunt target
          return { ...u, tx: action.x, ty: action.y, tgt: null };
        }
        return u;
      });
      return { ...state, units };
    }
    case "attack": {
      // hot-pursuit: the squad hunts this enemy until it dies or is held
      const units = state.units.map((u) => {
        if (u.f === F_PLAYER && action.ids.includes(u.id)) {
          return { ...u, tgt: action.target, tx: null, ty: null };
        }
        return u;
      });
      return { ...state, units };
    }
    case "hold": {
      // stand your ground: no march, no hunt
      const units = state.units.map((u) => {
        if (u.f === F_PLAYER && action.ids.includes(u.id)) {
          return { ...u, tgt: null, tx: null, ty: null };
        }
        return u;
      });
      return { ...state, units };
    }
    case "repair": {
      const b = state.buildings.find((bb) => bb.id === action.id);
      const cost = repairCost(b);
      const res = { ...state.res };
      for (const r of Object.keys(cost)) res[r] -= cost[r];
      const buildings = state.buildings.map((bb) =>
        bb.id === action.id ? { ...bb, hp: bb.max, work: bb.work || 0 } : bb,
      );
      const s = { ...state, res, buildings };
      pushEvent(s, "build", "Masons restore the " + BUILDINGS[b.b].name + ".");
      return s;
    }
    case "pause": {
      return { ...state, paused: action.on };
    }
    default:
      return state;
  }
}

// ── the real-time tick (fixed 500ms step) ─────────────────────────────────

export function tick(state) {
  if (state.over || state.paused) return state;

  let s = {
    ...state,
    time: state.time + 1,
    buildings: state.buildings.map((b) => ({ ...b })),
    units: state.units.map((u) => ({ ...u })),
  };

  s = stepEconomy(s);
  s = stepPop(s);
  s = stepUpkeep(s);
  s = stepUnits(s);
  s = stepTowers(s);
  s = stepWaves(s);

  // win/lose checks
  let over = false;
  let result = null;
  if (s.keep.hp <= 0) {
    over = true;
    result = "defeat";
    if (!state.over) pushEvent(s, "end", "The keep has fallen. The enemy camp lifts its banners over Ironhold.");
  } else if (s.camp.hp <= 0 && !s.camp.destroyed) {
    s.camp.destroyed = 1;
    over = true;
    result = "victory";
    if (!state.over) pushEvent(s, "end", "The enemy camp is rubble. Ironhold stands victorious!");
  }

  if (over) {
    s.over = true;
    s.result = result;
    s.keep = { ...s.keep };
    s.camp = { ...s.camp };
  }
  return s;
}

function stepEconomy(s) {
  let workLeft = s.pop;
  const res = { ...s.res };
  const buildings = s.buildings.map((b) => ({ ...b }));
  for (const b of buildings) {
    if (!PRODUCTION[b.b] || b.hp <= 0) continue;
    if (workLeft <= 0) continue; // no free worker
    workLeft -= 1;
    const p = PRODUCTION[b.b];
    b.work = (b.work || 0) + 1;
    if (b.work >= p.every) {
      b.work = 0;
      for (const k of ["wood", "stone", "iron", "gold", "food"]) {
        if (p[k]) res[k] = (res[k] || 0) + p[k];
      }
    }
  }
  // mouths to feed: each pop eats, farms must cover it
  const eatEvery = 60;
  s = { ...s, res, buildings };
  s.eatAcc = ((s.eatAcc || 0) + 1) % eatEvery;
  if (s.eatAcc === 0) {
    if (s.res.food >= s.pop) {
      s.res = { ...s.res, food: s.res.food - s.pop };
    } else {
      // starvation slows the workforce
      s.hungry = (s.hungry || 0) + 1;
    }
  }
  return s;
}

function stepPop(s) {
  let nextTickIn = (s.nextTickIn || 40) - 1;
  if (nextTickIn <= 0) {
    nextTickIn = 40;
    if (s.pop < s.popCap && s.res.food > s.pop * 0.2) {
      s.pop += 1;
    }
  }
  return { ...s, nextTickIn };
}

// soldiers eat gold: an unpaid garrison fights half-hearted
function stepUpkeep(s) {
  const paid = s.units.filter((u) => u.f === F_PLAYER && u.hp > 0);
  const due = paid.reduce((n, u) => n + (u.upk || 0), 0);
  if (due <= 0) return { ...s, unpaid: false };
  const acc = (s.upkeepAcc || 0) + 1;
  const PER = 900; // a pay day every 900 ticks (~7.5 min)
  if (acc >= PER) {
    const wasUnpaid = Boolean(s.unpaid);
    let gold = s.res.gold;
    const unpaid = gold < due;
    gold = Math.max(0, gold - due);
    const s2 = { ...s, res: { ...s.res, gold }, unpaid, upkeepAcc: 0 };
    if (unpaid && !wasUnpaid) {
      pushEvent(s2, "danger", "The treasury is empty — the garrison fights half-hearted!");
    } else if (!unpaid && wasUnpaid) {
      pushEvent(s2, "build", "The soldiers are paid once more.");
    }
    return s2;
  }
  return { ...s, upkeepAcc: acc };
}

// units: player moves + fights; enemies advance and attack
function stepUnits(s) {
  const units = s.units.map((u) => ({ ...u }));
  const enemies = units.filter((u) => u.f === F_ENEMY);
  const players = units.filter((u) => u.f === F_PLAYER);
  const buildingsALive = s.buildings.filter((b) => b.hp > 0);
  const buildingAt = new Map(buildingsALive.map((b) => [b.x + "," + b.y, b]));

  // players: move toward order, otherwise hold; attack any enemy in weapon range
  for (const u of players) {
    u.moveCd -= 1;
    u.atkCd -= 1;

    // hot-pursuit: hunt the assigned target across the field
    if (u.tgt != null) {
      const hunted = units.find((o) => o.id === u.tgt);
      if (!hunted || hunted.hp <= 0) {
        u.tgt = null; // quarry is gone
      } else {
        const d = manhattan(u.x, u.y, hunted.x, hunted.y);
        if (d <= u.range && u.atkCd <= 0) {
          hunted.hp -= u.dmg;
          u.atkCd = UNITS[u.t].atkCd;
          if (hunted.hp <= 0) s.kills = (s.kills || 0) + 1;
        } else if (d > u.range && u.moveCd <= 0) {
          const chased = stepToward(s, u, hunted.x, hunted.y, buildingAt);
          if (chased) u.moveCd = UNITS[u.t].moveCd;
        }
        continue;
      }
    }

    // fight enemies in range first — never walk through a melee
    const foe = nearestInRange(u, enemies);
    if (foe) {
      if (u.atkCd <= 0) {
        let dmg = u.dmg;
        if (s.unpaid) dmg *= 0.5; // morale penalty
        foe.hp -= dmg;
        u.atkCd = UNITS[u.t].atkCd;
        if (foe.hp <= 0) s.kills = (s.kills || 0) + 1;
      }
      continue;
    }

    // move toward order
    if (u.tx !== null && u.ty !== null && u.moveCd <= 0) {
      const d = manhattan(u.x, u.y, u.tx, u.ty);
      if (d === 0) {
        u.tx = null;
        u.ty = null;
      } else {
        const stepped = stepToward(s, u, u.tx, u.ty, buildingAt);
        if (stepped) u.moveCd = UNITS[u.t].moveCd;
        else {
          // fully blocked — order stands, unit waits
        }
      }
    }

    // assaulting the enemy camp? units ordered to its tile hammer it
    const campDist = Math.abs(u.x - s.campX) + Math.abs(u.y - s.campY);
    const orderedCamp =
      u.tx !== null &&
      u.ty !== null &&
      Math.abs(u.tx - s.campX) <= 1 &&
      Math.abs(u.ty - s.campY) <= 1;
    if (campDist <= 1 && orderedCamp && u.atkCd <= 0) {
      s.camp = { ...s.camp, hp: Math.max(0, s.camp.hp - u.siege) };
      u.atkCd = UNITS[u.t].atkCd;
    }
  }

// enemies: march on the keep; attack units in range and walls in the way
  for (const u of enemies) {
    u.moveCd -= 1;
    u.atkCd -= 1;

    // attack a player unit in range — never walk through a melee
    const near = nearestInRange(u, players);
    if (near) {
      if (u.atkCd <= 0) {
        near.hp -= u.dmg;
        u.atkCd = ENEMY_UNITS[u.t].atkCd;
        if (near.hp <= 0) s.lost = (s.lost || 0) + 1;
      }
      continue;
    }

    // at the keep?
    if (u.x === s.kx && u.y === s.ky && u.atkCd <= 0) {
      s.keep = { ...s.keep, hp: Math.max(0, s.keep.hp - u.dmg * 2) };
      u.atkCd = ENEMY_UNITS[u.t].atkCd;
      continue;
    }

    if (u.moveCd <= 0) {
      // blocked by a wall → destroy it
      const here = buildingAt.get(u.x + "," + u.y);
      if (here && here.b === "wall" || here && here.b === "tower") {
        here.hp -= u.dmg;
        u.atkCd = Math.min(u.atkCd, 6);
        continue;
      }
      const stepped = stepToward(s, u, s.kx, s.ky, buildingAt);
      if (stepped) u.moveCd = ENEMY_UNITS[u.t].moveCd;
      else {
        // adjacent wall: attack it
        const bwall = adjacentBuilding(s, u, buildingAt);
        if (bwall) {
          bwall.hp -= u.dmg;
          u.atkCd = ENEMY_UNITS[u.t].atkCd;
        }
      }
    }
  }

  // reap deaths
  const alive = units.filter((u) => u.hp > 0);
  if (alive.length !== units.length) {
    // a unit fell — nothing else to settle here
  }
  // destroyed buildings release their tile: a dead wall cannot block building
  const aliveBuildings = s.buildings.filter((b) => b.hp > 0);
  if (aliveBuildings.length !== s.buildings.length) {
    const lost = s.buildings.length - aliveBuildings.length;
    s.fallenBuildings = (s.fallenBuildings || 0) + lost;
  }
  return { ...s, units: alive, buildings: aliveBuildings };
}

function manhattan(x1, y1, x2, y2) {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

/** Nearest living target within the unit's weapon range. */
function nearestInRange(u, list) {
  let best = null;
  let bd = Infinity;
  for (const o of list) {
    if (o.hp <= 0) continue;
    const d = Math.abs(o.x - u.x) + Math.abs(o.y - u.y);
    if (d <= u.range && d < bd) {
      bd = d;
      best = o;
    }
  }
  return best;
}

function adjacentUnit(u, list) {
  return nearestInRange({ range: 1, x: u.x, y: u.y }, list);
}

function closest(list, u) {
  let best = null;
  let bd = Infinity;
  for (const o of list) {
    if (o.hp <= 0) continue;
    const d = Math.abs(o.x - u.x) + Math.abs(o.y - u.y);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return best;
}

function adjacentBuilding(s, u, buildingAt) {
  // prefer walls/towers, but ANY building blocks the march — bash it
  let wall = null;
  let any = null;
  for (const [dx, dy] of DIRS) {
    const b = buildingAt.get(u.x + dx + "," + (u.y + dy));
    if (!b) continue;
    if (b.b === "wall" || b.b === "tower") wall = b;
    if (!any) any = b;
  }
  return wall || any;
}

function stepToward(s, u, tx, ty, buildingAt) {
  const cx = u.x;
  const cy = u.y;
  const cd = Math.abs(cx - tx) + Math.abs(cy - ty);
  let best = null;
  let bd = cd;
  for (const [dx, dy] of DIRS) {
    const nx = cx + dx;
    const ny = cy + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    if (!PASSABLE[s.map[xy(nx, ny)]]) continue;
    if (buildingAt.has(nx + "," + ny)) continue;
    const d = Math.abs(nx - tx) + Math.abs(ny - ty);
    if (d < bd) {
      bd = d;
      best = [nx, ny];
    }
  }
  if (!best) return false;
  u.x = best[0];
  u.y = best[1];
  return true;
}

function stepTowers(s) {
  const towers = s.buildings.filter((b) => b.b === "tower" && b.hp > 0);
  if (!towers.length) return s;
  // work on the same copies the loop mutates, so kills stay consistent
  const units = s.units.map((u) => ({ ...u }));
  let enemies = units.filter((u) => u.f === F_ENEMY && u.hp > 0);
  if (!enemies.length) return s;
  let kills = 0;
  for (const tw of towers) {
    tw.cd = (tw.cd || 8) - 1;
    if (tw.cd > 0) continue;
    const target = closest(enemies, tw);
    if (target && Math.abs(target.x - tw.x) + Math.abs(target.y - tw.y) <= 6) {
      const u = units.find((u) => u.id === target.id);
      if (u && u.hp > 0) {
        u.hp -= 1.2;
        tw.cd = 10;
        if (u.hp <= 0) {
          kills += 1;
          enemies = enemies.filter((o) => o.id !== u.id);
        }
      }
    }
  }
  if (kills) {
    s.kills = (s.kills || 0) + kills;
    pushEvent(s, "kill", "A tower fells " + kills + (kills > 1 ? " enemies." : " enemy."));
  }
  return { ...s, units };
}

function stepWaves(s) {
  if (s.camp.hp <= 0) return s;

  // wave director — waveIn persists in state so waves actually fire
  const next = (s.waveIn ?? 120) - 1;
  const waveIn = Math.max(0, next);
  if (waveIn <= 0 && !s.pendingWave) {
    s.wave = (s.wave || 0) + 1;
    const size = Math.min(2 + s.wave * 2 + Math.floor(s.wave), 16);
    const brutes = s.wave >= 3 ? 1 + Math.floor((s.wave - 3) / 2) : 0;
    // queue the wave
    const queue = [];
    for (let i = 0; i < size; i++) queue.push(s.wave >= 2 && i % 4 === 3 ? "skirmisher" : "raider");
    for (let i = 0; i < brutes; i++) queue.push("brute");
    s.pendingWave = [...queue];
    pushEvent(s, "danger", "The enemy camp musters a new host — wave " + s.wave + "!");
  }
  // count down only when no wave is currently spawned
  if (!s.pendingWave) s.waveIn = waveIn;
  else s.waveIn = 110 + s.wave * 26;

  // feed 2 units per tick out of the pending wave
  if (s.pendingWave && s.pendingWave.length) {
    const n = Math.min(2, s.pendingWave.length);
    const spawned = s.pendingWave.slice(0, n);
    const units = s.units.map((u) => ({ ...u }));
    for (let k = 0; k < spawned.length; k++) {
      const t = spawned[k];
      const def = ENEMY_UNITS[t];
      units.push({
        id: s.nextId + k,
        f: F_ENEMY,
        t,
        x: s.campX,
        y: s.campY,
        tx: null,
        ty: null,
        hp: def.hp,
        max: def.hp,
        dmg: def.dmg,
        atkCd: 0,
        moveCd: 0,
        range: def.range,
      });
    }
    s.nextId = s.nextId + spawned.length;
    s.units = units;
    s.pendingWave = s.pendingWave.slice(n);
  }
  return s;
}

// ── game over ─────────────────────────────────────────────────────────────

export function isGameOver(state) {
  if (state.over) {
    return {
      over: true,
      winner: state.result === "victory" ? state.seat : null,
      result: state.result,
    };
  }
  return { over: false };
}

// ── view ───────────────────────────────────────────────────────────────────

export function viewFor(state, playerId) {
  return {
    time: state.time,
    map: state.map,
    W,
    H,
    kx: state.kx,
    ky: state.ky,
    campX: state.campX,
    campY: state.campY,
    keep: state.keep,
    camp: { hp: state.camp.hp, max: state.camp.max },
    res: state.res,
    pop: state.pop,
    popCap: state.popCap,
    buildings: state.buildings.map((b) => ({ id: b.id, b: b.b, x: b.x, y: b.y, hp: Math.round(b.hp), max: b.max })),
    units: state.units.map((u) => ({
      id: u.id,
      f: u.f,
      t: u.t,
      x: u.x,
      y: u.y,
      hp: Math.round(u.hp),
      max: u.max,
      tx: u.tx,
      ty: u.ty,
      tgt: u.tgt ?? null,
      range: u.range,
    })),
    wave: state.wave || 0,
    waveSpawnIn: state.pendingWave ? state.pendingWave.length : 0,
    nextWaveIn: state.waveIn ?? 120,
    unpaid: Boolean(state.unpaid),
    paused: Boolean(state.paused),
    events: state.events.slice(-10),
    over: state.over || false,
    result: state.result || null,
    kills: state.kills || 0,
    lost: state.lost || 0,
  };
}