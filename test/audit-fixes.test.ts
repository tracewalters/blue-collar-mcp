import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

process.env.PERMIT_MCP_HOME = mkdtempSync(join(tmpdir(), "audit-"));
const home = process.env.PERMIT_MCP_HOME;
const brain = await import("../src/brain/notes.ts");
const svc = await import("../src/service.ts");
const approval = await import("../src/brain/approval.ts");
const srv = await import("../src/server.ts");

test("different titles with the same slug do not overwrite each other", () => {
  brain.saveNote({ type: "job", title: "Lot 7 A", body: "first", source: "human" });
  brain.saveNote({ type: "job", title: "Lot 7-A", body: "second", source: "human" });
  assert.equal(brain.searchNotes("lot").length, 2);
  brain.saveNote({ type: "job", title: "Lot 7 A", body: "first, edited", source: "human" }); // same title updates in place
  assert.equal(brain.searchNotes("lot").length, 2);
  assert.match(brain.getNote("job", "lot-7-a").body, /edited/);
});

test("demo booking survives a new process (persisted)", async () => {
  await svc.login("demo-city", { username: "demo", password: "demo" });
  const before = (await svc.listInspections()).length;
  const { token } = await svc.proposeInspection("demo-city", { permitId: "BLD-2026-0142", type: "Final", date: "2026-12-05" });
  await svc.commit(token);
  const { readFileSync } = await import("node:fs");
  assert.match(readFileSync(join(home, "demo-booked.json"), "utf8"), /Final/);
  assert.equal((await svc.listInspections()).length, before + 1);
});

test("invalid inspection dates are rejected before a token is issued", async () => {
  for (const d of ["not-a-date", "2026-02-31", "12/01/2026", ""])
    await assert.rejects(svc.proposeInspection("demo-city", { permitId: "BLD-2026-0142", type: "X", date: d }), /Invalid date/);
});

test("hosted approval token is bound to content and tenant", () => {
  const dir = join(home, "tenant-a");
  brain.tenantDir.run(dir, () => {
    const p = { title: "A" };
    const g = approval.gate(p, p)!;
    assert.equal(g.needsApproval, true);
    assert.equal(approval.gate(p, p, g.approvalToken), null);
    assert.notEqual(approval.gate({ title: "B" }, p, g.approvalToken), null, "changed content needs new approval");
  });
  const tok = brain.tenantDir.run(dir, () => approval.issue({ title: "A" }));
  assert.equal(brain.tenantDir.run(join(home, "tenant-b"), () => approval.valid({ title: "A" }, tok)), false);
  assert.equal(approval.valid({ title: "A" }, `${Date.now() - 1}.x`), false);
});

test("rotating a connector kills the old URL and keeps the data folder", async () => {
  process.env.BCMCP_DATA = join(home, "hosted2");
  const a = srv.createTenant("Acme");
  const b = srv.rotateTenant("Acme");
  assert.notEqual(a, b);
  const { readFileSync } = await import("node:fs");
  const t = JSON.parse(readFileSync(join(process.env.BCMCP_DATA, "tenants.json"), "utf8"));
  assert.equal(Object.keys(t).length, 1);
  srv.revokeTenant("Acme");
  assert.equal(Object.keys(JSON.parse(readFileSync(join(process.env.BCMCP_DATA, "tenants.json"), "utf8"))).length, 0);
});

