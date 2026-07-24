import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemorySource } from "../src/memory-source.js";
import { createLearningMemoryEngine } from "../src/engine.js";

function withWorkspace(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), "lm-test-"));
  try {
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(dir, name), content, "utf8");
    }
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("memory-source builds a block from MEMORY.md + USER.md", () => {
  withWorkspace(
    { "MEMORY.md": "- rule: only reply when named", "USER.md": "Kent, boss" },
    (dir) => {
      const src = createMemorySource({ workspaceDir: dir });
      const block = src.build();
      assert.match(block, /only reply when named/);
      assert.match(block, /Kent, boss/);
      assert.match(block, /### MEMORY/);
      assert.match(block, /### USER/);
    },
  );
});

test("memory-source returns empty when files missing/blank", () => {
  withWorkspace({ "MEMORY.md": "   \n  " }, (dir) => {
    const src = createMemorySource({ workspaceDir: dir });
    assert.equal(src.build(), "");
  });
});

test("memory-source respects charBudget (trims)", () => {
  withWorkspace({ "MEMORY.md": "x".repeat(5000) }, (dir) => {
    const src = createMemorySource({ workspaceDir: dir, config: { charBudget: 500 } });
    const block = src.build();
    assert.ok(block.length < 700, `expected trimmed block, got ${block.length}`);
    assert.match(block, /memory truncated/);
  });
});

test("memory-source injects the most recent daily logs (real-time notes)", () => {
  withWorkspace({ "MEMORY.md": "- rule: end with 👾" }, (dir) => {
    mkdirSync(join(dir, "memory"), { recursive: true });
    writeFileSync(join(dir, "memory", "2026-07-23.md"), "- old note from yesterday", "utf8");
    writeFileSync(join(dir, "memory", "2026-07-24.md"), "- Dự án chính: Thiên Ba Phủ", "utf8");
    const src = createMemorySource({ workspaceDir: dir });
    const block = src.build();
    // Fresh learning from today's daily log must be present even though it's NOT in MEMORY.md.
    assert.match(block, /Thiên Ba Phủ/);
    assert.match(block, /end with 👾/); // curated rule still there
    assert.match(block, /recent notes \(2026-07-24\)/);
  });
});

test("memory-source recentDays=0 disables daily-log injection", () => {
  withWorkspace({ "MEMORY.md": "- rule" }, (dir) => {
    mkdirSync(join(dir, "memory"), { recursive: true });
    writeFileSync(join(dir, "memory", "2026-07-24.md"), "- Thiên Ba Phủ", "utf8");
    const src = createMemorySource({ workspaceDir: dir, config: { recentDays: 0 } });
    assert.doesNotMatch(src.build(), /Thiên Ba Phủ/);
  });
});

test("engine.assemble passes messages through and injects memory", async () => {
  await withWorkspace({ "MEMORY.md": "- fact: sky is blue" }, async (dir) => {
    const engine = createLearningMemoryEngine({ workspaceDir: dir });
    const messages = [{ role: "user", content: "hi" }];
    const res = await engine.assemble({ messages, tokenBudget: 8000 });
    assert.deepEqual(res.messages, messages);
    assert.match(res.systemPromptAddition, /sky is blue/);
    assert.equal(res.promptAuthority, "preassembly_may_overflow");
    assert.ok(res.estimatedTokens >= 0);
  });
});

test("engine.assemble omits systemPromptAddition when disabled", async () => {
  await withWorkspace({ "MEMORY.md": "- fact: x" }, async (dir) => {
    const engine = createLearningMemoryEngine({ workspaceDir: dir, config: { enabled: false } });
    const res = await engine.assemble({ messages: [], tokenBudget: 8000 });
    assert.equal(res.systemPromptAddition, undefined);
  });
});

test("engine.info + ingest + compact are safe defaults", async () => {
  const engine = createLearningMemoryEngine({ workspaceDir: "/nonexistent" });
  assert.equal(engine.info.id, "learning-memory");
  assert.equal(engine.info.ownsCompaction, false);
  assert.deepEqual(await engine.ingest(), { ingested: false });
  assert.deepEqual(await engine.compact(), { ok: true, compacted: false });
  // Missing workspace must not throw — degrade to no injection.
  const res = await engine.assemble({ messages: [], tokenBudget: 100 });
  assert.equal(res.systemPromptAddition, undefined);
});
