import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright-core";
import { portalDate, type Credentials, type InspectionRequest, type PortalAdapter, type Session } from "../adapter.ts";
import type { Plan } from "../schemas.ts";
import type { Inspection, Permit } from "../schemas.ts";
import { home } from "../vault.ts";

/**
 * City of Phoenix SHAPE PHX (Salesforce/Clariti). No API exists, so this drives a real headless browser
 * signed in as the user. Lessons from Stanley 1.0 (vault Knowledge/sops/shapephx-cli.md) are baked in:
 * dismiss the whatfix "Alright!" modal, click Login with JS, sign in on the Microsoft B2C page, click
 * lightning controls with JS. Booking is a dry run only: fill the Request form, read it back, press Cancel.
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

const FRESH_MS = 5 * 60_000;
const cache = new Map<string, { at: number; data: unknown }>();
const cached = async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < FRESH_MS) return hit.data as T;
  const data = await fn();
  cache.set(key, { at: Date.now(), data });
  return data;
};

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

// ---- booking dry run (Stanley's `request-inspection --stop-before-save`). UNVERIFIED in this codebase: no test login yet.
// The Request button sits in a scrolled lightning-datatable and modal inputs live in shadow DOM, so every click,
// focus and read goes through JS with a shadow-DOM-aware query (window.__all). Typing uses the real keyboard.
const DEEP_ALL = "window.__all=function a(root,sel,out){out=out||[];root.querySelectorAll('*').forEach(function(e){if(e.matches(sel))out.push(e);if(e.shadowRoot)a(e.shadowRoot,sel,out)});return out}";
type Deep = (root: ParentNode, sel: string) => HTMLElement[];
const FIELDS = { date: "SHPE_Preferred_Date__c", name: "SHPE_Site_Contact_Name__c", phone: "SHPE_Site_Contact_Phone_Number__c", email: "SHPE_Site_Contact_Email_Address__c" };

const modalState = (p: Page) => p.evaluate(() => {
  const all = (window as unknown as { __all: Deep }).__all;
  const m = all(document, "section.slds-modal")[0];
  if (!m) return null;
  const inputs = all(m, "input,textarea") as (HTMLInputElement | HTMLTextAreaElement)[];
  return {
    values: Object.fromEntries(inputs.filter((e) => e.name).map((e) => [e.name, e.value])),
    help: all(m, ".slds-form-element__help").map((e) => e.innerText.trim()).filter(Boolean),
  };
});

/** Focus one modal field by its Salesforce name, replace its value by typing, then fire change. */
async function fillField(p: Page, name: string, value: string) {
  const found = await p.evaluate((n) => {
    const all = (window as unknown as { __all: Deep }).__all;
    const e = all(document, "section.slds-modal input, section.slds-modal textarea").find((x) => (x as HTMLInputElement).name === n) as HTMLInputElement | undefined;
    if (!e) return false;
    e.focus(); e.select?.();
    return true;
  }, name);
  if (!found) throw new Error(`The Request form has no ${name} field. Shape PHX may have changed.`);
  await p.keyboard.type(value, { delay: 20 });
  await p.waitForTimeout(600);
  await p.evaluate((n) => {
    const all = (window as unknown as { __all: Deep }).__all;
    const e = all(document, "section.slds-modal input, section.slds-modal textarea").find((x) => (x as HTMLInputElement).name === n);
    e?.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    e?.blur();
  }, name);
}

const pressModalCancel = (p: Page) => p.evaluate(() => {
  const all = (window as unknown as { __all: Deep }).__all;
  all(document, "section.slds-modal button").find((x) => x.innerText.trim() === "Cancel")?.click();
}).catch(() => {});

