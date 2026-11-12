import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import net from "node:net";
import path from "node:path";
import type { StatusKey } from "./catalog";
import {
  PIPE_PATH,
  STATE_DIR,
  WORKSPACE_PATH,
  baseName,
  normalizePath,
  readJson,
  writeJsonAtomic,
  type SessionRecord,
  type WorkspaceRecord,
} from "./shared";

// Cursor hands every hook the full event: prompts, tool inputs, file contents, user_email.
// Only the handful of fields read below are ever written to disk.

type HookInput = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

function respond(event: string | null): Promise<void> {
  const body = event === "beforeSubmitPrompt" ? '{"continue":true}' : "{}";
  return new Promise((resolve) => process.stdout.write(body, () => resolve()));
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(data));
    setTimeout(() => resolve(data), 1500);
  });
}

function phaseForTool(name: string): StatusKey {
  if (/^MCP:/i.test(name)) return "tools";
  const n = name.toLowerCase();
  if (/shell|terminal|bash|command|await/.test(n)) return "running";
  if (/todo|plan/.test(n)) return "planning";
  if (/task|subagent|agent/.test(n)) return "delegating";
  if (/write|edit|replace|delete|patch|notebook/.test(n)) return "editing";
  if (/grep|glob|search|find|fetch|list/.test(n)) return "searching";
  if (/read|lint|view/.test(n)) return "reading";
  return "working";
}

function toolFile(input: HookInput): string | null {
  const toolInput = input.tool_input;
  if (!toolInput || typeof toolInput !== "object") return null;
  const t = toolInput as Record<string, unknown>;
  const p = str(t.path) ?? str(t.file_path) ?? str(t.target_file) ?? str(t.filePath) ?? str(t.target_notebook);
  return p ? baseName(p) : null;
}

function firstRoot(input: HookInput): string | null {
  const root = Array.isArray(input.workspace_roots) ? str(input.workspace_roots[0]) : null;
  return root ? normalizePath(root) : null;
}

async function recordWorkspace(input: HookInput, file: string | null): Promise<void> {
  const root = firstRoot(input) ?? str(process.env.CURSOR_PROJECT_DIR);
  if (!root) return;
  const now = Date.now();
  const prev = readJson<WorkspaceRecord>(WORKSPACE_PATH);
  const same = prev?.root === root;
  const next: WorkspaceRecord = {
    v: 1,
    root,
    file: file ?? (same ? prev.file : null),
    fileAt: file ? now : same ? prev.fileAt : 0,
    openedAt: same ? prev.openedAt : now,
    updatedAt: now,
  };
  await writeJsonAtomic(WORKSPACE_PATH, next);
}

async function recordAgent(event: string, input: HookInput): Promise<void> {
  const conversation = str(input.conversation_id) ?? str(input.session_id);
  if (!conversation) return;
  const id = createHash("sha256").update(conversation).digest("hex").slice(0, 16);
  const file = path.join(STATE_DIR, `session-${id}.json`);
  const now = Date.now();
  const prev = readJson<SessionRecord>(file);
  const s: SessionRecord = prev ?? {
    v: 1,
    id,
    root: null,
    model: null,
    modelId: null,
    phase: "starting",
    file: null,
    startedAt: now,
    updatedAt: now,
    ended: false,
  };

  s.root = firstRoot(input) ?? s.root;
  s.model = str(input.model) ?? s.model;
  s.modelId = str(input.model_id) ?? s.modelId;
  s.updatedAt = now;
  s.ended = false;

  const idle = s.phase === "starting" || s.phase === "done" || s.phase === "stopped" || s.phase === "error";

  switch (event) {
    case "sessionStart":
      break;
    case "beforeSubmitPrompt":
      if (idle) s.startedAt = now;
      s.phase = "thinking";
      s.file = null;
      break;
    case "afterAgentThought":
      s.phase = "thinking";
      break;
    case "postToolUse":
    case "postToolUseFailure": {
      const tool = str(input.tool_name) ?? "";
      s.phase = phaseForTool(tool);
      s.file = s.phase === "reading" || s.phase === "editing" ? toolFile(input) ?? s.file : null;
      break;
    }
    case "afterFileEdit": {
      const p = str(input.file_path);
      s.phase = "editing";
      s.file = p ? baseName(p) : s.file;
      break;
    }
    case "afterAgentResponse":
      s.phase = "responding";
      break;
    case "preCompact":
      s.phase = "compacting";
      break;
    case "stop": {
      const status = str(input.status);
      s.phase = status === "error" ? "error" : status === "aborted" ? "stopped" : "done";
      s.file = null;
      break;
    }
    case "sessionEnd":
      s.ended = true;
      s.file = null;
      break;
    default:
      return;
  }

  await writeJsonAtomic(file, s);
}

function nudgeDaemon(event: string): Promise<void> {
  return new Promise((resolve) => {
    const socket = net.connect(PIPE_PATH);
    const done = () => {
      socket.destroy();
      resolve();
    };
    socket.setTimeout(400, done);
    socket.on("connect", () => socket.end(`${event}\n`, done));
    socket.on("error", () => {
      const daemon = path.join(__dirname, "daemon.cjs");
      spawn(process.execPath, [daemon], { detached: true, stdio: "ignore", windowsHide: true }).unref();
      resolve();
    });
  });
}

async function main(): Promise<void> {
  const raw = await readStdin();
  let input: HookInput = {};
  try {
    input = JSON.parse(raw) as HookInput;
  } catch {
    // Nothing usable; still answer so Cursor carries on.
  }
  const event = str(input.hook_event_name) ?? str(process.argv[2]);
  await respond(event);
  if (!event) return;

  if (event === "workspaceOpen") await recordWorkspace(input, null);
  else if (event === "afterTabFileEdit") {
    const p = str(input.file_path);
    await recordWorkspace(input, p ? baseName(p) : null);
  } else await recordAgent(event, input);

  await nudgeDaemon(event);
}

setTimeout(() => process.exit(0), 3000);
main()
  .catch(() => {})
  .finally(() => process.exit(0));
