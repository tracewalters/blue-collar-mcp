// Typed mock data. Replace these functions with real API calls later.
// The site never shows permit data: only usage, portal names, and status.

export type PortalStatus = "healthy" | "needs_relogin" | "needs_2fa";

export interface Portal {
  id: string;
  name: string;
  platform: "Tyler" | "Accela" | "OpenGov" | "Salesforce";
  status: PortalStatus;
}

export interface ToolUsage {
  tool: string;
  calls: number;
}

export interface DailyUsage {
  date: string; // YYYY-MM-DD
  calls: number;
}

export interface Usage {
  month: string;
  totalCalls: number;
  byTool: ToolUsage[];
  daily: DailyUsage[];
}

export interface Plan {
  id: "free" | "pro" | "team";
  name: string;
  priceUsd: number;
  includedCalls: number;
  renewsOn: string;
}

export interface Invoice {
  id: string;
  date: string;
  amountUsd: number;
  status: "paid" | "open" | "failed";
  url: string; // Stripe-hosted invoice URL (stub)
}

const daily: DailyUsage[] = [
  42, 55, 38, 61, 70, 12, 8, 66, 72, 58, 64, 80, 15, 9, 77, 69, 84, 73, 91, 20, 11, 88,
  95, 79, 83, 102, 18, 14, 90, 97,
].map((calls, i) => ({ date: `2026-11-${String(i + 1).padStart(2, "0")}`, calls }));

const byTool: ToolUsage[] = [
  { tool: "list_permits", calls: 812 },
  { tool: "get_permit_status", calls: 604 },
  { tool: "list_inspections", calls: 431 },
  { tool: "get_deadlines", calls: 188 },
  { tool: "get_permit", calls: 143 },
  { tool: "connection_status", calls: 61 },
];

export async function getUsage(): Promise<Usage> {
  return {
    month: "November 2026",
    totalCalls: daily.reduce((n, d) => n + d.calls, 0),
    byTool,
    daily,
  };
}

export async function getPortals(): Promise<Portal[]> {
  return [
    { id: "p1", name: "City of Phoenix", platform: "Salesforce", status: "healthy" },
    { id: "p2", name: "City of Austin", platform: "Tyler", status: "healthy" },
    { id: "p3", name: "San Diego County", platform: "Accela", status: "needs_relogin" },
    { id: "p4", name: "City of Denver", platform: "OpenGov", status: "needs_2fa" },
  ];
}

export async function getPlan(): Promise<Plan> {
  return { id: "pro", name: "Pro", priceUsd: 29, includedCalls: 5000, renewsOn: "2026-12-01" };
}

export async function getInvoices(): Promise<Invoice[]> {
  return [
    { id: "INV-1004", date: "2026-11-01", amountUsd: 29, status: "paid", url: "#" },
    { id: "INV-1003", date: "2026-10-01", amountUsd: 29, status: "paid", url: "#" },
    { id: "INV-1002", date: "2026-09-01", amountUsd: 29, status: "paid", url: "#" },
    { id: "INV-1001", date: "2026-08-01", amountUsd: 0, status: "paid", url: "#" },
  ];
}
