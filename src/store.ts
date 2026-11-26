import { closeSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { basename, dirname, join } from "node:path";
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

/** Reads a JSON file. Only a missing file counts as empty; a broken one throws, so it is never silently overwritten. */
export const readJson = <T>(path: string, empty: T): T => {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return empty; throw new Error(`Could not read ${basename(path)}. Nothing was changed.`); }
};

/** Writes a JSON file atomically: temp file, fsync, rename. */
export const writeJson = (target: string, data: unknown) => {
  const temp = `${target}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temp, JSON.stringify(data, null, 2), { mode: 0o600, flag: "wx" });
    const fd = openSync(temp, "r");
    try { fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(temp, target);
    const dir = openSync(dirname(target), "r");
    try { fsyncSync(dir); } finally { closeSync(dir); }
  } finally {
    if (existsSync(temp)) unlinkSync(temp);
  }
};

/** Runs read-modify-write edits on one file one at a time (in this process). */
const queues = new Map<string, Promise<unknown>>();
export const editJson = <T, R = void>(path: string, empty: T, fn: (data: T) => R): Promise<R> => {
  const run = (queues.get(path) ?? Promise.resolve()).catch(() => {}).then(() => { const d = readJson(path, empty); const r = fn(d); writeJson(path, d); return r; });
  const tail = run.catch(() => {});
  queues.set(path, tail);
  tail.then(() => { if (queues.get(path) === tail) queues.delete(path); });
  return run;
};

export const readDb = (): Db => readJson(file(), { connections: [], plans: {} });
export const writeDb = (db: Db) => writeJson(file(), db);

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
