/**
 * IRON HOLDFAST — client.
 *
 * The server is authoritative: this file only sends intents ({type:"action"})
 * and draws whatever `view` comes back. All art is painted procedurally on the
 * canvas in a painterly medieval style — no assets, no credits. Sound is
 * synthesized with WebAudio.
 */

// ── net (keep this) ────────────────────────────────────────────────────────

const room = new URLSearchParams(location.search).get("room") || "main";

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

function send(msg) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
}

function connect() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${proto}//${location.host}/ws/${encodeURIComponent(room)}`);
  socket.addEventListener("open", () => {
    retry = 0;
    send({ type: "join", playerId: playerId() });
  });
  socket.addEventListener("message", (event) => {
    if (event.data === PONG) return;
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    if (msg.type === "state") onState(msg);
    else if (msg.type === "error") onError(msg.error);
  });
  socket.addEventListener("close", () => {
    retry = Math.min(retry + 1, 6);
    const wait = 500 * 2 ** (retry - 1);
    setTimeout(connect, wait);
  });
}

setInterval(() => {
  if (socket?.readyState === WebSocket.OPEN) socket.send(PING);
}, 30_000);

// ── state ──────────────────────────────────────────────────────────────────

let v = null; // latest view
let prev = null; // previous view (for movement interpolation)
let lastStateMs = 0;
let lastShownEventId = 0;
let gameOverShown = false;
let camInited = false;

function onState(msg) {
  if (msg.view && msg.view !== v) {
    prev = v;
    v = msg.view;
    lastStateMs = performance.now();
    if (!camInited) {
      camX = v.kx;
      camY = v.ky;
      camInited = true;
    }
    updateHud();
    showEvents(v);
    drawMinimap();
  }
  if (msg.status === "over" && msg.result && !onOverShown) {
    showOverlay(
      msg.result.result === "victory" ? "VICTORY!" : "THE KEEP FALLS",
      msg.result.result === "victory"
        ? "The enemy camp is rubble. Your garrison stands tall over Ironhold."
        : "The enemy banners fly over your keep. Wall tighter, train earlier, march sooner — and hold again.",
    );
    onOverShown = true;
  }
}

let onOverShown = false;

function onError(err) {
  toast(err || "server error", "danger");
  if (err === "join first") send({ type: "join", playerId: playerId() });
}

function toast(text, kind) {
  const ev = document.createElement("div");
  ev.className = "evt " + kind;
  ev.textContent = text;
  document.getElementById("events").append(ev);
  setTimeout(() => ev.remove(), 7000);
  sfx(kind);
}

function showEvents(view) {
  for (const e of view.events || []) {
    if (e.id > lastShownEventId) {
      lastShownEventId = e.id;
      toast(e.text, e.kind || "info");
    }
  }
}

// ── HUD ────────────────────────────────────────────────────────────────────

function $(id) {
  return document.getElementById(id);
}

const COSTS = {
  house: { wood: 12 },
  farm: { wood: 10 },
  woodcutter: { wood: 8 },
  quarry: { wood: 10, stone: 2 },
  ironmine: { wood: 14, stone: 4 },
  goldmine: { wood: 16, stone: 6 },
  barracks: { wood: 14, stone: 10 },
  wall: { wood: 4, stone: 2 },
  tower: { wood: 8, stone: 8 },
};

const UNIT_COSTS = {
  spearman: { gold: 8, iron: 2 },
  archer: { gold: 10, wood: 8 },
  knight: { gold: 20, iron: 6 },
};

function updateHud() {
  if (!v) return;
  $("resWood").textContent = Math.floor(v.res.wood);
  $("resStone").textContent = Math.floor(v.res.stone);
  $("resIron").textContent = Math.floor(v.res.iron);
  $("resGold").textContent = Math.floor(v.res.gold);
  $("resFood").textContent = Math.floor(v.res.food);
  $("resPop").textContent = `${v.pop}/${v.popCap}`;
  $("keepBar").style.width = `${Math.max(0, (v.keep.hp / v.keep.max) * 100)}%`;
  $("campBar").style.width = `${Math.max(0, (v.camp.hp / v.camp.max) * 100)}%`;
  $("resWave").textContent = v.wave || 0;
  $("resNext").textContent = v.waveSpawnIn
    ? `${v.waveSpawnIn} spawning`
    : `${Math.max(0, Math.round(v.nextWaveIn * 0.5))}s`;
  const t = Math.floor(v.time * 0.5);
  $("clock").textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
  $("btnPause").textContent = v.paused ? "▶ Resume" : "⏸ Pause";
  $("btnMute").textContent = muted ? "🔇" : "🔊";

  for (const el of document.querySelectorAll(".tool[data-b]")) {
    const b = el.dataset.b;
    const cost = COSTS[b];
    const ok = Object.entries(cost).every(([r, n]) => v.res[r] >= n);
    el.classList.toggle("broke", !ok);
  }
  for (const [id, u] of [["t-spearman", "spearman"], ["t-archer", "archer"], ["t-knight", "knight"]]) {
    const cost = UNIT_COSTS[u];
    const hasBarracks = v.buildings.some((b) => b.b === "barracks" && b.hp > 0);
    const ok = hasBarracks && Object.entries(cost).every(([r, n]) => v.res[r] >= n);
    $(id).classList.toggle("broke", !ok);
  }
  $("unpaidTag").style.display = v.unpaid ? "block" : "none";
}

