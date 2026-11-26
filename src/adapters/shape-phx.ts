import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright-core";
import type { Credentials, PortalAdapter, Session } from "../adapter.ts";
import type { Inspection, Permit } from "../schemas.ts";
import { home } from "../vault.ts";

/**
 * City of Phoenix SHAPE PHX (Salesforce/Clariti). No API exists, so this drives a real headless browser
 * signed in as the user. Lessons from Stanley 1.0 (vault Knowledge/sops/shapephx-cli.md) are baked in:
 * dismiss the whatfix "Alright!" modal, click Login with JS, sign in on the Microsoft B2C page, click
 * lightning controls with JS. Reads only here; booking is gated in propose/commit.
 */
const BASE = "https://shapephx.phoenix.gov";
type Sess = { state: unknown; user: string; pass: string };

const chromePath = () => {
  if (process.env.PLAYWRIGHT_CHROMIUM) return process.env.PLAYWRIGHT_CHROMIUM;
  const root = join(homedir(), ".cache", "ms-playwright");
  const d = existsSync(root) ? readdirSync(root).filter((x) => x.startsWith("chromium-")).sort().at(-1) : undefined;
  return d ? join(root, d, "chrome-linux64", "chrome") : undefined;
};

// One browser session at a time per process: the portal dislikes parallel logins.
let chain: Promise<unknown> = Promise.resolve();
const serial = <T>(fn: () => Promise<T>): Promise<T> => { const r = chain.then(fn, fn); chain = r.catch(() => {}); return r; };

const loggedIn = async (p: Page) => /Balance:/i.test(await p.locator("body").innerText().catch(() => ""));

async function dismissModals(p: Page) {
  for (const f of p.frames()) {
    const o = f.locator("text=/^Alright/").first();
    if (await o.count().catch(() => 0)) await o.evaluate((el: HTMLElement) => el.click()).catch(() => {});
  }
  await p.keyboard.press("Escape").catch(() => {});
}

