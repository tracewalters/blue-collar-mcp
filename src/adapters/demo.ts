import { portalDate, type PortalAdapter } from "../adapter.ts";
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
  { id: "ELE-2026-0388", jurisdiction: "demo-city", type: "Electrical", address: "12 Oak St", status: "corrections_required", appliedAt: "2026-10-11", feesDue: 145 },
  { id: "BLD-2026-0201", jurisdiction: "demo-city", type: "Deck", address: "48 Pine Ave", status: "in_review", appliedAt: "2026-11-03", feesDue: 0 },
];
const inspections: Inspection[] = [
  { id: "INS-1", permitId: "BLD-2026-0142", type: "Framing", status: "needed" },
  { id: "INS-2", permitId: "BLD-2026-0142", type: "Foundation", status: "passed", scheduledFor: "2026-10-05" },
  { id: "INS-3", permitId: "ELE-2026-0388", type: "Rough Electrical", status: "failed", scheduledFor: "2026-11-12", notes: "Missing box fill labels" },
  { id: "INS-4", permitId: "ELE-2026-0388", type: "Rough Electrical", status: "scheduled", scheduledFor: "2026-12-03" },
];

// BCMCP_DEMO_DELAY_MS makes reads slow like a real Portal (tests of the refresh rule).
const slow = () => new Promise((r) => setTimeout(r, Number(process.env.BCMCP_DEMO_DELAY_MS ?? 0)));

export const demoAdapter: PortalAdapter = {
  platform: "demo",
  maturity: "demo",
  async login(_j, c) {
    return c.username === "demo" && c.password === "demo"
      ? { ok: true, session: { token: "demo-session" } }
      : { ok: false, reason: "bad_credentials", message: 'Demo login is "demo" / "demo".' };
  },
  async listPermits() { await slow(); return permits; },
  async getPermit(_j, _s, id) { return permits.find((p) => p.id === id); },
  async listInspections(_j, _s, permitId) {
    await slow();
    const all = [...inspections, ...booked()];
    return permitId ? all.filter((i) => i.permitId === permitId) : all;
  },
  // Dry run like Shape PHX: find the open inspection of that type and "fill" the same form fields.
  async proposeInspection(j, _s, r) {
    const ins = inspections.find((i) => i.permitId === r.permitId && i.status === "needed" && i.type.toLowerCase() === r.type.toLowerCase());
    if (!ins) throw new Error(`No ${r.type} inspection is open to request on ${r.permitId}.`);
    return {
      action: "schedule_inspection",
      connectionId: j.id,
      summary: `Schedule ${ins.type} inspection for ${r.permitId} on ${r.date} (${j.name})`,
      params: { permitId: r.permitId, inspectionId: ins.id, type: ins.type, date: r.date },
      preview: {
        Permit: r.permitId, Inspection: `${ins.id} ${ins.type}`, "Preferred Date": portalDate(r.date),
        "Site Contact Name": r.contact.name, "Site Contact Phone": r.contact.phone ?? "", "Site Contact Email": r.contact.email ?? "",
      },
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
