import { chromium, type Page } from "playwright-core";
import type { Credentials, PortalAdapter, Session } from "../adapter.ts";
import type { Inspection, Jurisdiction, Permit } from "../schemas.ts";
import { chromePath } from "./shape-phx.ts";

/**
 * Accela Citizen Access (ACA), used by many cities. One adapter, cities are config: the jurisdiction's baseUrl is
 * the agency's ACA root, e.g. https://aca-prod.accela.com/AVONDALE. ACA is ASP.NET WebForms (postbacks, no JSON
 * for records), so a headless browser signs in as the user and the pages' HTML is parsed here with plain functions
 * (tested on fixtures in test/fixtures/accela). Reads only: booking is refused until verified (see PORTAL_NOTES).
 */
type Sess = { state: unknown; user: string; pass: string };
type Row = { num: string; type: string; description: string; project: string; status: string; expires: string; date: string; address: string; actions: string[]; detailUrl?: string };
export type InspRow = Inspection & { detailUrl?: string };

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const root = (j: Jurisdiction) => j.baseUrl.replace(/\/+$/, "");
const abs = (j: Jurisdiction, href: string) => new URL(href, root(j) + "/").href;
const myRecords = (j: Jurisdiction) => `${root(j)}/Cap/MyRecordsCap.aspx?TabName=Home&TabList=Home`;

// ---- HTML helpers (no DOM library: keep dependencies at zero)
const decode = (s: string) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
export const htmlText = (h: string) => decode(h.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<br\s*\/?>|<\/(div|tr|p|h\d)>/gi, "\n").replace(/<[^>]+>/g, " "))
  .split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
const one = (s: string) => htmlText(s).replace(/\n/g, " ");
/** Inner text of the element whose id ends with `_<suffix>`. */
const byId = (h: string, suffix: string) => {
  const m = h.match(new RegExp(`<(span|div|a)[^>]*id="[^"]*_${suffix}"[^>]*>([\\s\\S]*?)</\\1>`));
  return m ? one(m[2]) : "";
};
export const isoDay = (s = "") => {
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : undefined;
};

