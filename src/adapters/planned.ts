import type { PortalAdapter } from "../adapter.ts";

// Placeholders so cities can be listed and mapped today. Each becomes a real
// adapter (own file) when built. See docs/CONTRIBUTING.md.
const nope = (platform: string) => async (): Promise<never> => {
  throw new Error(`The "${platform}" adapter is planned but not built yet. Contributions welcome.`);
};

export const planned = (platform: string): PortalAdapter => ({
  platform,
  maturity: "planned",
  login: async () => ({ ok: false, reason: "unsupported", message: `"${platform}" adapter is not built yet.` }),
  listPermits: nope(platform),
  getPermit: nope(platform),
  listInspections: nope(platform),
  proposeInspection: nope(platform),
  commit: nope(platform),
});

export const PLANNED_PLATFORMS = ["tyler-energov", "accela", "opengov", "tbd"];
