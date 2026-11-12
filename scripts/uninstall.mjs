import { execFileSync } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";
import { stopDaemon } from "./daemon-control.mjs";
import { APP_DIR, HOME_DIR, HOOKS_JSON, readHooksConfig, withoutOurHooks, writeHooksConfig } from "./hooks-config.mjs";

await writeHooksConfig(withoutOurHooks(readHooksConfig()));
if (process.platform === "win32") {
  try {
    execFileSync("reg", ["delete", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run", "/v", "CursorPresence", "/f"], {
      stdio: "ignore",
    });
  } catch {}
}
await stopDaemon();
await rm(APP_DIR, { recursive: true, force: true });
await rm(path.join(HOME_DIR, "state"), { recursive: true, force: true });

console.log(`Removed the presence hooks from ${HOOKS_JSON} and the companion from ${APP_DIR}.`);
console.log(`Your settings are kept in ${path.join(HOME_DIR, "config.json")}.`);
