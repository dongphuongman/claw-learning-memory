import { createMemorySource } from "./memory-source.js";

export const ENGINE_ID = "learning-memory";

/** Extract groupId from a sessionKey like "agent:main:zalo:group:zgr-abc123". */
export function parseGroupId(sessionKey) {
  if (typeof sessionKey !== "string") return null;
  const parts = sessionKey.split(":");
  const idx = parts.lastIndexOf("group");
  return idx >= 0 && idx < parts.length - 1 ? parts[idx + 1] : null;
}

/** Cheap token estimate (~4 chars/token) over a message list. */
function estimateTokens(messages) {
  let chars = 0;
  for (const m of messages || []) {
    const c = m?.content;
    if (typeof c === "string") chars += c.length;
    else if (Array.isArray(c)) {
      for (const part of c) {
        if (typeof part?.text === "string") chars += part.text.length;
      }
    } else if (c != null) {
      try {
        chars += JSON.stringify(c).length;
      } catch {
        /* ignore */
      }
    }
  }
  return Math.ceil(chars / 4);
}

/**
 * Thin, always-on context engine.
 *
 * Design goals:
 *  - GUARANTEE a curated memory block is injected into EVERY turn, including group /
 *    channel sessions (OpenClaw's default recall excludes groups — that's why bots
 *    "forget" there). We do this via `systemPromptAddition`, which the host prepends
 *    to the system prompt every run.
 *  - Do NOT reinvent history storage or compaction: we pass the host-provided
 *    `messages` through and leave compaction to the runtime (`ownsCompaction: false`).
 *    We also declare `promptAuthority: "preassembly_may_overflow"` so the runtime
 *    keeps applying its own budgeting/compaction on top of our pass-through.
 *  - Fail safe: any throw here gets the engine quarantined and the host falls back to
 *    the legacy engine, so a bug can never brick an agent — but we still try/catch and
 *    degrade to a plain pass-through so a memory-read hiccup never drops the turn.
 */
export function createLearningMemoryEngine(ctx = {}) {
  const { config, workspaceDir, agentDir, logger } = ctx;
  const enabled = config?.enabled !== false;
  const source = createMemorySource({
    workspaceDir: workspaceDir || agentDir,
    config,
    logger,
  });

  return {
    info: {
      id: ENGINE_ID,
      name: "Learning Memory",
      ownsCompaction: false,
      version: "0.1.0",
    },

    // We don't maintain our own store; the runtime keeps history and hands it back
    // in assemble(). Report not-ingested so the host retains ownership of storage.
    async ingest() {
      return { ingested: false };
    },

    async assemble({ messages, tokenBudget, sessionKey } = {}) {
      const msgs = Array.isArray(messages) ? messages : [];
      let systemPromptAddition;
      if (enabled) {
        try {
          const groupId = parseGroupId(sessionKey);
          const block = source.build(groupId);
          if (block) systemPromptAddition = block;
        } catch (err) {
          logger?.warn?.(`[learning-memory] memory build failed: ${String(err)}`);
        }
      }
      return {
        messages: msgs,
        estimatedTokens: estimateTokens(msgs),
        systemPromptAddition,
        // We pass history through unbudgeted; let the runtime enforce the window.
        promptAuthority: "preassembly_may_overflow",
      };
    },

    // Compaction stays with the runtime (ownsCompaction:false). Provided for
    // interface completeness; it never claims to have compacted.
    async compact() {
      return { ok: true, compacted: false };
    },
  };
}
