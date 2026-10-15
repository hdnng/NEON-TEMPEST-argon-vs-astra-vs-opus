import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
if (!existsSync("node_modules/vite/bin/vite.js")) {
  console.log("Installing NEON TEMPEST development dependencies…");
  const npmCli =
    process.env.npm_execpath ??
    join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
  const install = spawnSync(process.execPath, [npmCli, "ci"], {
    stdio: "inherit",
    windowsHide: true,
  });
  if (install.status !== 0) process.exit(install.status ?? 1);
}
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "0.0.0.0",
    ...process.argv.slice(2),
  ],
  { stdio: "inherit", windowsHide: true },
);
server.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.kill(signal));