/** Rows of an ACA record grid (`gdvPermitList`): the public search and My Records use the same control. */
export function parseRecordList(html: string): Row[] {
  const parts = html.split(/<tr class="ACA_TabRow_(?:Odd|Even)[^"]*">/).slice(1);
  return parts.map((r) => {
    r = r.split("</tr>")[0] + r.slice(r.indexOf("</tr>")).split(/<tr[ >]/)[0]; // the row only
    const href = r.match(/id="[^"]*_hlPermitNumber"[^>]*href="([^"]+)"/)?.[1];
    const actions = [...r.matchAll(/<a\b(?![^>]*hlPermitNumber)[^>]*>([\s\S]*?)<\/a>/g)].map((m) => one(m[1])).filter(Boolean);
    return {
      num: byId(r, "lblPermitNumber1") || byId(r, "lblPermitNumber"),
      type: byId(r, "lblType"), description: byId(r, "lblDescription"), project: byId(r, "lblProjectName"),
      status: byId(r, "lblStatus"), expires: byId(r, "lblExpirationDate"), date: byId(r, "lblUpdatedTime"),
      address: byId(r, "lblAddress") || byId(r, "lblPermitAddress"),
      actions, detailUrl: href ? decode(href) : undefined,
    };
  }).filter((r) => r.num);
}

export const permitStatus = (raw: string, num = ""): Permit["status"] => {
  const r = raw.toLowerCase();
  if (!r) return /TMP/i.test(num) ? "draft" : "submitted";
  if (/correction|resubmit|additional info|info required|revision/.test(r)) return "corrections_required";
  if (/withdrawn|void|cancel/.test(r)) return "cancelled";
  if (/expire/.test(r)) return "expired";
  if (/final|closed|complete/.test(r)) return "finaled";
  if (/denied|reject/.test(r)) return "denied";
  if (/issued|active|inspection/.test(r)) return "issued";
  if (/approved|ready to issue/.test(r)) return "approved";
  if (/received|submitted|pending|accepted/.test(r)) return "submitted";
  return "in_review";
};

export const inspStatus = (raw: string, upcoming: boolean): Inspection["status"] => {
  const r = raw.toLowerCase();
  if (/cancel/.test(r)) return "cancelled";
  if (upcoming) return "scheduled"; // Scheduled, Pending, Requested: on the city's calendar or waiting for a date
  if (/disapprov|fail|denied|correction|not ready|partial|no access|re-?inspect/.test(r)) return "failed";
  if (/pass|approv/.test(r)) return "passed";
  return "completed";
};

/** Upcoming and Completed inspections from a record page (`InspectionList`). Row text: "06/22/2027 at TBD Scheduled", "Final Walk-thru (539944)", "Inspector: Name". */
export function parseInspections(html: string, permitId: string): InspRow[] {
  const up = html.indexOf("_gvListUpcoming"), done = html.indexOf("_completedPanel");
  const out: InspRow[] = [];
  for (const m of html.matchAll(/<tr class="InspectionListRow">([\s\S]*?)(?=<tr class="InspectionListRow">|_completedPanel"|<!--Attachment-->|$)/g)) {
    const r = m[1];
    const upcoming = up >= 0 && m.index > up && (done < 0 || m.index < done);
    const spans = [...r.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g)].map((s) => one(s[1])).filter((s) => s && s !== "Actions");
    const typeLine = spans.find((s) => /\(\d+\)$/.test(s));
    if (!typeLine) continue;
    const head = spans.filter((s) => s !== typeLine && !/^(Inspector|Result(ed)? by|Requested by|Scheduled by)\b/i.test(s)).join(" ");
    const raw = head.replace(/\d{1,2}\/\d{1,2}\/\d{4}/, "").replace(/\bat\s+(TBD|\d{1,2}:\d{2}\s*[AP]M)(\s*-\s*\d{1,2}:\d{2}\s*[AP]M)?/i, "").replace(/\s+/g, " ").trim();
    const inspector = spans.find((s) => /^Inspector\b/i.test(s))?.replace(/^Inspector:?\s*/i, "");
    const url = r.match(/'([^']*\/Inspection\/InspectionDetails\.aspx\?[^']+)'/)?.[1];
    out.push({
      id: typeLine.match(/\((\d+)\)$/)![1], permitId, type: typeLine.replace(/\s*\(\d+\)$/, ""),
      status: inspStatus(raw, upcoming), scheduledFor: isoDay(head),
      notes: [raw, inspector && `Inspector: ${inspector}`].filter(Boolean).join(". ") || undefined,
      detailUrl: url ? decode(url) : undefined,
    });
  }
  return out;
}

/** Fees the user still owes, from the record's Fees tab text ("Outstanding:" before "Paid:"). */
export function feesDue(text: string): number {
  const owed = text.split(/\nPaid:?\n/i)[0].split(/Outstanding:?/i)[1] ?? "";
  const total = owed.match(/Total[^$\n]*\$\s*([\d,]+\.\d{2})/i);
  const amounts = total ? [total[1]] : [...owed.matchAll(/\$\s*([\d,]+\.\d{2})/g)].map((x) => x[1]);
  return Math.round(amounts.reduce((a, x) => a + Number(x.replace(/,/g, "")), 0) * 100) / 100;
}

/** Conditions of approval with a blocking severity (Hold, Lock), from a record page. Unverified live: markup guessed. */
export function holds(html: string): string[] {
  const names = [...html.matchAll(/id="[^"]*_(?:lblConditionName|lblConditionTitle)"[^>]*>([\s\S]*?)<\/span>([\s\S]{0,1500})/g)];
  return names.filter((m) => /\b(Hold|Lock)\b/i.test(one(m[2].split(/_lblCondition(?:Name|Title)"/)[0]))).map((m) => one(m[1])).filter(Boolean);
}

/** The inspection details popup (`Inspection/InspectionDetails.aspx`): status, its date, and the hidden Result Comments grid. */
export function parseInspectionDetails(html: string) {
  const grid = html.match(/id="[^"]*_gdvInspectionResultCommentList"[\s\S]*?<\/table>\s*<\/div>\s*<\/div>/)?.[0] ?? "";
  const comments = [...grid.matchAll(/<tr class="ACA_TabRow_(?:Odd|Even)[^"]*">([\s\S]*?)<\/tr>/g)].map((m) => htmlText(m[1])).filter(Boolean);
  return { status: byId(html, "lblStatus"), date: isoDay(byId(html, "lblStatusDate")), comments: comments.join("\n") || undefined };
}

// ---- browser session
let chain: Promise<unknown> = Promise.resolve();
const serial = <T>(fn: () => Promise<T>): Promise<T> => { const r = chain.then(fn, fn); chain = r.catch(() => {}); return r; };
const live = new Map<string, unknown>();
const urls = new Map<string, string>(); // `${city}:${permit}` -> record page, filled by every list read
const OP_TIMEOUT_MS = 170_000;

/** ACA rate-limits fast clients (HTTP 429 for minutes), so every page load is paced. */
async function go(p: Page, url: string) {
  await p.waitForTimeout(1500);
  const r = await p.goto(url, { waitUntil: "load", timeout: 60_000 });
  if (r?.status() === 429) throw new Error("The city portal is busy (rate limit). Try again in a few minutes.");
}
const onLogin = (p: Page) => /\/login\.aspx/i.test(p.url());

async function signIn(p: Page, j: Jurisdiction, c: Credentials): Promise<string | null> {
  await go(p, `${root(j)}/Login.aspx`);
  let f = p.frames().find((x) => /login-panel/.test(x.url()));
  for (let i = 0; i < 10 && !f; i++) { await p.waitForTimeout(1000); f = p.frames().find((x) => /login-panel/.test(x.url())); }
  if (!f) return "The sign-in page did not load. Try again in a minute.";
  await f.locator("#username").waitFor({ timeout: 30_000 });
  await f.locator("#username").fill(c.username);
  await f.locator("input[type=password]").fill(c.password);
  await f.getByRole("button", { name: /sign in/i }).click();
  for (let i = 0; i < 20; i++) {
    await p.waitForTimeout(1500);
    if (!onLogin(p)) return null;
    const t = await f.locator("body").innerText().catch(() => "");
    if (/invalid|incorrect|not match|locked|disabled/i.test(t)) return `${j.name} says the user name or password is wrong.`;
    if (/security question|verification code/i.test(t)) return `${j.name} is asking for a security question or code. That is not supported yet.`;
  }
  return `Sign-in did not finish. Check the login at ${new URL(j.baseUrl).host}.`;
}

/** Runs fn on My Records, signed in. Reuses the saved session; signs in again when ACA sends us to Login.aspx. */
const withPortal = <T>(j: Jurisdiction, s: Session, fn: (p: Page) => Promise<T>): Promise<T> => serial(async () => {
  const sess = s as unknown as Sess;
  const browser = await chromium.launch({ executablePath: chromePath(), headless: true, args: ["--no-sandbox"] });
  const work = (async () => {
    const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1400, height: 1000 }, storageState: (live.get(sess.user) ?? sess.state) as never });
    const p = await ctx.newPage();
    p.setDefaultTimeout(25_000);
    await go(p, myRecords(j));
    if (onLogin(p)) {
      const err = await signIn(p, j, { username: sess.user, password: sess.pass });
      if (err) throw new Error(err);
      live.set(sess.user, await ctx.storageState());
      await go(p, myRecords(j));
    }
    return fn(p);
  })();
  const limit = new Promise<never>((_, no) => setTimeout(() => no(new Error(`${j.name} took too long. Try again in a minute.`)), OP_TIMEOUT_MS).unref());
  try { return await Promise.race([work, limit]); }
  finally { work.catch(() => {}); await browser.close().catch(() => {}); }
});

const toPermit = (j: Jurisdiction, r: Row): Permit => ({
  id: r.num, jurisdiction: j.id, type: r.type || "Record", address: r.address,
  description: r.description || r.project || undefined, status: permitStatus(r.status, r.num),
  appliedAt: isoDay(r.date), expiresAt: isoDay(r.expires), feesDue: 0, actions: r.actions,
});

/** All pages of My Records (the page is already open). */
async function readList(p: Page, j: Jurisdiction): Promise<Row[]> {
  const rows: Row[] = [];
  for (let page = 0; page < 20; page++) {
    for (const r of parseRecordList(await p.content())) if (!rows.some((x) => x.num === r.num)) rows.push(r);
    const next = p.locator("table[id$=gdvPermitList] a", { hasText: /^\s*Next\s*>?\s*$/ }).first();
    if (!(await next.count())) break;
    await p.waitForTimeout(1500);
    await next.click();
    await p.waitForLoadState("load");
    await p.waitForTimeout(2000);
  }
  for (const r of rows) if (r.detailUrl) urls.set(`${j.id}:${r.num}`, abs(j, r.detailUrl));
  return rows;
}

async function openRecord(p: Page, j: Jurisdiction, permitId: string): Promise<string> {
  let url = urls.get(`${j.id}:${permitId}`);
  if (!url) { await readList(p, j); url = urls.get(`${j.id}:${permitId}`); }
  if (!url) throw new Error(`${permitId} is not in your ${j.name} records.`);
  await go(p, url);
  // Inspections and fees load by postback/XHR after the page itself.
  await p.locator("[id$=InspectionList_gvListCompleted], [id$=InspectionList_lblEmptyUpcoming]").first().waitFor({ timeout: 20_000 }).catch(() => {});
  await p.waitForTimeout(2000);
  return p.content();
}

export const accela: PortalAdapter = {
  platform: "accela",
  // Built from public recon only (no login yet). Flip to "ready" after a live read works (docs/PORTAL_NOTES.md).
  maturity: "planned",
  bookingVerified: false,

  login: (j, c) => serial(async () => {
    const browser = await chromium.launch({ executablePath: chromePath(), headless: true, args: ["--no-sandbox"] });
    try {
      const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1400, height: 1000 } });
      const p = await ctx.newPage();
      p.setDefaultTimeout(25_000);
      const err = await signIn(p, j, c);
      if (err) return { ok: false as const, reason: /wrong/.test(err) ? "bad_credentials" as const : /code|question/.test(err) ? "needs_2fa" as const : "unsupported" as const, message: err };
      return { ok: true as const, session: { state: await ctx.storageState(), user: c.username, pass: c.password } as unknown as Session };
    } finally { await browser.close(); }
  }),

  listPermits: (j, s) => withPortal(j, s, async (p) => (await readList(p, j)).map((r) => toPermit(j, r))),

  getPermit: (j, s, id) => withPortal(j, s, async (p) => {
    const row = (await readList(p, j)).find((r) => r.num.toLowerCase() === id.toLowerCase());
    if (!row) return undefined;
    const html = await openRecord(p, j, row.num);
    const fees = await p.locator("[id$=PlaceHolderMain_divFee]").innerText().catch(() => "");
    const h = holds(html);
    return { ...toPermit(j, row), status: permitStatus(byId(html, "lblRecordStatus") || row.status, row.num), feesDue: feesDue(fees), ...(h.length ? { holds: h } : {}) };
  }),

  listInspections: (j, s, permitId) => withPortal(j, s, async (p) => {
    const rows = await readList(p, j);
    const ids = permitId ? [permitId] : rows.map((r) => toPermit(j, r)).filter((x) => x.status === "issued" || x.status === "inspection_phase").map((x) => x.id);
    const out: Inspection[] = [], failed: string[] = [];
    for (const id of ids) {
      try { out.push(...parseInspections(await openRecord(p, j, id), id).map(({ detailUrl: _, ...i }) => i)); }
      catch (e) { failed.push(`${id}: ${(e as Error).message}`); }
    }
    if (ids.length && failed.length === ids.length) throw new Error(`Could not read inspections. ${failed[0]}`);
    return out;
  }),

  async getInspection(j, s, permitId, inspectionId) {
    if (!/^\d+$/.test(inspectionId)) throw new Error(`"${inspectionId}" is not an Accela inspection number (digits, like 539944).`);
    return withPortal(j, s, async (p) => {
      const row = parseInspections(await openRecord(p, j, permitId), permitId).find((i) => i.id === inspectionId);
      if (!row) return undefined;
      const { detailUrl, ...ins } = row;
      if (!detailUrl) return ins;
      await go(p, abs(j, detailUrl));
      const d = parseInspectionDetails(await p.content());
      return { ...ins, scheduledFor: d.date ?? ins.scheduledFor, comments: d.comments };
    });
  },

  async proposeInspection(j) { throw new Error(`Booking for ${j.name} is being tested; not available yet.`); },
  async commit(j) { throw new Error(`Booking inspections on ${j.name} is not enabled yet.`); },
};
