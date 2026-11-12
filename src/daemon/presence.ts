import type { SetActivity } from "@xhayper/discord-rpc";
import { ASSET_VERSION, languageForFile, type StatusKey } from "../catalog";
import { baseName, normalizePath, type Config, type SessionRecord, type WorkspaceRecord } from "../shared";
import { formatChars } from "./codeCounter";
import { describeModel } from "./models";
import { clean, isHiddenProject, isProtectedFile } from "./privacy";

const PHASE_TEXT: Record<StatusKey, string> = {
  thinking: "Thinking",
  reading: "Reading",
  searching: "Searching the codebase",
  editing: "Editing",
  running: "Running a command",
  delegating: "Running subagents",
  tools: "Using tools",
  planning: "Planning",
  responding: "Writing a reply",
  compacting: "Compacting context",
  working: "Working",
  done: "Finished",
  stopped: "Stopped",
  error: "Hit an error",
  idle: "Idle",
};
export interface Snapshot {
  config: Config;
  session: SessionRecord | null;
  workspace: WorkspaceRecord | null;
  codeChars: number | null;
  idle: boolean;
  /** When Cursor launched; the one start time every card shares. */
  since: number;
  now: number;
}

export function projectRoot(s: Snapshot): string | null {
  const root = s.session?.root ?? s.workspace?.root ?? null;
  return root ? normalizePath(root) : null;
}

function image(config: Config, size: "lg" | "sm", key: string): string {
  const base = config.assetBaseUrl.endsWith("/") ? config.assetBaseUrl : `${config.assetBaseUrl}/`;
  return `${base}${size}/${key}.png?v=${ASSET_VERSION}`;
}

const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");

/**
 * Builds what Discord shows. Everything here has already passed the privacy rules.
 * Project and folder names are never part of it; the root is only used to count code.
 */
export function buildActivity(s: Snapshot): SetActivity | null {
  const { config, session, workspace, now } = s;
  const root = projectRoot(s);
  const hidden = !!root && isHiddenProject(baseName(root), config);
  const size = config.showCodeSize && !hidden && s.codeChars ? formatChars(s.codeChars) : null;

  const base: SetActivity = {
    name: "Cursor",
    type: 0,
    statusDisplayType: config.memberListShows === "activity" ? 2 : 0,
  };
  const recent =
    workspace?.file && now - workspace.fileAt < config.idleMinutes * 60_000 ? workspace.file : null;

  let a: SetActivity;

  if (session && config.showAgent && !s.idle) {
    const phase: StatusKey = session.phase === "starting" ? "working" : session.phase;
    const model = config.showModel ? describeModel(session.model, session.modelId) : null;
    const rawFile = config.showAgentFile && !hidden && (phase === "reading" || phase === "editing") ? session.file : null;
    const isSecret = !!rawFile && isProtectedFile(rawFile, config);
    const lang = rawFile && !isSecret ? languageForFile(rawFile) : undefined;
    const target = rawFile ? (isSecret ? "a protected file" : rawFile) : phase === "reading" || phase === "editing" ? "code" : null;

    a = {
      ...base,
      details: PHASE_TEXT[phase] + (target ? ` ${target}` : ""),
      state: join(model?.label, size) || undefined,
      largeImageKey: image(config, "lg", lang?.key ?? phase),
      largeImageText: lang?.name ?? PHASE_TEXT[phase],
      smallImageKey: image(config, "sm", model?.provider ?? "cursor"),
      smallImageText: model ? `Agent · ${model.label}` : "Cursor Agent",
      startTimestamp: s.since || undefined,
    };
  } else if (recent && !s.idle) {
    const lang = !isProtectedFile(recent, config) ? languageForFile(recent) : undefined;
    a = {
      ...base,
      details: `Writing ${lang?.name ?? "code"}`,
      state: size ? `${size} of code` : undefined,
      largeImageKey: image(config, "lg", lang?.key ?? "cursor"),
      largeImageText: lang?.name ?? "Cursor",
      smallImageKey: lang ? image(config, "sm", "cursor") : undefined,
      smallImageText: lang ? "Cursor" : undefined,
      startTimestamp: s.since || undefined,
    };
  } else {
    if (s.idle && config.idleAction === "clear") return null;
    // Nothing happening: the logo alone, still counting time in Cursor.
    return { ...base, largeImageKey: image(config, "lg", "cursor"), startTimestamp: s.since || undefined };
  }

  for (const key of ["details", "state", "largeImageText", "smallImageText"] as const) {
    const v = a[key];
    if (typeof v !== "string") continue;
    const c = clean(v);
    // Discord drops text fields shorter than two characters.
    if (c.length < 2) delete a[key];
    else a[key] = c;
  }
  return a;
}
