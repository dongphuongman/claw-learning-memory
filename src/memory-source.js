import { readFileSync, statSync } from "node:fs";
import { join, isAbsolute } from "node:path";

/**
 * Reads the curated memory files from the agent workspace and builds a single,
 * size-bounded block to inject into every turn.
 *
 * Keeping this tight (a few thousand chars) forces the agent to CURATE
 * rather than accumulate — a smaller, sharper always-on memory beats a huge one.
 * We cache per (path) with an mtime check so we only re-read when a file changes.
 */
const DEFAULT_FILES = ["MEMORY.md", "USER.md"];
const DEFAULT_CHAR_BUDGET = 3500;

export function createMemorySource({ workspaceDir, config, logger } = {}) {
  const files =
    Array.isArray(config?.files) && config.files.length ? config.files : DEFAULT_FILES;
  const charBudget =
    Number.isFinite(config?.charBudget) && config.charBudget > 0
      ? Math.floor(config.charBudget)
      : DEFAULT_CHAR_BUDGET;
  const header = typeof config?.header === "string" ? config.header : "";

  /** @type {Map<string, { mtimeMs: number, text: string }>} */
  const cache = new Map();

  function resolvePath(rel) {
    if (isAbsolute(rel)) return rel;
    return workspaceDir ? join(workspaceDir, rel) : rel;
  }

  function readFileCached(rel) {
    const full = resolvePath(rel);
    let mtimeMs = 0;
    try {
      mtimeMs = statSync(full).mtimeMs;
    } catch {
      cache.delete(full);
      return "";
    }
    const hit = cache.get(full);
    if (hit && hit.mtimeMs === mtimeMs) return hit.text;
    let text = "";
    try {
      text = readFileSync(full, "utf8");
    } catch {
      text = "";
    }
    cache.set(full, { mtimeMs, text });
    return text;
  }

  /** Build the injected block, or "" when there's nothing worth injecting. */
  function build() {
    const parts = [];
    for (const rel of files) {
      const raw = readFileCached(rel);
      const trimmed = (raw || "").trim();
      if (!trimmed) continue;
      const label = rel.replace(/\.md$/i, "");
      parts.push(`### ${label}\n${trimmed}`);
    }
    if (!parts.length) return "";

    let body = parts.join("\n\n");
    if (body.length > charBudget) {
      // Keep the beginning (curated, highest-value) and mark the trim.
      body = body.slice(0, charBudget).replace(/\s+\S*$/, "") + "\n…(memory truncated)";
      logger?.debug?.(
        `[learning-memory] memory block trimmed to ~${charBudget} chars`,
      );
    }

    const head = header
      ? header
      : "Persistent memory (always loaded — your curated long-term notes and the rules you must follow):";
    return `${head}\n\n${body}`;
  }

  return { build, _charBudget: charBudget, _files: files };
}
