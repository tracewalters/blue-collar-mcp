import { createHash, randomBytes } from "node:crypto";
import { join } from "node:path";
import "./adapters/index.ts";
import { getAdapter, portalDate, type Credentials } from "./adapter.ts";
import { getJurisdiction, listJurisdictions } from "./jurisdictions.ts";
import { getProfile } from "./profile.ts";
import { groupJobs, mergeJobs, renameJob } from "./jobs.ts";
import { Plan } from "./schemas.ts";
import { editJson, loadSecret, readDb, readJson, removeConnection, saveConnection, writeDb } from "./store.ts";
import { home, open, seal } from "./vault.ts";

// The one place that does real work. The CLI and the MCP server both call these.

const PLAN_TTL_MS = 10 * 60 * 1000;

export async function login(jurisdictionId: string, creds: Credentials) {
  const j = getJurisdiction(jurisdictionId);
  const r = await getAdapter(j.platform).login(j, creds);
  if (r.ok) { saveConnection(j.id, r.session, creds); await forget(j.id); }
  return r.ok ? { ok: true as const } : r;
}

export const logout = async (jurisdictionId: string) => { removeConnection(jurisdictionId); await forget(getJurisdiction(jurisdictionId).id); };

export const listConnections = () =>
  readDb().connections.map((c) => {
    const j = getJurisdiction(c.jurisdictionId);
    return { id: j.id, name: `${j.name}, ${j.state}`, platform: j.platform, connectedAt: c.connectedAt };
  });

/** Connected cities, cities the user picked but has not signed in to (and whether we support them yet), and all cities. */
export const connectionStatus = (key?: string) => {
  const connections = listConnections(), on = new Set(connections.map((c) => c.id));
  const pending = (getProfile()?.cities ?? []).filter((id) => !on.has(id)).map((id) => {
    const j = getJurisdiction(id);
    let supported = false; try { supported = getAdapter(j.platform).maturity !== "planned"; } catch {}
    return { id: j.id, name: `${j.name}, ${j.state}`, supported };
  });
  return { ...(key ? { confirmed: redeemConnectKey(key) } : {}), connections, pending, available: listJurisdictions() };
};

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
// The dashboard gets cached data at once and the refresh runs in the background. Claude (`wait`) waits for
// the fresh read, up to BCMCP_REFRESH_WAIT_MS, and gets the cached data marked stale only if the read fails or
// times out. An empty cache always waits. `refresh` forces a read and waits the same way. No polling.
// The cache is a file per Company, so it survives a restart. Writes are atomic and one at a time.
type Entry = { data: unknown; fetchedAt: string; error?: string };
export type ReadOpts = { refresh?: boolean; wait?: boolean };
const staleMs = () => Number(process.env.BCMCP_STALE_MS ?? 15 * 60_000);
const waitMs = () => Number(process.env.BCMCP_REFRESH_WAIT_MS ?? 40_000);
// Stored in cache.json and shown to users. Never the raw error: it can carry portal URLs.
const REFRESH_FAILED = "Could not reach the city portal. Showing the last data we have.";
const cacheFile = () => join(home(), "cache.json");
const readCache = () => readJson<Record<string, Entry>>(cacheFile(), {});
const editCache = (fn: (c: Record<string, Entry>) => void) => editJson<Record<string, Entry>>(cacheFile(), {}, fn);
const inflight = new Map<string, Promise<unknown>>();
const connected = (city: string) => readDb().connections.some((c) => c.jurisdictionId === city);

/** Drops a city's cached data, e.g. after a connect, disconnect or booking. */
export const forget = (city: string, kind?: string) => editCache((c) => { for (const k of Object.keys(c)) if (k.startsWith(`${city}|${kind ?? ""}`)) delete c[k]; });

