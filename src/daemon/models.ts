import { providerForModel } from "../catalog";

const NOISE = new Set([
  "thinking",
  "think",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "fast",
  "preview",
  "latest",
  "exp",
  "experimental",
  "instruct",
  "chat",
]);
const UPPER = new Set(["gpt", "glm", "llm"]);
const CASED: Record<string, string> = { deepseek: "DeepSeek", xai: "xAI", openai: "OpenAI" };

export interface ModelInfo {
  label: string;
  provider: string;
}

/** "claude-opus-4-7-thinking-max" -> "Claude Opus 4.7", "gpt-5.6-sol-max" -> "GPT-5.6 Sol". */
export function describeModel(slug: string | null, id: string | null): ModelInfo | null {
  const raw = (id ?? slug ?? "").trim();
  if (!raw) return null;
  if (/^(auto|default)$/i.test(raw)) return { label: "Auto", provider: "cursor" };

  const tokens = raw
    .replace(/^cursor[-/]/i, "")
    .replace(/^[\w-]+\//, "")
    .split(/[-_\s]+/)
    .filter((t) => t && !NOISE.has(t.toLowerCase()) && !/^\d{6,}$/.test(t));

  const words: string[] = [];
  for (const t of tokens) {
    const prev = words[words.length - 1];
    if (/^\d+(\.\d+)?$/.test(t) && prev && /^\d+(\.\d+)?$/.test(prev) && !prev.includes(".")) {
      words[words.length - 1] = `${prev}.${t}`;
      continue;
    }
    const lower = t.toLowerCase();
    const keepCase = /^\d/.test(t) || /^o\d/.test(lower);
    words.push(CASED[lower] ?? (UPPER.has(lower) ? lower.toUpperCase() : keepCase ? lower : t[0].toUpperCase() + t.slice(1)));
  }

  let label = words.join(" ");
  label = label.replace(/^GPT (\d)/, "GPT-$1");
  const provider = providerForModel(raw)?.key ?? "model";
  return { label: label || raw, provider };
}
