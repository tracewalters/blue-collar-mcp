import { createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import "./adapters/index.ts";
import { getAdapter, type Credentials } from "./adapter.ts";
import { getJurisdiction } from "./jurisdictions.ts";
import { Plan } from "./schemas.ts";
import { loadSecret, readDb, removeConnection, saveConnection, writeDb } from "./store.ts";
import { home, open, seal } from "./vault.ts";

// The one place that does real work. The CLI and the MCP server both call these.

const PLAN_TTL_MS = 10 * 60 * 1000;

export async function login(jurisdictionId: string, creds: Credentials) {
  const j = getJurisdiction(jurisdictionId);
  const r = await getAdapter(j.platform).login(j, creds);
  if (r.ok) { saveConnection(j.id, r.session, creds); forget(j.id); }
  return r.ok ? { ok: true as const } : r;
}

export const logout = (jurisdictionId: string) => { removeConnection(jurisdictionId); forget(getJurisdiction(jurisdictionId).id); };

export const listConnections = () =>
  readDb().connections.map((c) => {
    const j = getJurisdiction(c.jurisdictionId);
    return { id: j.id, name: `${j.name}, ${j.state}`, platform: j.platform, connectedAt: c.connectedAt };
  });

// ---- Connection flow. The agent checks list_connections itself; a short key shown after sign-in is the
// fallback the user can paste into chat. Single use, short-lived, tied to the Company. Never a password.
const connectKeys = new Map<string, { home: string; city: string; expires: number }>();
const keyMs = () => Number(process.env.BCMCP_CONNECT_KEY_MS ?? 10 * 60_000);
const keyHash = (k: string) => createHash("sha256").update(k.trim().toUpperCase()).digest("hex");

export function issueConnectKey(city: string) {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", b = randomBytes(8);
  const key = [...b].map((x) => abc[x % abc.length]).join("").replace(/^(.{4})/, "$1-");
  for (const [k, v] of connectKeys) if (v.expires < Date.now()) connectKeys.delete(k);
  connectKeys.set(keyHash(key), { home: home(), city, expires: Date.now() + keyMs() });
  return key;
}

export function redeemConnectKey(key: string) {
  const h = keyHash(key), e = connectKeys.get(h);
  if (!e || e.home !== home()) throw new Error("Unknown or already-used key. Call list_connections without a key to check status.");
  connectKeys.delete(h);
  if (e.expires < Date.now()) throw new Error("That key expired. Call list_connections without a key to check status.");
  const c = listConnections().find((x) => x.id === e.city);
  if (!c) throw new Error("That city is no longer connected.");
  return c;
}

const ctx = (jurisdictionId: string) => {
  const j = getJurisdiction(jurisdictionId);
  return { j, a: getAdapter(j.platform), s: loadSecret(jurisdictionId).session };
};

// ---- Refresh rule (ADR 0002). Data older than BCMCP_STALE_MS (about 15 min) refreshes when someone looks.
// Cached data is served at once and refreshed in the background, so a slow Portal never blocks Claude.
// Only an empty cache waits. `refresh` forces a read and waits up to BCMCP_REFRESH_WAIT_MS for it. No polling.
// The cache is a file per Company, so it survives a restart.
type Entry = { data: unknown; fetchedAt: string; error?: string };
const staleMs = () => Number(process.env.BCMCP_STALE_MS ?? 15 * 60_000);
const waitMs = () => Number(process.env.BCMCP_REFRESH_WAIT_MS ?? 40_000);
const cacheFile = () => join(home(), "cache.json");
const readCache = (): Record<string, Entry> => { try { return JSON.parse(readFileSync(cacheFile(), "utf8")); } catch { return {}; } };
const editCache = (fn: (c: Record<string, Entry>) => void) => { const c = readCache(); fn(c); writeFileSync(cacheFile(), JSON.stringify(c), { mode: 0o600 }); };
const inflight = new Map<string, Promise<unknown>>();
const connected = (city: string) => readDb().connections.some((c) => c.jurisdictionId === city);

/** Drops a city's cached data, e.g. after a connect, disconnect or booking. */
export const forget = (city: string, kind?: string) => editCache((c) => { for (const k of Object.keys(c)) if (k.startsWith(`${city}|${kind ?? ""}`)) delete c[k]; });

async function fresh<T>(city: string, kind: string, read: () => Promise<T>, force = false) {
  const key = `${city}|${kind}`, id = `${home()}|${key}`;
  const hit = readCache()[key];
  if ((force || !hit || Date.now() - Date.parse(hit.fetchedAt) >= staleMs()) && !inflight.has(id)) {
    const p = read()
      .then((data) => { if (connected(city)) editCache((c) => { c[key] = { data, fetchedAt: new Date().toISOString() }; }); })
      .finally(() => inflight.delete(id));
    p.catch((e) => { if (connected(city)) editCache((c) => { if (c[key]) c[key].error = (e as Error).message; }); });
    inflight.set(id, p);
  }
  if (!hit) await inflight.get(id);
  else if (force) await Promise.race([inflight.get(id)?.catch(() => {}), new Promise((r) => setTimeout(r, waitMs()).unref())]);
  const e = readCache()[key] ?? hit!;
  return { data: e.data as T, fetchedAt: e.fetchedAt, refreshing: inflight.has(id), error: e.error };
}

/** Joins per-city results: oldest fetch time, refreshing if any city is. */
const freshness = (parts: { fetchedAt: string; refreshing: boolean; error?: string }[]) => {
  const fetchedAt: string | null = parts.map((p) => p.fetchedAt).sort()[0] ?? null;
  const errors = parts.map((p) => p.error).filter(Boolean);
  return {
    fetchedAt, ageMinutes: fetchedAt ? Math.floor((Date.now() - Date.parse(fetchedAt)) / 60_000) : null,
    refreshing: parts.some((p) => p.refreshing), ...(errors.length ? { refreshError: errors.join(" ") } : {}),
  };
};

const cityPermits = (id: string, force?: boolean) => { const { j, a, s } = ctx(id); return fresh(id, "permits", () => a.listPermits(j, s), force); };
const cityInspections = (id: string, force?: boolean) => {
  const { j, a, s } = ctx(id);
  return fresh(id, "inspections", async () => (await a.listInspections(j, s)).map((i) => ({ ...i, jurisdiction: j.id })), force);
};
const cities = (jurisdictionId?: string) => (jurisdictionId ? [getJurisdiction(jurisdictionId).id] : listConnections().map((c) => c.id));

/** Reads fan out to every connected city unless one is named. */
export async function listPermits(jurisdictionId?: string, opts: { refresh?: boolean } = {}) {
  const parts = await Promise.all(cities(jurisdictionId).map((id) => cityPermits(id, opts.refresh)));
  return { permits: parts.flatMap((p) => p.data), ...freshness(parts) };
}

export async function listInspections(jurisdictionId?: string, opts: { refresh?: boolean } = {}) {
  const parts = await Promise.all(cities(jurisdictionId).map((id) => cityInspections(id, opts.refresh)));
  return { inspections: parts.flatMap((p) => p.data), ...freshness(parts) };
}

/** One permit and its inspections, from the same cached city data as the lists. */
export async function getPermit(jurisdictionId: string, permitId: string, opts: { refresh?: boolean } = {}) {
  const j = getJurisdiction(jurisdictionId);
  const [p, i] = await Promise.all([cityPermits(j.id, opts.refresh), cityInspections(j.id, opts.refresh)]);
  const permit = p.data.find((x) => x.id.toLowerCase() === permitId.toLowerCase());
  if (!permit) throw new Error(`Permit ${permitId} not found in ${j.name}`);
  return { permit, inspections: i.data.filter((x) => x.permitId === permit.id), ...freshness([p, i]) };
}

const bind = (plan: unknown, token: string) => createHash("sha256").update(JSON.stringify(plan) + token).digest("hex");

export async function proposeInspection(jurisdictionId: string, req: { permitId: string; type: string; date: string }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(req.date) || new Date(`${req.date}T00:00:00Z`).toISOString().slice(0, 10) !== req.date) throw new Error(`Invalid date "${req.date}". Use a real date as YYYY-MM-DD.`);
  const { j, a, s } = ctx(jurisdictionId);
  const plan = await a.proposeInspection(j, s, req);
  const token = randomBytes(16).toString("hex");
  const db = readDb();
  for (const [k, v] of Object.entries(db.plans)) if (v.expires < Date.now()) delete db.plans[k];
  db.plans[token] = { sealed: seal({ plan, bind: bind(plan, token) }), expires: Date.now() + PLAN_TTL_MS };
  writeDb(db);
  return { token, summary: plan.summary, expiresInMinutes: PLAN_TTL_MS / 60000 };
}

/** Single use. Expires. Executes exactly what was proposed. */
export async function commit(token: string) {
  const db = readDb();
  const entry = db.plans[token];
  if (!entry) throw new Error("Unknown or already-used token.");
  delete db.plans[token];
  writeDb(db);
  if (entry.expires < Date.now()) throw new Error("Token expired. Propose again.");
  const { plan, bind: b } = open<{ plan: unknown; bind: string }>(entry.sealed);
  if (b !== bind(plan, token)) throw new Error("Plan was altered.");
  const parsed = Plan.parse(plan);
  const { j, a, s } = ctx(parsed.connectionId);
  const r = await a.commit(j, s, parsed);
  forget(j.id, "inspections");
  return r;
}

/** Read a proposed plan's summary without consuming the token. */
export function peek(token: string) {
  const entry = readDb().plans[token];
  if (!entry || entry.expires < Date.now()) throw new Error("Unknown, used, or expired token.");
  return Plan.parse(open<{ plan: unknown }>(entry.sealed).plan).summary;
}
