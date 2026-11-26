import type { Inspection, Jurisdiction, Permit, Plan } from "./schemas.ts";

export type Credentials = { username: string; password: string };

/** Opaque, serializable session (cookies, tokens). Stored encrypted. */
export type Session = Record<string, unknown>;

/** Who the city calls on site. Comes from the Company profile. Shape PHX needs a phone or an email. */
export type SiteContact = { name: string; phone?: string; email?: string };
export type InspectionRequest = { permitId: string; type: string; date: string; contact: SiteContact };

/** "2026-10-26" -> "Oct 26, 2026", the format city portals show and accept. */
export const portalDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export type LoginResult =
  | { ok: true; session: Session }
  | { ok: false; reason: "bad_credentials" | "needs_2fa" | "unsupported"; message: string };

/**
 * One adapter per portal PLATFORM (Tyler, Accela, ...). Cities are config on top.
 * Writes are two-phase: propose returns a Plan, commit executes it.
 */
export interface PortalAdapter {
  platform: string;
  /** "ready" adapters talk to real portals. "planned" ones are placeholders. */
  maturity: "ready" | "demo" | "planned";
  login(j: Jurisdiction, creds: Credentials): Promise<LoginResult>;
  listPermits(j: Jurisdiction, s: Session): Promise<Permit[]>;
  getPermit(j: Jurisdiction, s: Session, id: string): Promise<Permit | undefined>;
  listInspections(j: Jurisdiction, s: Session, permitId?: string): Promise<Inspection[]>;
  /** Dry run: fill the city's form, read it back, stop before Save. The Plan's preview is exactly what would be sent. */
  proposeInspection(j: Jurisdiction, s: Session, req: InspectionRequest): Promise<Plan>;
  commit(j: Jurisdiction, s: Session, plan: Plan): Promise<{ ok: boolean; message: string }>;
}

const registry = new Map<string, PortalAdapter>();
export const registerAdapter = (a: PortalAdapter) => void registry.set(a.platform, a);
export const getAdapter = (platform: string) => {
  const a = registry.get(platform);
  if (!a) throw new Error(`No adapter for platform "${platform}"`);
  return a;
};
export const listAdapters = () => [...registry.values()];
