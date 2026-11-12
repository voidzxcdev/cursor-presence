// Shared by the companion and scripts/build-assets.mjs (run directly by Node), so keep it to
// erasable TypeScript only: no enums, namespaces, or parameter properties.

export interface IconSource {
  /** simple-icons slug */
  si?: string;
  /** monogram drawn in a monospace face */
  text?: string;
  /** key into GLYPHS */
  glyph?: string;
}

export interface LanguageDef {
  key: string;
  name: string;
  exts: string[];
  fileNames?: string[];
  icon: IconSource;
  /** excluded from the code character count */
  notCode?: boolean;
}

export const LANGUAGES: LanguageDef[] = [
  { key: "typescript", name: "TypeScript", exts: ["ts", "mts", "cts"], icon: { si: "typescript" } },
  { key: "react", name: "React", exts: ["tsx", "jsx"], icon: { si: "react" } },
  { key: "javascript", name: "JavaScript", exts: ["js", "mjs", "cjs"], icon: { si: "javascript" } },
  { key: "python", name: "Python", exts: ["py", "pyi", "pyw"], icon: { si: "python" } },
  { key: "jupyter", name: "Jupyter", exts: ["ipynb"], icon: { si: "jupyter" } },
  { key: "rust", name: "Rust", exts: ["rs"], icon: { si: "rust" } },
  { key: "go", name: "Go", exts: ["go"], icon: { si: "go" } },
  { key: "html", name: "HTML", exts: ["html", "htm"], icon: { si: "html5" } },
  { key: "css", name: "CSS", exts: ["css"], icon: { si: "css" } },
  { key: "sass", name: "Sass", exts: ["scss", "sass"], icon: { si: "sass" } },
  { key: "json", name: "JSON", exts: ["json", "jsonc", "json5"], icon: { si: "json" } },
  { key: "markdown", name: "Markdown", exts: ["md", "mdx", "markdown"], icon: { si: "markdown" }, notCode: true },
  { key: "vue", name: "Vue", exts: ["vue"], icon: { si: "vuedotjs" } },
  { key: "svelte", name: "Svelte", exts: ["svelte"], icon: { si: "svelte" } },
  { key: "astro", name: "Astro", exts: ["astro"], icon: { si: "astro" } },
  { key: "php", name: "PHP", exts: ["php"], icon: { si: "php" } },
  { key: "ruby", name: "Ruby", exts: ["rb", "erb"], fileNames: ["gemfile", "rakefile"], icon: { si: "ruby" } },
  { key: "swift", name: "Swift", exts: ["swift"], icon: { si: "swift" } },
  { key: "kotlin", name: "Kotlin", exts: ["kt", "kts"], icon: { si: "kotlin" } },
  { key: "dart", name: "Dart", exts: ["dart"], icon: { si: "dart" } },
  { key: "cpp", name: "C++", exts: ["cpp", "cc", "cxx", "hpp", "hh", "hxx"], icon: { si: "cplusplus" } },
  { key: "c", name: "C", exts: ["c", "h"], icon: { si: "c" } },
  { key: "csharp", name: "C#", exts: ["cs", "csx"], icon: { text: "C#" } },
  { key: "java", name: "Java", exts: ["java"], icon: { si: "openjdk" } },
  { key: "lua", name: "Lua", exts: ["lua", "luau"], icon: { si: "lua" } },
  { key: "shell", name: "Shell", exts: ["sh", "bash", "zsh", "fish"], icon: { si: "gnubash" } },
  { key: "powershell", name: "PowerShell", exts: ["ps1", "psm1", "psd1"], icon: { text: "PS" } },
  { key: "docker", name: "Docker", exts: ["dockerfile"], fileNames: ["dockerfile", "containerfile"], icon: { si: "docker" } },
  { key: "yaml", name: "YAML", exts: ["yml", "yaml"], icon: { si: "yaml" } },
  { key: "toml", name: "TOML", exts: ["toml"], icon: { si: "toml" } },
  { key: "graphql", name: "GraphQL", exts: ["graphql", "gql"], icon: { si: "graphql" } },
  { key: "prisma", name: "Prisma", exts: ["prisma"], icon: { si: "prisma" } },
  { key: "zig", name: "Zig", exts: ["zig"], icon: { si: "zig" } },
  { key: "elixir", name: "Elixir", exts: ["ex", "exs", "heex"], icon: { si: "elixir" } },
  { key: "haskell", name: "Haskell", exts: ["hs", "lhs"], icon: { si: "haskell" } },
  { key: "scala", name: "Scala", exts: ["scala", "sc"], icon: { si: "scala" } },
  { key: "r", name: "R", exts: ["r", "rmd"], icon: { si: "r" } },
  { key: "sql", name: "SQL", exts: ["sql", "psql"], icon: { text: "SQL" } },
  { key: "solidity", name: "Solidity", exts: ["sol"], icon: { si: "solidity" } },
  { key: "julia", name: "Julia", exts: ["jl"], icon: { si: "julia" } },
  { key: "ocaml", name: "OCaml", exts: ["ml", "mli"], icon: { si: "ocaml" } },
  { key: "clojure", name: "Clojure", exts: ["clj", "cljs", "cljc", "edn"], icon: { si: "clojure" } },
  { key: "erlang", name: "Erlang", exts: ["erl", "hrl"], icon: { si: "erlang" } },
  { key: "fsharp", name: "F#", exts: ["fs", "fsi", "fsx"], icon: { si: "fsharp" } },
  { key: "perl", name: "Perl", exts: ["pl", "pm"], icon: { si: "perl" } },
  { key: "gleam", name: "Gleam", exts: ["gleam"], icon: { si: "gleam" } },
  { key: "terraform", name: "Terraform", exts: ["tf", "tfvars", "hcl"], icon: { si: "terraform" } },
  { key: "nix", name: "Nix", exts: ["nix"], icon: { text: "NIX" } },
];

