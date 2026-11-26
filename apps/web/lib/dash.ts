// Dashboard data: types mirror src/schemas.ts, plus plain-English labels and sorting.

export type PermitStatus =
  | "draft" | "submitted" | "in_review" | "corrections_required" | "approved"
  | "issued" | "inspection_phase" | "finaled" | "expired" | "denied" | "cancelled";
export interface Permit {
  id: string; jurisdiction: string; type: string; address: string; description?: string;
  status: PermitStatus; appliedAt?: string; expiresAt?: string; feesDue: number; actions?: string[];
}
export type InspStatus = "needed" | "scheduled" | "completed" | "passed" | "failed" | "cancelled";
export interface Inspection {
  id: string; permitId: string; type: string; status: InspStatus; scheduledFor?: string; notes?: string; comments?: string; jurisdiction?: string;
}
export interface JobPermit { id: string; jurisdiction: string; type: string; status: PermitStatus; address: string }
export interface Job { id: string; name: string; addresses: string[]; cities: string[]; permits: JobPermit[] }
export interface Jobs { jobs: Job[]; ungrouped: JobPermit[] }
export interface City { id: string; name: string; state: string; platform: string; maturity: "ready" | "demo" | "planned" }
export interface Connection { id: string; name: string; platform: string; connectedAt: string }
export interface Profile {
  company: string; userName: string; role?: string; phone?: string; email?: string; license?: string; cities: string[];
}
export interface Me { company: string; userName?: string; profile: Profile | null; connections: Connection[]; cities: City[] }

/** Every read says when the city portal was last checked (ADR 0002: refresh on open when older than ~15 min). */
export interface Fresh { fetchedAt: string | null; ageMinutes: number | null; refreshing: boolean; refreshError?: string }
export type Permits = Fresh & { permits: Permit[] };
export type Inspections = Fresh & { inspections: Inspection[] };

/** "just now", "4 min ago", "2 h ago", "Nov 24". */
export const ago = (iso: string) => {
  const m = Math.floor((Date.now() - Date.parse(iso)) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 24 * 60) return `${Math.floor(m / 60)} h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export type Result<T> = { ok: true; data: T } | { ok: false; signedOut: boolean; message: string };

const DOWN = "We can't reach your permit server right now. Try again in a minute.";

/** Same-origin call to the hosted server. 401 means signed out. */
export async function api<T>(path: string, post?: object): Promise<Result<T>> {
  try {
    const res = await fetch(`/api${path}`, post
      ? { method: "POST", headers: { "content-type": "application/json", "x-bc": "1" }, body: JSON.stringify(post) }
      : { cache: "no-store" });
    if (res.status === 401) return { ok: false, signedOut: true, message: "Signed out." };
    const data = await res.json().catch(() => null);
    if (!data) return { ok: false, signedOut: false, message: DOWN };
    if (!res.ok || data.ok === false) return { ok: false, signedOut: false, message: data.message ?? data.error ?? DOWN };
    return { ok: true, data };
  } catch {
    return { ok: false, signedOut: false, message: DOWN };
  }
}

/** Planned portals can't log in yet. They show "Coming soon". */
export const isBuilt = (c: City) => c.maturity !== "planned";

/** Cities from the profile that can log in but aren't connected yet. */
export const pendingCities = (me: Me) => {
  const on = new Set(me.connections.map((c) => c.id));
  return (me.profile?.cities ?? []).map((id) => me.cities.find((c) => c.id === id)).filter((c): c is City => !!c && isBuilt(c) && !on.has(c.id));
};

export type Tone = "ok" | "warn" | "bad" | "idle";

export const permitLabel: Record<PermitStatus, [string, Tone]> = {
  draft: ["Draft", "idle"],
  submitted: ["Submitted", "idle"],
  in_review: ["In review", "idle"],
  corrections_required: ["Corrections needed", "bad"],
  approved: ["Approved", "ok"],
  issued: ["Issued", "ok"],
  inspection_phase: ["Inspections", "ok"],
  finaled: ["Finaled", "ok"],
  expired: ["Expired", "bad"],
  denied: ["Denied", "bad"],
  cancelled: ["Cancelled", "idle"],
};

export const inspLabel: Record<InspStatus, [string, Tone]> = {
  needed: ["Needs booking", "warn"],
  scheduled: ["Scheduled", "ok"],
  completed: ["Completed", "ok"],
  passed: ["Passed", "ok"],
  failed: ["Failed", "bad"],
  cancelled: ["Cancelled", "idle"],
};

export const CLOSED: PermitStatus[] = ["finaled", "expired", "denied", "cancelled"];

// Dates arrive as YYYY-MM-DD. Read them as local days so nothing shifts by a timezone.
export const day = (s: string) => { const [y, m, d] = s.slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
export const today = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };
export const daysFrom = (s: string) => Math.round((day(s).getTime() - today().getTime()) / 864e5);
export const fmtDay = (s?: string) => (s ? day(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Not set");
export const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n % 1 ? 2 : 0 });

/** What needs the user on this permit, worst first. Rank 9 means nothing. */
export const forPermit = (p: Permit, insp: Inspection[]) =>
  insp.filter((i) => i.permitId === p.id && (!i.jurisdiction || i.jurisdiction === p.jurisdiction));

export function problem(p: Permit, all: Inspection[]): { rank: number; why?: string; tone?: Tone } {
  const insp = forPermit(p, all);
  const failed = insp.find((i) => i.status === "failed");
  const left = p.expiresAt ? daysFrom(p.expiresAt) : Infinity;
  if (p.status === "corrections_required") return { rank: 0, why: "Fix and resubmit to the city", tone: "bad" };
  if (failed) return { rank: 1, why: `Failed ${failed.type.toLowerCase()} inspection`, tone: "bad" };
  if (p.status === "expired" || (left < 0 && !CLOSED.includes(p.status))) return { rank: 2, why: "Expired", tone: "bad" };
  if (left <= 30 && !CLOSED.includes(p.status)) return { rank: 3, why: `Expires in ${left} day${left === 1 ? "" : "s"}`, tone: "warn" };
  if (p.feesDue > 0) return { rank: 4, why: `${money(p.feesDue)} in fees due`, tone: "warn" };
  if (insp.some((i) => i.status === "needed")) return { rank: 5, why: "Inspection needs booking", tone: "warn" };
  return { rank: CLOSED.includes(p.status) ? 10 : 9 };
}

export const permitHref = (p: { jurisdiction: string; id: string }) =>
  `/dashboard/permit?city=${encodeURIComponent(p.jurisdiction)}&id=${encodeURIComponent(p.id)}`;
