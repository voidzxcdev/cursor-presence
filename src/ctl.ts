import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { CONFIG_PATH, DEFAULT_CONFIG, PIPE_PATH, STATUS_PATH, loadConfig, readJson } from "./shared";

const USAGE = `cursor-presence <command>

  status              Show what Discord currently sees
  pause | resume      Hide or show your presence
  client-id <id>      Set the Discord Application ID
  hide <project>      Show a project as "a private project"
  unhide <project>
  start | stop | restart`;

function send(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect(PIPE_PATH);
    socket.setTimeout(800, () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("connect", () => socket.end(`${message}\n`, () => resolve(true)));
    socket.on("error", () => resolve(false));
  });
}

function saveConfig(patch: Record<string, unknown>): void {
  let current: Record<string, unknown> = {};
  try {
    current = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch {}
  writeFileSync(CONFIG_PATH, `${JSON.stringify({ ...DEFAULT_CONFIG, ...current, ...patch }, null, 2)}\n`);
}

function start(): void {
  spawn(process.execPath, [path.join(__dirname, "daemon.cjs")], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  }).unref();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const [cmd, arg] = process.argv.slice(2);
  switch (cmd) {
    case "status": {
      const alive = await send("ping");
      const status = readJson<Record<string, unknown>>(STATUS_PATH);
      console.log(JSON.stringify({ daemonReachable: alive, ...(alive ? status : {}) }, null, 2));
      return;
    }
    case "pause":
    case "resume":
      saveConfig({ paused: cmd === "pause" });
      await send("refresh");
      console.log(cmd === "pause" ? "Presence paused and cleared." : "Presence resumed.");
      return;
    case "client-id":
      if (!arg || !/^\d{15,22}$/.test(arg)) throw new Error("Pass the numeric Application ID from the Discord Developer Portal.");
      saveConfig({ clientId: arg });
      if (!(await send("refresh"))) start();
      console.log("Application ID saved.");
      return;
    case "hide":
    case "unhide": {
      if (!arg) throw new Error(`Usage: ${cmd} <project folder name>`);
      const others = loadConfig().hiddenProjects.filter((p) => p.toLowerCase() !== arg.toLowerCase());
      saveConfig({ hiddenProjects: cmd === "hide" ? [...others, arg] : others });
      await send("refresh");
      console.log(cmd === "hide" ? `"${arg}" now shows as a private project.` : `"${arg}" is visible again.`);
      return;
    }
    case "start":
      if (await send("ping")) console.log("Already running.");
      else {
        start();
        console.log("Started.");
      }
      return;
    case "stop":
      console.log((await send("quit")) ? "Stopped." : "Not running.");
      return;
    case "restart":
      await send("quit");
      for (let i = 0; i < 20 && (await send("ping")); i++) await sleep(150);
      start();
      console.log("Restarted.");
      return;
    default:
      console.log(USAGE);
  }
}

main().catch((err) => {
  console.error((err as Error).message);
  process.exit(1);
});