/** Returns an error message, or null when signed in. */
async function signIn(p: Page, c: Credentials): Promise<string | null> {
  await p.goto(`${BASE}/s/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await p.waitForTimeout(5000);
  if (await loggedIn(p)) return null;
  await dismissModals(p);
  await p.waitForTimeout(800);
  for (let a = 0; a < 3 && !/b2clogin/.test(p.url()); a++) {
    await p.locator("a:text-is('Login')").first().evaluate((el: HTMLElement) => el.click()).catch(() => {});
    await p.waitForTimeout(7000);
  }
  if (!/b2clogin/.test(p.url())) {
    // Debug aid: when BCMCP_DEBUG_DIR is set, keep a screenshot of where we got stuck (taken before any password is typed).
    if (process.env.BCMCP_DEBUG_DIR) await p.screenshot({ path: join(process.env.BCMCP_DEBUG_DIR, `shapephx-signin-${Date.now()}.png`) }).catch(() => {});
    console.error(`shape-phx: sign-in page did not load, stuck at ${new URL(p.url()).host}${new URL(p.url()).pathname}`);
    return "The sign-in page did not load. Try again in a minute.";
  }
  await p.locator("input[type=email], input#email, input[name*=mail i], input[placeholder*=mail i]").first().fill(c.username);
  await p.locator("input[type=password]").first().fill(c.password);
  await p.getByRole("button", { name: /sign in|log in|login/i }).first().click();
  for (let i = 0; i < 20; i++) {
    await p.waitForTimeout(2000);
    const t = await p.locator("body").innerText().catch(() => "");
    if (/Balance:/i.test(t)) return null;
    if (/password is incorrect|account.*(locked|not found)|couldn't find your account|we can't find/i.test(t)) return "Shape PHX says the email or password is wrong.";
    if (/verification code|enter code|multi-?factor/i.test(t)) return "Shape PHX is asking for a verification code. That is not supported yet.";
  }
  return "Sign-in did not finish. Check the login at shapephx.phoenix.gov.";
}

const OP_TIMEOUT_MS = 170_000;
const live = new Map<string, unknown>(); // refreshed browser state per user, so a re-login is reused by the next call

/** Runs fn in a signed-in page. Reuses the saved session; if it went stale, signs in again in a clean browser. */
const withPortal = <T>(s: Session, fn: (p: Page) => Promise<T>): Promise<T> => serial(async () => {
  const sess = s as unknown as Sess;
  const browser = await chromium.launch({ executablePath: chromePath(), headless: true, args: ["--no-sandbox"] });
  const work = (async () => {
    let ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, storageState: (live.get(sess.user) ?? sess.state) as never });
    let p = await ctx.newPage();
    p.setDefaultTimeout(25_000);
    await p.goto(`${BASE}/s/permits`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await p.waitForTimeout(6000);
    if (!(await loggedIn(p))) {
      // Stale cookies confuse the sign-in page, so start from a clean context.
      await ctx.close();
      ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
      p = await ctx.newPage();
      p.setDefaultTimeout(25_000);
      const err = await signIn(p, { username: sess.user, password: sess.pass });
      if (err) { console.error(`shape-phx sign-in failed: ${err}`); throw new Error(err); }
      live.set(sess.user, await ctx.storageState());
      await p.goto(`${BASE}/s/permits`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    }
    await p.locator("li.bgccApplicationWidgetItem").first().waitFor({ timeout: 30_000 }).catch(() => {});
    await p.waitForTimeout(1500);
    return fn(p);
  })();
  const limit = new Promise<never>((_, no) => setTimeout(() => no(new Error("Shape PHX took too long. Try again in a minute.")), OP_TIMEOUT_MS).unref());
  try { return await Promise.race([work, limit]); }
  finally { work.catch(() => {}); await browser.close().catch(() => {}); }
});

// ---- mapping portal wording to our schema
const permitStatus = (raw: string, actions: string[]): Permit["status"] => {
  const r = raw.toLowerCase();
  if (r.includes("correction")) return "corrections_required";
  if (r.includes("cancel")) return "cancelled";
  if (r.includes("expire")) return "expired";
  if (r.includes("complete") || r.includes("final")) return "finaled";
  if (r.includes("denied") || r.includes("reject")) return "denied";
  if (r.includes("issued")) return actions.includes("Request Inspection") ? "inspection_phase" : "issued";
  if (r.includes("approved")) return "approved";
  if (r.includes("draft")) return "draft";
  if (r.includes("submit")) return "submitted";
  return "in_review"; // Plan Review, Pre-Log, etc.
};
const inspStatus = (raw: string): Inspection["status"] => {
  const r = raw.toLowerCase();
  if (r === "pending") return "needed";
  if (r.includes("cancel")) return "cancelled";
  if (r === "pass" || r === "passed") return "passed";
  if (r === "completed") return "completed";
  if (/fail|partial|not ready|unable|carryover/.test(r)) return "failed";
  return "scheduled";
};
const isoDay = (s: string) => {
  const d = new Date(/^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) + "T12:00:00" : s + " 12:00:00");
  return isNaN(+d) ? undefined : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

type Row = { num: string; address: string; applicant: string; kind: string; work: string; status: string; actions: string[]; section: string };

async function readPermits(p: Page, j: string): Promise<Permit[]> {
  const rows: Row[] = await p.locator("li.bgccApplicationWidgetItem").evaluateAll((els) => els.map((li) => {
    const lines = (li as HTMLElement).innerText.split("\n").map((x) => x.trim()).filter(Boolean);
    const links = [...li.querySelectorAll("a,button")].map((a) => (a as HTMLElement).innerText.trim()).filter(Boolean);
    const sec = (li.closest("article")?.querySelector(".slds-card__header") as HTMLElement | null)?.innerText.trim() ?? "";
    const cut = lines.findIndex((l) => l === "View" || l === "View Permit");
    const body = lines.slice(1, cut < 0 ? undefined : cut).filter((l) => l !== "|"); // drop the icon word and the action links after the status
    const addr = body.find((l) => /\((Active|Inactive)\)/i.test(l)) ?? "";
    const rest = body.filter((l) => l !== addr);
    const num = rest.shift() ?? "";
    // after the number: [unit?] applicant, category, work type?, status. Status is last.
    const status = rest.pop() ?? "";
    return { num, address: addr.replace(/\s*\((Active|Inactive)\)/i, ""), applicant: rest.find((x) => /^[A-Za-z .'-]+$/.test(x)) ?? "", kind: rest.find((x) => /construction|trades|residential|grading|civil/i.test(x)) ?? "", work: rest.filter((x) => !/^\d+$/.test(x)).at(-1) ?? "", status, actions: links.filter((l) => l !== "View"), section: sec };
  }));
  const shared: { num: string; applicant: string; kind: string; created: string; status: string }[] = await p.locator("table tbody tr").evaluateAll((trs) => trs.map((t) => {
    const c = [...t.querySelectorAll("th,td")].map((x) => (x as HTMLElement).innerText.trim());
    return { num: c[0] ?? "", applicant: c[2] ?? "", kind: c[3] ?? "", created: c[4] ?? "", status: c[5] ?? "" };
  })).catch(() => []);
  const out: Permit[] = rows.filter((r) => r.num).map((r) => ({
    id: r.num.replace(/\s+/g, ""), jurisdiction: j, type: r.kind || "Permit", address: r.address, description: r.work && r.work !== r.kind ? r.work : undefined,
    status: permitStatus(r.status, r.actions), feesDue: 0, actions: r.actions.filter((a) => a !== "View Permit"),
  }));
  for (const s of shared) if (/^[A-Z]{2,4}-/.test(s.num)) out.push({ id: s.num, jurisdiction: j, type: s.kind, address: "", description: `Shared with you by ${s.applicant}`, status: permitStatus(s.status, []), appliedAt: isoDay(s.created.slice(0, 10)), feesDue: 0, actions: [] });
  return out;
}

// ---- record ids (needed to open a permit's inspection scheduler). Cached on disk per company.
const ridFile = () => join(home(), "shapephx-rids.json");
const rids = (): Record<string, string> => { try { return JSON.parse(readFileSync(ridFile(), "utf8")); } catch { return {}; } };

async function recordId(p: Page, permitId: string): Promise<string> {
  const known = rids()[permitId];
  if (known) return known;
  await p.goto(`${BASE}/s/permits`, { waitUntil: "domcontentloaded" });
  await p.locator("li.bgccApplicationWidgetItem").first().waitFor({ timeout: 30_000 });
  await p.waitForTimeout(1500);
  const li = p.locator("li.bgccApplicationWidgetItem", { hasText: new RegExp(permitId.replace(/[-]/g, "-\\s*")) }).first();
  if (!(await li.count())) throw new Error(`Permit ${permitId} not found in your Shape PHX account.`);
  await li.getByText("View", { exact: true }).first().evaluate((el: HTMLElement) => el.click());
  await p.waitForURL(/recordId=/, { timeout: 20_000 });
  const id = new URL(p.url()).searchParams.get("recordId")!;
  writeFileSync(ridFile(), JSON.stringify({ ...rids(), [permitId]: id }), { mode: 0o600 });
  return id;
}

async function readInspections(p: Page, permitId: string): Promise<Inspection[]> {
  const rid = await recordId(p, permitId);
  await p.goto(`${BASE}/s/inspection-scheduler?permitId=${rid}`, { waitUntil: "domcontentloaded" });
  // Tables render empty first and fill in a moment later. Playwright locators see through the shadow DOM.
  await p.locator("lightning-datatable table tbody tr", { hasText: /INS-/ }).first().waitFor({ timeout: 30_000 }).catch(() => {});
  await p.waitForTimeout(2000);
  const tables: { head: string[]; rows: string[][] }[] = await p.locator("lightning-datatable table").evaluateAll((els) => els.map((el) => ({
    head: [...el.querySelectorAll("thead th")].map((h) => (h as HTMLElement).innerText.trim().split("\n")[0]),
    rows: [...el.querySelectorAll("tbody tr")].map((tr) => [...tr.querySelectorAll("th,td")].map((c) => (c as HTMLElement).innerText.trim().split("\n")[0])),
  })));
  const out: Inspection[] = [];
  tables.forEach((t, ti) => {
    const col = (n: string) => t.head.findIndex((h) => h.toLowerCase().startsWith(n));
    const [cType, cNum, cStat, cSched, cDone] = [col("inspection type"), col("number"), col("status"), col("scheduled start"), col("completed")];
    for (const r of t.rows) {
      if (!r[cNum] || !/^INS-/.test(r[cNum])) continue;
      const raw = r[cStat] ?? "";
      const status = ti === 0 ? "needed" : ti === 1 ? "scheduled" : inspStatus(raw);
      out.push({ id: r[cNum], permitId, type: r[cType] ?? "", status, scheduledFor: isoDay(r[cSched] ?? "") ?? isoDay(r[cDone] ?? ""), notes: ti === 2 ? raw : undefined });
    }
  });
  return out;
}

export const shapePhx: PortalAdapter = {
  platform: "shape-phx",
  maturity: "ready",

  login: (_j, c) => serial(async () => {
    const browser = await chromium.launch({ executablePath: chromePath(), headless: true, args: ["--no-sandbox"] });
    try {
      const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
      const p = await ctx.newPage();
      p.setDefaultTimeout(25_000);
      const err = await signIn(p, c);
      if (err) return { ok: false as const, reason: /wrong/.test(err) ? "bad_credentials" as const : /code/.test(err) ? "needs_2fa" as const : "unsupported" as const, message: err };
      const session: Sess = { state: await ctx.storageState(), user: c.username, pass: c.password };
      return { ok: true as const, session: session as unknown as Session };
    } finally { await browser.close(); }
  }),

  // No cache here: src/service.ts owns freshness (ADR 0002).
  listPermits: (j, s) => withPortal(s, (p) => readPermits(p, j.id)),

  getPermit: async (j, s, id) => (await shapePhx.listPermits(j, s)).find((x) => x.id.toLowerCase() === id.toLowerCase()),

  /** One browser session: the permit list (already open) tells which permits can have inspections, then each one is read. */
  listInspections: (j, s, permitId) => withPortal(s, async (p) => {
    // Only permits that can have inspections: issued or in the inspection phase, not just shared with you.
    const ids = permitId ? [permitId] : (await readPermits(p, j.id)).filter((x) => (x.status === "issued" || x.status === "inspection_phase") && !x.description?.startsWith("Shared with you")).map((x) => x.id);
    const out: Inspection[] = [], failed: string[] = [];
    for (const id of ids) {
      try { out.push(...await readInspections(p, id)); }
      catch (e) { failed.push(`${id}: ${(e as Error).message}`); }
    }
    if (ids.length && failed.length === ids.length) throw new Error(`Could not read inspections. ${failed[0]}`);
    return out;
  }),

  async proposeInspection() { throw new Error("Booking inspections on Shape PHX is not enabled yet."); },
  async commit() { throw new Error("Booking inspections on Shape PHX is not enabled yet."); },
};
