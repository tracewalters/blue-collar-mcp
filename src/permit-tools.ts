import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listJurisdictions } from "./jurisdictions.ts";
import * as svc from "./service.ts";

const reply = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });
const run = (fn: () => Promise<unknown> | unknown) => async () => {
  try { return reply(await fn()); }
  catch (e) { return { isError: true, content: [{ type: "text" as const, text: (e as Error).message }] }; }
};
const readOnly = { readOnlyHint: true, openWorldHint: true };
const city = z.string().optional().describe("Jurisdiction id. Omit for all connected cities.");

/** Permit tools. Booking dry runs are always on. writes=true adds commit_action (local stdio only: needs a prompt the user can approve). */
export const registerPermits = (server: McpServer, opts: { writes: boolean; connectHint: string }) => {
  server.registerTool("list_connections", {
    description: `Cities the user has logged into. If empty, ${opts.connectHint} Never ask for passwords in chat.`,
    annotations: { readOnlyHint: true },
  }, run(() => ({ connections: svc.listConnections(), available: listJurisdictions() })));
  
  server.registerTool("list_permits", {
    description: "List permits across connected city portals.",
    inputSchema: { city }, annotations: readOnly,
  }, ({ city }) => run(() => svc.listPermits(city))());
  
  server.registerTool("get_permit", {
    description: "Full detail and inspections for one permit.",
    inputSchema: { city: z.string(), permitId: z.string() }, annotations: readOnly,
  }, ({ city, permitId }) => run(() => svc.getPermit(city, permitId))());
  
  server.registerTool("list_inspections", {
    description: "Inspections across connected cities: needed, scheduled, passed, failed.",
    inputSchema: { city }, annotations: readOnly,
  }, ({ city }) => run(() => svc.listInspections(city))());
  server.registerTool("propose_inspection", {
    description: "Book an inspection, step 1 (dry run). Fills the city's request form with the site contact from the company profile, then stops before Save. Nothing is sent. Show the user the preview." + (opts.writes ? " Returns a token for commit_action." : " Booking itself is not turned on here yet."),
    inputSchema: { city: z.string(), permitId: z.string(), type: z.string().describe("Inspection type, e.g. Framing"), date: z.string().describe("YYYY-MM-DD, a weekday after today") },
  }, ({ city, permitId, type, date }) => run(async () => {
    const r = await svc.proposeInspection(city, { permitId, type, date });
    return opts.writes ? r : { dryRun: true, summary: r.summary, preview: r.preview, note: "Dry run only. Nothing was sent to the city." };
  })());
  if (!opts.writes) return;

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
