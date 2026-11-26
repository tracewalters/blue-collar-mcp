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

const TRADES = ["General contractor", "Home builder", "Electrician", "Plumber", "HVAC", "Pool builder", "Landscape contractor", "Architect or designer", "Other"];

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

/** One-step setup as a real form in the chat (MCP elicitation): text boxes, a trade dropdown, a city multi-select. */
export const registerSetupForm = (server: McpServer) => {
  server.registerTool("run_setup", {
    description: "Show the user the setup form (company, name, trade, cities, site contact). PREFER this over asking questions in text. Then call open_dashboard. If the client cannot show forms this tells you to ask in text instead.",
  }, async () => {
    if (!server.server.getClientCapabilities()?.elicitation) return reply({ fallback: true, instruction: `This client cannot show a form. ${SETUP_QUESTIONS}`, cities: listJurisdictions().filter((j) => j.id !== "demo-city").map((j) => ({ id: j.id, name: j.name })) });
    const cur = getProfile();
    const cities = listJurisdictions().filter((j) => j.id !== "demo-city");
    const r = await server.server.elicitInput({
      message: "Let's set up your permits. This takes about 30 seconds.",
      requestedSchema: {
        type: "object",
        properties: {
          company: { type: "string", title: "Company name", default: cur?.company },
          userName: { type: "string", title: "Your name", default: cur?.userName },
          role: { type: "string", title: "Your trade", oneOf: TRADES.map((t) => ({ const: t, title: t })), default: cur?.role },
          cities: { type: "array", title: "Cities where you pull permits", minItems: 1, items: { anyOf: cities.map((j) => ({ const: j.id, title: `${j.name}${ready(j.platform) ? "" : " (coming soon)"}` })) }, default: cur?.cities },
          phone: { type: "string", title: "Site contact phone (for inspection requests)", default: cur?.phone },
          email: { type: "string", title: "Site contact email", default: cur?.email },
        },
        required: ["company", "userName", "cities"],
      },
    });
    if (r.action !== "accept" || !r.content) return reply({ saved: false, note: "Setup was cancelled. Nothing saved." });
    try {
      const c = r.content as Record<string, unknown>;
      const profile = saveProfile({ company: String(c.company), userName: String(c.userName), role: c.role ? String(c.role) : undefined, phone: c.phone ? String(c.phone) : undefined, email: c.email ? String(c.email) : undefined, cities: (c.cities as string[]) ?? [] });
      return reply({ saved: true, profile, next: "Call open_dashboard so they can log in to each city." });
    } catch (e) { return fail(e); }
  });
};
