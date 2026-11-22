import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { gate } from "./approval.ts";
import * as brain from "./brain.ts";

const reply = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });
const run = (fn: () => Promise<unknown> | unknown) => async () => {
  try { return reply(await fn()); }
  catch (e) { return { isError: true, content: [{ type: "text" as const, text: (e as Error).message }] }; }
};

export const BRAIN_INSTRUCTIONS = [
  "Blue Collar MCP is this company's second brain for residential construction.",
  "For ANY question about a client, job, sub, vendor, payment, permit, meeting or past decision, call brain_search FIRST and answer from it. Cite the note and its updated date.",
  "If a result has stale:true, say it may be out of date and offer to refresh it. If nothing matches, say the brain has no record, then offer to look in connected sources and save what you find.",
  "Keep answers short and in plain English. Never invent facts. Writes are previewed first and saved only after the user says yes.",
].join(" ");

/** Brain tools and the /brain-setup prompt. Shared by local stdio and hosted HTTP. */
export const registerBrain = (server: McpServer) => {
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
    inputSchema: { type: noteType, title: z.string(), body: z.string(), source: z.enum(["human", "ai", "import"]).default("ai"), approvalToken: z.string().optional().describe("From the preview step. Only send after the user said yes to this exact note.") },
  }, ({ type, title, body, source, approvalToken }) => run(async () => {
    const caps = server.server.getClientCapabilities();
    if (!caps?.elicitation) {
      const g = gate({ type, title, body, source }, { type, title, body, source }, approvalToken);
      if (g) return g;
      return brain.saveNote({ type, title, body, source });
    }
    const ok = await server.server.elicitInput({
      message: `Save this ${type} note?\n${title}\n\n${body.slice(0, 600)}`,
      requestedSchema: { type: "object", properties: { approve: { type: "boolean", title: "Save" } }, required: ["approve"] },
    });
    if (ok.action !== "accept" || !ok.content?.approve) throw new Error("User declined. Nothing was saved.");
    return brain.saveNote({ type, title, body, source });
  })())
  
  server.registerPrompt("brain-setup", {
    description: "Build your company brain.",
  }, () => ({ messages: [{ role: "user", content: { type: "text", text: [
    "Build the company brain now. Be decisive and brief: make the choices yourself, do not quiz the user.",
    "Defaults: hosted brain, all connected sources (Gmail, Drive, CRM, QuickBooks, texts, notes), last 90 days first, then keep going back in time on your own.",
    "1. Pull items from every connected source in the biggest batches you can and send them to ingest_run. Do not dry run. Do not ask permission. Keep paging until a source is done.",
    "2. Call ingest_review. Then ask the user at most ONE bundled yes: 'Save N clean facts and M payments?' (ingest_confirm with allClean, payments true, then repeat with the approvalToken after yes).",
    "3. Show only real conflicts (sources disagree), one at a time, newest first, with sources and dates. Never guess.",
    "4. Finish with a 3-line summary and tell them: from now on ask anything about clients, jobs, payments or decisions and you will check the brain first.",
    "Never ask for passwords or keys in chat. Never invent facts.",
  ].join("\n") } }] }));
};
