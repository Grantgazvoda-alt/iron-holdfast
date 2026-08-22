import { playerId, roomId } from "./session.js";

const player = playerId();
const room = roomId();
const $ = (id) => document.getElementById(id);
const canvas = $("battle");
const ctx = canvas.getContext("2d");

let socket;
let retry = 0;
let view = null;
let controlledId = Number(localStorage.getItem("hf:battle:unit")) || null;
let yaw = Number(localStorage.getItem("hf:battle:yaw")) || 0;
let pitch = 0;
let lastMoveAt = 0;
let lastAttackAt = 0;
let bracing = false;
let sprinting = false;
const keys = new Set();
const moveAxis = { x: 0, y: 0 };

function sendAction(action) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "action", action }));
}

function connect() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${proto}//${location.host}/ws/${encodeURIComponent(room)}`);
  socket.addEventListener("open", () => {
    retry = 0;
    $("status").textContent = "Live siege";
    socket.send(JSON.stringify({ type: "join", playerId: player }));
  });
  socket.addEventListener("message", (event) => {
    if (event.data === "__pong") return;
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    if (msg.type === "state" && msg.view) {
      view = msg.view;
      chooseUnit();
      updateHud();
    } else if (msg.type === "error") {
      flash(msg.error || "Server rejected action");
      if (msg.error === "join first") socket.send(JSON.stringify({ type: "join", playerId: player }));
    }
  });
  socket.addEventListener("close", () => {
    $("status").textContent = "Reconnecting…";
    const wait = Math.min(8000, 500 * 2 ** retry++);
    setTimeout(connect, wait);
  });
}

setInterval(() => {
  if (socket?.readyState === WebSocket.OPEN) socket.send("__ping");
}, 30000);

function chooseUnit() {
  if (!view) return;
  let u = view.units.find((x) => x.id === controlledId && x.f === "p" && x.hp > 0 && !x.rout);
  if (!u) u = view.units.find((x) => x.f === "p" && x.t === "spearman" && x.hp > 0 && !x.rout);
  if (!u) u = view.units.find((x) => x.f === "p" && x.hp > 0 && !x.rout);
  controlledId = u?.id ?? null;
  if (controlledId) localStorage.setItem("hf:battle:unit", String(controlledId));
}

function soldier() {
  return view?.units.find((u) => u.id === controlledId && u.f === "p" && u.hp > 0) || null;
}

function updateHud() {
  const u = soldier();
  $("unit").textContent = u ? `${u.t.toUpperCase()} · HP ${u.hp}/${u.max} · Morale ${u.morale}` : "Train a garrison soldier";
  if (!u) flash("Battle Mode needs a living garrison unit. Return to Command and train a spearman.");
}

function flash(text) {
  const el = $("message");
  el.textContent = text;
  clearTimeout(flash.timer);
  flash.timer = setTimeout(() => { el.textContent = ""; }, 3500);
}

