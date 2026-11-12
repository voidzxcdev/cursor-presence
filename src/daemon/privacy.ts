import type { Config } from "../shared";

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i");
}

let cachedPatterns: string[] = [];
let cachedRegs: RegExp[] = [];

function protectedRegs(config: Config): RegExp[] {
  if (config.protectedFilePatterns !== cachedPatterns) {
    cachedPatterns = config.protectedFilePatterns;
    cachedRegs = cachedPatterns.map(globToRegExp);
  }
  return cachedRegs;
}

export function isProtectedFile(fileName: string, config: Config): boolean {
  return protectedRegs(config).some((re) => re.test(fileName));
}

export function isHiddenProject(name: string, config: Config): boolean {
  const lower = name.toLowerCase();
  return config.hiddenProjects.some((p) => p.toLowerCase() === lower);
}

/** Discord rejects fields over 128 characters; also guards against odd control characters. */
export function clean(text: string, max = 128): string {
  const flat = text.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
