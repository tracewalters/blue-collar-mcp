#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { listJurisdictions } from "./jurisdictions.ts";
import * as svc from "./service.ts";

const server = new McpServer({ name: "permit-mcp", version: "0.1.0" });
const city = z.string().optional().describe("Jurisdiction id. Omit for all connected cities.");
const reply = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });
const run = (fn: () => Promise<unknown> | unknown) => async () => {
  try { return reply(await fn()); }
  catch (e) { return { isError: true, content: [{ type: "text" as const, text: (e as Error).message }] }; }
};
const readOnly = { readOnlyHint: true, openWorldHint: true };

server.registerTool("list_connections", {
  description: "Cities the user has logged into. If empty, tell the user to run `permit login` in their terminal. Never ask for passwords in chat.",
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

await server.connect(new StdioServerTransport());
