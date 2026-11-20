import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Credentials, Session } from "./adapter.ts";
import { home, open, seal } from "./vault.ts";

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
export const writeDb = (db: Db) => writeFileSync(file(), JSON.stringify(db, null, 2), { mode: 0o600 });

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
