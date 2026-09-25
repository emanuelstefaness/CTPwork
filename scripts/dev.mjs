import { spawn } from "node:child_process";

const raw = process.argv.slice(2);
let host = "127.0.0.1";
let port = "3000";
for (let i = 0; i < raw.length; i += 1) {
  if (raw[i] === "--host" || raw[i] === "--hostname" || raw[i] === "-H") host = raw[i + 1] ?? host;
  if (raw[i] === "--port" || raw[i] === "-p") port = raw[i + 1] ?? port;
}

const previewMode = raw.includes("--strictPort");
const command = previewMode ? ["start", "--hostname", host, "--port", port] : ["dev", "--webpack", "--hostname", host, "--port", port];
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", ...command], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 0));
