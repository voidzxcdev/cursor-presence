import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { APP_DIR, HOME_DIR, HOOKS_JSON, readHooksConfig, withOurHooks, writeHooksConfig } from "./hooks-config.mjs";
import { stopDaemon } from "./daemon-control.mjs";

const CONFIG_PATH = path.join(HOME_DIR, "config.json");
const files = ["hook.cjs", "daemon.cjs", "ctl.cjs"];

for (const f of files) {
  if (!existsSync(path.join("dist", f))) throw new Error(`dist/${f} is missing; run "npm run build" first.`);
}

const hooks = withOurHooks(readHooksConfig());

await stopDaemon();
await mkdir(APP_DIR, { recursive: true });
for (const f of files) await copyFile(path.join("dist", f), path.join(APP_DIR, f));

const { DEFAULT_CONFIG } = await import(new URL("../src/shared.ts", import.meta.url));
let current = {};
try {
  current = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
} catch {}
const known = Object.fromEntries(Object.entries(current).filter(([key]) => key in DEFAULT_CONFIG));
const config = { ...DEFAULT_CONFIG, ...known };
await writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);

await writeHooksConfig(hooks);

const ctl = path.join(APP_DIR, "ctl.cjs");
if (process.platform === "win32") execFileSync(process.execPath, [ctl, "autostart", "on"], { stdio: "ignore" });

spawn(process.execPath, [path.join(APP_DIR, "daemon.cjs")], {
  detached: true,
  stdio: "ignore",
  windowsHide: true,
}).unref();

console.log(`Installed to ${APP_DIR}`);
console.log(`Hooks registered in ${HOOKS_JSON}`);
if (process.platform === "win32") console.log("Starts with Windows and goes live whenever Cursor is open.");
console.log(`Settings: ${CONFIG_PATH}`);
if (!config.clientId) {
  console.log(`\nNext, set your Discord Application ID:\n  node "${ctl}" client-id`);
}
