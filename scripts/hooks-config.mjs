import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const HOME_DIR = path.join(os.homedir(), ".cursor-presence");
export const APP_DIR = path.join(HOME_DIR, "app");
export const HOOKS_JSON = path.join(os.homedir(), ".cursor", "hooks.json");

export const EVENTS = [
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

const isOurs = (entry) => typeof entry?.command === "string" && entry.command.includes(".cursor-presence");

export function readHooksConfig() {
  if (!existsSync(HOOKS_JSON)) return { version: 1, hooks: {} };
  const text = readFileSync(HOOKS_JSON, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${HOOKS_JSON} is not valid JSON; fix it first so existing hooks aren't lost.`);
  }
  parsed.version ??= 1;
  parsed.hooks ??= {};
  return parsed;
}

export async function writeHooksConfig(config) {
  await mkdir(path.dirname(HOOKS_JSON), { recursive: true });
  await writeFile(HOOKS_JSON, `${JSON.stringify(config, null, 2)}\n`);
}

export function withoutOurHooks(config) {
  for (const [event, list] of Object.entries(config.hooks)) {
    if (!Array.isArray(list)) continue;
    const kept = list.filter((entry) => !isOurs(entry));
    if (kept.length) config.hooks[event] = kept;
    else delete config.hooks[event];
  }
  return config;
}

export function withOurHooks(config) {
  withoutOurHooks(config);
  const script = path.join(APP_DIR, "hook.cjs").replaceAll("\\", "/");
  const target = /\s/.test(script) ? `"${script}"` : script;
  for (const event of EVENTS) {
    const list = Array.isArray(config.hooks[event]) ? config.hooks[event] : [];
    list.push({ command: `node ${target} ${event}`, timeout: 5 });
    config.hooks[event] = list;
  }
  return config;
}
