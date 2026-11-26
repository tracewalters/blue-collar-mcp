import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { AsyncLocalStorage } from "node:async_hooks";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";

/** Hosted mode runs each request inside a tenant (its brain dir). Vault, state and brain are then per company. */
export const tenantDir = new AsyncLocalStorage<string>();

/** Data dir. Override with PERMIT_MCP_HOME. */
export const home = () => {
  const t = tenantDir.getStore();
  const dir = t ? dirname(t) : process.env.PERMIT_MCP_HOME ?? join(homedir(), ".permit-mcp");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
};

const parseKey = (raw: string, source: string) => {
  const value = Buffer.from(raw.trim(), "base64");
  if (value.length !== 32) throw new Error(`${source} must be a base64-encoded 32-byte key.`);
  return value;
};

const masterKey = () => {
  const raw = process.env.BCMCP_MASTER_KEY;
  return raw ? parseKey(raw, "BCMCP_MASTER_KEY") : null;
};

/** Hosted mode must keep this key outside BCMCP_DATA, ideally in a service environment or KMS. */
export const requireHostedMasterKey = () => {
  if (!masterKey()) throw new Error("BCMCP_MASTER_KEY is required in hosted mode.");
};

export const usesMasterKey = () => Boolean(masterKey());
export const isMasterSealed = (blob: string) => blob.startsWith("v2.");

const scope = () => tenantDir.getStore() ? basename(home()) : "local";
const derivedKey = () => {
  const master = masterKey();
  if (!master) return null;
  return Buffer.from(hkdfSync("sha256", master, Buffer.alloc(0), `blue-collar-mcp:vault:${scope()}`, 32));
};

// Local mode stays zero-config. Hosted mode never creates this legacy key.
const legacyKey = (create: boolean): Buffer => {
  const f = join(home(), "vault.key");
  if (!existsSync(f)) {
    if (!create) throw new Error("Legacy vault key is missing.");
    writeFileSync(f, randomBytes(32).toString("base64"), { mode: 0o600 });
    chmodSync(f, 0o600);
  }
  return parseKey(readFileSync(f, "utf8"), "vault.key");
};

export const seal = (data: unknown): string => {
  const iv = randomBytes(12);
  const master = derivedKey();
  const c = createCipheriv("aes-256-gcm", master ?? legacyKey(true), iv);
  if (master) c.setAAD(Buffer.from(scope()));
  const enc = Buffer.concat([c.update(JSON.stringify(data), "utf8"), c.final()]);
  const blob = Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64");
  return master ? `v2.${blob}` : blob;
};

export const open = <T = unknown>(blob: string): T => {
  const master = isMasterSealed(blob);
  const key = master ? derivedKey() : legacyKey(false);
  if (master && !key) throw new Error("BCMCP_MASTER_KEY is required to open this vault.");
  const b = Buffer.from(master ? blob.slice(3) : blob, "base64");
  const d = createDecipheriv("aes-256-gcm", key!, b.subarray(0, 12));
  if (master) d.setAAD(Buffer.from(scope()));
  d.setAuthTag(b.subarray(12, 28));
  return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8"));
};