async function fresh<T>(city: string, kind: string, read: () => Promise<T>, o: ReadOpts = {}) {
  const key = `${city}|${kind}`, id = `${home()}|${key}`;
  const hit = readCache()[key];
  const old = !hit || Date.now() - Date.parse(hit.fetchedAt) >= staleMs();
  if ((o.refresh || old) && !inflight.has(id)) {
    const p = read()
      .then(async (data) => { if (connected(city)) await editCache((c) => { c[key] = { data, fetchedAt: new Date().toISOString() }; }); })
      .catch(async (e) => {
        console.error(`refresh failed (${kind}): ${(e as Error).message}`);
        if (connected(city)) await editCache((c) => { if (c[key]) c[key].error = REFRESH_FAILED; });
        throw e;
      })
      .finally(() => inflight.delete(id));
    p.catch(() => {});
    inflight.set(id, p);
  }
  let failed = false;
  if (!hit) await inflight.get(id);
  else if (o.refresh || (o.wait && old)) {
    const done = inflight.get(id)?.then(() => true, () => false) ?? Promise.resolve(true);
    failed = !(await Promise.race([done, new Promise<boolean>((r) => setTimeout(r, waitMs(), false).unref())]));
  }
  const e = readCache()[key];
  if (!e) throw new Error(`No ${kind} for ${city}: it is not connected any more. Check list_connections.`);
  return { data: e.data as T, fetchedAt: e.fetchedAt, refreshing: inflight.has(id), error: e.error ?? (failed ? REFRESH_FAILED : undefined), stale: failed && old };
}

/** Joins per-city results: oldest fetch time, refreshing if any city is. */
const freshness = (parts: { fetchedAt: string; refreshing: boolean; error?: string; stale?: boolean }[]) => {
  const fetchedAt: string | null = parts.map((p) => p.fetchedAt).sort()[0] ?? null;
  const errors = parts.map((p) => p.error).filter(Boolean);
  return {
    fetchedAt, ageMinutes: fetchedAt ? Math.floor((Date.now() - Date.parse(fetchedAt)) / 60_000) : null,
    refreshing: parts.some((p) => p.refreshing), ...(errors.length ? { refreshError: [...new Set(errors)].join(" ") } : {}),
    ...(parts.some((p) => p.stale) ? { stale: true } : {}),
  };
};

const cityPermits = (id: string, o?: ReadOpts) => { const { j, a, s } = ctx(id); return fresh(id, "permits", () => a.listPermits(j, s), o); };
const cityInspections = (id: string, o?: ReadOpts) => {
  const { j, a, s } = ctx(id);
  return fresh(id, "inspections", async () => (await a.listInspections(j, s)).map((i) => ({ ...i, jurisdiction: j.id })), o);
};
const cities = (jurisdictionId?: string) => (jurisdictionId ? [getJurisdiction(jurisdictionId).id] : listConnections().map((c) => c.id));

/** Reads fan out to every connected city unless one is named. */
export async function listPermits(jurisdictionId?: string, opts: ReadOpts = {}) {
  const parts = await Promise.all(cities(jurisdictionId).map((id) => cityPermits(id, opts)));
  return { permits: parts.flatMap((p) => p.data), ...freshness(parts) };
}

/** Permits grouped into Jobs by site address, with the Company's renames and merges applied. */
export const listJobs = async (opts: ReadOpts = {}) => groupJobs((await listPermits(undefined, opts)).permits);
const jobIds = async () => (await listJobs()).jobs.map((j) => j.id);
export const renameJobTo = async (job: string, name: string) => { await renameJob(await jobIds(), job, name); return listJobs(); };
export const mergeJob = async (from: string, into: string) => { await mergeJobs(await jobIds(), from, into); return listJobs(); };

export async function listInspections(jurisdictionId?: string, opts: ReadOpts = {}) {
  const parts = await Promise.all(cities(jurisdictionId).map((id) => cityInspections(id, opts)));
  return { inspections: parts.flatMap((p) => p.data), ...freshness(parts) };
}

