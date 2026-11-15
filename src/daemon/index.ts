import { existsSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import {
  PIPE_PATH,
  STATE_DIR,
  STATUS_PATH,
  WORKSPACE_PATH,
  loadConfig,
  readJson,
  writeJsonAtomic,
  type SessionRecord,
  type WorkspaceRecord,
} from "../shared";
import { CodeCounter } from "./codeCounter";
import { cursorLaunchedAt, isCursorRunning } from "./cursorWatch";
import { DiscordLink } from "./discord";
import { log } from "./log";
import { buildActivity, projectRoot, type Snapshot } from "./presence";

const TICK_MS = 5_000;
const AGENT_STALE_MS = 3 * 60_000;
const FINISHED_SHOW_MS = 3 * 60_000;
const SESSION_TTL_MS = 12 * 60 * 60_000;
const RECOUNT_MS = 10 * 60_000;
/** Two missed checks in a row means Cursor actually closed. A failed check does not count. */
const CURSOR_CHECK_MS = 5_000;

const TERMINAL = new Set(["done", "stopped", "error"]);
/** Minimum time an action stays on the card before a passing "thinking" replaces it. */
const DWELL_MS = 2_500;
const BRIEF = new Set(["thinking", "responding", "starting"]);

const discord = new DiscordLink();
const counter = new CodeCounter();
let refreshTimer: NodeJS.Timeout | null = null;
let recountTimer: NodeJS.Timeout | null = null;
/** When Cursor itself launched; every card counts from here so the timer never resets mid-session. */
let cursorLaunched = 0;
let cursorMisses = 0;
let shown: { id: string; phase: SessionRecord["phase"]; file: string | null; at: number } | null = null;
const startedAt = Date.now();
let lastStatus = "";
let shuttingDown = false;

function readSessions(now: number): SessionRecord[] {
  const sessions: SessionRecord[] = [];
  let names: string[] = [];
  try {
    names = readdirSync(STATE_DIR);
  } catch {
    return sessions;
  }
  for (const name of names) {
    const file = path.join(STATE_DIR, name);
    if (name.endsWith(".tmp") || name.endsWith(".stale")) {
      try {
        if (now - statSync(file).mtimeMs > 60_000) unlinkSync(file);
      } catch {}
      continue;
    }
    if (!name.startsWith("session-") || !name.endsWith(".json")) continue;
    const s = readJson<SessionRecord>(file);
    if (!s) continue;
    if (now - s.updatedAt > SESSION_TTL_MS) {
      try {
        unlinkSync(file);
      } catch {}
      continue;
    }
    sessions.push(s);
  }
  return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
}

function pickSession(sessions: SessionRecord[], now: number): SessionRecord | null {
  const active = sessions.find(
    (s) => !s.ended && s.phase !== "starting" && !TERMINAL.has(s.phase) && now - s.updatedAt < AGENT_STALE_MS,
  );
  if (active) return active;
  return sessions.find((s) => TERMINAL.has(s.phase) && now - s.updatedAt < FINISHED_SHOW_MS) ?? null;
}

/**
 * Between tool calls the agent flashes "thinking" for a moment; hold the last action on screen
 * for a beat so the card reads as a steady stream instead of flickering back and forth.
 */
function steady(session: SessionRecord | null, now: number): SessionRecord | null {
  if (!session) {
    shown = null;
    return null;
  }
  const transient = session.phase === "thinking" || session.phase === "responding";
  if (shown && shown.id === session.id && transient && !BRIEF.has(shown.phase) && now - shown.at < DWELL_MS) {
    setTimeout(() => scheduleRefresh(0), DWELL_MS - (now - shown.at) + 30);
    return { ...session, phase: shown.phase, file: shown.file };
  }
  if (!shown || shown.id !== session.id || shown.phase !== session.phase || shown.file !== session.file) {
    shown = { id: session.id, phase: session.phase, file: session.file, at: now };
  }
  return session;
}

async function writeStatus(fields: Record<string, unknown>): Promise<void> {
  const status = JSON.stringify({ running: true, pid: process.pid, ...fields });
  if (status === lastStatus) return;
  lastStatus = status;
  await writeJsonAtomic(STATUS_PATH, { ...JSON.parse(status), updatedAt: Date.now() }).catch(() => {});
}

async function refresh(): Promise<void> {
  if (shuttingDown) return;
  const config = loadConfig();
  const now = Date.now();
  discord.configure(config.clientId);
  discord.tick();

  const sessions = readSessions(now);
  const saved = readJson<WorkspaceRecord>(WORKSPACE_PATH);
  // A project remembered from before Cursor was last launched is not what's open now.
  const workspace = saved && saved.updatedAt >= cursorLaunched ? saved : null;
  const session = steady(pickSession(sessions, now), now);
  if (!cursorLaunched) {
    discord.set(null);
    await writeStatus({
      paused: config.paused,
      cursorOpen: false,
      clientIdSet: !!config.clientId,
      discordConnected: discord.connected,
      discordError: discord.lastError,
      activity: null,
    });
    return;
  }

  const anchor = cursorLaunched || startedAt;
  const lastActivity = Math.max(workspace?.updatedAt ?? 0, sessions[0]?.updatedAt ?? 0, anchor);
  const busy = !!session && !TERMINAL.has(session.phase);

  const snapshot: Snapshot = {
    config,
    session,
    workspace,
    codeChars: null,
    idle: !busy && now - lastActivity > config.idleMinutes * 60_000,
    since: anchor,
    now,
  };
  const root = projectRoot(snapshot);
  counter.setRoot(root && existsSync(root) ? root : null);
  snapshot.codeChars = counter.total;

  const activity = config.paused ? null : buildActivity(snapshot);
  discord.set(activity);

  await writeStatus({
    paused: config.paused,
    cursorOpen: true,
    clientIdSet: !!config.clientId,
    discordConnected: discord.connected,
    discordError: discord.lastError,
    activity,
  });
}

function scheduleRefresh(delay = 40): void {
  if (refreshTimer) return;
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void refresh().catch((err) => log(`refresh failed: ${err}`));
  }, delay);
}

