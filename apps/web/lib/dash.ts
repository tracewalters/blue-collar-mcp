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
  id: string; permitId: string; type: string; status: InspStatus; scheduledFor?: string; notes?: string; jurisdiction?: string;
}
export interface City { id: string; name: string; state: string; platform: string; maturity?: string }
export interface Connection { id: string; name: string; platform: string; connectedAt: string }
export interface Me { company: string; connections: Connection[]; cities: City[] }

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

// Only these portal platforms can log in today. Others show "Coming soon".
const BUILT = ["demo", "shape-phx"];
export const isBuilt = (c: City) => (c.maturity ? c.maturity !== "planned" : BUILT.includes(c.platform));

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
