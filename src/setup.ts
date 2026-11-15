import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { APP_DIR, CONFIG_PATH, DEFAULT_CONFIG, STATE_DIR, sendToDaemon } from "./shared";

const HOOKS_JSON = path.join(os.homedir(), ".cursor", "hooks.json");
const FILES = ["hook.cjs", "daemon.cjs", "ctl.cjs", "setup.cjs"];
const EVENTS = [
  "workspaceOpen",
  "sessionStart",
  "sessionEnd",
  "beforeSubmitPrompt",
  "afterAgentThought",
  "postToolUse",
  "postToolUseFailure",
  "afterFileEdit",
  "afterAgentResponse",
  "preCompact",
  "stop",
  "afterTabFileEdit",
];

type HooksConfig = { version?: number; hooks: Record<string, unknown> };

const isOurs = (entry: unknown) =>
  typeof (entry as { command?: unknown })?.command === "string" &&
  (entry as { command: string }).command.includes(".cursor-presence");

function readHooks(): HooksConfig {
  if (!existsSync(HOOKS_JSON)) return { version: 1, hooks: {} };
  let parsed: HooksConfig;
  try {
    parsed = JSON.parse(readFileSync(HOOKS_JSON, "utf8"));
  } catch {
    throw new Error(`${HOOKS_JSON} is not valid JSON; fix it first so your existing hooks aren't lost.`);
  }
  parsed.version ??= 1;
  parsed.hooks ??= {};
  return parsed;
}

function writeHooks(config: HooksConfig): void {
  mkdirSync(path.dirname(HOOKS_JSON), { recursive: true });
  writeFileSync(HOOKS_JSON, `${JSON.stringify(config, null, 2)}\n`);
}

function withoutOurs(config: HooksConfig): HooksConfig {
  for (const [event, list] of Object.entries(config.hooks)) {
    if (!Array.isArray(list)) continue;
    const kept = list.filter((entry) => !isOurs(entry));
    if (kept.length) config.hooks[event] = kept;
    else delete config.hooks[event];
  }
  return config;
}

function withOurs(config: HooksConfig): HooksConfig {
  withoutOurs(config);
  const script = path.join(APP_DIR, "hook.cjs").replaceAll("\\", "/");
  const target = /\s/.test(script) ? `"${script}"` : script;
  for (const event of EVENTS) {
    const list = Array.isArray(config.hooks[event]) ? (config.hooks[event] as unknown[]) : [];
    list.push({ command: `node ${target} ${event}`, timeout: 5 });
    config.hooks[event] = list;
  }
  return config;
}

async function stopDaemon(): Promise<void> {
  if (!(await sendToDaemon("quit"))) return;
  for (let i = 0; i < 20 && (await sendToDaemon("ping")); i++) await new Promise((r) => setTimeout(r, 150));
}

async function install(): Promise<void> {
  for (const f of FILES) {
    if (!existsSync(path.join(__dirname, f))) throw new Error(`${f} is missing next to setup.cjs.`);
  }
  const hooks = withOurs(readHooks());

  await stopDaemon();
  mkdirSync(APP_DIR, { recursive: true });
  if (path.resolve(__dirname) !== path.resolve(APP_DIR)) {
    for (const f of FILES) copyFileSync(path.join(__dirname, f), path.join(APP_DIR, f));
  }

  let current: Record<string, unknown> = {};
  try {
    current = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch {}
  const known = Object.fromEntries(Object.entries(current).filter(([key]) => key in DEFAULT_CONFIG));
  const config = { ...DEFAULT_CONFIG, ...known };
  writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
  writeHooks(hooks);

  removeAutostart();
  spawn(process.execPath, [path.join(APP_DIR, "daemon.cjs")], { detached: true, stdio: "ignore", windowsHide: true }).unref();
  console.log("Installed. The presence runs only while Cursor is open, and the process exits when Cursor closes.");

  const ctl = path.join(APP_DIR, "ctl.cjs");
  if (config.clientId) return;
  if (process.stdin.isTTY) {
    spawnSync(process.execPath, [ctl, "client-id"], { stdio: "inherit" });
  } else {
    console.log(`Next, set your Discord Application ID:\n  node "${ctl}" client-id`);
  }
}

const RUN_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const RUN_VALUE = "cursor-presence";

function removeAutostart(): void {
  if (process.platform !== "win32") return;
  spawnSync("reg", ["delete", RUN_KEY, "/v", RUN_VALUE, "/f"], { windowsHide: true });
}

async function uninstall(): Promise<void> {
  writeHooks(withoutOurs(readHooks()));
  removeAutostart();
  await stopDaemon();
  rmSync(APP_DIR, { recursive: true, force: true });
  rmSync(STATE_DIR, { recursive: true, force: true });
  console.log(`Uninstalled. Your settings stay in ${CONFIG_PATH}.`);
}

const command = process.argv[2];
(command === "install" ? install() : command === "uninstall" ? uninstall() : Promise.reject(new Error("Usage: setup <install|uninstall>"))).catch(
  (err: Error) => {
    console.error(err.message);
    process.exit(1);
  },
);