// ── canvas ─────────────────────────────────────────────────────────────────

const canvas = $("canvas");
const ctx = canvas.getContext("2d");
const TILE = 48;
let camX = 0;
let camY = 0;
let zoom = 1;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();

function sx(x) {
  return (x - camX) * TILE * zoom + canvas.clientWidth / 2;
}
function sy(y) {
  return (y - camY) * TILE * zoom + canvas.clientHeight / 2;
}
function tileAt(mx, my) {
  const tx = Math.floor((mx - canvas.clientWidth / 2) / (TILE * zoom) + camX);
  const ty = Math.floor((my - canvas.clientHeight / 2) / (TILE * zoom) + camY);
  return [tx, ty];
}

// deterministic hash for tile jitter
function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h || 1);
}
function rnd(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// pre-rendered terrain tiles
const tileCache = {};
function terrainTile(c) {
  if (tileCache[c]) return tileCache[c];
  const t = document.createElement("canvas");
  t.width = t.height = 64;
  const g = t.getContext("2d");
  paintTerrain(g, c);
  tileCache[c] = t;
  return t;
}

function paintTerrain(g, c) {
  const r = rnd(hashCode(c));
  if (c === "g") {
    g.fillStyle = "#6f9e4f";
    g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 42; i++) {
      g.fillStyle = r() < 0.5 ? "rgba(92,128,60,.5)" : "rgba(122,152,76,.5)";
      g.fillRect(r() * 64, r() * 64, 3 + r() * 3, 3 + r() * 3);
    }
    for (let i = 0; i < 6; i++) {
      g.fillStyle = "rgba(150,110,60,.4)";
      g.beginPath();
      g.arc(r() * 64, r() * 64, 2 + r() * 3, 0, 7);
      g.fill();
    }
  } else if (c === "f") {
    g.fillStyle = "#5b8a3e";
    g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 4; i++) {
      const x = 8 + r() * 48;
      const y = 8 + r() * 48;
      g.fillStyle = "#2c5a22";
      g.beginPath();
      g.arc(x, y, 12 + r() * 6, 0, 7);
      g.fill();
      g.fillStyle = "#3f7a2e";
      g.beginPath();
      g.arc(x - 3, y - 3, 8 + r() * 4, 0, 7);
      g.fill();
    }
  } else if (c === "r") {
    g.fillStyle = "#9a928a";
    g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 3; i++) {
      g.fillStyle = "#7a7268";
      g.beginPath();
      g.arc(14 + r() * 36, 14 + r() * 36, 9 + r() * 5, 0, 7);
      g.fill();
    }
    for (let i = 0; i < 7; i++) {
      g.fillStyle = "rgba(255,255,255,.15)";
      g.fillRect(r() * 64, 8 + r() * 14, 8 + r() * 10, 2);
    }
    g.fillStyle = "rgba(70,60,50,.35)";
    g.fillRect(6, 52, 18, 8);
    g.fillRect(40, 14, 20, 6);
  } else if (c === "i") {
    paintTerrain(g, "g");
    g.fillStyle = "#373a42";
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.ellipse(10 + r() * 44, 10 + r() * 44, 7 + r() * 3, 5 + r() * 2, r() * 3, 0, 7);
      g.fill();
    }
    g.fillStyle = "rgba(190,200,215,.65)";
    for (let i = 0; i < 5; i++) g.fillRect(r() * 64, r() * 64, 3, 1.5);
  } else if (c === "a") {
    g.fillStyle = "#6f9e4f";
    g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 20; i++) {
      g.fillStyle = "rgba(122,150,76,.5)";
      g.fillRect(r() * 64, r() * 64, 3, 3);
    }
    g.fillStyle = "#d9a441";
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.arc(10 + r() * 44, 10 + r() * 44, 3.5, 0, 7);
      g.fill();
    }
    g.fillStyle = "rgba(255,235,180,.85)";
    for (let i = 0; i < 6; i++) g.fillRect(8 + r() * 50, 8 + r() * 50, 2, 2);
  } else if (c === "w") {
    g.fillStyle = "#3a6f8a";
    g.fillRect(0, 0, 64, 64);
    g.strokeStyle = "rgba(220,240,250,.5)";
    g.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      const y = 14 + i * 18;
      g.moveTo(4, y);
      g.bezierCurveTo(16, y - 4, 26, y + 4, 36, y);
      g.bezierCurveTo(46, y - 4, 56, y + 4, 62, y);
      g.stroke();
    }
  } else {
    g.fillStyle = "#6f9e4f";
    g.fillRect(0, 0, 64, 64);
  }
}