async function dryRunRequest(p: Page, j: string, r: InspectionRequest): Promise<Plan> {
  const rows = await readInspections(p, r.permitId); // leaves the page on the Inspection Scheduler
  const want = r.type.toLowerCase();
  const done = rows.find((i) => i.status === "scheduled" && i.type.toLowerCase() === want);
  if (done) throw new Error(`${done.type} (${done.id}) is already scheduled on ${r.permitId}.`);
  const open = rows.filter((i) => i.status === "needed" && i.type.toLowerCase() === want);
  if (!open.length) {
    const types = rows.filter((i) => i.status === "needed").map((i) => i.type);
    throw new Error(`No ${r.type} inspection is open to request on ${r.permitId}.${types.length ? ` Open: ${[...new Set(types)].join(", ")}.` : ""}`);
  }
  if (open.length > 1) throw new Error(`${r.permitId} has ${open.length} open ${r.type} inspections (${open.map((i) => i.id).join(", ")}). Request it in the portal.`);
  const ins = open[0];

  await p.evaluate(DEEP_ALL);
  const clicked = await p.evaluate((id) => {
    const all = (window as unknown as { __all: Deep }).__all;
    const tr = all(document, "tr").filter((t) => t.innerText.includes(id) && t.innerText.includes("Request"));
    if (tr.length !== 1) return `rows:${tr.length}`;
    if ((tr[0].innerText.match(/INS-\d+/g) ?? []).length !== 1) return "ambiguous";
    tr[0].scrollIntoView({ block: "center" });
    const bt = all(tr[0], "button").find((x) => x.innerText.trim() === "Request");
    if (!bt) return "no Request button";
    bt.click();
    return "ok";
  }, ins.id);
  if (clicked !== "ok") throw new Error(`Could not open the Request form for ${ins.id} (${clicked}). Nothing was sent.`);

  try {
    let st = null;
    for (let i = 0; i < 10 && !st; i++) { await p.waitForTimeout(1500); st = await modalState(p); }
    if (!st) throw new Error("The Request form did not open. Nothing was sent.");
    if (st.values.Name !== ins.id) throw new Error(`The form opened for ${st.values.Name ?? "another inspection"}, not ${ins.id}. Nothing was sent.`);

    const fill: Record<string, string> = { [FIELDS.date]: portalDate(r.date), [FIELDS.name]: r.contact.name };
    if (r.contact.phone) fill[FIELDS.phone] = r.contact.phone;
    if (r.contact.email) fill[FIELDS.email] = r.contact.email;
    for (const [k, v] of Object.entries(fill)) if (v) await fillField(p, k, v);
    await p.waitForTimeout(1000);

    st = await modalState(p);
    const got = st?.values ?? {};
    const off = Object.entries(fill).filter(([k, v]) => v && (got[k] ?? "").trim() !== v);
    const help = (st?.help ?? []).filter((h) => /invalid|does not match|required|complete this/i.test(h));
    if (off.length || help.length) throw new Error(`Shape PHX did not accept the form: ${help[0] ?? off.map(([k]) => k).join(", ")}. Nothing was sent.`);

    return {
      action: "schedule_inspection",
      connectionId: j,
      summary: `Dry run: filled the Shape PHX Request form for ${ins.type} (${ins.id}) on ${r.permitId}, ${portalDate(r.date)}, then pressed Cancel. Nothing was sent.`,
      params: { permitId: r.permitId, inspectionId: ins.id, type: ins.type, date: r.date, contact: r.contact },
      preview: {
        Permit: r.permitId, Inspection: `${ins.id} ${ins.type}`, "Preferred Date": got[FIELDS.date] ?? "",
        "Site Contact Name": got[FIELDS.name] ?? "", "Site Contact Phone": got[FIELDS.phone] ?? "", "Site Contact Email": got[FIELDS.email] ?? "",
      },
    };
  } finally {
    await pressModalCancel(p); // always stop before Save
    await p.waitForTimeout(1000);
  }
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

  listPermits: (j, s) => cached(`p:${(s as unknown as Sess).user}`, () => withPortal(s, (p) => readPermits(p, j.id))),

  getPermit: async (j, s, id) => (await shapePhx.listPermits(j, s)).find((x) => x.id.toLowerCase() === id.toLowerCase()),

  async listInspections(j, s, permitId) {
    const user = (s as unknown as Sess).user;
    const permits = await shapePhx.listPermits(j, s);
    // Only permits that can have inspections: issued or in the inspection phase, not just shared with you.
    const ids = permitId ? [permitId] : permits.filter((x) => (x.status === "issued" || x.status === "inspection_phase") && !x.description?.startsWith("Shared with you")).map((x) => x.id);
    const need = ids.filter((id) => !cache.has(`i:${user}:${id}`) || Date.now() - cache.get(`i:${user}:${id}`)!.at >= FRESH_MS);
    if (need.length) {
      // One browser session for all permits.
      const failed: string[] = [];
      await withPortal(s, async (p) => {
        for (const id of need) {
          try { cache.set(`i:${user}:${id}`, { at: Date.now(), data: await readInspections(p, id) }); }
          catch (e) { failed.push(`${id}: ${(e as Error).message}`); }
        }
      });
      if (failed.length === need.length) throw new Error(`Could not read inspections. ${failed[0]}`);
    }
    return ids.flatMap((id) => (cache.get(`i:${user}:${id}`)?.data as Inspection[] | undefined) ?? []);
  },

  async proposeInspection(j, s, r) {
    if (!r.contact.phone && !r.contact.email) throw new Error("Add a site contact phone or email to your company profile first.");
    return withPortal(s, (p) => dryRunRequest(p, j.id, r));
  },
  async commit() { throw new Error("Booking inspections on Shape PHX is not enabled yet."); },
};
