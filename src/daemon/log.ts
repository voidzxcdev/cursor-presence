import { appendFileSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { HOME_DIR, LOG_PATH } from "../shared";

const MAX_BYTES = 256 * 1024;

export function log(message: string): void {
  try {
    mkdirSync(HOME_DIR, { recursive: true });
    if ((statSync(LOG_PATH, { throwIfNoEntry: false })?.size ?? 0) > MAX_BYTES) writeFileSync(LOG_PATH, "");
    appendFileSync(LOG_PATH, `${new Date().toISOString()} ${message}\n`);
  } catch {
    // Logging must never take the companion down.
  }
}
