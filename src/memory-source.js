import { readFileSync, statSync, readdirSync } from "node:fs";
import { join, isAbsolute } from "node:path";

/**
 * Builds the always-on memory block injected into every turn.
 *
 * Two layers, because OpenClaw splits memory in two:
 *  - Curated long-term: `MEMORY.md` + `USER.md` (the "dreaming" cron consolidates into
 *    MEMORY.md over time — NOT in real time).
 *  - Real-time notes: `memory/YYYY-MM-DD.md` daily logs, where the agent records things
 *    the moment you tell it ("remember X"). These land here immediately, BEFORE dreaming
 *    folds them into MEMORY.md.
 *
 * If we only injected MEMORY.md we'd miss everything just told to the bot until the next
 * dream — so we also inject the most recent daily logs. That makes "remember this" work
 * across groups/sessions instantly.
 *
 * Kept size-bounded so the always-on block stays sharp; per-file mtime cache avoids
 * re-reading unchanged files.
 */
const DEFAULT_FILES = ["MEMORY.md", "USER.md"];
const DEFAULT_MEMORY_DIR = "memory";
const DEFAULT_RECENT_DAYS = 2;
const DEFAULT_CHAR_BUDGET = 6000;
const PER_DAILY_TAIL_CHARS = 1500; // keep the newest entries of a long daily log

export function createMemorySource({ workspaceDir, config, logger } = {}) {
  const files =
    Array.isArray(config?.files) && config.files.length ? config.files : DEFAULT_FILES;
  const memoryDir =
    typeof config?.memoryDir === "string" && config.memoryDir.trim()
      ? config.memoryDir.trim()
      : DEFAULT_MEMORY_DIR;
  const recentDays =
    Number.isFinite(config?.recentDays) && config.recentDays >= 0
      ? Math.floor(config.recentDays)
      : DEFAULT_RECENT_DAYS;
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

  function readFileCached(full) {
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

  /** Most recent daily log files (top-level `*.md` in the memory dir), newest last. */
  function recentDailyFiles() {
    if (recentDays <= 0) return [];
    const dir = resolvePath(memoryDir);
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return [];
    }
    const names = entries
      .filter((e) => e.isFile() && /\.md$/i.test(e.name))
      .map((e) => e.name)
      .sort(); // date-named files (YYYY-MM-DD.md) sort chronologically
    return names.slice(-recentDays).map((name) => join(dir, name));
  }

  /** Build the injected block, or "" when there's nothing worth injecting. */
  function build() {
    const parts = [];

    // Curated layer first (rules + long-term facts + user profile).
    for (const rel of files) {
      const trimmed = (readFileCached(resolvePath(rel)) || "").trim();
      if (!trimmed) continue;
      parts.push(`### ${rel.replace(/\.md$/i, "")}\n${trimmed}`);
    }

    // Real-time layer: recent daily logs (freshest last). Keep the tail of a long log
    // so the newest entries survive.
    for (const full of recentDailyFiles()) {
      let trimmed = (readFileCached(full) || "").trim();
      if (!trimmed) continue;
      if (trimmed.length > PER_DAILY_TAIL_CHARS) {
        trimmed = "…(earlier entries omitted)\n" + trimmed.slice(-PER_DAILY_TAIL_CHARS).replace(/^\S*\s+/, "");
      }
      const label = full.replace(/^.*[/\\]/, "").replace(/\.md$/i, "");
      parts.push(`### recent notes (${label})\n${trimmed}`);
    }

    if (!parts.length) return "";

    let body = parts.join("\n\n");
    if (body.length > charBudget) {
      body = body.slice(0, charBudget).replace(/\s+\S*$/, "") + "\n…(memory truncated)";
      logger?.debug?.(`[learning-memory] memory block trimmed to ~${charBudget} chars`);
    }

    const head = header
      ? header
      : "Persistent memory (always loaded — your curated long-term notes, the rules you must follow, and your most recent notes):";
    return `${head}\n\n${body}`;
  }

  return { build, _charBudget: charBudget, _files: files, _recentDays: recentDays };
}
