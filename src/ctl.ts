import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { CONFIG_PATH, DEFAULT_CONFIG, STATUS_PATH, loadConfig, readJson, sendToDaemon as send } from "./shared";

const USAGE = `cursor-presence <command>

  status              Show what Discord currently sees
  pause | resume      Hide or show your presence
  client-id [id]      Set the Discord Application ID (asks for it if omitted)
  hide <project>      Also hide file names and code size in this project
  unhide <project>
  start | stop | restart`;

async function askClientId(): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question("Paste your Discord Application ID: ")).trim();
  } finally {
    rl.close();
  }
}

function checkClientId(id: string): void {
  if (/^\d{15,22}$/.test(id)) return;
  if (id.includes(".") && id.length > 40) {
    throw new Error(
      "That looks like a bot token. Nothing was saved. Rich Presence never needs it, so keep it private " +
        "(reset it in the Developer Portal if you shared it anywhere). Copy the Application ID from General Information instead.",
    );
  }
  throw new Error("That isn't an Application ID. It's the 17-20 digit number under General Information in the Developer Portal.");
}

async function waitForDiscord(): Promise<void> {
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    const s = readJson<{ running?: boolean; discordConnected?: boolean; discordError?: string | null }>(STATUS_PATH);
    if (s?.discordConnected) {
      console.log("Connected to Discord. Your presence is live.");
      return;
    }
    if (i > 12 && s?.running === false) {
      console.log("Saved. It goes live the next time Cursor is open.");
      return;
    }
    if (i > 8 && s?.discordError) {
      console.log(`Saved, but Discord refused the connection: ${s.discordError}`);
      console.log("Check that the Discord desktop app is running and the ID is correct.");
      return;
    }
  }
  console.log("Saved. Waiting for the Discord desktop app; it will connect once Discord is running.");
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
    case "client-id": {
      const id = (arg ?? (await askClientId())).trim();
      checkClientId(id);
      saveConfig({ clientId: id });
      if (!(await send("refresh"))) start();
      await waitForDiscord();
      return;
    }
    case "hide":
    case "unhide": {
      if (!arg) throw new Error(`Usage: ${cmd} <project folder name>`);
      const others = loadConfig().hiddenProjects.filter((p) => p.toLowerCase() !== arg.toLowerCase());
      saveConfig({ hiddenProjects: cmd === "hide" ? [...others, arg] : others });
      await send("refresh");
      console.log(
        cmd === "hide" ? `File names and code size are now hidden in "${arg}".` : `"${arg}" shows file names and code size again.`,
      );
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