// building art (painterly, procedural)
const CAP = "#7c4a34"; // roof
const WOD = "#6b4a2e"; // wood
const DAK = "#45301f"; // dark wood
const STN = "#8f8578"; // stone
const STND = "#6d665c";
const STK = STND;
const AZU = "#2f6fd0";
const BLD = "#a3342f";

function drawBuilding(g, b, s) {
  const cx = s / 2;
  switch (b) {
    case "house": {
      g.fillStyle = WOD;
      g.fillRect(s * 0.18, s * 0.38, s * 0.64, s * 0.52);
      g.fillStyle = CAP;
      g.beginPath();
      g.moveTo(s * 0.08, s * 0.42);
      g.lineTo(cx, s * 0.1);
      g.lineTo(s * 0.92, s * 0.42);
      g.closePath();
      g.fill();
      g.fillStyle = DAK;
      g.fillRect(s * 0.44, s * 0.62, s * 0.14, s * 0.28);
      g.fillStyle = "rgba(255,220,140,.75)";
      g.fillRect(s * 0.2, s * 0.46, s * 0.12, s * 0.12);
      break;
    }
    case "farm": {
      g.fillStyle = "#b8943e";
      g.fillRect(s * 0.3, s * 0.66, s * 0.42, s * 0.24);
      g.strokeStyle = "#8a6d2c";
      g.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.moveTo(s * (0.32 + i * 0.075), s * 0.9);
        g.lineTo(s * (0.32 + i * 0.075), s * 0.66);
        g.stroke();
      }
      g.fillStyle = CAP;
      g.beginPath();
      g.moveTo(s * 0.12, s * 0.5);
      g.lineTo(cx, s * 0.2);
      g.lineTo(s * 0.58, s * 0.5);
      g.closePath();
      g.fill();
      g.fillStyle = WOD;
      g.fillRect(s * 0.12, s * 0.44, s * 0.46, s * 0.24);
      break;
    }
    case "woodcutter": {
      g.fillStyle = WOD;
      g.fillRect(s * 0.2, s * 0.42, s * 0.6, s * 0.46);
      g.fillStyle = CAP;
      g.beginPath();
      g.moveTo(s * 0.08, s * 0.46);
      g.lineTo(cx, s * 0.14);
      g.lineTo(s * 0.92, s * 0.46);
      g.closePath();
      g.fill();
      g.strokeStyle = DAK;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(s * 0.66, s * 0.7);
      g.lineTo(s * 0.88, s * 0.88);
      g.stroke();
      g.beginPath();
      g.moveTo(s * 0.72, s * 0.72);
      g.lineTo(s * 0.9, s * 0.62);
      g.stroke();
      break;
    }
    case "quarry": {
      g.fillStyle = STN;
      g.fillRect(s * 0.18, s * 0.5, s * 0.64, s * 0.34);
      g.strokeStyle = STND;
      g.lineWidth = 2;
      g.strokeRect(s * 0.18, s * 0.5, s * 0.64, s * 0.34);
      g.fillStyle = "#a69782";
      g.fillRect(s * 0.3, s * 0.28, s * 0.4, s * 0.16);
      g.strokeRect(s * 0.3, s * 0.28, s * 0.4, s * 0.16);
      g.fillStyle = "#c9b98f";
      g.fillRect(s * 0.34, s * 0.32, s * 0.14, s * 0.08);
      break;
    }
    case "ironmine": {
      g.fillStyle = "#4a4038";
      g.beginPath();
      g.moveTo(s * 0.22, s * 0.86);
      g.lineTo(s * 0.34, s * 0.4);
      g.lineTo(s * 0.66, s * 0.4);
      g.lineTo(s * 0.78, s * 0.86);
      g.closePath();
      g.fill();
      g.fillStyle = "#1a1512";
      g.fillRect(s * 0.36, s * 0.56, s * 0.28, s * 0.3);
      g.strokeStyle = "#b09a7a";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(s * 0.28, s * 0.42);
      g.lineTo(s * 0.72, s * 0.42);
      g.lineTo(s * 0.64, s * 0.24);
      g.lineTo(s * 0.36, s * 0.24);
      g.closePath();
      g.stroke();
      break;
    }
    case "goldmine": {
      drawBuilding(g, "ironmine", s);
      g.fillStyle = "#ffd75e";
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.arc(s * (0.38 + i * 0.08), s * (0.6 + (i % 2) * 0.12), 2.5, 0, 7);
        g.fill();
      }
      break;
    }
    case "barracks": {
      g.fillStyle = STN;
      g.fillRect(s * 0.1, s * 0.44, s * 0.8, s * 0.38);
      g.fillStyle = CAP;
      g.beginPath();
      g.moveTo(s * 0.04, s * 0.46);
      g.lineTo(cx, s * 0.1);
      g.lineTo(s * 0.96, s * 0.46);
      g.closePath();
      g.fill();
      g.fillStyle = DAK;
      g.fillRect(s * 0.2, s * 0.6, s * 0.16, s * 0.22);
      g.fillRect(s * 0.64, s * 0.6, s * 0.16, s * 0.22);
      g.fillStyle = AZU;
      g.beginPath();
      g.moveTo(cx - 5, s * 0.32);
      g.lineTo(cx + 5, s * 0.32);
      g.lineTo(cx, s * 0.16);
      g.closePath();
      g.fill();
      break;
    }
    case "wall": {
      g.fillStyle = STN;
      g.fillRect(s * 0.08, s * 0.52, s * 0.84, s * 0.24);
      g.strokeStyle = STK;
      g.lineWidth = 1.5;
      g.strokeRect(s * 0.08, s * 0.52, s * 0.84, s * 0.24);
      for (let i = 0; i < 5; i++) {
        g.fillStyle = "#a19a8e";
        g.fillRect(s * (0.1 + i * 0.16), s * 0.42, s * 0.15, s * 0.1);
        g.strokeRect(s * (0.1 + i * 0.16), s * 0.42, s * 0.15, s * 0.1);
      }
      g.fillStyle = "rgba(90,80,60,.3)";
      for (let i = 0; i < 4; i++) g.fillRect(s * (0.12 + i * 0.2), s * 0.56, s * 0.12, s * 0.06);
      break;
    }
    case "tower": {
      g.fillStyle = STN;
      g.beginPath();
      g.arc(cx, s * 0.52, s * 0.3, 0, 7);
      g.fill();
      g.strokeStyle = STK;
      g.lineWidth = 2;
      g.stroke();
      g.fillStyle = "#b8a98a";
      g.fillRect(cx - s * 0.2, s * 0.26, s * 0.4, s * 0.14);
      g.strokeStyle = "#8a7a5e";
      g.lineWidth = 1.5;
      for (let i = -1; i <= 1; i++) {
        g.beginPath();
        g.moveTo(cx + i * s * 0.13, s * 0.4);
        g.lineTo(cx + i * s * 0.13, s * 0.56);
        g.lineTo(cx + i * s * 0.13 + 4, s * 0.56);
        g.lineTo(cx + i * s * 0.13 + 4, s * 0.4);
        g.stroke();
      }
      g.fillStyle = "rgba(255,215,94,.9)";
      g.fillRect(cx - 1.5, s * 0.3, 3, 4);
      break;
    }
  }
}

