import { z } from "zod";

export const PermitStatus = z.enum([
  "draft", "submitted", "in_review", "corrections_required",
  "approved", "issued", "inspection_phase", "finaled", "expired", "denied", "cancelled",
]);

export const Permit = z.object({
  id: z.string(),
  jurisdiction: z.string(),
  type: z.string(),
  address: z.string(),
  description: z.string().optional(),
  status: PermitStatus,
  appliedAt: z.string().optional(),
  expiresAt: z.string().optional(),
  feesDue: z.number().default(0),
  /** Things the portal currently lets the user do on this permit, e.g. "Request Inspection". */
  actions: z.array(z.string()).optional(),
});
export type Permit = z.infer<typeof Permit>;

export const Inspection = z.object({
  id: z.string(),
  permitId: z.string(),
  type: z.string(),
  status: z.enum(["needed", "scheduled", "completed", "passed", "failed", "cancelled"]),
  scheduledFor: z.string().optional(),
  notes: z.string().optional(),
});
export type Inspection = z.infer<typeof Inspection>;

export const Jurisdiction = z.object({
  id: z.string(),
  name: z.string(),
  state: z.string(),
  platform: z.string(),
  baseUrl: z.string(),
});
export type Jurisdiction = z.infer<typeof Jurisdiction>;

/** A proposed write. Nothing happens until it is committed with its token. */
export const Plan = z.object({
  action: z.enum(["schedule_inspection"]),
  connectionId: z.string(),
  summary: z.string(),
  params: z.record(z.string(), z.unknown()),
});
export type Plan = z.infer<typeof Plan>;
