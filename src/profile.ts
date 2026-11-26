import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { getJurisdiction } from "./jurisdictions.ts";
import { home } from "./vault.ts";

/** Who the company is and which cities they want connected. One per company (tenant). */
export const Profile = z.object({
  company: z.string().min(1).max(120),
  userName: z.string().min(1).max(120),
  role: z.string().max(120).optional().describe("Trade or role, e.g. general contractor, electrician, pool builder"),
  phone: z.string().max(40).optional().describe("Site contact phone. City portals ask for it on inspection requests."),
  email: z.string().max(120).optional(),
  license: z.string().max(60).optional().describe("Contractor license number, optional"),
  cities: z.array(z.string()).default([]),
  updated: z.string().optional(),
});
export type Profile = z.infer<typeof Profile>;

const file = () => join(home(), "profile.json");
export const getProfile = (): Profile | null => (existsSync(file()) ? JSON.parse(readFileSync(file(), "utf8")) : null);

export const saveProfile = (p: Partial<Profile>): Profile => {
  const merged = Profile.parse({ ...(getProfile() ?? {}), ...p, updated: new Date().toISOString().slice(0, 10) });
  merged.cities = [...new Set(merged.cities)].map((id) => getJurisdiction(id).id); // throws on unknown city
  writeFileSync(file(), JSON.stringify(merged, null, 2), { mode: 0o600 });
  return merged;
};
