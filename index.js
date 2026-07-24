/**
 * OpenClaw Learning Memory — always-on memory context engine.
 *
 * Registers a context engine that injects a curated MEMORY.md + USER.md block into
 * EVERY agent turn (including group/channel sessions, which OpenClaw's default memory
 * recall excludes). This keeps bots from forgetting context and rules over time.
 *
 * Select it per agent with:
 *   { "agents": { "defaults": { "plugins": { "slots": { "contextEngine": "learning-memory" } } } } }
 * (or the equivalent per-agent slot). See README for details.
 *
 * @author dongphuongman 
 */
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { createLearningMemoryEngine, ENGINE_ID } from "./src/engine.js";

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

    api.registerContextEngine(ENGINE_ID, (ctx) =>
      createLearningMemoryEngine({ ...ctx, logger }),
    );
  },
});

export default plugin;
