import { readFile, writeFile } from "node:fs/promises";

const path = "public/index.html";
let source = await readFile(path, "utf8");

function replaceOnce(label, before, after) {
  const at = source.indexOf(before);
  if (at < 0) throw new Error(`${label}: expected source not found`);
  if (source.indexOf(before, at + before.length) >= 0) throw new Error(`${label}: expected source occurs more than once`);
  source = source.slice(0, at) + after + source.slice(at + before.length);
}

replaceOnce(
  "topbar safe area",
  `      #topbar {\n        height: 52px; flex: 0 0 auto; display: flex; align-items: center; gap: 14px;\n        padding: 0 14px; background: linear-gradient(#3b2b1c, #241a10);`,
  `      #topbar {\n        min-height: calc(52px + env(safe-area-inset-top)); flex: 0 0 auto; display: flex; align-items: center; gap: 14px;\n        padding: env(safe-area-inset-top) calc(14px + env(safe-area-inset-right)) 0 calc(14px + env(safe-area-inset-left)); background: linear-gradient(#3b2b1c, #241a10);`,
);

replaceOnce(
  "toolbelt home indicator safe area",
  `        padding: 8px 10px; display: flex; gap: 10px; align-items: center; overflow-x: auto; user-select: none;`,
  `        padding: 8px calc(10px + env(safe-area-inset-right)) calc(8px + env(safe-area-inset-bottom)) calc(10px + env(safe-area-inset-left)); display: flex; gap: 10px; align-items: center; overflow-x: auto; user-select: none;`,
);

replaceOnce(
  "mobile topbar safe area",
  `        #hud { gap: 5px; } .bar { width: 90px; } #topbar { flex-wrap: wrap; height: auto; padding: 6px 8px; gap: 6px; }`,
  `        #hud { gap: 5px; } .bar { width: 90px; } #topbar { flex-wrap: wrap; height: auto; padding: calc(6px + env(safe-area-inset-top)) calc(8px + env(safe-area-inset-right)) 6px calc(8px + env(safe-area-inset-left)); gap: 6px; }`,
);

if (!source.includes("env(safe-area-inset-top)")) throw new Error("top safe-area CSS was not applied");
if (!source.includes("env(safe-area-inset-bottom)")) throw new Error("bottom safe-area CSS was not applied");
await writeFile(path, source);
console.log("Applied command-mode notch, side, and home-indicator safe-area padding.");