function drawKeep(g, s) {
  const cx = s / 2;
  g.fillStyle = STK;
  g.fillRect(s * 0.08, s * 0.5, s * 0.84, s * 0.34);
  g.fillStyle = STN;
  g.fillRect(s * 0.12, s * 0.54, s * 0.76, s * 0.26);
  g.fillStyle = "#a19a8c";
  g.fillRect(s * 0.3, s * 0.26, s * 0.4, s * 0.34);
  g.fillStyle = STK;
  g.fillRect(s * 0.3, s * 0.26, s * 0.4, s * 0.34);
  g.fillStyle = WOD;
  g.fillRect(s * 0.38, s * 0.44, s * 0.24, s * 0.36);
  g.fillStyle = AZU;
  g.beginPath();
  g.moveTo(cx, s * 0.06);
  g.lineTo(cx + 7, s * 0.26);
  g.lineTo(cx - 7, s * 0.26);
  g.closePath();
  g.fill();
  g.strokeStyle = "rgba(0,0,0,.35)";
  g.strokeRect(s * 0.3, s * 0.26, s * 0.4, s * 0.34);
}

function drawCamp(g, s) {
  const cx = s / 2;
  g.fillStyle = "#6b2c22";
  g.beginPath();
  g.moveTo(cx, s * 0.22);
  g.lineTo(cx + s * 0.3, s * 0.62);
  g.lineTo(cx - s * 0.3, s * 0.62);
  g.closePath();
  g.fill();
  g.fillStyle = "#4a1d16";
  g.beginPath();
  g.moveTo(cx, s * 0.32);
  g.lineTo(cx + s * 0.18, s * 0.6);
  g.lineTo(cx - s * 0.18, s * 0.6);
  g.closePath();
  g.fill();
  g.fillStyle = "#4a3524";
  g.fillRect(s * 0.22, s * 0.64, s * 0.56, s * 0.12);
  g.fillStyle = "#c84b42";
  g.beginPath();
  g.moveTo(cx, s * 0.28);
  g.lineTo(cx + 5, s * 0.16);
  g.lineTo(cx - 5, s * 0.16);
  g.closePath();
  g.fill();
}