export interface ProviderDef {
  key: string;
  name: string;
  match: RegExp;
  icon: IconSource;
}

export const PROVIDERS: ProviderDef[] = [
  { key: "anthropic", name: "Anthropic", match: /claude|anthropic|opus|sonnet|haiku|fable/i, icon: { si: "claude" } },
  { key: "openai", name: "OpenAI", match: /gpt|openai|codex|^o\d/i, icon: { glyph: "openai" } },
  { key: "gemini", name: "Google", match: /gemini|gemma|google/i, icon: { si: "googlegemini" } },
  { key: "xai", name: "xAI", match: /grok|xai/i, icon: { glyph: "xai" } },
  { key: "deepseek", name: "DeepSeek", match: /deepseek/i, icon: { si: "deepseek" } },
  { key: "mistral", name: "Mistral", match: /mistral|codestral|devstral/i, icon: { si: "mistralai" } },
  { key: "qwen", name: "Qwen", match: /qwen/i, icon: { si: "qwen" } },
  { key: "moonshot", name: "Moonshot", match: /kimi|moonshot/i, icon: { si: "moonshotai" } },
  { key: "meta", name: "Meta", match: /llama|meta/i, icon: { si: "meta" } },
  { key: "cursor", name: "Cursor", match: /composer|cursor|^auto$|^default$/i, icon: { si: "cursor" } },
];

export const STATUS_KEYS = [
  "thinking",
  "reading",
  "searching",
  "editing",
  "running",
  "delegating",
  "tools",
  "planning",
  "responding",
  "compacting",
  "working",
  "done",
  "stopped",
  "error",
  "idle",
] as const;

export type StatusKey = (typeof STATUS_KEYS)[number];

