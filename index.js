/**
 * OpenClaw Learning Memory — always-on memory injection.
 *
 * Injects a curated MEMORY.md + USER.md block into EVERY agent turn (including
 * group/channel sessions, which OpenClaw's default memory recall excludes).
 *
 * Two integration paths for maximum runtime compatibility:
 *  - Context engine (assemble-before-prompt): for OpenClaw embedded / Codex runners
 *  - before_prompt_build hook (prependContext): for CLI backends (claude-cli etc.)
 *
 * @author dongphuongman
 */
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { createLearningMemoryEngine, ENGINE_ID, parseGroupId } from "./src/engine.js";
import { createMemorySource } from "./src/memory-source.js";

const PLUGIN_ID = "learning-memory";

const plugin = definePluginEntry({
  id: PLUGIN_ID,
  name: "OpenClaw Learning Memory",
  description:
    "Always-on memory: injects curated MEMORY.md + USER.md into every turn, including group sessions.",
  kind: "context-engine",

  register(api) {
    const logger = api.logger;
    logger?.info?.("[learning-memory] registering always-on memory context engine");

    let resolvedConfig = {};

    // Path 1: Context engine for embedded/Codex runners (assemble-before-prompt)
    api.registerContextEngine(ENGINE_ID, (ctx) => {
      resolvedConfig = ctx.config?.plugins?.entries?.[PLUGIN_ID]?.config || {};
      return createLearningMemoryEngine({ ...ctx, logger });
    });

    // Path 2: before_prompt_build hook for CLI backends (claude-cli)
    api.on("before_prompt_build", (_event, ctx) => {
      try {
        const workspaceDir = ctx.workspaceDir;
        if (!workspaceDir) return {};

        const hookConfig = resolvedConfig && Object.keys(resolvedConfig).length > 0
          ? resolvedConfig
          : {};

        if (hookConfig.enabled === false) return {};

        const source = createMemorySource({ workspaceDir, config: hookConfig, logger });
        const groupId = parseGroupId(ctx.sessionKey);
        const block = source.build(groupId);
        if (block) {
          logger?.info?.(`[learning-memory] hook injecting ${block.length} chars (group=${groupId || "none"})`);
          return { prependContext: block };
        }
      } catch (err) {
        logger?.warn?.(`[learning-memory] hook memory build failed: ${String(err)}`);
      }
      return {};
    });
  },
});

export default plugin;