function drawUnit(g, u, sel) {
  const cx = 16;
  const cy = 18;
  const col = u.f === "p" ? AZU : BLD;
  const dk = u.f === "p" ? "#1f4a8e" : "#6a1d1d";
  g.beginPath();
  g.arc(cx, cy, 8, 0, 7);
  g.fillStyle = col;
  g.fill();
  g.strokeStyle = dk;
  g.lineWidth = 2;
  g.stroke();
  g.fillStyle = "#d8d2c6";
  g.beginPath();
  g.arc(cx, cy - 6, 5, 0, 7);
  g.fill();
  g.strokeStyle = "#9a9486";
  g.stroke();
  g.strokeStyle = "#3a3a3a";
  g.lineWidth = 2.5;
  const ranged = u.range > 1;
  if (ranged) {
    // bow
    g.beginPath();
    g.arc(cx + 10, cy - 4, 7, -Math.PI / 2, Math.PI / 2);
    g.stroke();
    g.beginPath();
    g.moveTo(cx + 10, cy - 11);
    g.lineTo(cx + 10, cy + 3);
    g.stroke();
  } else if (u.t === "spearman" || u.t === "raider") {
    g.beginPath();
    g.moveTo(cx + 6, cy + 1);
    g.lineTo(cx + 12, cy - 12);
    g.stroke();
  } else {
    g.beginPath();
    g.moveTo(cx - 5, cy + 6);
    g.lineTo(cx + 9, cy - 8);
    g.stroke();
  }
  if (sel) {
    g.strokeStyle = "#ffd75e";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy - 1, 10, 0, 7);
    g.stroke();
  }
}

function bar(x, y, w, h, pct) {
  ctx.fillStyle = "rgba(0,0,0,.55)";
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = "#7a231e";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = pct > 0.5 ? "#3fad3f" : pct > 0.25 ? "#d9a441" : "#c0392b";
  ctx.fillRect(x, y, w * Math.max(0, pct), h);
}

// ── minimap ────────────────────────────────────────────────────────────────

const mm = $("mmCanvas");
const mmCtx = mm.getContext("2d");
const MM_W = 150;
const MM_H = 100;
let mmTerrain = null; // cached terrain layer, rebuilt when the map changes

function drawMinimap() {
  if (!v || !mm) return;
  mm.width = MM_W;
  mm.height = MM_H;
  const sclX = MM_W / v.W;
  const sclY = MM_H / v.H;
  const key = v.map;
  if (mmTerrain !== key) {
    // terrain base, painted once per map
    for (let y = 0; y < v.H; y++) {
      for (let x = 0; x < v.W; x++) {
        const c = v.map[y * v.W + x];
        mmCtx.fillStyle = c === "w" ? "#3a6f8a" : c === "f" ? "#2e5b28" : c === "r" ? "#8a8278" : c === "i" ? "#4a4550" : c === "a" ? "#c9a23e" : "#6f9e4f";
        mmCtx.fillRect(x * sclX, y * sclY, Math.ceil(sclX), Math.ceil(sclY));
      }
    }
    mmTerrain = key;
  }
  // buildings (walls/towers matter)
  for (const b of v.buildings) {
    mmCtx.fillStyle = b.b === "wall" ? "#c9c2b0" : b.b === "tower" ? "#d9d2c0" : "#6b5a3e";
    mmCtx.fillRect(b.x * sclX, b.y * sclY, Math.max(2, sclX), Math.max(2, sclY));
  }
  // units
  for (const u of v.units) {
    mmCtx.fillStyle = u.f === "p" ? "#2f6fd0" : "#c84b42";
    mmCtx.fillRect(u.x * sclX, u.y * sclY, Math.max(2, sclX), Math.max(2, sclY));
  }
  // keep + camp markers
  mmCtx.fillStyle = "#ffd75e";
  mmCtx.beginPath();
  mmCtx.arc(v.kx * sclX + sclX / 2, v.ky * sclY + sclY / 2, 3, 0, 7);
  mmCtx.fill();
  mmCtx.fillStyle = "#ff5a4a";
  mmCtx.beginPath();
  mmCtx.arc(v.campX * sclX + sclX / 2, v.campY * sclY + sclY / 2, 3, 0, 7);
  mmCtx.fill();
}

if (mm) {
  mm.addEventListener("click", (e) => {
    if (!v) return;
    const r = mm.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    camX = fx * v.W;
    camY = fy * v.H;
  });
}

// ── render loop ────────────────────────────────────────────────────────────

let selected = new Set();
let mode = "idle"; // "idle" | "build:<b>"
let mouse = { x: 0, y: 0 };
let panning = false;
let panLast = null;

const DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function draw() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#dccaa0";
  ctx.fillRect(0, 0, w, h);

  if (!v) return;
  const tSize = TILE * zoom;
  const k = prev ? Math.max(0, Math.min(1, (performance.now() - lastStateMs) / 500)) : 1;

  // tiles
  const x0 = Math.max(0, Math.floor(camX - w / 2 / tSize));
  const y0 = Math.max(0, Math.floor(camY - h / 2 / tSize));
  const x1 = Math.min(v.W - 1, Math.ceil(camX + w / 2 / tSize));
  const y1 = Math.min(v.H - 1, Math.ceil(camY + h / 2 / tSize));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      ctx.drawImage(terrainTile(v.map[y * v.W + x]), sx(x), sy(y), tSize + 1, tSize + 1);
    }
  }

  // buildings
  for (const b of v.buildings) {
    const px = sx(b.x) + tSize / 2;
    const py = sy(b.y) + tSize / 2;
    ctx.save();
    ctx.translate(px, py);
    ctx.scale((tSize * 0.92) / 32, (tSize * 0.92) / 32);
    ctx.translate(-16, -16);
    drawBuilding(ctx, b.b, 32);
    ctx.restore();
    if (b.hp < b.max) bar(px - tSize / 4, py - tSize / 2, tSize / 2, 4, b.hp / b.max);
  }

  // keep
  const kpx = sx(v.kx) + tSize / 2;
  const kpy = sy(v.ky) + tSize / 2;
  ctx.save();
  ctx.translate(kpx, kpy);
  ctx.scale((tSize * 1.9) / 32, (tSize * 1.9) / 32);
  ctx.translate(-16, -16);
  drawKeep(ctx, 32);
  ctx.restore();
  bar(kpx - tSize / 2, kpy - tSize * 0.85, tSize, 5, v.keep.hp / v.keep.max);

  // enemy camp
  const cx = sx(v.campX) + tSize / 2;
  const cy = sy(v.campY) + tSize / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale((tSize * 1.5) / 32, (tSize * 1.5) / 32);
  ctx.translate(-16, -16);
  drawCamp(ctx, 32);
  ctx.restore();
  bar(cx - tSize / 2 - 4, cy - tSize * 0.8, tSize + 8, 5, v.camp.hp / v.camp.max);

  // units (interpolated)
  const prevById = new Map((prev?.units || []).map((u) => [u.id, u]));
  for (const u of v.units) {
    const pu = prevById.get(u.id);
    const ux = pu && k < 1 ? lerp(pu.x, u.x, k) : u.x;
    const uy = pu && k < 1 ? lerp(pu.y, u.y, k) : u.y;
    const px = sx(ux) + tSize / 2;
    const py = sy(uy) + tSize / 2;
    ctx.save();
    ctx.translate(px, py);
    ctx.scale((tSize * 0.75) / 32, (tSize * 0.75) / 32);
    ctx.translate(-16, -16);
    drawUnit(ctx, u, selected.has(u.id));
    ctx.restore();
    if (u.hp < u.max) bar(px - tSize * 0.28, py - tSize * 0.48, tSize * 0.56, 3.5, u.hp / u.max);
  }

  // move order flags for selected units
  ctx.strokeStyle = "rgba(255,215,94,.8)";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  for (const u of v.units) {
    if (u.f === "p" && selected.has(u.id) && u.tx !== null && u.ty !== null) {
      ctx.beginPath();
      ctx.moveTo(sx(u.x) + tSize / 2, sy(u.y) + tSize / 2);
      ctx.lineTo(sx(u.tx) + tSize / 2, sy(u.ty) + tSize / 2);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);

  // build ghost
  if (mode.startsWith("build:")) {
    const b = mode.slice(6);
    const [tx, ty] = tileAt(mouse.x, mouse.y);
    if (tx >= 0 && ty >= 0 && tx < v.W && ty < v.H) {
      const gx = sx(tx);
      const gy = sy(ty);
      ctx.fillStyle = validBuild(tx, ty, b) ? "rgba(110,200,110,.3)" : "rgba(220,80,70,.35)";
      ctx.fillRect(gx, gy, tSize, tSize);
      ctx.save();
      ctx.translate(gx + tSize / 2, gy + tSize / 2);
      ctx.scale((tSize * 0.92) / 32, (tSize * 0.92) / 32);
      ctx.translate(-16, -16);
      ctx.globalAlpha = 0.75;
      drawBuilding(ctx, b, 32);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  // box selection overlay
  if (dragMoved && dragStart && dragCur) {
    ctx.strokeStyle = "rgba(47,111,208,.9)";
    ctx.lineWidth = 1.5;
    ctx.fillStyle = "rgba(47,111,208,.12)";
    ctx.fillRect(dragStart.x, dragStart.y, dragCur.x - dragStart.x, dragCur.y - dragStart.y);
    ctx.strokeRect(dragStart.x, dragStart.y, dragCur.x - dragStart.x, dragCur.y - dragStart.y);
  }
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function validBuild(x, y, b) {
  if (!v) return false;
  if (x < 0 || y < 0 || x >= v.W || y >= v.H) return false;
  if (v.map[y * v.W + x] === "w") return false;
  if (v.buildings.some((bb) => bb.x === x && bb.y === y)) return false;
  if (b === "ironmine" && !adjacentTo("i", x, y)) return false;
  if (b === "goldmine" && !adjacentTo("a", x, y)) return false;
  return true;
}
function adjacentTo(c, x, y) {
  for (const [dx, dy] of DIRS) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= v.W || ny >= v.H) continue;
    if (v.map[ny * v.W + nx] === c) return true;
  }
  return false;
}

// ── input ──────────────────────────────────────────────────────────────────

// left-drag = box select, right/middle-drag = pan, wheel = zoom
let dragStart = null; // {x,y} in client px, for box selection
let dragCur = null;
let dragMoved = false;

canvas.addEventListener("mousedown", (e) => {
  mouse.x = e.offsetX;
  mouse.y = e.offsetY;
  if (e.button === 0) {
    dragStart = { x: e.offsetX, y: e.offsetY };
    dragCur = { x: e.offsetX, y: e.offsetY };
    dragMoved = false;
  } else {
    panning = true;
    panLast = [e.clientX, e.clientY];
  }
  e.preventDefault();
});

canvas.addEventListener("mousemove", (e) => {
  mouse.x = e.offsetX;
  mouse.y = e.offsetY;
  if (panning && panLast) {
    camX -= (e.clientX - panLast[0]) / (TILE * zoom);
    camY -= (e.clientY - panLast[1]) / (TILE * zoom);
    panLast = [e.clientX, e.clientY];
  }
  if (dragStart && !panning) {
    const dx = e.offsetX - dragStart.x;
    const dy = e.offsetY - dragStart.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) dragMoved = true;
    if (dragMoved) dragCur = { x: e.offsetX, y: e.offsetY };
  }
});

