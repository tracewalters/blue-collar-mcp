import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAdapter } from "./adapter.ts";
import "./adapters/index.ts";
import { listJurisdictions } from "./jurisdictions.ts";
import { Profile, getProfile, saveProfile } from "./profile.ts";
import * as svc from "./service.ts";

const reply = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });
const fail = (e: unknown) => ({ isError: true, content: [{ type: "text" as const, text: (e as Error).message }] });
const ready = (platform: string) => { try { const a = getAdapter(platform); return a.maturity !== "planned"; } catch { return false; } };

export const SETUP_QUESTIONS =
  "Ask ALL of these in ONE short message, numbered: 1) Company name. 2) Your name. 3) Your trade or role (general contractor, electrician, plumber, pool builder, architect...). 4) Which cities do you pull permits in? Show the city list as a numbered list and let them pick several. 5) Site contact phone and email for inspection requests (portals require one). 6) Contractor license number (optional).";

/** Onboarding: who the company is and which cities to connect. */
export const registerSetup = (server: McpServer) => {
  server.registerTool("get_setup", {
    description: `Call this FIRST in any conversation. Returns the company profile, the cities they chose and which are connected. If needsSetup is true, run onboarding. ${SETUP_QUESTIONS}`,
    annotations: { readOnlyHint: true },
  }, async () => {
    const profile = getProfile();
    const connected = svc.listConnections().map((c) => c.id);
    const cities = listJurisdictions().filter((j) => j.id !== "demo-city").map((j) => ({ id: j.id, name: j.name, supported: ready(j.platform) }));
    return reply({
      needsSetup: !profile, profile, connected,
      stillToConnect: (profile?.cities ?? []).filter((c) => !connected.includes(c)),
      cities,
      ...(profile ? {} : { howTo: SETUP_QUESTIONS }),
    });
  });

  server.registerTool("save_setup", {
    description: "Save the onboarding answers. Pass city ids from get_setup (e.g. phoenix-az, scottsdale-az). Then call open_dashboard so the user can log in to each city. Do not ask for portal passwords.",
    inputSchema: {
      company: Profile.shape.company, userName: Profile.shape.userName, role: Profile.shape.role,
      phone: Profile.shape.phone, email: Profile.shape.email, license: Profile.shape.license,
      cities: z.array(z.string()).describe("City ids the user wants connected"),
    },
  }, async (a) => { try { return reply(saveProfile(a)); } catch (e) { return fail(e); } });
};
