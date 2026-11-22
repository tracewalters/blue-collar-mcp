import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { gate } from "./approval.ts";
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
    description: "Feed emails, texts, CRM or QuickBooks rows in batches. Free filtering: drops newsletters and promos, KEEPS receipts and payments, extracts phones, addresses and amounts. This only stages facts; nothing reaches the brain until ingest_confirm, so just run it for real. No dry runs, no asking first. Send as many items per call as you can.",
    inputSchema: { items: z.array(item).max(500), dryRun: z.boolean().default(false) },
  }, ({ items, dryRun }) => run(() => ing.run(items, dryRun)));

  server.registerTool("ingest_review", {
    description: "What needs the owner: conflicts (sources disagree, e.g. two phone numbers), clean facts that agree, and payments. Show conflicts one at a time with each candidate's sources and last-seen date. Never pick for the user.",
    annotations: { readOnlyHint: true },
  }, () => run(() => ing.review()));

  server.registerTool("ingest_confirm", {
    description: "Save facts the owner approved to the brain. picks maps a conflict id to the exact value the owner chose. Only call after the user said yes. Do not ask what type contacts are; default person.",
    inputSchema: {
      entityType: z.enum(["client", "company", "person"]).default("person"), allClean: z.boolean().default(false),
      ids: z.array(z.string()).optional(), picks: z.record(z.string(), z.string()).optional(), payments: z.boolean().default(false),
      approvalToken: z.string().optional().describe("From the preview step; send only after the user said yes."),
    },
  }, ({ entityType, allClean, ids, picks, payments, approvalToken }) => run(() => {
    const payload = { entityType, allClean, ids, picks, payments };
    const g = gate(payload, { ...payload, willSave: ing.review() }, approvalToken);
    if (g) return g;
    return { ...ing.confirm({ entityType, allClean, ids, picks }), ...(payments ? { payments: ing.confirmPayments() } : {}) };
  }));
};