window.addEventListener("mouseup", (e) => {
  if (panning) {
    panning = false;
    panLast = null;
  }
  if (dragStart) {
    if (dragMoved && dragCur) {
      // box select players inside the rect
      const x0 = Math.min(dragStart.x, dragCur.x);
      const y0 = Math.min(dragStart.y, dragCur.y);
      const x1 = Math.max(dragStart.x, dragCur.x);
      const y1 = Math.max(dragStart.y, dragCur.y);
      const next = new Set();
      for (const u of v?.units || []) {
        if (u.f !== "p") continue;
        const px = sx(u.x) + (TILE * zoom) / 2;
        const py = sy(u.y) + (TILE * zoom) / 2;
        if (px >= x0 && px <= x1 && py >= y0 && py <= y1) next.add(u.id);
      }
      selected = next;
    } else if (e.button === 0) {
      handleClick(e);
    }
    dragStart = null;
    dragCur = null;
    dragMoved = false;
  }
});

function handleClick(e) {
  const mx = e.offsetX;
  const my = e.offsetY;
  if (mode.startsWith("build:")) {
    const b = mode.slice(6);
    const [tx, ty] = tileAt(mx, my);
    if (v && validBuild(tx, ty, b)) {
      send({ type: "action", action: { type: "build", b, x: tx, y: ty } });
      mode = "idle";
      document.querySelectorAll(".tool[data-b]").forEach((x) => x.classList.remove("active"));
    }
    return;
  }
  if (mode === "repair") {
    // click a damaged building to repair it
    const [tx, ty] = tileAt(mx, my);
    if (v) {
      const b = v.buildings.find((bb) => bb.x === tx && bb.y === ty && bb.hp < bb.max);
      if (b) {
        send({ type: "action", action: { type: "repair", id: b.id } });
      }
    }
    return;
  }
  // select/move units
  const hit = unitAt(mx, my);
  if (hit) {
    if (e.shiftKey) {
      if (selected.has(hit.id)) selected.delete(hit.id);
      else selected.add(hit.id);
    } else {
      selected = new Set([hit.id]);
    }
  } else if (selected.size) {
    const [tx, ty] = tileAt(mx, my);
    if (v && tx >= 0 && ty >= 0 && tx < v.W && ty < v.H) {
      send({ type: "action", action: { type: "move", ids: [...selected], x: tx, y: ty } });
      selected = new Set();
    }
  } else {
    selected = new Set();
  }
}

canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  if (mode.startsWith("build:")) mode = "idle";
  else if (mode === "repair") mode = "idle";
  else selected = new Set();
  document.querySelectorAll(".tool[data-b]").forEach((x) => x.classList.remove("active"));
  repairBtn.classList.remove("active");
});

canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const factor = e.deltaY > 0 ? 1.12 : 0.89;
  zoom = clamp(zoom * factor, 0.5, 2.5);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (mode.startsWith("build:")) mode = "idle";
    else if (mode === "repair") mode = "idle";
    else selected = new Set();
    document.querySelectorAll(".tool[data-b]").forEach((x) => x.classList.remove("active"));
    repairBtn.classList.remove("active");
  }
  if (e.key === "h" || e.key === "H") {
    if (v) {
      camX = v.kx;
      camY = v.ky;
    }
  }
  if (e.key === "c" || e.key === "C") {
    if (v) {
      camX = v.campX;
      camY = v.campY;
    }
  }
  if (e.key === "p" || e.key === "P") {
    if (v) send({ type: "action", action: { type: "pause", on: !v.paused } });
  }
});

function unitAt(mx, my) {
  if (!v) return null;
  const tSize = TILE * zoom;
  let best = null;
  let bd = 1e9;
  for (const u of v.units) {
    if (u.f !== "p") continue;
    const px = sx(u.x) + tSize / 2;
    const py = sy(u.y) + tSize / 2;
    const d = (px - mx) ** 2 + (py - my) ** 2;
    if (d < 1100 && d < bd) {
      bd = d;
      best = u;
    }
  }
  return best;
}

// toolbelt
document.querySelectorAll(".tool[data-b]").forEach((el) => {
  el.addEventListener("click", () => {
    if (!v) return;
    const b = el.dataset.b;
    document.querySelectorAll(".tool[data-b]").forEach((x) => x.classList.toggle("active", x === el));
    if (mode === "build:" + b) {
      mode = "idle";
      el.classList.remove("active");
    } else {
      mode = "build:" + b;
    }
  });
});