/** One permit and its inspections, from the same cached city data as the lists. */
export async function getPermit(jurisdictionId: string, permitId: string, opts: ReadOpts = {}) {
  const j = getJurisdiction(jurisdictionId);
  const [p, i] = await Promise.all([cityPermits(j.id, opts), cityInspections(j.id, opts)]);
  const permit = p.data.find((x) => x.id.toLowerCase() === permitId.toLowerCase());
  if (!permit) throw new Error(`Permit ${permitId} not found in ${j.name}`);
  return { permit, inspections: i.data.filter((x) => x.permitId === permit.id), ...freshness([p, i]) };
}

/** One inspection with the inspector's comments. */
export async function getInspection(jurisdictionId: string, permitId: string, inspectionId: string) {
  const { j, a, s } = ctx(jurisdictionId);
  const i = await a.getInspection(j, s, permitId, inspectionId);
  if (!i || i.permitId.toLowerCase() !== permitId.toLowerCase()) throw new Error(`Inspection ${inspectionId} not found on permit ${permitId} in ${j.name}`);
  return { ...i, jurisdiction: j.id };
}

const bind = (plan: unknown, token: string) => createHash("sha256").update(JSON.stringify(plan) + token).digest("hex");

// Today's date where the cities are. All supported cities are Phoenix metro (no daylight saving).
const cityToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Phoenix" });
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Step 1 of booking, for every city. The booking rules live here so each adapter, the demo city included, gets them:
 * no weekends, no past dates, no inspection that is already scheduled. The site contact comes from the Company profile.
 */
export async function proposeInspection(jurisdictionId: string, req: { permitId: string; type: string; inspectionId?: string; date: string }) {
  const { date } = req;
  const city = getJurisdiction(jurisdictionId);
  if (!getAdapter(city.platform).bookingVerified) throw new Error(`Booking for ${city.name} is being tested; not available yet.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error(`Invalid date "${date}". Use a real date as YYYY-MM-DD.`);
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (day === 0 || day === 6) throw new Error(`${portalDate(date)} is a ${DAYS[day]}. Cities inspect on weekdays only.`);
  if (date <= cityToday()) throw new Error(`${portalDate(date)} is not after today. Pick a future weekday.`);
  const { j, a, s } = ctx(jurisdictionId);
  const rows = await a.listInspections(j, s, req.permitId);
  const insId = req.inspectionId?.trim();
  // By inspection number when we have it; otherwise any scheduled inspection of that type counts.
  if (insId && !rows.some((i) => i.id === insId)) throw new Error(`No inspection ${insId} on ${req.permitId}.`);
  const same = rows.find((i) => i.status === "scheduled" && (insId ? i.id === insId : i.type.toLowerCase() === req.type.trim().toLowerCase()));
  if (same) throw new Error(`${same.type} (${same.id}) is already scheduled on ${req.permitId}${same.scheduledFor ? ` for ${portalDate(same.scheduledFor)}` : ""}.`);
  const p = getProfile();
  const contact = { name: p?.userName ?? "", phone: p?.phone || undefined, email: p?.email || undefined };
  const plan = await a.proposeInspection(j, s, { ...req, type: req.type.trim(), inspectionId: insId || undefined, contact });
  const token = randomBytes(16).toString("hex");
  const db = readDb();
  for (const [k, v] of Object.entries(db.plans)) if (v.expires < Date.now()) delete db.plans[k];
  db.plans[token] = { sealed: seal({ plan, bind: bind(plan, token) }), expires: Date.now() + PLAN_TTL_MS };
  writeDb(db);
  return { token, summary: plan.summary, preview: plan.preview, expiresInMinutes: PLAN_TTL_MS / 60000 };
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
  await forget(j.id, "inspections");
  return r;
}

/** Read a proposed plan's summary without consuming the token. */
export function peek(token: string) {
  const entry = readDb().plans[token];
  if (!entry || entry.expires < Date.now()) throw new Error("Unknown, used, or expired token.");
  return Plan.parse(open<{ plan: unknown }>(entry.sealed).plan).summary;
}
