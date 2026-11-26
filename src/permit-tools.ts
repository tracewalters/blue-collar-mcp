import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAdapter } from "./adapter.ts";
import { getJurisdiction, listJurisdictions } from "./jurisdictions.ts";
import { getProfile } from "./profile.ts";
import * as svc from "./service.ts";

const reply = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });
const run = (fn: () => Promise<unknown> | unknown) => async () => {
  try { return reply(await fn()); }
  catch (e) { return { isError: true, content: [{ type: "text" as const, text: (e as Error).message }] }; }
};
const readOnly = { readOnlyHint: true, openWorldHint: true };
const city = z.string().optional().describe("Jurisdiction id. Omit for all connected cities.");
const refresh = z.boolean().optional().describe("Read the city portal now. Only when the user asks for the latest; data older than 15 minutes refreshes on its own.");
const FRESH = " Results carry fetchedAt and ageMinutes: say how fresh the data is in a few words. If refreshing is true, newer data is on its way; say so.";

/** Permit tools. writes=true adds scheduling (local stdio only: needs a prompt the user can approve). */
export const registerPermits = (server: McpServer, opts: { writes: boolean; connectHint: string }) => {
  server.registerTool("list_connections", {
    description: `Cities the user has logged into, and pending ones they chose but have not signed in to yet. If empty, ${opts.connectHint} After the user signs in on the connect page, call this to check; no paste needed. Only if they paste a connection key (like ABCD-1234), pass it as key. Never ask for passwords in chat.`,
    inputSchema: { key: z.string().max(20).optional().describe("Connection key the user pasted from the connect page") },
    annotations: { readOnlyHint: true },
  }, ({ key }) => run(() => {
    const connections = svc.listConnections(), on = new Set(connections.map((c) => c.id));
    const pending = (getProfile()?.cities ?? []).filter((id) => !on.has(id)).map((id) => {
      const j = getJurisdiction(id);
      let supported = false; try { supported = getAdapter(j.platform).maturity !== "planned"; } catch {}
      return { id: j.id, name: `${j.name}, ${j.state}`, supported };
    });
    return { ...(key ? { confirmed: svc.redeemConnectKey(key) } : {}), connections, pending, available: listJurisdictions() };
  })());
  
  server.registerTool("list_permits", {
    description: "List permits across connected city portals." + FRESH,
    inputSchema: { city, refresh }, annotations: readOnly,
  }, ({ city, refresh }) => run(() => svc.listPermits(city, { refresh }))());
  
  server.registerTool("get_permit", {
    description: "Full detail and inspections for one permit." + FRESH,
    inputSchema: { city: z.string(), permitId: z.string(), refresh }, annotations: readOnly,
  }, ({ city, permitId, refresh }) => run(() => svc.getPermit(city, permitId, { refresh }))());
  
  server.registerTool("list_inspections", {
    description: "Inspections across connected cities: needed, scheduled, passed, failed." + FRESH,
    inputSchema: { city, refresh }, annotations: readOnly,
  }, ({ city, refresh }) => run(() => svc.listInspections(city, { refresh }))());
  if (!opts.writes) return;
  server.registerTool("propose_inspection", {
    description: "Step 1 of scheduling an inspection. Changes nothing. Returns a token for commit_action.",
    inputSchema: { city: z.string(), permitId: z.string(), type: z.string(), date: z.string().describe("YYYY-MM-DD") },
  }, ({ city, permitId, type, date }) => run(() => svc.proposeInspection(city, { permitId, type, date }))());
  
  server.registerTool("commit_action", {
    description: "Step 2. Executes a proposed action after the user confirms in a prompt. Single use.",
    inputSchema: { token: z.string() },
    annotations: { destructiveHint: true, openWorldHint: true },
  }, ({ token }) => run(async () => {
    // The human must approve. The model alone can never commit.
    const caps = server.server.getClientCapabilities();
    if (!caps?.elicitation) throw new Error("This client cannot ask the user to confirm, so writes are blocked. Use the CLI: permit commit <token>");
    const ok = await server.server.elicitInput({
      message: `Approve this action on the city portal?\n${svc.peek(token)}`,
      requestedSchema: { type: "object", properties: { approve: { type: "boolean", title: "Approve" } }, required: ["approve"] },
    });
    if (ok.action !== "accept" || !ok.content?.approve) throw new Error("User declined. Nothing was done.");
    return svc.commit(token);
  })())
};