for (const [id, u] of [
  ["t-spearman", "spearman"],
  ["t-archer", "archer"],
  ["t-knight", "knight"],
]) {
  $(id).addEventListener("click", () => {
    send({ type: "action", action: { type: "train", u } });
    sfx("train");
  });
}

// repair tool: pick it, then click a damaged building
const repairBtn = $("t-repair");
repairBtn.addEventListener("click", () => {
  if (mode.startsWith("build:")) {
    document.querySelectorAll(".tool[data-b]").forEach((x) => x.classList.remove("active"));
  }
  const on = mode === "repair";
  mode = on ? "idle" : "repair";
  repairBtn.classList.toggle("active", !on);
});

$("btnPause").addEventListener("click", () => {
  if (!v) return;
  send({ type: "action", action: { type: "pause", on: !v.paused } });
});

$("btnReset").addEventListener("click", () => send({ type: "reset" }));

$("btnMute").addEventListener("click", () => {
  muted = !muted;
  if (!muted) initAudio();
  updateHud();
});

function showOverlay(title, text) {
  onOverShown = false;
  $("ovTitle").textContent = title;
  $("ovText").textContent = text;
  $("overlay").classList.add("show");
}
$("ovBtn").addEventListener("click", () => {
  $("overlay").classList.remove("show");
  send({ type: "reset" });
});

// ── audio (WebAudio synthesis) ─────────────────────────────────────────────

let ac = null;
let muted = false;
let musicGain = null;
let musicTimer = null;

function initAudio() {
  if (muted) return;
  if (ac) {
    ac.resume();
    return;
  }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    musicGain = ac.createGain();
    musicGain.gain.value = 0;
    musicGain.connect(ac.destination);
    startDrone();
    // fade in
    musicGain.gain.linearRampToValueAtTime(0.5, ac.currentTime + 2);
  } catch {
    /* no audio available */
  }
}

// low medieval drone: two detuned fifths through a slow filter
function startDrone() {
  const o1 = ac.createOscillator();
  o1.type = "sawtooth";
  o1.frequency.value = 110; // A2
  const o2 = ac.createOscillator();
  o2.type = "sawtooth";
  o2.frequency.value = 110 * 1.5; // E3 (fifth)
  const o3 = ac.createOscillator();
  o3.type = "sine";
  o3.frequency.value = 55;
  const f = ac.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 320;
  const g = ac.createGain();
  g.gain.value = 0.05;
  o1.connect(f);
  o2.connect(f);
  o3.connect(f);
  f.connect(g);
  g.connect(musicGain);
  o1.start();
  o2.start();
  o3.start();
  // slow pulse for war-drums feel
  musicTimer = setInterval(() => {
    if (!ac || muted) return;
    const t = ac.currentTime;
    const o = ac.createOscillator();
    o.type = "sine";
    o.frequency.value = 70;
    const gg = ac.createGain();
    gg.gain.setValueAtTime(0.04, t);
    gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(gg);
    gg.connect(musicGain);
    o.start(t);
    o.stop(t + 0.32);
  }, 2500);
}

function sfx(kind) {
  if (!ac || muted) return;
  const t = ac.currentTime;
  const env = (g, dur, vol) => {
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  };
  const node = (type, freq, dur, vol, freqEnd) => {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = ac.createGain();
    env(g, dur, vol);
    o.connect(g);
    g.connect(ac.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  };
  if (kind === "build") node("square", 130, 0.12, 0.12, 60);
  else if (kind === "danger") {
    node("sawtooth", 110, 0.2, 0.12);
    node("sawtooth", 110, 0.2, 0.12); // two hits
    setTimeout(() => node("sawtooth", 110, 0.2, 0.12), 250);
  } else if (kind === "train") node("triangle", 520, 0.18, 0.1, 780);
  else if (kind === "kill") node("sine", 950, 0.08, 0.08, 500);
  else if (kind === "end") {
    node("triangle", 330, 0.9, 0.12);
    node("triangle", 415, 0.9, 0.1);
    node("triangle", 494, 1.2, 0.1);
  } else if (kind === "intro") node("triangle", 220, 0.4, 0.06, 440);
}

// ── boot ───────────────────────────────────────────────────────────────────

function loop() {
  draw();
  requestAnimationFrame(loop);
}

document.querySelectorAll(".tool[data-b]").forEach((el) => {
  el.title = el.title || (el.dataset.b + " — click twice to place");
});

// intro overlay
showOverlay("IRON HOLDFAST", "");
$("ovText").textContent =
  "A real-time siege builder. Grow a medieval economy — houses, farms, mines — raise walls and towers, train a garrison, and destroy the enemy camp before its waves break your keep. Click a building in the belt to place it; click a soldier, then click a tile to march it.";
$("ovBtn").textContent = "Begin the hold";
document.addEventListener("pointerdown", initAudio, { once: true });
$("ovBtn").addEventListener("click", () => {
  initAudio();
  sfx("intro");
});

connect();
requestAnimationFrame(loop);