function scheduleRecount(): void {
  if (recountTimer) clearTimeout(recountTimer);
  recountTimer = setTimeout(() => {
    recountTimer = null;
    void counter.recount().then(() => scheduleRefresh());
  }, 8_000);
}

function onMessage(line: string): void {
  const msg = line.trim();
  if (!msg) return;
  if (msg === "quit") {
    void shutdown("asked to quit");
    return;
  }
  if (msg === "ping") return;
  if (msg === "afterFileEdit" || msg === "afterTabFileEdit" || msg === "recount") scheduleRecount();
  scheduleRefresh();
}

async function checkCursor(): Promise<void> {
  if (shuttingDown) return;
  const running = await isCursorRunning();
  if (running === null) {
    // tasklist failed; leaving the card alone is safer than clearing it.
  } else if (running) {
    cursorMisses = 0;
    if (!cursorLaunched) {
      cursorLaunched = (await cursorLaunchedAt()) ?? Date.now();
      log(`Cursor is running (launched ${new Date(cursorLaunched).toISOString()})`);
      scheduleRefresh(0);
    }
  } else if (cursorLaunched && ++cursorMisses >= 2) {
    log("Cursor closed; presence cleared until it opens again");
    cursorLaunched = 0;
    cursorMisses = 0;
    shown = null;
    scheduleRefresh(0);
  }
  setTimeout(() => void checkCursor(), CURSOR_CHECK_MS);
}

async function shutdown(reason: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`shutting down: ${reason}`);
  await discord.teardown();
  await writeJsonAtomic(STATUS_PATH, { running: false, updatedAt: Date.now() }).catch(() => {});
  process.exit(0);
}

function listen(): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer((socket) => {
      let buf = "";
      socket.setEncoding("utf8");
      socket.on("data", (chunk) => {
        buf += chunk;
        let i: number;
        while ((i = buf.indexOf("\n")) !== -1) {
          onMessage(buf.slice(0, i));
          buf = buf.slice(i + 1);
        }
      });
      socket.on("end", () => onMessage(buf));
      socket.on("error", () => {});
    });
    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE" && process.platform !== "win32") {
        // A socket file left by a crash; take it over only if nobody answers on it.
        const probe = net.connect(PIPE_PATH);
        probe.on("connect", () => {
          probe.destroy();
          resolve(false);
        });
        probe.on("error", () => {
          try {
            unlinkSync(PIPE_PATH);
          } catch {}
          server.listen(PIPE_PATH, () => resolve(true));
        });
        return;
      }
      resolve(false);
    });
    server.listen(PIPE_PATH, () => resolve(true));
  });
}

async function main(): Promise<void> {
  await mkdir(STATE_DIR, { recursive: true });
  if (!(await listen())) process.exit(0);
  log(`started (pid ${process.pid})`);

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("uncaughtException", (err) => log(`uncaught: ${err?.stack ?? err}`));
  process.on("unhandledRejection", (err) => log(`unhandled: ${err}`));

  // Learn Cursor's launch time before the first update so the timer starts out right.
  await checkCursor();
  setInterval(() => scheduleRefresh(0), TICK_MS);
  setInterval(() => void counter.recount().then(() => scheduleRefresh()), RECOUNT_MS);
}

void main();
