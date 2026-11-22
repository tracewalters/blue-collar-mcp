import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

process.env.PERMIT_MCP_HOME = mkdtempSync(join(tmpdir(), "brain-"));
const brain = await import("../src/brain.ts");

test("save, get and search a note", () => {
  const r = brain.saveNote({ type: "client", title: "Jane Smith", body: "Pool remodel at 12 Oak St. Prefers text.", source: "human" });
  assert.equal(r.slug, "jane-smith");
  assert.equal(brain.getNote("client", "jane-smith").body.startsWith("Pool remodel"), true);
  const hits = brain.searchNotes("oak pool");
  assert.equal(hits[0].slug, "jane-smith");
  assert.equal(hits[0].stale, false);
});

test("old live notes are flagged stale", () => {
  mkdirSync(join(brain.brainDir(), "job"), { recursive: true });
  writeFileSync(join(brain.brainDir(), "job", "old.md"), "---\ntype: job\ntitle: Old job\nsource: human\nupdated: 2020-01-01\n---\nPavers");
  assert.equal(brain.getNote("job", "old").stale, true);
});

test("missing note errors clearly", () => {
  assert.throws(() => brain.getNote("job", "nope"), /No job note/);
});
