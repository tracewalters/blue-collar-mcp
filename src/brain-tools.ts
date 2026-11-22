import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as brain from "./brain.ts";

const reply = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });
const run = (fn: () => Promise<unknown> | unknown) => async () => {
  try { return reply(await fn()); }
  catch (e) { return { isError: true, content: [{ type: "text" as const, text: (e as Error).message }] }; }
};

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
    inputSchema: { type: noteType, title: z.string(), body: z.string(), source: z.enum(["human", "ai", "import"]).default("ai"), confirmed: z.boolean().default(false).describe("Only true after the user said yes in chat to this exact note.") },
  }, ({ type, title, body, source, confirmed }) => run(async () => {
    const caps = server.server.getClientCapabilities();
    if (!caps?.elicitation) {
      // Hosted HTTP is stateless and cannot pop a prompt. Require an explicit yes from the user in chat.
      if (!confirmed) throw new Error("NOT saved. Show the user the note, ask them to confirm, then call again with confirmed=true.");
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
    description: "Guided setup for your company brain.",
  }, () => ({ messages: [{ role: "user", content: { type: "text", text: [
    "Run the Blue Collar MCP brain setup.",
    "Ask ONE question at a time with lettered options. Plain English. Give exact links. Never ask for passwords or keys in chat.",
    "Step 1: Where should the brain live? A) Hosted by us  B) Obsidian  C) Google Drive  D) Notion.",
    "Step 2: Who is on the team? Step 3: What do you keep info in today? (Gmail, Drive, local files, texts, CRM, QuickBooks, notetaker).",
    "Then walk each source: connect, pick scope, preview 10 samples, and only save with brain_save after the user says yes to that exact note (then pass confirmed=true).",
    "Mark anything you inferred as source ai. Do not invent facts.",
  ].join("\n") } }] }));
};
