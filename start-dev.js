import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));
const isCheckOnly = process.argv.includes("--check-only");
const npmCommand = "npm";
const children = [];
let shuttingDown = false;

const requiredPaths = [
  { path: "backend/package.json", label: "backend package" },
  { path: "frontend/package.json", label: "frontend package" },
];

const missing = requiredPaths.filter((entry) => !existsSync(join(rootDir, entry.path)));
if (missing.length > 0) {
  console.error("Missing required files:");
  for (const entry of missing) {
    console.error(`- ${entry.path} (${entry.label})`);
  }
  process.exit(1);
}

if (isCheckOnly) {
  console.log("Dev startup check passed.");
  process.exit(0);
}

function killChild(child) {
  if (!child || child.exitCode !== null || child.killed) {
    return;
  }

  if (process.platform === "win32" && child.pid) {
    spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }

  child.kill("SIGTERM");
}

function shutdown(code = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children) {
    killChild(child);
  }

  setTimeout(() => {
    process.exit(code);
  }, 300);
}

function startService(name, cwd) {
  const useShell = process.platform === "win32";
  const command = useShell ? "npm run dev" : npmCommand;
  const args = useShell ? [] : ["run", "dev"];

  const child = spawn(command, args, {
    cwd,
    stdio: "inherit",
    env: process.env,
    shell: useShell,
  });

  children.push(child);

  child.on("error", (error) => {
    console.error(`${name} failed to start: ${error.message}`);
    shutdown(1);
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (signal) {
      console.error(`${name} stopped with signal ${signal}.`);
      shutdown(1);
      return;
    }

    if (typeof code === "number" && code !== 0) {
      console.error(`${name} exited with code ${code}.`);
      shutdown(code);
    }
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log("Starting backend and frontend dev servers...");
startService("Backend", join(rootDir, "backend"));

setTimeout(() => {
  if (shuttingDown) {
    return;
  }

  startService("Frontend", join(rootDir, "frontend"));
  console.log("Both dev commands started.");
}, 2000);
