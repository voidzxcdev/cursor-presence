import { readFileSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { StatusKey } from "./catalog";

export const HOME_DIR = path.join(os.homedir(), ".cursor-presence");
export const STATE_DIR = path.join(HOME_DIR, "state");
export const CONFIG_PATH = path.join(HOME_DIR, "config.json");
export const STATUS_PATH = path.join(HOME_DIR, "status.json");
export const LOG_PATH = path.join(HOME_DIR, "daemon.log");
export const WORKSPACE_PATH = path.join(STATE_DIR, "workspace.json");

const user = os.userInfo().username.replace(/[^\w.-]/g, "_");
export const PIPE_PATH =
  process.platform === "win32" ? `\\\\.\\pipe\\cursor-presence-${user}` : path.join(HOME_DIR, "daemon.sock");

/** One agent conversation, as written by the hook. Holds no prompts, commands, or contents. */
export interface SessionRecord {
  v: 1;
  id: string;
  /** Local only, used for counting code; never sent to Discord. */
  root: string | null;
  model: string | null;
  modelId: string | null;
  phase: StatusKey | "starting";
  /** Base name only. */
  file: string | null;
  startedAt: number;
  updatedAt: number;
  ended: boolean;
}

export interface WorkspaceRecord {
  v: 1;
  root: string;
  /** Base name of the last file you edited with Tab. */
  file: string | null;
  fileAt: number;
  openedAt: number;
  updatedAt: number;
}

export interface Config {
  clientId: string;
  assetBaseUrl: string;
  paused: boolean;
  showProjectName: boolean;
  showCodeSize: boolean;
  showAgent: boolean;
  showAgentFile: boolean;
  showModel: boolean;
  hiddenProjects: string[];
  protectedFilePatterns: string[];
  idleMinutes: number;
  idleAction: "show" | "clear";
  memberListShows: "app" | "activity";
}

export const DEFAULT_CONFIG: Config = {
  clientId: "",
  assetBaseUrl: "https://raw.githubusercontent.com/voidzxcdev/cursor-presence/main/assets/png/",
  paused: false,
  showProjectName: true,
  showCodeSize: true,
  showAgent: true,
  showAgentFile: true,
  showModel: true,
  hiddenProjects: [],
  protectedFilePatterns: [
    ".env*",
    "*.pem",
    "*.key",
    "*.p12",
    "*.pfx",
    "*.keystore",
    "*secret*",
    "*credential*",
    "*password*",
    "*token*",
    "id_rsa*",
    "id_ed25519*",
    ".npmrc",
    ".netrc",
    ".pypirc",
  ],
  idleMinutes: 5,
  idleAction: "show",
  memberListShows: "app",
};

export function loadConfig(): Config {
  try {
    const parsed = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

export async function writeJsonAtomic(file: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const body = JSON.stringify(data, null, 2);
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, body);
  try {
    await rename(tmp, file);
  } catch {
    // Windows refuses to replace a file another process has open; a direct write is fine here.
    await writeFile(file, body);
    await rename(tmp, `${tmp}.stale`).catch(() => {});
  }
}

export function baseName(p: string): string {
  return p.split(/[\\/]/).filter(Boolean).pop() ?? p;
}
