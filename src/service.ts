import { createHash, randomBytes } from "node:crypto";
import "./adapters/index.ts";
import { getAdapter, type Credentials } from "./adapter.ts";
import { getJurisdiction } from "./jurisdictions.ts";
import { groupJobs, mergeJobs, renameJob } from "./jobs.ts";
import { Plan } from "./schemas.ts";
import { loadSecret, readDb, removeConnection, saveConnection, writeDb } from "./store.ts";
import { open, seal } from "./vault.ts";

// The one place that does real work. The CLI and the MCP server both call these.

const PLAN_TTL_MS = 10 * 60 * 1000;

export async function login(jurisdictionId: string, creds: Credentials) {
  const j = getJurisdiction(jurisdictionId);
  const r = await getAdapter(j.platform).login(j, creds);
  if (r.ok) saveConnection(j.id, r.session, creds);
  return r.ok ? { ok: true as const } : r;
}

export const logout = (jurisdictionId: string) => removeConnection(jurisdictionId);

export const listConnections = () =>
  readDb().connections.map((c) => {
    const j = getJurisdiction(c.jurisdictionId);
    return { id: j.id, name: `${j.name}, ${j.state}`, platform: j.platform, connectedAt: c.connectedAt };
  });

const ctx = (jurisdictionId: string) => {
  const j = getJurisdiction(jurisdictionId);
  return { j, a: getAdapter(j.platform), s: loadSecret(jurisdictionId).session };
};

/** Reads fan out to every connected city unless one is named. */
export async function listPermits(jurisdictionId?: string) {
  const ids = jurisdictionId ? [jurisdictionId] : listConnections().map((c) => c.id);
  const out = await Promise.all(ids.map((id) => { const { j, a, s } = ctx(id); return a.listPermits(j, s); }));
  return out.flat();
}

/** Permits grouped into Jobs by site address, with the Company's renames and merges applied. */
export const listJobs = async () => groupJobs(await listPermits());
const jobIds = async () => (await listJobs()).jobs.map((j) => j.id);
export const renameJobTo = async (job: string, name: string) => { renameJob(await jobIds(), job, name); return listJobs(); };
export const mergeJob = async (from: string, into: string) => { mergeJobs(await jobIds(), from, into); return listJobs(); };

export async function getPermit(jurisdictionId: string, permitId: string) {
  const { j, a, s } = ctx(jurisdictionId);
  const p = await a.getPermit(j, s, permitId);
  if (!p) throw new Error(`Permit ${permitId} not found in ${j.name}`);
  return { permit: p, inspections: await a.listInspections(j, s, permitId) };
}

export async function listInspections(jurisdictionId?: string) {
  const ids = jurisdictionId ? [jurisdictionId] : listConnections().map((c) => c.id);
  const out = await Promise.all(ids.map(async (id) => {
    const { j, a, s } = ctx(id);
    return (await a.listInspections(j, s)).map((i) => ({ ...i, jurisdiction: j.id }));
  }));
  return out.flat();
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
  return a.commit(j, s, parsed);
}

/** Read a proposed plan's summary without consuming the token. */
export function peek(token: string) {
  const entry = readDb().plans[token];
  if (!entry || entry.expires < Date.now()) throw new Error("Unknown, used, or expired token.");
  return Plan.parse(open<{ plan: unknown }>(entry.sealed).plan).summary;
}
