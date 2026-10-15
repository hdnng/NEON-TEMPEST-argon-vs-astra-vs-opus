import { mkdtempSync, cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep, dirname } from "node:path";
import { spawn, execFileSync } from "node:child_process";
const tempRoot = resolve(tmpdir()),
  checkout = mkdtempSync(join(tempRoot, "neon-tempest-start-"));
for (const name of ["package.json", "package-lock.json", "index.html", "src"])
  cpSync(name, join(checkout, name), { recursive: true });
mkdirSync(join(checkout, "scripts"));
cpSync("scripts/start.mjs", join(checkout, "scripts/start.mjs"));
const npmCli =
  process.env.npm_execpath ??
  join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
const child = spawn(
  process.execPath,
  [npmCli, "start", "--", "--host", "127.0.0.1", "--port", "5178"],
  { cwd: checkout, stdio: "pipe", windowsHide: true },
);
let logs = "";
child.stdout.on("data", (d) => (logs += d));
child.stderr.on("data", (d) => (logs += d));
let ok = false;
try {
  for (let i = 0; i < 300; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      const r = await fetch("http://127.0.0.1:5178");
      if (r.ok && (await r.text()).includes("NEON TEMPEST")) {
        ok = true;
        break;
      }
    } catch {}
  }
  if (!ok) throw Error("Clean startup failed: " + logs);
  const entry = await fetch("http://127.0.0.1:5178/src/main.ts");
  if (!entry.ok) throw Error("TypeScript entry failed");
  const report = {
    passed: true,
    command: "npm start -- --host 127.0.0.1 --port 5178",
    freshDirectory: true,
    dependenciesInitiallyAbsent: true,
    date: new Date().toISOString(),
  };
  writeFileSync("startup-results.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (child.pid) {
    if (process.platform === "win32") {
      try {
        execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
          windowsHide: true,
          stdio: "ignore",
        });
      } catch {}
    } else child.kill();
  }
  const target = resolve(checkout);
  if (
    !target.startsWith(tempRoot + sep) ||
    !target.split(sep).at(-1).startsWith("neon-tempest-start-")
  )
    throw Error("Unsafe cleanup path");
  rmSync(target, { recursive: true, force: true });
}
