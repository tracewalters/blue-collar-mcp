import type { PortalAdapter } from "../adapter.ts";
import type { Inspection, Permit } from "../schemas.ts";

// Fixture-backed adapter. Lets the whole flow work with no real portal.
// Login: username "demo", password "demo".
const permits: Permit[] = [
  { id: "BLD-2026-0142", jurisdiction: "demo-city", type: "Residential Remodel", address: "12 Oak St", status: "inspection_phase", appliedAt: "2026-09-02", expiresAt: "2027-03-02", feesDue: 0 },
  { id: "ELE-2026-0388", jurisdiction: "demo-city", type: "Electrical", address: "12 Oak St", status: "corrections_required", appliedAt: "2026-10-11", feesDue: 145 },
  { id: "BLD-2026-0201", jurisdiction: "demo-city", type: "Deck", address: "48 Pine Ave", status: "in_review", appliedAt: "2026-11-03", feesDue: 0 },
];
const inspections: Inspection[] = [
  { id: "INS-1", permitId: "BLD-2026-0142", type: "Framing", status: "needed" },
  { id: "INS-2", permitId: "BLD-2026-0142", type: "Foundation", status: "passed", scheduledFor: "2026-10-05" },
  { id: "INS-3", permitId: "ELE-2026-0388", type: "Rough Electrical", status: "failed", scheduledFor: "2026-11-12", notes: "Missing box fill labels" },
];

export const demoAdapter: PortalAdapter = {
  platform: "demo",
  maturity: "demo",
  async login(_j, c) {
    return c.username === "demo" && c.password === "demo"
      ? { ok: true, session: { token: "demo-session" } }
      : { ok: false, reason: "bad_credentials", message: 'Demo login is "demo" / "demo".' };
  },
  async listPermits() { return permits; },
  async getPermit(_j, _s, id) { return permits.find((p) => p.id === id); },
  async listInspections(_j, _s, permitId) {
    return permitId ? inspections.filter((i) => i.permitId === permitId) : inspections;
  },
  async proposeInspection(j, _s, r) {
    return {
      action: "schedule_inspection",
      connectionId: j.id,
      summary: `Schedule ${r.type} inspection for ${r.permitId} on ${r.date} (${j.name})`,
      params: r,
    };
  },
  async commit(_j, _s, plan) {
    const p = plan.params as { permitId: string; type: string; date: string };
    inspections.push({ id: `INS-${inspections.length + 1}`, permitId: p.permitId, type: p.type, status: "scheduled", scheduledFor: p.date });
    return { ok: true, message: `Scheduled: ${plan.summary}` };
  },
};
