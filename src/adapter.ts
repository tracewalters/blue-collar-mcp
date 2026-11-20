import type { Inspection, Jurisdiction, Permit, Plan } from "./schemas.ts";

export type Credentials = { username: string; password: string };

/** Opaque, serializable session (cookies, tokens). Stored encrypted. */
export type Session = Record<string, unknown>;

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
  proposeInspection(j: Jurisdiction, s: Session, req: { permitId: string; type: string; date: string }): Promise<Plan>;
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
