import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { open, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { LANGUAGES, languageForFile } from "../catalog";
import { log } from "./log";

const MAX_FILE_BYTES = 1024 * 1024;
const MAX_FILES = 60_000;
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".turbo",
  ".cache",
  "target",
  "vendor",
  ".venv",
  "venv",
  "__pycache__",
  "coverage",
  ".gradle",
  "Pods",
]);
const SKIP_FILES = /(^|[\\/])(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|Cargo\.lock|poetry\.lock|composer\.lock|Gemfile\.lock|go\.sum)$|\.min\.(js|css)$|\.map$/i;
const NOT_CODE = new Set(LANGUAGES.filter((l) => l.notCode).map((l) => l.key));

interface Entry {
  mtimeMs: number;
  size: number;
  chars: number;
}

function isCode(file: string): boolean {
  if (SKIP_FILES.test(file)) return false;
  const lang = languageForFile(path.basename(file));
  return !!lang && !NOT_CODE.has(lang.key);
}

function gitFiles(root: string): Promise<string[] | null> {
  if (!existsSync(path.join(root, ".git"))) return Promise.resolve(null);
  return new Promise((resolve) => {
    execFile(
      "git",
      ["-C", root, "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
      { maxBuffer: 64 * 1024 * 1024, windowsHide: true },
      (err, stdout) => resolve(err ? null : stdout.split("\0").filter(Boolean)),
    );
  });
}

async function walk(root: string): Promise<string[]> {
  const found: string[] = [];
  const queue = [""];
  while (queue.length && found.length < MAX_FILES) {
    const rel = queue.shift()!;
    let entries;
    try {
      entries = await readdir(path.join(root, rel), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const child = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name) && !e.name.startsWith(".")) queue.push(child);
      } else if (e.isFile()) found.push(child);
    }
  }
  return found;
}

async function countChars(file: string, size: number): Promise<number> {
  const handle = await open(file, "r");
  try {
    const buf = Buffer.alloc(size);
    await handle.read(buf, 0, size, 0);
    if (buf.subarray(0, 8000).includes(0)) return 0;
    return buf.toString("utf8").length;
  } finally {
    await handle.close();
  }
}

/** Counts characters across a project's source files, re-reading only files that changed. */
export class CodeCounter {
  private root: string | null = null;
  private cache = new Map<string, Entry>();
  private running: Promise<void> | null = null;
  private again = false;
  total: number | null = null;

  setRoot(root: string | null): void {
    if (root === this.root) return;
    this.root = root;
    this.cache.clear();
    this.total = null;
    if (root) void this.recount();
  }

  recount(): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = this.run().finally(() => {
      this.running = null;
      if (this.again) {
        this.again = false;
        void this.recount();
      }
    });
    return this.running;
  }

  private async run(): Promise<void> {
    const root = this.root;
    if (!root || !existsSync(root)) return;
    const started = Date.now();
    const listed = (await gitFiles(root)) ?? (await walk(root));
    const files = listed.filter(isCode).slice(0, MAX_FILES);
    const next = new Map<string, Entry>();
    let total = 0;

    for (let i = 0; i < files.length; i += 64) {
      await Promise.all(
        files.slice(i, i + 64).map(async (rel) => {
          const abs = path.join(root, rel);
          try {
            const st = await stat(abs);
            if (!st.isFile() || st.size > MAX_FILE_BYTES) return;
            const prev = this.cache.get(rel);
            const chars =
              prev && prev.mtimeMs === st.mtimeMs && prev.size === st.size ? prev.chars : await countChars(abs, st.size);
            next.set(rel, { mtimeMs: st.mtimeMs, size: st.size, chars });
            total += chars;
          } catch {
            // Deleted or locked mid-scan.
          }
        }),
      );
      if (this.root !== root) return;
    }

    this.cache = next;
    this.total = total;
    log(`counted ${next.size} files in ${Date.now() - started}ms`);
  }
}

export function formatChars(n: number): string {
  if (n < 1000) return `${n} chars`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K chars`;
  return `${(n / 1_000_000).toFixed(n < 10_000_000 ? 2 : 1)}M chars`;
}
