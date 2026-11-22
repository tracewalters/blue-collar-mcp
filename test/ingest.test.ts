import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

process.env.PERMIT_MCP_HOME = mkdtempSync(join(tmpdir(), "ingest-"));
const ing = await import("../src/ingest.ts");
const brain = await import("../src/brain.ts");

const items = [
  { id: "1", source: "gmail", date: "2026-10-01", from: "Jane <jane@x.com>", subject: "Pool quote", body: "Call me at (602) 555-0101. Job is at 12 Oak St.\n\nOn Mon, Jane wrote:\n> old text 480-555-9999" },
  { id: "2", source: "gmail", date: "2026-11-01", from: "jane@x.com", subject: "Re: Pool", body: "New number 480-555-0199 please. Same site 12 Oak St." },
  { id: "3", source: "gmail", date: "2026-10-05", from: "deals@shop.com", subject: "50% off sale ends", body: "limited time", unsubscribe: true },
  { id: "4", source: "gmail", date: "2026-10-10", from: "noreply@bank.com", subject: "Payment received", body: "Thank you for your payment of $2,500.00" },
  { id: "5", source: "quickbooks", date: "2026-10-10", structured: { customer: "noreply@bank.com", amount: 2500 } },
];

test("noise dropped, receipts kept, quotes stripped", () => {
  const r = ing.run(items, true);
  assert.equal(r.kept, 4);
  assert.deepEqual(r.skipped, { promo: 1 });
  assert.equal(ing.clean(items[0].body).includes("old text"), false);
});

test("sources that disagree become conflicts; agreeing facts are clean", () => {
  ing.run(items);
  const r = ing.review();
  const phone = r.conflicts.find((c) => c.field === "phone")!;
  assert.deepEqual(phone.candidates.map((c) => c.value), ["4805550199", "6025550101"]); // newest first
  assert.equal(r.clean.some((c) => c.field === "address"), true);
});

test("same payment from two sources is merged, rerun skips seen items", () => {
  const p = ing.review().payments;
  assert.equal(p.length, 1);
  assert.deepEqual(p[0].sources.sort(), ["gmail", "quickbooks"]);
  assert.equal(ing.run(items).alreadySeen, 5);
});

test("confirm requires an exact candidate and writes to the brain", () => {
  const id = ing.review().conflicts[0].id;
  assert.throws(() => ing.confirm({ entityType: "client", picks: { [id]: "nope" } }), /pick one/);
  const r = ing.confirm({ entityType: "client", allClean: true, picks: { [id]: "4805550199" } });
  assert.equal(r.stillOpenConflicts, 0);
  assert.match(brain.getNote("client", "jane-x-com").body, /4805550199/);
  assert.equal(ing.confirmPayments().written, 1);
});

test("vendor invoices and supplier paperwork are kept even from automated senders", () => {
  const keep = (o: object) => ing.classify({ id: "k", source: "gmail", date: "2026-11-01", ...o }).keep;
  assert.equal(keep({ from: "billing@monterreytile.com", subject: "Invoice 4471 from Monterrey Tile" }), true, "invoice with no dollar sign");
  assert.equal(keep({ from: "noreply@homedepot.com", subject: "Your order has shipped", unsubscribe: true }), true, "supplier order");
  assert.equal(keep({ from: "noreply@city.gov", subject: "Inspection result for permit BLD-1" }), true, "portal notice");
  assert.equal(keep({ from: "no-reply@shop.com", subject: "Receipt", body: "Total USD 1,250.00", unsubscribe: true }), true, "receipt with unsubscribe footer");
  assert.equal(keep({ from: "news@vendor.com", subject: "Our fall newsletter", unsubscribe: true }), false, "real newsletter dropped");
  assert.equal(keep({ from: "deals@x.com", subject: "Order now: 40% off everything" }), false, "promo dropped");
});

test("amounts of 1000 or more parse correctly with or without commas", () => {
  const amt = (body: string) => ing.extract({ id: "a", source: "gmail", date: "2026-11-01", from: "p@x.com", subject: "Receipt", body }, "receipt").find((f) => f.field === "payment")!.amount;
  assert.equal(amt("Paid $2500.00 by Zelle"), 2500);
  assert.equal(amt("Paid $2,500.00"), 2500);
  assert.equal(amt("Paid $12,345"), 12345);
  assert.equal(amt("Deposit $750"), 750);
});
