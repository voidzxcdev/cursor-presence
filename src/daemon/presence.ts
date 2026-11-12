import type { SetActivity } from "@xhayper/discord-rpc";
import { languageForFile, type StatusKey } from "../catalog";
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

const ROTATE_MS = 20_000;

export interface Snapshot {
  config: Config;
  session: SessionRecord | null;
  workspace: WorkspaceRecord | null;
  codeChars: number | null;
  idle: boolean;
  /** When the current Cursor session began, for the elapsed timer outside agent runs. */
  since: number;
  now: number;
}

export function projectRoot(s: Snapshot): string | null {
  const root = s.session?.root ?? s.workspace?.root ?? null;
  return root ? normalizePath(root) : null;
}

function image(config: Config, size: "lg" | "sm", key: string): string {
  const base = config.assetBaseUrl.endsWith("/") ? config.assetBaseUrl : `${config.assetBaseUrl}/`;
  return `${base}${size}/${key}.png`;
}

const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");

/** Builds what Discord shows. Everything here has already passed the privacy rules. */
export function buildActivity(s: Snapshot): SetActivity | null {
  const { config, session, workspace, now } = s;
  const root = projectRoot(s);
  const project = root ? baseName(root) : null;
  const hidden = !!project && isHiddenProject(project, config);
  const projectLabel = project && config.showProjectName ? (hidden ? "a private project" : project) : null;
  const size = config.showCodeSize && !hidden && s.codeChars ? formatChars(s.codeChars) : null;

  const base: SetActivity = {
    name: "Cursor",
    type: 0,
    statusDisplayType: config.memberListShows === "activity" ? 2 : 0,
  };

  let a: SetActivity;

  if (s.idle) {
    if (config.idleAction === "clear") return null;
    a = {
      ...base,
      details: "Idle",
      state: projectLabel ?? undefined,
      largeImageKey: image(config, "lg", "idle"),
      largeImageText: "Idle",
      smallImageKey: image(config, "sm", "cursor"),
      smallImageText: "Cursor",
    };
  } else if (session && config.showAgent) {
    const phase: StatusKey = session.phase === "starting" ? "working" : session.phase;
    const model = config.showModel ? describeModel(session.model, session.modelId) : null;
    const rawFile = config.showAgentFile && !hidden && (phase === "reading" || phase === "editing") ? session.file : null;
    const isSecret = !!rawFile && isProtectedFile(rawFile, config);
    const lang = rawFile && !isSecret ? languageForFile(rawFile) : undefined;
    const target = rawFile ? (isSecret ? "a protected file" : rawFile) : phase === "reading" || phase === "editing" ? "code" : null;

    const withModel = join(model?.label, projectLabel);
    const withSize = join(projectLabel, size);
    const showSize = !!size && Math.floor(now / ROTATE_MS) % 2 === 1;

    a = {
      ...base,
      details: join(PHASE_TEXT[phase] + (target ? ` ${target}` : "")),
      state: (showSize ? withSize : withModel) || undefined,
      largeImageKey: image(config, "lg", lang?.key ?? phase),
      largeImageText: lang?.name ?? PHASE_TEXT[phase],
      smallImageKey: image(config, "sm", model?.provider ?? "cursor"),
      smallImageText: model ? `Agent · ${model.label}` : "Cursor Agent",
      startTimestamp: session.startedAt,
    };
  } else {
    const recent = workspace?.file && now - workspace.fileAt < config.idleMinutes * 60_000 ? workspace.file : null;
    const lang = recent && !isProtectedFile(recent, config) ? languageForFile(recent) : undefined;
    a = {
      ...base,
      details: recent ? `Writing ${lang?.name ?? "code"}` : projectLabel ? `Working on ${projectLabel}` : "In Cursor",
      state: (recent ? join(projectLabel, size) : size) || undefined,
      largeImageKey: image(config, "lg", lang?.key ?? "cursor"),
      largeImageText: lang?.name ?? "Cursor",
      smallImageKey: lang ? image(config, "sm", "cursor") : undefined,
      smallImageText: lang ? "Cursor" : undefined,
      startTimestamp: s.since || undefined,
    };
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
