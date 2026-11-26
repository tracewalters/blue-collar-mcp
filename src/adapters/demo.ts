import type { PortalAdapter } from "../adapter.ts";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Inspection, Permit } from "../schemas.ts";
import { home } from "../vault.ts";

// Fixture-backed adapter. Lets the whole flow work with no real portal.
// Login: username "demo", password "demo".
// Demo bookings persist to disk so a CLI commit is visible to the next command.
const bookedFile = () => join(home(), "demo-booked.json");
const booked = (): Inspection[] => (existsSync(bookedFile()) ? JSON.parse(readFileSync(bookedFile(), "utf8")) : []);
const permits: Permit[] = [
  { id: "BLD-2026-0142", jurisdiction: "demo-city", type: "Residential Remodel", address: "12 Oak St", status: "inspection_phase", appliedAt: "2026-09-02", expiresAt: "2027-03-02", feesDue: 0 },
  { id: "ELE-2026-0388", jurisdiction: "demo-city", type: "Electrical", address: "12 OAK STREET.", status: "corrections_required", appliedAt: "2026-10-11", feesDue: 145 },
  { id: "BLD-2026-0201", jurisdiction: "demo-city", type: "Deck", address: "48 Pine Ave", status: "in_review", appliedAt: "2026-11-03", feesDue: 0 },
  { id: "PLM-2026-0077", jurisdiction: "demo-city", type: "Plumbing", address: "301 E Camelback Rd Unit 4", status: "issued", appliedAt: "2026-10-20", feesDue: 0 },
  { id: "MEC-2026-0090", jurisdiction: "demo-city", type: "Mechanical", address: "301 East Camelback Road, #4", status: "approved", appliedAt: "2026-10-22", feesDue: 0 },
  { id: "SLR-2026-0012", jurisdiction: "demo-city", type: "Solar", address: "301 E Camelback Rd Ste 5", status: "submitted", appliedAt: "2026-11-10", feesDue: 0 },
  { id: "SHR-2026-0005", jurisdiction: "demo-city", type: "Pool Barrier", address: "", description: "Shared with you, no site address", status: "in_review", appliedAt: "2026-11-15", feesDue: 0 },
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
    const all = [...inspections, ...booked()];
    return permitId ? all.filter((i) => i.permitId === permitId) : all;
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
    const added = booked();
    added.push({ id: `INS-${inspections.length + added.length + 1}`, permitId: p.permitId, type: p.type, status: "scheduled", scheduledFor: p.date });
    writeFileSync(bookedFile(), JSON.stringify(added));
    return { ok: true, message: `Scheduled: ${plan.summary}` };
  },
};