function returnToCommand() {
  localStorage.setItem("hf:battle:yaw", String(yaw));
  location.href = `/?room=${encodeURIComponent(room)}`;
}
$("return").addEventListener("click", returnToCommand);

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  canvas.style.width = `${innerWidth}px`;
  canvas.style.height = `${innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener("resize", resize);
resize();

function terrainColor(c) {
  return c === "w" ? "#466b78" : c === "f" ? "#29442b" : c === "m" ? "#6b6760" : c === "i" ? "#665f55" : c === "o" ? "#8a6f3d" : "#617c4c";
}

function rel(u, x, y) {
  const dx = x - u.x;
  const dy = y - u.y;
  const cs = Math.cos(-yaw), sn = Math.sin(-yaw);
  return { side: dx * cs - dy * sn, depth: dx * sn + dy * cs };
}

function draw() {
  requestAnimationFrame(draw);
  const w = innerWidth, h = innerHeight;
  const sky = ctx.createLinearGradient(0, 0, 0, h * .58);
  sky.addColorStop(0, "#718ba0"); sky.addColorStop(1, "#d7b77c");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h * .58);
  const ground = ctx.createLinearGradient(0, h * .52, 0, h);
  ground.addColorStop(0, "#55633e"); ground.addColorStop(1, "#25291c");
  ctx.fillStyle = ground; ctx.fillRect(0, h * .52, w, h * .48);
  ctx.fillStyle = "rgba(50,40,28,.25)"; ctx.fillRect(0, h * .5 + pitch * 40, w, 2);

  const u = soldier();
  if (!view || !u) {
    ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.fillRect(0, 0, w, h);
    return;
  }

  const things = [];
  for (const b of view.buildings) things.push({ kind:"building", ...b });
  things.push({ kind:"keep", x:view.kx, y:view.ky, hp:view.keep.hp, max:view.keep.max });
  things.push({ kind:"camp", x:view.campX, y:view.campY, hp:view.camp.hp, max:view.camp.max });
  for (const other of view.units) if (other.id !== u.id && other.hp > 0) things.push({ kind:"unit", ...other });

  const projected = things.map((o) => ({ o, r: rel(u, o.x, o.y) })).filter(({r}) => r.depth > .15).sort((a,b) => b.r.depth - a.r.depth);
  for (const { o, r } of projected) {
    const scale = Math.min(2.2, 1.6 / r.depth);
    const x = w / 2 + (r.side / r.depth) * w * .55;
    const base = h * (.56 + pitch * .05) + 42 / Math.max(.5, r.depth);
    if (x < -120 || x > w + 120) continue;
    if (o.kind === "unit") {
      const height = 86 * scale;
      ctx.fillStyle = o.f === "p" ? "#315e9b" : "#9c342f";
      ctx.fillRect(x - 12 * scale, base - height, 24 * scale, height * .72);
      ctx.beginPath(); ctx.arc(x, base - height, 12 * scale, 0, Math.PI * 2); ctx.fill();
      if (o.t === "spearman" || o.t === "raider") {
        ctx.strokeStyle = "#c9b48b"; ctx.lineWidth = Math.max(1, 3 * scale); ctx.beginPath(); ctx.moveTo(x + 10 * scale, base - height * .7); ctx.lineTo(x + 30 * scale, base - height * 1.35); ctx.stroke();
      }
      const hp = Math.max(0, o.hp / o.max);
      ctx.fillStyle = "rgba(0,0,0,.65)"; ctx.fillRect(x - 20 * scale, base - height - 20, 40 * scale, 5);
      ctx.fillStyle = hp > .45 ? "#68b35b" : "#b63d36"; ctx.fillRect(x - 20 * scale, base - height - 20, 40 * scale * hp, 5);
    } else {
      const bh = (o.kind === "keep" || o.kind === "camp" ? 150 : 90) * scale;
      const bw = (o.kind === "keep" || o.kind === "camp" ? 130 : 65) * scale;
      ctx.fillStyle = o.kind === "camp" ? "#5a2d24" : o.b === "wall" ? "#777269" : "#655441";
      ctx.fillRect(x - bw / 2, base - bh, bw, bh);
      ctx.fillStyle = "rgba(20,15,10,.45)"; ctx.fillRect(x - bw / 2, base - 8, bw, 8);
    }
  }

  // weapon/shield foreground conveys attack and brace state without trusting client damage.
  ctx.save();
  if (bracing) {
    ctx.fillStyle = "rgba(80,91,105,.92)"; ctx.beginPath(); ctx.ellipse(w * .18, h * .72, w * .13, h * .25, -.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#b8a36f"; ctx.lineWidth = 5; ctx.stroke();
  }
  ctx.strokeStyle = "#8f7652"; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(w * .82, h); ctx.lineTo(w * .61, h * .54); ctx.stroke();
  ctx.strokeStyle = "#d4d0c4"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(w * .61, h * .54); ctx.lineTo(w * .58, h * .43); ctx.stroke();
  ctx.restore();
}
requestAnimationFrame(draw);

function nearestEnemy(u) {
  if (!view) return null;
  let best = null, bd = Infinity;
  for (const e of view.units) {
    if (e.f !== "e" || e.hp <= 0) continue;
    const d = Math.abs(e.x - u.x) + Math.abs(e.y - u.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best && bd <= Math.max(2, u.range || 1) ? best : null;
}

function attack() {
  const now = performance.now();
  if (now - lastAttackAt < 420) return;
  lastAttackAt = now;
  const u = soldier();
  if (!u || bracing) return;
  const target = nearestEnemy(u);
  if (!target) { flash("No enemy in weapon range"); return; }
  sendAction({ type:"attack", ids:[u.id], target:target.id });
}

function setBrace(on) {
  bracing = on;
  const u = soldier();
  if (u && on) sendAction({ type:"hold", ids:[u.id] });
}

function movementVector() {
  let x = moveAxis.x, y = moveAxis.y;
  if (keys.has("KeyA")) x -= 1;
  if (keys.has("KeyD")) x += 1;
  if (keys.has("KeyW")) y -= 1;
  if (keys.has("KeyS")) y += 1;
  const len = Math.hypot(x, y);
  return len > 1 ? { x:x/len, y:y/len } : { x, y };
}

function stepMovement() {
  requestAnimationFrame(stepMovement);
  if (!view || bracing) return;
  const now = performance.now();
  const cadence = sprinting || keys.has("ShiftLeft") || keys.has("ShiftRight") ? 210 : 360;
  if (now - lastMoveAt < cadence) return;
  const m = movementVector();
  if (Math.hypot(m.x, m.y) < .35) return;
  const u = soldier();
  if (!u) return;
  // Convert local first-person input to a one-tile server-validated march intent.
  const forward = -m.y, strafe = m.x;
  const wx = forward * Math.sin(yaw) + strafe * Math.cos(yaw);
  const wy = forward * Math.cos(yaw) - strafe * Math.sin(yaw);
  let dx = Math.abs(wx) > Math.abs(wy) ? Math.sign(wx) : 0;
  let dy = dx === 0 ? Math.sign(wy) : 0;
  const tx = Math.max(0, Math.min(view.W - 1, u.x + dx));
  const ty = Math.max(0, Math.min(view.H - 1, u.y + dy));
  if (tx === u.x && ty === u.y) return;
  lastMoveAt = now;
  sendAction({ type:"move", ids:[u.id], x:tx, y:ty });
}
requestAnimationFrame(stepMovement);

addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (e.code === "Escape") document.exitPointerLock?.();
  if (e.code === "Space") attack();
});
addEventListener("keyup", (e) => keys.delete(e.code));
canvas.addEventListener("click", () => {
  if (matchMedia("(pointer:fine)").matches && document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
  else attack();
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("mousedown", (e) => { if (e.button === 2) setBrace(true); });
addEventListener("mouseup", (e) => { if (e.button === 2) setBrace(false); });
addEventListener("mousemove", (e) => {
  if (document.pointerLockElement !== canvas) return;
  yaw += e.movementX * .0026;
  pitch = Math.max(-.65, Math.min(.65, pitch + e.movementY * .002));
});

function bindHoldButton(id, onDown, onUp = () => {}) {
  const el = $(id);
  el.addEventListener("pointerdown", (e) => { e.preventDefault(); el.setPointerCapture?.(e.pointerId); onDown(); });
  const up = (e) => { e.preventDefault(); onUp(); };
  el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
}
bindHoldButton("attack", attack);
bindHoldButton("brace", () => setBrace(true), () => setBrace(false));
bindHoldButton("sprint", () => { sprinting = true; }, () => { sprinting = false; });

const stick = $("moveStick"), nub = $("moveNub");
let movePointer = null;
function moveStick(e) {
  const r = stick.getBoundingClientRect();
  const dx = e.clientX - (r.left + r.width/2), dy = e.clientY - (r.top + r.height/2);
  const max = r.width * .34, len = Math.hypot(dx,dy) || 1, k = Math.min(1,max/len);
  const px = dx*k, py = dy*k;
  nub.style.transform = `translate(${px}px,${py}px)`;
  moveAxis.x = Math.max(-1,Math.min(1,dx/max)); moveAxis.y = Math.max(-1,Math.min(1,dy/max));
}
stick.addEventListener("pointerdown", (e) => { movePointer=e.pointerId; stick.setPointerCapture?.(e.pointerId); moveStick(e); });
stick.addEventListener("pointermove", (e) => { if(e.pointerId===movePointer) moveStick(e); });
function endStick(e) { if(e.pointerId!==movePointer)return; movePointer=null; moveAxis.x=moveAxis.y=0; nub.style.transform="translate(0,0)"; }
stick.addEventListener("pointerup",endStick); stick.addEventListener("pointercancel",endStick);

let lookPointer=null, lastLook=null;
$("lookPad").addEventListener("pointerdown",(e)=>{ lookPointer=e.pointerId; lastLook={x:e.clientX,y:e.clientY}; $("lookPad").setPointerCapture?.(e.pointerId); });
$("lookPad").addEventListener("pointermove",(e)=>{ if(e.pointerId!==lookPointer||!lastLook)return; yaw+=(e.clientX-lastLook.x)*.006; pitch=Math.max(-.65,Math.min(.65,pitch+(e.clientY-lastLook.y)*.004)); lastLook={x:e.clientX,y:e.clientY}; });
function endLook(e){ if(e.pointerId===lookPointer){lookPointer=null;lastLook=null;} }
$("lookPad").addEventListener("pointerup",endLook); $("lookPad").addEventListener("pointercancel",endLook);

$("return").addEventListener("click", () => {
  location.href = `/?room=${encodeURIComponent(room)}`;
});

connect();
