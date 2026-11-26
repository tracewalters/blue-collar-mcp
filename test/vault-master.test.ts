import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

process.env.PERMIT_MCP_HOME = mkdtempSync(join(tmpdir(), "vault-master-"));
const root = process.env.PERMIT_MCP_HOME;
const vault = await import("../src/vault.ts");
const store = await import("../src/store.ts");

const tenant = (name: string) => join(root, name, "brain");
const session = { token: "session-secret" };
const creds = { username: "user@example.com", password: "password-secret" };

test("hosted master key derives isolated tenant keys", () => {
  process.env.BCMCP_MASTER_KEY = Buffer.alloc(32, 1).toString("base64");
  let blob = "";
  vault.tenantDir.run(tenant("a"), () => {
    store.saveConnection("demo-city", session, creds);
    const raw = readFileSync(join(root, "a", "state.json"), "utf8");
    assert.ok(!raw.includes(creds.password));
    assert.equal(existsSync(join(root, "a", "vault.key")), false);
    blob = store.readDb().connections[0].secret;
    assert.match(blob, /^v2\./);
    assert.deepEqual(store.loadSecret("demo-city"), { session, creds });
  });
  assert.throws(() => vault.tenantDir.run(tenant("b"), () => vault.open(blob)));
});

test("legacy tenant vault migrates before hosted traffic", () => {
  delete process.env.BCMCP_MASTER_KEY;
  vault.tenantDir.run(tenant("legacy"), () => {
    store.saveConnection("demo-city", session, creds);
    assert.equal(existsSync(join(root, "legacy", "vault.key")), true);
  });

  process.env.BCMCP_MASTER_KEY = Buffer.alloc(32, 2).toString("base64");
  vault.tenantDir.run(tenant("legacy"), () => {
    assert.equal(store.migrateLegacyVault(), true);
    assert.equal(existsSync(join(root, "legacy", "vault.key")), false);
    assert.match(store.readDb().connections[0].secret, /^v2\./);
    assert.deepEqual(store.loadSecret("demo-city"), { session, creds });
  });
});
