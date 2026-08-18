import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "dist", "client");
const mobile = resolve(root, "dist", "mobile");
const backend = new URL(process.env.HF_MOBILE_SERVER || "https://iron-empire.higgsfield.app");

if (backend.protocol !== "https:") {
  throw new Error("HF_MOBILE_SERVER must use https for store builds");
}

await rm(mobile, { recursive: true, force: true });
await mkdir(mobile, { recursive: true });
await cp(source, mobile, { recursive: true });

const socketPattern = /const proto = location\.protocol === "https:" \? "wss:" : "ws:";\s*socket = new WebSocket\(`\$\{proto\}\/\/\$\{location\.host\}\/ws\/\$\{encodeURIComponent\(room\)\}`\);/;
const socketReplacement = `const backend = new URL(${JSON.stringify(backend.origin)});\n  const proto = backend.protocol === "https:" ? "wss:" : "ws:";\n  socket = new WebSocket(\`${"${proto}"}//${"${backend.host}"}/ws/${"${encodeURIComponent(room)}"}\`);`;

for (const name of ["client.js", "battle.js"]) {
  const path = resolve(mobile, name);
  const current = await readFile(path, "utf8");
  if (!socketPattern.test(current)) {
    throw new Error(`Expected WebSocket block not found in ${name}`);
  }
  await writeFile(path, current.replace(socketPattern, socketReplacement));
}

for (const name of ["index.html", "battle.html"]) {
  const path = resolve(mobile, name);
  let current = await readFile(path, "utf8");
  current = current.replace(
    /<meta name="viewport" content="[^"]*" \/>/,
    '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover" />',
  );
  if (!current.includes('name="mobile-web-app-capable"')) {
    current = current.replace(
      "</head>",
      '    <meta name="mobile-web-app-capable" content="yes" />\n    <meta name="apple-mobile-web-app-capable" content="yes" />\n    <meta name="theme-color" content="#1a140e" />\n  </head>',
    );
  }
  await writeFile(path, current);
}

await writeFile(
  resolve(mobile, "mobile-build.json"),
  `${JSON.stringify({ app: "Iron Holdfast", backend: backend.origin, preparedAt: new Date().toISOString() }, null, 2)}\n`,
);

console.log(`prepared native web assets in dist/mobile -> ${backend.origin}`);
