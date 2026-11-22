import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as ing from "./ingest.ts";

const reply = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });
const run = (fn: () => unknown) => { try { return reply(fn()); } catch (e) { return { isError: true, content: [{ type: "text" as const, text: (e as Error).message }] }; } };

const item = z.object({
  id: z.string(), source: z.string().describe("gmail, crm, quickbooks, text, drive..."), date: z.string().describe("ISO date"),
  from: z.string().optional(), subject: z.string().optional(), body: z.string().optional(), unsubscribe: z.boolean().optional(),
  structured: z.record(z.string(), z.union([z.string(), z.number()])).optional().describe("A CRM or QuickBooks row. Use email/customer and amount keys."),
});

export const registerIngest = (server: McpServer) => {
  server.registerTool("ingest_run", {
    description: "Feed emails, texts, CRM or QuickBooks rows in batches. Free filtering: drops newsletters and promos, KEEPS receipts and payments, extracts phones, addresses and amounts. Nothing is saved to the brain yet. Use dryRun first on a small batch and show the user the counts.",
    inputSchema: { items: z.array(item).max(200), dryRun: z.boolean().default(true) },
  }, ({ items, dryRun }) => run(() => ing.run(items, dryRun)));

  server.registerTool("ingest_review", {
    description: "What needs the owner: conflicts (sources disagree, e.g. two phone numbers), clean facts that agree, and payments. Show conflicts one at a time with each candidate's sources and last-seen date. Never pick for the user.",
    annotations: { readOnlyHint: true },
  }, () => run(() => ing.review()));

  server.registerTool("ingest_confirm", {
    description: "Save facts the owner approved to the brain. picks maps a conflict id to the exact value the owner chose. Only call after the user said yes. entityType says what these contacts are.",
    inputSchema: {
      entityType: z.enum(["client", "company", "person"]), allClean: z.boolean().default(false),
      ids: z.array(z.string()).optional(), picks: z.record(z.string(), z.string()).optional(), payments: z.boolean().default(false),
      confirmed: z.boolean().describe("true only after the user said yes in chat"),
    },
  }, ({ entityType, allClean, ids, picks, payments, confirmed }) => run(() => {
    if (!confirmed) throw new Error("NOT saved. Show the user what will be saved and ask first.");
    return { ...ing.confirm({ entityType, allClean, ids, picks }), ...(payments ? { payments: ing.confirmPayments() } : {}) };
  }));
};
