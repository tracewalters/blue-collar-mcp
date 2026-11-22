import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { brainDir, saveNote } from "./brain.ts";

/**
 * Ingest v0: cheap deterministic pipeline. No model calls.
 * Messy sources disagree, so nothing becomes "truth" until the owner confirms it.
 * Every fact keeps its source, so conflicts are visible instead of silently overwritten.
 */
export type Item = {
  id: string; source: string; date: string; from?: string; subject?: string; body?: string;
  unsubscribe?: boolean;                       // has a List-Unsubscribe header
  structured?: Record<string, string | number>; // CRM / QuickBooks rows: skip text parsing
};
export type Fact = { field: "phone" | "address" | "email" | "payment"; value: string; entity: string; source: string; ref: string; date: string; amount?: number };
type State = { seen: Record<string, 1>; facts: Fact[]; resolved: Record<string, string> };

const dir = () => join(brainDir(), "..", "_ingest");
const stateFile = () => join(dir(), "state.json");
const load = (): State => (existsSync(stateFile()) ? JSON.parse(readFileSync(stateFile(), "utf8")) : { seen: {}, facts: [], resolved: {} });
const save = (s: State) => { mkdirSync(dir(), { recursive: true }); writeFileSync(stateFile(), JSON.stringify(s)); };

const MONEY = /(?:\$|USD\s?)\s?(\d[\d,]*)(?:\.(\d{2}))?/g;
// Money words always keep an item, even from a no-reply sender: this is how payments are tracked.
const PAY_WORDS = /\b(invoice|receipt|payment|paid|deposit|zelle|venmo|ach|check\s*#?\d*|statement|balance due|remittance)\b/i;
// Construction paperwork from automated senders (suppliers, portals) is kept too.
const BIZ_WORDS = /\b(order|purchase order|po\s*#?\d+|quote|estimate|proposal|contract|change order|permit|inspection|delivery|shipment|submittal|lien)\b/i;

/** In doubt, keep. Only clear mass-marketing is dropped. */
export const classify = (it: Item): { keep: boolean; kind: "structured" | "receipt" | "business" | "human" | "noise"; reason: string } => {
  if (it.structured) return { keep: true, kind: "structured", reason: "structured source" };
  const text = `${it.subject ?? ""} ${it.body ?? ""}`;
  if (PAY_WORDS.test(text)) return { keep: true, kind: "receipt", reason: "payment or invoice" };
  if (/\b(\d+% off|sale ends|webinar|limited time|free shipping)\b/i.test(text)) return { keep: false, kind: "noise", reason: "promo" };
  const automated = it.unsubscribe || /no-?reply|newsletter|marketing|mailer-daemon|notifications?@/i.test(it.from ?? "");
  if (automated && BIZ_WORDS.test(text)) return { keep: true, kind: "business", reason: "supplier or portal paperwork" };
  if (automated) return { keep: false, kind: "noise", reason: "mass mailing" };
  return { keep: true, kind: "human", reason: "human conversation" };
};

/** Drop quoted replies, signatures and HTML so only new text remains. */
export const clean = (body = "") => {
  let t = body.replace(/<style[\s\S]*?<\/style>|<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
  t = t.split(/\n-{2,}\s*Original Message|\nOn .{5,120} wrote:|\n-- ?\n|\nSent from my /i)[0];
  t = t.split("\n").filter((l) => !l.trim().startsWith(">")).join("\n");
  return t.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 4000);
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9@.]+/g, " ").trim();
const normPhone = (s: string) => { const d = s.replace(/\D/g, ""); return d.length === 11 && d[0] === "1" ? d.slice(1) : d; };
const entityOf = (from = "") => (from.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/)?.[0] ?? from).toLowerCase();

export const extract = (it: Item, kind: string): Fact[] => {
  const ref = it.id, base = { source: it.source, ref, date: it.date };
  const entity = entityOf(it.from ?? String(it.structured?.email ?? it.structured?.customer ?? ""));
  if (!entity) return [];
  const out: Fact[] = [];
  const text = it.structured ? Object.values(it.structured).join("\n") : clean(it.body);
  for (const m of text.matchAll(/(?:\+?1[ .-]?)?\(?\b(\d{3})\)?[ .-]?(\d{3})[ .-]?(\d{4})\b/g)) out.push({ ...base, field: "phone", entity, value: normPhone(m[0]) });
  for (const m of text.matchAll(/\b\d{2,6}\s+(?:[NSEW]\.?\s+)?[A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+)?\s(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Ln|Lane|Blvd|Way|Ct|Court|Cir|Circle|Pl|Place)\b\.?/g)) out.push({ ...base, field: "address", entity, value: m[0].replace(/\.$/, "") });
  if (kind === "receipt" || it.structured?.amount !== undefined) {
    const amounts = it.structured?.amount !== undefined ? [Number(it.structured.amount)] : [...text.matchAll(MONEY)].map((m) => Number(`${m[1].replace(/,/g, "")}.${m[2] ?? "00"}`));
    if (amounts.length) { const amount = Math.max(...amounts); out.push({ ...base, field: "payment", entity, amount, value: `${it.date.slice(0, 10)}|${amount.toFixed(2)}` }); }
  }
  return out;
};

