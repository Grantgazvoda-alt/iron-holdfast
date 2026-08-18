import { readFile, writeFile } from "node:fs/promises";

async function patch(path, edits) {
  let source = await readFile(path, "utf8");
  for (const [label, before, after] of edits) {
    const at = source.indexOf(before);
    if (at < 0) throw new Error(`${path}: ${label}: expected source not found`);
    if (source.indexOf(before, at + before.length) >= 0) {
      throw new Error(`${path}: ${label}: expected source occurs more than once`);
    }
    source = source.slice(0, at) + after + source.slice(at + before.length);
  }
  await writeFile(path, source);
}

const oldClientSession = `const room = new URLSearchParams(location.search).get("room") || "main";\n\nfunction playerId() {\n  const key = "hf:game:playerId";\n  let id = localStorage.getItem(key);\n  if (!id) {\n    id = Math.random().toString(36).slice(2, 10);\n    localStorage.setItem(key, id);\n  }\n  return id;\n}`;

const newClientSession = `import { playerId, roomId } from "./session.js";\n\nconst player = playerId();\nconst room = roomId();\n\n// A queryless solo install owns a stable private room. Explicit ?room= links\n// remain available for deliberate QA/shared-room scenarios. Keep Battle Mode\n// on the same room and replace the legacy inline fallback to global \"main\".\nconst battleLink = document.getElementById("btnBattle");\nif (battleLink) {\n  battleLink.removeAttribute("onclick");\n  battleLink.href = \`/battle.html?room=\${encodeURIComponent(room)}\`;\n}`;

await patch("public/client.js", [
  ["replace global main session", oldClientSession, newClientSession],
]);
let client = await readFile("public/client.js", "utf8");
client = client.replaceAll("playerId: playerId()", "playerId: player");
if (client.includes("playerId: playerId()")) throw new Error("client join still calls legacy playerId()");
await writeFile("public/client.js", client);

const oldBattleSession = `const room = new URLSearchParams(location.search).get("room") || "main";\nconst $ = (id) => document.getElementById(id);\nconst canvas = $("battle");\nconst ctx = canvas.getContext("2d");\n\nfunction playerId() {\n  const key = "hf:game:playerId";\n  let id = localStorage.getItem(key);\n  if (!id) {\n    id = Math.random().toString(36).slice(2, 10);\n    localStorage.setItem(key, id);\n  }\n  return id;\n}`;

const newBattleSession = `import { playerId, roomId } from "./session.js";\n\nconst player = playerId();\nconst room = roomId();\nconst $ = (id) => document.getElementById(id);\nconst canvas = $("battle");\nconst ctx = canvas.getContext("2d");`;

await patch("public/battle.js", [
  ["replace global main battle session", oldBattleSession, newBattleSession],
  [
    "wire return to command",
    `$("lookPad").addEventListener("pointerup",endLook); $("lookPad").addEventListener("pointercancel",endLook);\n\nconnect();`,
    `$("lookPad").addEventListener("pointerup",endLook); $("lookPad").addEventListener("pointercancel",endLook);\n\n$("return").addEventListener("click", () => {\n  location.href = \`/?room=\${encodeURIComponent(room)}\`;\n});\n\nconnect();`,
  ],
]);
let battle = await readFile("public/battle.js", "utf8");
battle = battle.replaceAll("playerId: playerId()", "playerId: player");
if (battle.includes("playerId: playerId()")) throw new Error("battle join still calls legacy playerId()");
await writeFile("public/battle.js", battle);

const oldInline = ` onclick="this.href='/battle.html?room='+encodeURIComponent(new URLSearchParams(location.search).get('room')||'main')"`;
await patch("public/index.html", [["remove global-main inline battle link", oldInline, ""]]);

for (const path of ["public/client.js", "public/battle.js", "public/index.html"]) {
  const source = await readFile(path, "utf8");
  if (source.includes('get("room") || "main"') || source.includes("get('room')||'main'")) {
    throw new Error(`${path}: global main fallback remains`);
  }
}

console.log("Applied stable per-install room routing and command/battle navigation wiring.");
