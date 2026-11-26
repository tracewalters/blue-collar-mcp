import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { gate } from "./approval.ts";
import * as brain from "./notes.ts";

const reply = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });
const run = (fn: () => Promise<unknown> | unknown) => async () => {
  try { return reply(await fn()); }
  catch (e) { return { isError: true, content: [{ type: "text" as const, text: (e as Error).message }] }; }
};

export const BRAIN_INSTRUCTIONS = [
  "Blue Collar MCP is this company's second brain for residential construction.",
  "For ANY question about a client, job, sub, vendor, payment, permit, meeting or past decision, call brain_search FIRST and answer from it. Cite the note and its updated date.",
  "If a result has stale:true, say it may be out of date and offer to refresh it. If nothing matches, say the brain has no record, then offer to look in connected sources and save what you find.",
  "Keep EVERY reply under 6 short lines, plain English, no headers. Always say where data lives when relevant. Never invent facts. Writes are previewed first and saved only after the user says yes.",
].join(" ");

/** Brain tools and the /brain-setup prompt. Shared by local stdio and hosted HTTP. */
export const registerBrain = (server: McpServer) => {
const noteType = z.enum(brain.NoteType.options);
  
  server.registerTool("brain_status", {
    description: "Where the brain is stored, how many notes it has, and whether setup was done. Call this FIRST in any setup or when asked where things are kept.",
    annotations: { readOnlyHint: true },
  }, () => run(() => {
    const cfg = brain.getConfig(), info = brain.requestInfo.getStore();
    return {
      setup: Boolean(cfg.storage), storage: cfg.storage ?? null,
      whereItLives: "On your Blue Collar server, in a private folder only your company's connector can read. Plain markdown notes, one file per client, job, payment and so on.",
      downloadAll: info?.exportUrl ?? "available on the hosted server",
      ...brain.brainStats(),
    };
  })());

  server.registerTool("brain_configure", {
    description: "Record where the owner wants their brain. Only after they chose. hosted works now. obsidian works now as a one-click download of all notes (live two-way sync is coming). drive and notion are coming: save the choice, the brain stays hosted meanwhile.",
    inputSchema: { storage: z.enum(["hosted", "obsidian", "drive", "notion"]) },
  }, ({ storage }) => run(() => { brain.setConfig({ storage }); return { saved: storage, note: storage === "hosted" || storage === "obsidian" ? "Ready." : "Not built yet. Stored on the Blue Collar server for now; you can download everything any time." }; })());

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
    description: "Set up and fill your company brain.",
  }, () => ({ messages: [{ role: "user", content: { type: "text", text: [
    "Set up the company brain. Replies under 6 lines.",
    "Step 1: call brain_status. If setup is false, ask ONE multiple-choice question and nothing else: 'Where should your company brain live? A) On the Blue Collar server (recommended, works now)  B) Obsidian (same, plus a one-click download of every note as Obsidian files)  C) Google Drive (coming soon)  D) Notion (coming soon)'. Then call brain_configure.",
    "Step 2: tell them in one line where it lives (use whereItLives and the downloadAll link).",
    "Step 3: pull from every connected source in big batches into ingest_run. No dry runs, no permission questions. Money only counts as payment when it was actually received; CRM deal values and quotes are NOT payments.",
    "Step 4: ingest_review, then ONE bundled yes: 'Save N facts, M payments?'. Only real conflicts get shown, one at a time.",
    "Step 5: finish in 3 lines, including that from now on you check the brain first for any question.",
    "Never ask for passwords. Never invent facts.",
  ].join("\n") } }] }));
};
