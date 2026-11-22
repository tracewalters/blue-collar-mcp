#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { listJurisdictions } from "./jurisdictions.ts";
import * as brain from "./brain.ts";
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

const noteType = z.enum(brain.NoteType.options);

server.registerTool("brain_search", {
  description: "Search the company brain (clients, jobs, meetings, decisions, rules). Results flagged stale:true are old live data: say so and suggest updating before relying on them.",
  inputSchema: { query: z.string(), type: noteType.optional() }, annotations: { readOnlyHint: true },
}, ({ query, type }) => run(() => brain.searchNotes(query, type))());

server.registerTool("brain_get", {
  description: "Read one brain note in full.",
  inputSchema: { type: noteType, slug: z.string() }, annotations: { readOnlyHint: true },
}, ({ type, slug }) => run(() => brain.getNote(type, slug))());

server.registerTool("brain_save", {
  description: "Create or update a brain note. Asks the user to approve first. Use source 'ai' for anything you wrote or inferred. Never invent facts; leave unknowns out.",
  inputSchema: { type: noteType, title: z.string(), body: z.string(), source: z.enum(["human", "ai", "import"]).default("ai") },
}, ({ type, title, body, source }) => run(async () => {
  const caps = server.server.getClientCapabilities();
  if (!caps?.elicitation) throw new Error("This client cannot ask the user to confirm, so the note was NOT saved. Show the user the note and ask them to confirm in chat, then tell them it is not saved yet.");
  const ok = await server.server.elicitInput({
    message: `Save this ${type} note?\n${title}\n\n${body.slice(0, 600)}`,
    requestedSchema: { type: "object", properties: { approve: { type: "boolean", title: "Save" } }, required: ["approve"] },
  });
  if (ok.action !== "accept" || !ok.content?.approve) throw new Error("User declined. Nothing was saved.");
  return brain.saveNote({ type, title, body, source });
})())

server.registerPrompt("brain-setup", {
  description: "Guided setup for your company brain.",
}, () => ({ messages: [{ role: "user", content: { type: "text", text: [
  "Run the Blue Collar MCP brain setup. Follow docs/ONBOARDING.md '/brain-setup'.",
  "Ask ONE question at a time with lettered options. Plain English. Give exact links. Never ask for passwords or keys in chat.",
  "Step 1: Where should the brain live? A) Hosted by us  B) Obsidian  C) Google Drive  D) Notion.",
  "Step 2: Who is on the team? Step 3: What do you keep info in today? (Gmail, Drive, local files, texts, CRM, QuickBooks, notetaker).",
  "Then walk each source: connect, pick scope, preview 10 samples, and only save with brain_save after the user confirms.",
  "Mark anything you inferred as source ai. Do not invent facts.",
].join("\n") } }] }));

await server.connect(new StdioServerTransport());
