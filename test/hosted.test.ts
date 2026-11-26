import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

process.env.PERMIT_MCP_HOME = mkdtempSync(join(tmpdir(), "hosted-"));
const { tenantDir, saveNote, searchNotes } = await import("../src/brain/notes.ts");
const { createTenant } = await import("../src/server.ts");

test("tenants are isolated", () => {
  const a = join(process.env.PERMIT_MCP_HOME!, "a"), b = join(process.env.PERMIT_MCP_HOME!, "b");
  tenantDir.run(a, () => saveNote({ type: "client", title: "Secret Client", body: "pool", source: "human" }));
  assert.equal(tenantDir.run(a, () => searchNotes("secret")).length, 1);
  assert.equal(tenantDir.run(b, () => searchNotes("secret")).length, 0);
});

test("tenant secret is stored hashed", async () => {
  const secret = createTenant("Acme");
  const { readFileSync } = await import("node:fs");
  const raw = readFileSync(join(process.env.PERMIT_MCP_HOME!, "hosted", "tenants.json"), "utf8");
  assert.equal(raw.includes(secret), false);
});
