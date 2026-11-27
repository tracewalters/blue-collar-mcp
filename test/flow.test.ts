import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const NEXT = (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() + 3); while (d.getUTCDay() % 6 === 0) d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })(); // a weekday after today
process.env.PERMIT_MCP_HOME = mkdtempSync(join(tmpdir(), "permit-"));
const svc = await import("../src/service.ts");
const vault = await import("../src/vault.ts");

test("vault round trip and tamper detection", () => {
  const blob = vault.seal({ a: 1 });
  assert.deepEqual(vault.open(blob), { a: 1 });
  const bad = Buffer.from(blob, "base64");
  bad[bad.length - 1] ^= 1;
  assert.throws(() => vault.open(bad.toString("base64")));
});

test("bad login is rejected and not saved", async () => {
  const r = await svc.login("demo-city", { username: "x", password: "y" });
  assert.equal(r.ok, false);
  assert.equal(svc.listConnections().length, 0);
});

test("unbuilt platform fails clearly", async () => {
  const r = await svc.login("scottsdale-az", { username: "x", password: "y" });
  assert.equal(r.ok, false);
});

test("login once, read across cities, two-phase write", async () => {
  assert.equal((await svc.login("demo-city", { username: "demo", password: "demo" })).ok, true);
  assert.equal(svc.listConnections().length, 1);
  assert.ok((await svc.listPermits()).permits.length >= 3);
  const before = (await svc.listInspections()).inspections.length;

  const { token, summary } = await svc.proposeInspection("demo-city", { permitId: "BLD-2026-0142", type: "Framing", date: NEXT });
  assert.equal((await svc.listInspections()).inspections.length, before, "propose must not change anything");
  assert.match(svc.peek(token), /Framing/);
  assert.match(summary, /Framing/);

  assert.equal((await svc.commit(token)).ok, true);
  assert.equal((await svc.listInspections()).inspections.length, before + 1);
  await assert.rejects(svc.commit(token), /already-used|Unknown/, "token is single use");
});

test("secrets are not stored in plain text", async () => {
  const { readFileSync } = await import("node:fs");
  const raw = readFileSync(join(process.env.PERMIT_MCP_HOME!, "state.json"), "utf8");
  assert.ok(!raw.includes("demo-session") && !raw.includes('"password"'));
});
