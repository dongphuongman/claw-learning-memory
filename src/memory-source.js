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
const DEFAULT_GROUP_MEMORY_PATTERN = "memory/group-{groupId}.md";
const DEFAULT_GROUP_BUDGET_RATIO = 0.3;

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
  const groupMemoryEnabled = config?.groupMemory !== false;
  const groupMemoryPattern =
    typeof config?.groupMemoryPattern === "string" && config.groupMemoryPattern.trim()
      ? config.groupMemoryPattern.trim()
      : DEFAULT_GROUP_MEMORY_PATTERN;
  const groupBudgetRatio =
    Number.isFinite(config?.groupBudgetRatio) && config.groupBudgetRatio > 0 && config.groupBudgetRatio < 1
      ? config.groupBudgetRatio
      : DEFAULT_GROUP_BUDGET_RATIO;

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
      .filter((e) => e.isFile() && /^\d{4}-\d{2}-\d{2}\.md$/i.test(e.name))
      .map((e) => e.name)
      .sort(); // date-named files (YYYY-MM-DD.md) sort chronologically
    return names.slice(-recentDays).map((name) => join(dir, name));
  }

  /** Build the injected block, or "" when there's nothing worth injecting. */
  function build(groupId) {
    const parts = [];

    // Curated layer first (rules + long-term facts + user profile).
    for (const rel of files) {
      const trimmed = (readFileCached(resolvePath(rel)) || "").trim();
      if (!trimmed) continue;
      parts.push(`### ${rel.replace(/\.md$/i, "")}\n${trimmed}`);
    }

    // Real-time layer: recent daily logs (freshest last).
    for (const full of recentDailyFiles()) {
      let trimmed = (readFileCached(full) || "").trim();
      if (!trimmed) continue;
      if (trimmed.length > PER_DAILY_TAIL_CHARS) {
        trimmed = "…(earlier entries omitted)\n" + trimmed.slice(-PER_DAILY_TAIL_CHARS).replace(/^\S*\s+/, "");
      }
      const label = full.replace(/^.*[/\\]/, "").replace(/\.md$/i, "");
      parts.push(`### recent notes (${label})\n${trimmed}`);
    }

    // Group-specific layer.
    let groupBody = "";
    if (groupMemoryEnabled && groupId) {
      const groupPath = resolvePath(groupMemoryPattern.replace("{groupId}", groupId));
      const groupContent = (readFileCached(groupPath) || "").trim();
      if (groupContent) {
        groupBody = `### group context (${groupId})\n${groupContent}`;
      }
    }

    const sharedBody = parts.join("\n\n");
    if (!sharedBody && !groupBody) return "";

    const sep = "\n\n";
    let body;
    if (groupBody) {
      // Budget splitting: group gets up to ratio * budget; unused space transfers.
      const groupCap = Math.floor(charBudget * groupBudgetRatio);
      let gTrimmed = groupBody.length > groupCap
        ? groupBody.slice(0, groupCap).replace(/\s+\S*$/, "") + "\n…(group memory truncated)"
        : groupBody;

      const sharedCap = Math.max(0, charBudget - gTrimmed.length - sep.length);
      let sTrimmed = sharedBody.length > sharedCap
        ? sharedBody.slice(0, Math.max(0, sharedCap)).replace(/\s+\S*$/, "") + "\n…(memory truncated)"
        : sharedBody;

      // If shared left room, let group expand beyond its ratio.
      if (sTrimmed.length + sep.length + gTrimmed.length < charBudget && gTrimmed.length < groupBody.length) {
        const expandedCap = Math.max(0, charBudget - sTrimmed.length - sep.length);
        gTrimmed = groupBody.length > expandedCap
          ? groupBody.slice(0, expandedCap).replace(/\s+\S*$/, "") + "\n…(group memory truncated)"
          : groupBody;
      }

      body = sTrimmed ? sTrimmed + sep + gTrimmed : gTrimmed;
      logger?.debug?.(`[learning-memory] budget split: shared=${sTrimmed.length}, group=${gTrimmed.length}, total=${body.length}/${charBudget}`);
    } else {
      body = sharedBody;
      if (body.length > charBudget) {
        body = body.slice(0, charBudget).replace(/\s+\S*$/, "") + "\n…(memory truncated)";
        logger?.debug?.(`[learning-memory] memory block trimmed to ~${charBudget} chars`);
      }
    }

    const head = header
      ? header
      : "Persistent memory (always loaded — your curated long-term notes, the rules you must follow, and your most recent notes):";
    return `${head}\n\n${body}`;
  }

  return { build, _charBudget: charBudget, _files: files, _recentDays: recentDays, _groupMemoryEnabled: groupMemoryEnabled, _groupBudgetRatio: groupBudgetRatio };
}
