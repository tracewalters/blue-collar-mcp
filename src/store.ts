import { closeSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import type { Credentials, Session } from "./adapter.ts";
import { home, isMasterSealed, open, seal, usesMasterKey } from "./vault.ts";

export type Connection = {
  jurisdictionId: string;
  connectedAt: string;
  /** Sealed {session, creds}. Never leaves the vault unencrypted. */
  secret: string;
};
type Db = { connections: Connection[]; plans: Record<string, { sealed: string; expires: number }> };

const file = () => join(home(), "state.json");
export const readDb = (): Db =>
  existsSync(file()) ? JSON.parse(readFileSync(file(), "utf8")) : { connections: [], plans: {} };
export const writeDb = (db: Db) => {
  const target = file();
  const temp = `${target}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temp, JSON.stringify(db, null, 2), { mode: 0o600, flag: "wx" });
    const fd = openSync(temp, "r");
    try { fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(temp, target);
    const dir = openSync(dirname(target), "r");
    try { fsyncSync(dir); } finally { closeSync(dir); }
  } finally {
    if (existsSync(temp)) unlinkSync(temp);
  }
};

/** Re-encrypts old hosted blobs before traffic starts, then removes the per-tenant key. */
export const migrateLegacyVault = () => {
  const keyFile = join(home(), "vault.key");
  if (!usesMasterKey() || !existsSync(file()) || !existsSync(keyFile)) return false;
  const db = readDb();
  let changed = false;
  for (const connection of db.connections) {
    if (isMasterSealed(connection.secret)) continue;
    connection.secret = seal(open(connection.secret));
    changed = true;
  }
  for (const plan of Object.values(db.plans)) {
    if (isMasterSealed(plan.sealed)) continue;
    plan.sealed = seal(open(plan.sealed));
    changed = true;
  }
  if (changed) writeDb(db);
  if (db.connections.every((x) => isMasterSealed(x.secret)) && Object.values(db.plans).every((x) => isMasterSealed(x.sealed))) unlinkSync(keyFile);
  return changed;
};

export const saveConnection = (jurisdictionId: string, session: Session, creds: Credentials) => {
  const db = readDb();
  db.connections = db.connections.filter((c) => c.jurisdictionId !== jurisdictionId);
  db.connections.push({ jurisdictionId, connectedAt: new Date().toISOString(), secret: seal({ session, creds }) });
  writeDb(db);
};
export const removeConnection = (jurisdictionId: string) => {
  const db = readDb();
  db.connections = db.connections.filter((c) => c.jurisdictionId !== jurisdictionId);
  writeDb(db);
};
export const loadSecret = (jurisdictionId: string) => {
  const c = readDb().connections.find((x) => x.jurisdictionId === jurisdictionId);
  if (!c) throw new Error(`Not connected to "${jurisdictionId}". Run: permit login`);
  return open<{ session: Session; creds: Credentials }>(c.secret);
};
