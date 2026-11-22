// Site copy and product facts. Source: VISION.md, docs/ONBOARDING.md, docs/MONETIZATION.md.

export const GITHUB = "https://github.com/tracewalters/Permit-MCP";

export type Status = "Ready" | "Coming next" | "Later";

export interface Pkg {
  id: string;
  name: string;
  command: string;
  what: string;
  examples: string[];
  status: Status;
  steps: string[];
}

export const packages: Pkg[] = [
  {
    id: "brain",
    name: "Brain",
    command: "/brain-setup",
    what: "Your company memory. Clients, jobs, people, meetings, and decisions in one place.",
    examples: ["Pulls in Gmail, Drive, folders, texts, and meeting notes", "Flags anything that's out of date"],
    status: "Ready",
    steps: ["Pick where your brain lives: hosted, Obsidian, Drive, or Notion","Invite your team","Pick your sources: Gmail, Drive, texts, CRM, QuickBooks","Connect each one with a secure link","Preview what gets saved, then confirm","Ask about your latest job"],
  },
  {
    id: "rules",
    name: "Rules",
    command: "/rules-setup",
    what: "How your shop does things. Pricing, voice, process, and safety, the same for everyone.",
    examples: ["Start from a trade rule pack", "Or let Claude suggest rules from your own history"],
    status: "Ready",
    steps: ["Pick a rule pack, mine your history, or start from scratch","Keep, edit, or drop each rule","Set reply style and voice","Publish version 1 for the whole team"],
  },
  {
    id: "permits",
    name: "Permits",
    command: "/permits-setup",
    what: "Every city permit portal in one chat. Status, inspections, deadlines.",
    examples: ["Any Phoenix-metro city", "Alerts for inspections, expirations, resubmittals"],
    status: "Ready",
    steps: ["Pick your cities","Sign in to each portal with a secure link","Import permits you already have","Turn on inspection and deadline alerts"],
  },
  {
    id: "books",
    name: "Books",
    command: "/books-setup",
    what: "Read your QuickBooks or Xero in plain English. Read-only to start.",
    examples: ["“What did we make on the Smith job?”", "Suggests categories, you approve"],
    status: "Coming next",
    steps: ["Pick QuickBooks, Xero, or a spreadsheet","Connect read-only","Check it with a profit and loss pull","Approve suggested category rules"],
  },
  {
    id: "crm",
    name: "CRM",
    command: "/crm-setup",
    what: "Leads, jobs, quotes, and price books from the tool you already use.",
    examples: ["JobTread, Jobber, Buildertrend, HubSpot", "Or a spreadsheet, or nothing at all"],
    status: "Coming next",
    steps: ["Pick JobTread, Jobber, Buildertrend, HubSpot, or none","Connect it","Match your fields","Import into your brain and confirm"],
  },
  {
    id: "inventory",
    name: "Inventory",
    command: "/inventory-setup",
    what: "Check stock and build orders with your suppliers.",
    examples: ["Pool Corp, Home Depot, Lowe's, local yards", "Orders always wait for your OK"],
    status: "Later",
    steps: ["Pick your suppliers","Connect each one","Build job shopping lists","Draft orders that wait for your OK"],
  },
];

export const laterPackages = ["Subs", "Field", "Docs", "Comms"];

export interface RulePack {
  id: string;
  name: string;
  forWho: string;
  samples: string[];
}

// Sample rules are illustrations of the kind of rule in each pack, not the final pack text.
export const rulePacks: RulePack[] = [
  {
    id: "residential-gc",
    name: "Residential GC",
    forWho: "General contractors and home builders",
    samples: ["Every change order is in writing before work starts", "Quotes list allowances on their own line"],
  },
  {
    id: "phoenix-landscape-pool",
    name: "Landscape & Pool (Phoenix)",
    forWho: "Landscape and pool designers and builders",
    samples: ["Plant picks are low-water for the desert", "Pool quotes call out equipment brand and model"],
  },
  {
    id: "design-architect",
    name: "Design & Architect",
    forWho: "Architects, drafters, interior designers",
    samples: ["Every drawing set has a revision date", "Selections are logged with who approved them"],
  },
  {
    id: "electrical",
    name: "Electrical",
    forWho: "Electrical subs",
    samples: ["Panel work notes amperage and permit number", "Bids separate rough-in from trim-out"],
  },
  {
    id: "plumbing",
    name: "Plumbing",
    forWho: "Plumbing subs",
    samples: ["Water heater quotes list fuel type and size", "Rough-in inspection is booked before drywall"],
  },
];

export const trades = [
  "Architects",
  "Drafters",
  "Interior designers",
  "Landscape designers",
  "Pool designers",
  "General contractors",
  "Home builders",
  "Electricians",
  "Plumbers",
];

// The /brain-setup guided flow, shown as a chat.
export interface Turn {
  ask: string;
  choices?: string[];
  pick?: number;
  note?: string;
}

export const brainSetup: Turn[] = [
  {
    ask: "Where should your company brain live?",
    choices: ["Hosted by us (nothing to install)", "Obsidian on your computer", "A Google Drive folder", "Notion"],
    pick: 0,
  },
  { ask: "How big is your team?", choices: ["Just me", "2 to 5 people", "6 or more"], pick: 1 },
  {
    ask: "Where do you keep info today? Pick all that apply.",
    choices: ["Gmail", "Google Drive", "Text messages", "JobTread / Jobber / Buildertrend", "QuickBooks"],
    pick: 0,
  },
  {
    ask: "Open this secure link and sign in to Gmail. I never see your password.",
    note: "Connected. I found 2,140 emails from the last 12 months. Here are 10 samples. Save them?",
  },
];

export const freeTier = [
  "Brain, with a starter note limit and one import per source",
  "Rule packs, plus one custom rule set",
  "Permits for supported cities",
  "1 seat",
];

export const paidLevers = [
  { name: "Big imports", why: "Years of email, texts, or scanned paperwork take real computer time to read." },
  { name: "More seats", why: "Add your office manager, PMs, and crew leads to the same brain." },
  { name: "New portal builds", why: "We build a connection for a city or supplier we don't have yet. Then everyone gets it." },
  { name: "Automations and alerts", why: "Inspection reminders, a morning brief, follow-up drafts." },
  { name: "Premium rule packs", why: "Deeper trade templates and checklists." },
  { name: "Heavy use", why: "A simple meter for big days of chat and tool use." },
];
