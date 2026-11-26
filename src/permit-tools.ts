import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as svc from "./service.ts";

const reply = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });
const run = (fn: () => Promise<unknown> | unknown) => async () => {
  try { return reply(await fn()); }
  catch (e) { return { isError: true, content: [{ type: "text" as const, text: (e as Error).message }] }; }
};
const readOnly = { readOnlyHint: true, openWorldHint: true };
const city = z.string().optional().describe("Jurisdiction id. Omit for all connected cities.");
const refresh = z.boolean().optional().describe("Read the city portal now. Only when the user asks for the latest; data older than 15 minutes refreshes on its own.");
const FRESH = " Results carry fetchedAt and ageMinutes: say how fresh the data is in a few words. If stale is true, the city portal could not be reached and this is older data; say so.";

/** Permit tools. Booking dry runs are always on. writes=true adds commit_action (local stdio only: needs a prompt the user can approve). */
export const registerPermits = (server: McpServer, opts: { writes: boolean; connectHint: string }) => {
  server.registerTool("list_connections", {
    description: `Cities the user has logged into, and pending ones they chose but have not signed in to yet. If empty, ${opts.connectHint} After the user signs in on the connect page, call this to check; no paste needed. Only if they paste a connection key (like ABCD-1234), pass it as key. Never ask for passwords in chat.`,
    inputSchema: { key: z.string().max(20).optional().describe("Connection key the user pasted from the connect page") },
    annotations: { readOnlyHint: true },
  }, ({ key }) => run(() => svc.connectionStatus(key))());
  
  server.registerTool("list_permits", {
    description: "List permits across connected city portals." + FRESH,
    inputSchema: { city, refresh }, annotations: readOnly,
  }, ({ city, refresh }) => run(() => svc.listPermits(city, { refresh, wait: true }))());
  
  server.registerTool("list_jobs", {
    description: "Jobs: permits grouped by site address across all connected cities, with the names the user gave them. Permits with no address are listed as ungrouped.",
    annotations: readOnly,
  }, run(() => svc.listJobs({ wait: true })));

  server.registerTool("get_permit", {
    description: "Full detail and inspections for one permit." + FRESH,
    inputSchema: { city: z.string(), permitId: z.string(), refresh }, annotations: readOnly,
  }, ({ city, permitId, refresh }) => run(() => svc.getPermit(city, permitId, { refresh, wait: true }))());
  
  server.registerTool("get_inspection", {
    description: "One inspection with the inspector's comments (why it passed or failed). Use when the user asks what the inspector said. Can take up to a minute on real portals.",
    inputSchema: { city: z.string(), permitId: z.string(), inspectionId: z.string().describe("e.g. INS-00985207") }, annotations: readOnly,
  }, ({ city, permitId, inspectionId }) => run(() => svc.getInspection(city, permitId, inspectionId))());

  server.registerTool("list_inspections", {
    description: "Inspections across connected cities: needed, scheduled, passed, failed." + FRESH,
    inputSchema: { city, refresh }, annotations: readOnly,
  }, ({ city, refresh }) => run(() => svc.listInspections(city, { refresh, wait: true }))());
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
