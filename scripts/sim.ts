// Sandbox simulation. Fake data, temp folder, ZERO model calls. Run: npm run sim
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.PERMIT_MCP_HOME = mkdtempSync(join(tmpdir(), "sim-"));
import type { Item } from "../src/brain/ingest.ts";
const ing = await import("../src/brain/ingest.ts");
const brain = await import("../src/brain/notes.ts");

// Seeded random so runs are repeatable.
let seed = 42;
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const day = (n: number) => new Date(Date.UTC(2026, 10, 20) - n * 864e5).toISOString().slice(0, 10);
const clients = Array.from({ length: 40 }, (_, i) => ({ email: `client${i}@mail.com`, phone: `480555${String(1000 + i)}`, street: `${100 + i * 7} E Oak St` }));

type Truth = "keep" | "drop";
const items: { item: Item; truth: Truth }[] = [];
const add = (truth: Truth, item: Item) => items.push({ truth, item });
let n = 0;
for (let d = 0; d < 90; d++) {
  for (let k = 0; k < 6; k++) {
    const id = String(n++), date = day(d), c = pick(clients);
    const r = rnd();
    if (r < 0.40) add("drop", { id, source: "gmail", date, from: pick(["deals@shop.com", "news@vendor.com", "noreply@social.com"]), subject: pick(["Fall newsletter", "50% off sale ends", "Webinar tomorrow", "Your weekly digest"]), body: "unsubscribe limited time", unsubscribe: rnd() < 0.7 });
    else if (r < 0.55) add("keep", { id, source: "gmail", date, from: pick(["billing@monterreytile.com", "noreply@poolcorp.com", "orders@homedepot.com"]), subject: pick(["Invoice 4471", "Order confirmation", "Delivery scheduled", "Statement"]), body: "Thank you. Total $" + (200 + Math.floor(rnd() * 4000)) + ".00", unsubscribe: rnd() < 0.5 });
    else if (r < 0.62) add("keep", { id, source: "gmail", date, from: "noreply@city.gov", subject: "Inspection result for permit BLD-" + n, body: "Result: passed" });
    else if (r < 0.80) add("keep", { id, source: "gmail", date, from: c.email, subject: "Re: pool", body: `Call me at ${c.phone}. Site is ${c.street}.\n\nOn Mon, Bob wrote:\n> old 602-555-0000` });
    else if (r < 0.90) add("keep", { id, source: "gmail", date, from: c.email, subject: "Receipt", body: `Paid $${500 + Math.floor(rnd() * 3000)}.00 by Zelle` });
    else add("keep", { id, source: "gmail", date, from: c.email, subject: "Quick question", body: "Can we move the start date?" });
  }
}
// Planted problems: 5 clients changed phone number, 5 payments also appear in QuickBooks.
for (let i = 0; i < 5; i++) add("keep", { id: `new${i}`, source: "gmail", date: day(1), from: clients[i].email, subject: "New number", body: `Use my new number 602-555-${9000 + i} now.` });
const pay = items.filter((x) => x.item.subject === "Receipt").slice(0, 5);
for (const [i, p] of pay.entries()) add("keep", { id: `qb${i}`, source: "quickbooks", date: p.item.date, structured: { customer: p.item.from!, kind: "payment", amount: Number(p.item.body!.match(/\$(\d+)/)![1]) } });

const t0 = performance.now();
const res = ing.run(items.map((x) => x.item));
const ms = Math.round(performance.now() - t0);
const wrongDrop = items.filter((x) => x.truth === "keep" && !ing.classify(x.item).keep).length;
const wrongKeep = items.filter((x) => x.truth === "drop" && ing.classify(x.item).keep).length;
const rev = ing.review();
const multiSource = rev.payments.filter((p) => p.sources.length > 1).length;
const phoneConflicts = rev.conflicts.filter((c) => c.field === "phone").length;
const before = ing.run(items.map((x) => x.item)).alreadySeen;

const conf = ing.confirm({ entityType: "client", allClean: true });
for (const c of rev.conflicts.slice(0, 5)) ing.confirm({ entityType: "client", picks: { [c.id]: c.candidates[0].value } });
const hit = brain.searchNotes("client3@mail.com")[0];

console.log(JSON.stringify({
  items: items.length, ms, modelCalls: 0,
  kept: res.kept, skipped: res.skipped,
  mistakes: { keptThatShouldBeDropped: wrongKeep, droppedThatShouldBeKept: wrongDrop },
  conflicts: { phone: phoneConflicts, expected: 5 }, paymentsMergedAcrossSources: { found: multiSource, expected: 5 },
  rerunAlreadySeen: before, estTokensIfEverythingKeptWentToAModel: res.estTokensIfModelUsed,
  confirmedFacts: conf.confirmedFacts, brainSearchWorks: Boolean(hit),
}, null, 2));
const ok = wrongDrop === 0 && wrongKeep === 0 && phoneConflicts >= 5 && multiSource === 5 && before === items.length;
console.log(ok ? "PASS" : "FAIL");
process.exit(ok ? 0 : 1);