/** Run items through the pipeline. dryRun only counts and estimates. */
export const run = (items: Item[], dryRun = false) => {
  const st = load();
  const stats = { received: items.length, alreadySeen: 0, skipped: {} as Record<string, number>, kept: 0, newFacts: 0, estTokensIfModelUsed: 0 };
  for (const it of items) {
    const key = createHash("sha1").update(`${it.source}|${it.id}`).digest("hex");
    if (st.seen[key]) { stats.alreadySeen++; continue; }
    const c = classify(it);
    if (!c.keep) { stats.skipped[c.reason] = (stats.skipped[c.reason] ?? 0) + 1; if (!dryRun) st.seen[key] = 1; continue; }
    stats.kept++;
    stats.estTokensIfModelUsed += Math.ceil(clean(it.body).length / 4);
    const facts = extract(it, c.kind);
    stats.newFacts += facts.length;
    if (!dryRun) { st.facts.push(...facts); st.seen[key] = 1; }
  }
  if (!dryRun) save(st);
  const r = dryRun ? null : review();
  return { dryRun, ...stats, ...(r ? { toReview: { cleanFacts: r.clean.length, conflicts: r.conflicts.length, payments: r.payments.length } } : {}) };
};

type Group = { id: string; entity: string; field: Fact["field"]; candidates: { value: string; sources: string[]; count: number; lastSeen: string }[] };
const gid = (entity: string, field: string) => createHash("sha1").update(`${entity}|${field}`).digest("hex").slice(0, 8);

/** What needs the owner. Single-value facts are "clean" and bulk-confirmable. Disagreements are conflicts. */
export const review = () => {
  const st = load();
  const by = new Map<string, Group>();
  for (const f of st.facts) {
    if (f.field === "payment") continue;
    const id = gid(f.entity, f.field);
    if (st.resolved[id]) continue;
    const g = by.get(id) ?? { id, entity: f.entity, field: f.field, candidates: [] };
    const key = f.field === "address" ? norm(f.value) : f.value;
    const c = g.candidates.find((x) => norm(x.value) === key || x.value === key);
    if (c) { c.count++; if (!c.sources.includes(f.source)) c.sources.push(f.source); if (f.date > c.lastSeen) c.lastSeen = f.date; }
    else g.candidates.push({ value: f.value, sources: [f.source], count: 1, lastSeen: f.date });
    by.set(id, g);
  }
  const groups = [...by.values()];
  const payments = new Map<string, { entity: string; date: string; amount: number; sources: string[] }>();
  for (const f of st.facts) if (f.field === "payment") {
    const k = `${f.entity}|${f.value}`;
    const p = payments.get(k) ?? { entity: f.entity, date: f.value.split("|")[0], amount: f.amount!, sources: [] };
    if (!p.sources.includes(f.source)) p.sources.push(f.source);
    payments.set(k, p);
  }
  return {
    clean: groups.filter((g) => g.candidates.length === 1),
    conflicts: groups.filter((g) => g.candidates.length > 1).map((g) => ({ ...g, candidates: g.candidates.sort((a, b) => b.lastSeen.localeCompare(a.lastSeen)) })),
    payments: [...payments.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
};

/** Owner confirms. Writes to the brain as source:import. entityType says what these contacts are. */
export const confirm = (opts: { ids?: string[]; allClean?: boolean; picks?: Record<string, string>; entityType: "client" | "company" | "person" }) => {
  const st = load(), r = review(), wrote: string[] = [];
  const chosen = new Map<string, string>();
  if (opts.allClean) for (const g of r.clean) chosen.set(g.id, g.candidates[0].value);
  for (const id of opts.ids ?? []) { const g = r.clean.find((x) => x.id === id); if (g) chosen.set(id, g.candidates[0].value); }
  for (const [id, value] of Object.entries(opts.picks ?? {})) {
    const g = r.conflicts.find((x) => x.id === id);
    if (!g?.candidates.some((c) => c.value === value)) throw new Error(`Conflict ${id}: pick one of its candidate values exactly.`);
    chosen.set(id, value);
  }
  const all = [...r.clean, ...r.conflicts], byEntity = new Map<string, string[]>();
  for (const [id, value] of chosen) {
    const g = all.find((x) => x.id === id)!;
    st.resolved[id] = value;
    byEntity.set(g.entity, [...(byEntity.get(g.entity) ?? []), `- ${g.field}: ${value}`]);
  }
  for (const [entity, lines] of byEntity) { saveNote({ type: opts.entityType, title: entity, body: `Confirmed by owner from imported data.\n${lines.join("\n")}`, source: "import" }); wrote.push(entity); }
  save(st);
  return { confirmedFacts: chosen.size, notesWritten: wrote, stillOpenConflicts: review().conflicts.length };
};

export const confirmPayments = () => {
  const p = review().payments;
  if (!p.length) return { written: 0 };
  const body = ["Imported payments. Rows seen in 2+ sources are more reliable.", "", ...p.map((x) => `- ${x.date} $${x.amount.toFixed(2)} from ${x.entity} (${x.sources.join(", ")})`)].join("\n");
  saveNote({ type: "payment", title: "Imported payments", body, source: "import" });
  return { written: p.length };
};