/** Inner SVG markup on a 24x24 grid, stroked in the tile's foreground color. */
export const GLYPHS: Record<string, string> = {
  thinking:
    '<path d="M11 3.5l1.9 5.1 5.1 1.9-5.1 1.9L11 17.5l-1.9-5.1L4 10.5l5.1-1.9z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  reading:
    '<path d="M3 5.8c3-1.2 6-1 9 1 3-2 6-2.2 9-1v12.4c-3-1.2-6-1-9 1-3-2-6-2.2-9-1z"/><path d="M12 6.8v12.4"/>',
  searching: '<circle cx="10.5" cy="10.5" r="6.2"/><path d="M15.2 15.2L20.5 20.5"/>',
  editing: '<path d="M4 20h4.2L19.4 8.8a2.3 2.3 0 0 0-3.2-3.2L5 16.8z"/><path d="M14.4 7.4l3.2 3.2"/>',
  running:
    '<rect x="3" y="4.5" width="18" height="15" rx="2.6"/><path d="M7.2 9.6l2.8 2.4-2.8 2.4"/><path d="M12.6 14.6h4.2"/>',
  delegating:
    '<circle cx="12" cy="5.6" r="2.3"/><circle cx="5.6" cy="18.2" r="2.3"/><circle cx="18.4" cy="18.2" r="2.3"/><path d="M12 7.9v3.6M12 11.5l-5.2 4.6M12 11.5l5.2 4.6"/>',
  tools:
    '<path d="M9 3.5v4M15 3.5v4"/><path d="M6.5 7.5h11v3.3a5.5 5.5 0 0 1-11 0z"/><path d="M12 16.3v4.2"/>',
  planning:
    '<path d="M4.5 6.5l1.6 1.6 2.9-3"/><path d="M4.5 12.5l1.6 1.6 2.9-3"/><path d="M5.8 18.5h1.4"/><path d="M12 7h7.5M12 13h7.5M12 18.5h7.5"/>',
  responding:
    '<path d="M5.2 4.8h13.6a2.2 2.2 0 0 1 2.2 2.2v8.2a2.2 2.2 0 0 1-2.2 2.2h-6.3l-4.3 3.4v-3.4H5.2A2.2 2.2 0 0 1 3 15.2V7a2.2 2.2 0 0 1 2.2-2.2z"/><path d="M8 10.2h8M8 13.4h5"/>',
  compacting: '<path d="M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5"/>',
  working:
    '<circle cx="12" cy="12" r="2.4"/><path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5"/><path d="M12 20.5a8.5 8.5 0 0 1-8.5-8.5"/>',
  done: '<circle cx="12" cy="12" r="8.6"/><path d="M8.2 12.3l2.6 2.6 5-5.4"/>',
  stopped: '<circle cx="12" cy="12" r="8.6"/><rect x="9.2" y="9.2" width="5.6" height="5.6" rx="1"/>',
  error:
    '<path d="M10.3 4.4a2 2 0 0 1 3.4 0l7.2 12.6a2 2 0 0 1-1.7 3H4.8a2 2 0 0 1-1.7-3z"/><path d="M12 9.5v4"/><path d="M12 16.8v.01"/>',
  idle: '<path d="M19.8 14.6A8 8 0 1 1 9.4 4.2a6.4 6.4 0 0 0 10.4 10.4z"/>',
  file: '<path d="M8.5 7.5L4 12l4.5 4.5M15.5 7.5L20 12l-4.5 4.5M13.4 5.5l-2.8 13"/>',
  model:
    '<rect x="6.5" y="6.5" width="11" height="11" rx="2.2"/><path d="M10 3.5v3M14 3.5v3M10 17.5v3M14 17.5v3M3.5 10h3M3.5 14h3M17.5 10h3M17.5 14h3"/>',
  openai:
    '<g stroke-width="1.9"><ellipse cx="12" cy="7.3" rx="3.7" ry="5.5"/><ellipse cx="12" cy="7.3" rx="3.7" ry="5.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="7.3" rx="3.7" ry="5.5" transform="rotate(120 12 12)"/><ellipse cx="12" cy="7.3" rx="3.7" ry="5.5" transform="rotate(180 12 12)"/><ellipse cx="12" cy="7.3" rx="3.7" ry="5.5" transform="rotate(240 12 12)"/><ellipse cx="12" cy="7.3" rx="3.7" ry="5.5" transform="rotate(300 12 12)"/></g>',
  xai: '<path d="M3.5 3.5l7.6 10.4M13.6 17.3l2.4 3.2M20.5 3l-13 18" stroke-width="2.8" stroke-linecap="butt"/>',
};

export const LANGUAGE_BY_EXT = new Map<string, LanguageDef>();
export const LANGUAGE_BY_FILENAME = new Map<string, LanguageDef>();
for (const lang of LANGUAGES) {
  for (const ext of lang.exts) LANGUAGE_BY_EXT.set(ext, lang);
  for (const name of lang.fileNames ?? []) LANGUAGE_BY_FILENAME.set(name, lang);
}

export function languageForFile(fileName: string): LanguageDef | undefined {
  const lower = fileName.toLowerCase();
  const byName = LANGUAGE_BY_FILENAME.get(lower);
  if (byName) return byName;
  const dot = lower.lastIndexOf(".");
  return dot === -1 ? undefined : LANGUAGE_BY_EXT.get(lower.slice(dot + 1));
}

export function providerForModel(model: string): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.match.test(model));
}
