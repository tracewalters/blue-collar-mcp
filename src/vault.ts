import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { AsyncLocalStorage } from "node:async_hooks";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/** Hosted mode runs each request inside a tenant (its brain dir). Vault, state and brain are then per company. */
export const tenantDir = new AsyncLocalStorage<string>();

/** Data dir. Override with PERMIT_MCP_HOME. */
export const home = () => {
  const t = tenantDir.getStore();
  const dir = t ? dirname(t) : process.env.PERMIT_MCP_HOME ?? join(homedir(), ".permit-mcp");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
};

// Local mode: AES-256-GCM, key in a 0600 file. Hosted mode swaps this key source for KMS.
const key = (): Buffer => {
  const f = join(home(), "vault.key");
  if (!existsSync(f)) {
    writeFileSync(f, randomBytes(32).toString("base64"), { mode: 0o600 });
    chmodSync(f, 0o600);
  }
  return Buffer.from(readFileSync(f, "utf8"), "base64");
};

export const seal = (data: unknown): string => {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(JSON.stringify(data), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64");
};

export const open = <T = unknown>(blob: string): T => {
  const b = Buffer.from(blob, "base64");
  const d = createDecipheriv("aes-256-gcm", key(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8"));
};
