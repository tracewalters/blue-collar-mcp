// Typed mock data. Replace these functions with real API calls later.
// The site never shows business data: only usage, source names, and status.

export type SourceStatus = "healthy" | "needs_relogin" | "needs_2fa";

export interface Source {
  id: string;
  name: string;
  kind: string;
  status: SourceStatus;
}

export interface ToolUsage {
  tool: string; // package name
  calls: number;
}

export interface Seat {
  name: string;
  role: "Owner" | "Member";
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
  name: string;
  seats: number;
  includedCalls: number;
  credits: { name: string; used: number; included: number }[];
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
  { tool: "Brain", calls: 912 },
  { tool: "Permits", calls: 604 },
  { tool: "Rules", calls: 431 },
  { tool: "Books", calls: 188 },
  { tool: "CRM", calls: 104 },
];

export async function getUsage(): Promise<Usage> {
  return {
    month: "November 2026",
    totalCalls: daily.reduce((n, d) => n + d.calls, 0),
    byTool,
    daily,
  };
}

export async function getSources(): Promise<Source[]> {
  return [
    { id: "s1", name: "Gmail", kind: "Email", status: "healthy" },
    { id: "s2", name: "Google Drive", kind: "Files", status: "healthy" },
    { id: "s3", name: "JobTread", kind: "CRM", status: "healthy" },
    { id: "s4", name: "QuickBooks Online", kind: "Books, read-only", status: "needs_relogin" },
    { id: "s5", name: "City of Phoenix", kind: "Permit portal", status: "healthy" },
    { id: "s6", name: "Town of Queen Creek", kind: "Permit portal", status: "needs_2fa" },
  ];
}

export async function getSeats(): Promise<Seat[]> {
  return [
    { name: "You", role: "Owner" },
    { name: "Office manager", role: "Member" },
    { name: "Project manager", role: "Member" },
  ];
}

export async function getPlan(): Promise<Plan> {
  return {
    name: "Free + pay as you go",
    seats: 3,
    includedCalls: 2500,
    credits: [
      { name: "Import credits", used: 640, included: 1000 },
      { name: "Automations", used: 3, included: 5 },
    ],
    renewsOn: "2026-12-01",
  };
}

export async function getInvoices(): Promise<Invoice[]> {
  return [
    { id: "INV-1004", date: "2026-11-01", amountUsd: 24, status: "paid", url: "#" },
    { id: "INV-1003", date: "2026-10-01", amountUsd: 18, status: "paid", url: "#" },
    { id: "INV-1002", date: "2026-09-01", amountUsd: 18, status: "paid", url: "#" },
    { id: "INV-1001", date: "2026-08-01", amountUsd: 0, status: "paid", url: "#" },
  ];
}
