import { chromium } from "playwright-core";
import type { Credentials, PortalAdapter, Session } from "../adapter.ts";
import type { Inspection, Jurisdiction, Permit } from "../schemas.ts";
import { chromePath } from "./shape-phx.ts";

/**
 * Accela Citizen Access (ACA), e.g. Queen Creek's "Development Nexus" at https://aca-prod.accela.com/QC.
 * One adapter for every Accela city: the city is its baseUrl (`https://<host>/<AGENCY>`).
 * Sign-in is Accela Civic ID (FusionAuth at login.accela.com), so it needs a real browser once. Every read after
 * that is plain HTTP with the ACA cookies: record pages, ASP.NET async postbacks and the page's own JSON methods.
 * Cloudflare rate-limits the host (error 1015), so requests go one at a time with a gap. Reads only.
 */
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const GAP_MS = Number(process.env.BCMCP_ACCELA_GAP_MS ?? 1200);
const MODULE = "Permits";
type Sess = { cookies: Record<string, string>; user: string; pass: string };
type CapId = string; // "PMT26-00000-00220"

// ---- small HTML helpers (exported for tests)
const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };
export const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e) => ENT[e]).replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
export const text = (html = "") => decode(html.replace(/<br\s*\/?>/gi, "\n").replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").replace(/<[^>]+>/g, " "))
  .split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
const byId = (html: string, id: string) => html.match(new RegExp(`id="[^"]*${id}"[^>]*>([\\s\\S]*?)</span>`))?.[1];
const isoDay = (s = "") => { const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : undefined; };
const money = (s: string) => Number(s.replace(/[^0-9.]/g, "")) || 0;

/** Hidden ASP.NET form fields (__VIEWSTATE, ACA_CS_FIELD, ...) from a full page. */
export function hiddenFields(html: string) {
  const f: Record<string, string> = {};
  for (const [tag] of html.matchAll(/<input[^>]*type="hidden"[^>]*>/gi)) {
    const n = tag.match(/name="([^"]+)"/)?.[1];
    if (n) f[n] = decode(tag.match(/value="([^"]*)"/)?.[1] ?? "");
  }
  return f;
}

/** ASP.NET AJAX delta response: `len|type|id|content|` repeated. Returns panels, refreshed hidden fields and a redirect if any. */
export function parseDelta(s: string) {
  const panels: Record<string, string> = {}, hidden: Record<string, string> = {};
  let redirect: string | undefined, i = 0;
  while (i < s.length) {
    const a = s.indexOf("|", i), len = Number(s.slice(i, a));
    const b = s.indexOf("|", a + 1), type = s.slice(a + 1, b);
    const c = s.indexOf("|", b + 1), id = s.slice(b + 1, c);
    if (isNaN(len) || a < 0 || b < 0 || c < 0) break;
    const content = s.slice(c + 1, c + 1 + len);
    if (type === "updatePanel") panels[id] = content;
    else if (type === "hiddenField") hidden[id] = content;
    else if (type === "pageRedirect") redirect = decodeURIComponent(content);
    i = c + 1 + len + 1;
  }
  return { panels, hidden, redirect };
}

/** capID1-3 from any link or URL to CapDetail.aspx. */
export const capIdOf = (url: string): CapId | undefined => {
  const m = decode(url).match(/capID1=([^&'"]+)&capID2=([^&'"]+)&capID3=([^&'"]+)/i);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
};

// ---- mapping portal wording to our schema
export const permitStatus = (raw: string): Permit["status"] => {
  const r = raw.toLowerCase();
  if (/correction|resubmit|revision/.test(r)) return "corrections_required";
  if (/cancel|withdraw|void/.test(r)) return "cancelled";
  if (r.includes("expire")) return "expired";
  if (/final|closed|complete/.test(r)) return "finaled";
  if (/denied|reject/.test(r)) return "denied";
  if (/inspection/.test(r)) return "inspection_phase";
  if (/issued|active/.test(r)) return "issued";
  if (/approved|ready to issue/.test(r)) return "approved";
  if (/^(draft|incomplete|saved)/.test(r)) return "draft";
  if (/submit|received|pending|accepted|intake/.test(r)) return "submitted";
  return "in_review"; // Plan Review, In Review, Routed, ...
};
export const inspStatus = (raw: string, upcoming: boolean): Inspection["status"] => {
  const r = raw.toLowerCase();
  if (r.includes("cancel")) return "cancelled";
  if (upcoming) return "scheduled"; // Scheduled, Pending (requested, time not set yet), Rescheduled
  if (/pass|approv/.test(r)) return "passed";
  if (/fail|reject|partial|correction|not ready|disapprov/.test(r)) return "failed";
  return "completed";
};

// ---- parsers (exported for tests, fed by test/fixtures/accela)
export type ListRow = { id: string; capId: CapId; date?: string; type: string; address: string; description: string; status: string; actions: string[] };

/** Search results and "My Records": a GridView whose columns differ by city, so headers pick the cells. */
export function parseRecordList(html: string): { rows: ListRow[]; next?: string } {
  const grid = html.slice(html.indexOf("gdvPermitList"));
  const head = [...(grid.match(/<tr[^>]*ACA_TabRow_Header[\s\S]*?<\/tr>/)?.[0] ?? "").matchAll(/<th[\s\S]*?<\/th>/g)].map((m) => text(m[0]).toLowerCase());
  const col = (re: RegExp) => head.findIndex((h) => re.test(h));
  const ix = { date: col(/date/), id: col(/record #|record number|permit/), type: col(/type/), address: col(/address|location/), desc: col(/description/), project: col(/project/), status: col(/status/), action: col(/action/) };
  const rows: ListRow[] = [];
  for (const [tr] of grid.matchAll(/<tr[^>]*class="ACA_TabRow_(?:Odd|Even)[^"]*"[\s\S]*?<\/tr>/g)) {
    const link = tr.match(/href="([^"]*CapDetail\.aspx[^"]*)"[^>]*>([\s\S]*?)<\/a>/);
    const capId = link && capIdOf(link[1]);
    if (!capId) continue;
    const cells = [...tr.matchAll(/<td[\s\S]*?<\/td>/g)].map((m) => m[0]);
    const cell = (i: number) => (i >= 0 && cells[i] ? text(cells[i]).replace(/\n/g, " ") : "");
    const desc = [cell(ix.project), cell(ix.desc)].filter(Boolean).join(" — ");
    rows.push({
      id: text(link[2]) || cell(ix.id), capId, date: isoDay(cell(ix.date)), type: cell(ix.type), address: cell(ix.address), description: desc, status: cell(ix.status),
      actions: ix.action >= 0 && cells[ix.action] ? [...cells[ix.action].matchAll(/<a[^>]*>([\s\S]*?)<\/a>/g)].map((m) => text(m[1])).filter(Boolean) : [],
    });
  }
  const next = decode(grid).match(/__doPostBack\('([^']*gdvPermitList[^']*)',''\)[^>]*>\s*Next/)?.[1];
  return { rows, next };
}

/** CapDetail.aspx: number, type, status, work location and description. */
export function parseRecord(html: string) {
  const loc = html.match(/id=['"]tbl_worklocation['"][^>]*>([\s\S]*?)<\/table>/)?.[1] ?? "";
  const desc = html.match(/Project Description:[\s\S]*?<td>([\s\S]*?)<\/td>/)?.[1];
  return {
    id: text(byId(html, "lblPermitNumber")), type: text(byId(html, "lblPermitType")), status: text(byId(html, "lblRecordStatus")),
    address: text(loc).split("\n")[0]?.replace(/\s*\*$/, "") ?? "", description: desc ? text(desc).replace(/\n/g, " ") : undefined,
  };
}

/** Fee table HTML from the page method DisplayFeeNoPaid: the outstanding total. */
export function parseFeesDue(html: string) {
  if (!html.trim()) return 0;
  const total = text(html).match(/Total[^$\n]*\$\s*([\d,]+\.?\d*)/i);
  if (total) return money(total[1]);
  return [...html.matchAll(/<tr class="ACA_TabRow_(?:Odd|Even)[\s\S]*?<\/tr>/g)].reduce((n, [tr]) => n + money(tr.match(/\$\s*[\d,]+\.\d\d/)?.[0] ?? ""), 0);
}

/** The inspections update panel: upcoming and completed rows, plus the postback target for the next completed page. */
export function parseInspectionList(html: string, permitId: string): { items: Inspection[]; nextCompleted?: string } {
  const items: Inspection[] = [];
  const cut = html.indexOf("gvListCompleted");
  for (const [tr, at] of [...html.matchAll(/<tr class="InspectionListRow">[\s\S]*?<\/table>\s*<\/td>\s*<\/tr>/g)].map((m) => [m[0], m.index ?? 0] as const)) {
    const upcoming = cut < 0 || at < cut;
    const spans = [...tr.matchAll(/<span style="[^"]*">([\s\S]*?)<\/span>/g)].map((m) => text(m[1]));
    const [raw = "", type = "", sub = ""] = spans;
    const id = decode(tr).match(/[?&]ID=(\d+)/)?.[1];
    if (!id) continue;
    items.push({ id, permitId, type, status: inspStatus(raw, upcoming), scheduledFor: isoDay(sub), notes: [raw, sub.replace(/^Result by:.*? on /, "")].filter(Boolean).join(", ") || undefined });
  }
  const nextCompleted = decode(html).match(/__doPostBack\('([^']*gvListCompleted[^']*)',''\)">Next/)?.[1];
  return { items, nextCompleted };
}

/** InspectionDetails.aspx popup: status, date and the inspector's result comments. */
export function parseInspectionDetail(html: string, permitId: string, id: string): Inspection | undefined {
  const name = text(byId(html, "Inspection_lblInspectionName") ?? html.match(/lblInspectionName">([\s\S]*?)<\/span>/)?.[1]);
  if (!name) return undefined;
  const raw = text(byId(html, "Inspection_lblStatus"));
  const comments = [...html.matchAll(/lblResultComment"[^>]*>([\s\S]*?)<\/span>/g)].map((m) => text(m[1])).filter(Boolean).join("\n");
  return {
    id, permitId, type: name.replace(/\s*\(\d+.*\)\s*$/, ""), status: inspStatus(raw, /^(scheduled|pending|rescheduled)/i.test(raw)),
    scheduledFor: isoDay(text(byId(html, "Inspection_lblStatusDate"))), notes: raw || undefined, comments: comments || undefined,
  };
}

// ---- HTTP client: cookie jar, one request at a time, async postbacks
const site = (j: Jurisdiction) => { const u = new URL(j.baseUrl); return { base: j.baseUrl.replace(/\/$/, ""), agency: u.pathname.split("/").filter(Boolean).at(-1) ?? "" }; };
let chain: Promise<unknown> = Promise.resolve(), last = 0;
const serial = <T>(fn: () => Promise<T>): Promise<T> => { const r = chain.then(fn, fn); chain = r.catch(() => {}); return r; };

class Aca {
  base: string; jar: Record<string, string>;
  constructor(base: string, jar: Record<string, string> = {}) { this.base = base; this.jar = jar; }
  async req(url: string, init: { method?: string; body?: string; headers?: Record<string, string> } = {}, hops = 0): Promise<{ url: string; text: string }> {
    const wait = last + GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    const r = await fetch(url, { ...init, redirect: "manual", signal: AbortSignal.timeout(45_000), headers: { "user-agent": UA, cookie: Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join("; "), ...init.headers } });
    for (const c of r.headers.getSetCookie()) { const kv = c.split(";")[0], i = kv.indexOf("="); this.jar[kv.slice(0, i)] = kv.slice(i + 1); }
    if (r.status >= 300 && r.status < 400 && r.headers.get("location") && hops < 6) return this.req(new URL(r.headers.get("location")!, url).href, {}, hops + 1);
    if (r.status === 429 || r.status === 403) throw new Error("The city portal is limiting requests right now. Try again in a few minutes.");
    if (!r.ok) throw new Error(`The city portal answered ${r.status}.`);
    const t = await r.text();
    if (/\/Error\.aspx/i.test(r.url) || /pageRedirect\|\|[^|]*Error\.aspx/.test(t)) throw new Error("The city portal showed an error page.");
    return { url, text: t };
  }
  get = (path: string) => this.req(path.startsWith("http") ? path : `${this.base}${path}`);
  /** Async postback on a page we already loaded. `extra` are form inputs (text boxes, dropdowns). */
  async postback(page: { url: string; fields: Record<string, string> }, panel: string, target: string, extra: Record<string, string> = {}) {
    const body = new URLSearchParams({ ...page.fields, ...extra, "ctl00$ScriptManager1": `${panel}|${target}`, __EVENTTARGET: target, __EVENTARGUMENT: "", __ASYNCPOST: "true" });
    const r = await this.req(page.url, { method: "POST", body: body.toString(), headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8", "x-microsoftajax": "Delta=true", "x-requested-with": "XMLHttpRequest", referer: page.url } });
    const d = parseDelta(r.text);
    Object.assign(page.fields, d.hidden);
    return d;
  }
  async pageMethod(page: string, method: string, body: unknown) {
    const r = await this.req(`${this.base}/Cap/${page}/${method}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json; charset=utf-8", "x-requested-with": "XMLHttpRequest" } });
    return (JSON.parse(r.text) as { d?: string }).d ?? "";
  }
}

const detailPath = (agency: string, capId: CapId) => { const [a, b, c] = capId.split("-"); return `/Cap/CapDetail.aspx?Module=${MODULE}&TabName=${MODULE}&capID1=${a}&capID2=${b}&capID3=${c}&agencyCode=${agency}`; };
const signedIn = (html: string) => /Logout|Log Out|Sign Out/i.test(html) && !/>\s*Login\s*</.test(html);
const capIds = new Map<string, CapId>(); // "QC:B26-0198" -> capID, learned from lists and searches

/** Find a record's capID by its number with the public general search. One hit redirects straight to the record. */
async function findCap(aca: Aca, agency: string, permitId: string): Promise<CapId | undefined> {
  const key = `${agency}:${permitId.toUpperCase()}`;
  if (capIds.has(key)) return capIds.get(key);
  const home = await aca.get(`/Cap/CapHome.aspx?module=${MODULE}&TabName=${MODULE}`);
  const t = "ctl00$PlaceHolderMain$btnNewSearch";
  const d = await aca.postback({ url: home.url, fields: hiddenFields(home.text) }, "ctl00$PlaceHolderMain$updatePanel", t,
    { "ctl00$PlaceHolderMain$ddlSearchType": "0", "ctl00$PlaceHolderMain$generalSearchForm$txtGSPermitNumber": permitId });
  const hit = d.redirect ? capIdOf(d.redirect) : parseRecordList(Object.values(d.panels).join("")).rows.find((r) => r.id.toUpperCase() === permitId.toUpperCase())?.capId;
  if (hit) capIds.set(key, hit);
  return hit;
}

async function readPermit(aca: Aca, j: Jurisdiction, capId: CapId, row?: ListRow): Promise<Permit> {
  const { agency } = site(j);
  const page = await aca.get(detailPath(agency, capId));
  const r = parseRecord(page.text);
  const fees = parseFeesDue(await aca.pageMethod("CapDetail.aspx", "DisplayFeeNoPaid", { pageNum: "1", moduleName: MODULE }));
  const status = r.status || row?.status || "";
  return {
    id: r.id || row?.id || capId, jurisdiction: j.id, type: r.type || row?.type || "", address: r.address || row?.address || "",
    description: r.description || row?.description || undefined, status: permitStatus(status), appliedAt: row?.date, feesDue: fees, actions: row?.actions ?? [],
  };
}

async function readInspections(aca: Aca, j: Jurisdiction, permitId: string, capId: CapId): Promise<Inspection[]> {
  const page = await aca.get(detailPath(site(j).agency, capId));
  const p = { url: page.url, fields: { ...hiddenFields(page.text), "ctl00$PlaceHolderMain$addForDetailPage$collection": "rdoExistCollection" } };
  const panel = "ctl00$PlaceHolderMain$InspectionList$inspectionUpdatePanel";
  let d = await aca.postback(p, panel, "ctl00$PlaceHolderMain$InspectionList$btnRefreshGridView");
  let r = parseInspectionList(Object.values(d.panels).join(""), permitId);
  const out = [...r.items];
  for (let n = 0; r.nextCompleted && n < 10; n++) {
    d = await aca.postback(p, panel, r.nextCompleted);
    r = parseInspectionList(Object.values(d.panels).join(""), permitId);
    out.push(...r.items.filter((x) => x.status !== "scheduled" && !out.some((y) => y.id === x.id)));
  }
  return out;
}

/** Signed-in client. Reuses the saved cookies; signs in again with the stored login when they went stale. */
async function client(j: Jurisdiction, s: Session) {
  const sess = s as unknown as Sess, { base } = site(j);
  const aca = new Aca(base, { ...(live.get(sess.user) ?? sess.cookies) });
  const home = await aca.get(`/Cap/CapHome.aspx?module=${MODULE}&TabName=${MODULE}`);
  if (signedIn(home.text)) return { aca, home };
  const r = await signIn(j, { username: sess.user, password: sess.pass });
  if (!r.ok) throw new Error(r.message);
  live.set(sess.user, r.cookies);
  const fresh = new Aca(base, { ...r.cookies });
  return { aca: fresh, home: await fresh.get(`/Cap/CapHome.aspx?module=${MODULE}&TabName=${MODULE}`) };
}
const live = new Map<string, Record<string, string>>();

/** Accela Civic ID (FusionAuth) in a real browser. Returns the ACA cookies. */
async function signIn(j: Jurisdiction, c: Credentials): Promise<{ ok: true; cookies: Record<string, string> } | { ok: false; reason: "bad_credentials" | "needs_2fa" | "unsupported"; message: string }> {
  const { base } = site(j), host = new URL(base).host;
  const browser = await chromium.launch({ executablePath: chromePath(), headless: true, args: ["--no-sandbox"] });
  try {
    const ctx = await browser.newContext({ userAgent: UA });
    const p = await ctx.newPage();
    p.setDefaultTimeout(30_000);
    await p.goto(`${base}/Login.aspx`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await p.locator("input#username").waitFor({ timeout: 30_000 }).catch(() => {});
    if (!/login\.accela\.com/.test(p.url())) return { ok: false, reason: "unsupported", message: "The city sign-in page did not load. Try again in a minute." };
    await p.locator("input#username").fill(c.username);
    await p.locator("input#password").fill(c.password);
    await p.locator("button[type=submit]").first().click();
    for (let i = 0; i < 30; i++) {
      await p.waitForTimeout(1500);
      const url = p.url();
      if (new URL(url).host === host && !/FaResponse|Login\.aspx/i.test(url)) {
        const cookies = Object.fromEntries((await ctx.cookies(`https://${host}`)).map((k) => [k.name, k.value]));
        return { ok: true, cookies };
      }
      const t = await p.locator("body").innerText().catch(() => "");
      if (/two-factor|verification code|authenticator|enter the code/i.test(t) || /two-factor/.test(url)) return { ok: false, reason: "needs_2fa", message: "The city portal is asking for a verification code. That is not supported yet." };
      if (/invalid login|invalid credentials|incorrect|locked/i.test(t)) return { ok: false, reason: "bad_credentials", message: "The city portal says the username or password is wrong." };
      if (/captcha/i.test(t) && /verify|robot/i.test(t)) return { ok: false, reason: "unsupported", message: "The city portal is showing a CAPTCHA. Try again later." };
    }
    return { ok: false, reason: "unsupported", message: "Sign-in did not finish. Check the login on the city portal." };
  } finally { await browser.close().catch(() => {}); }
}

export const accela: PortalAdapter = {
  platform: "accela",
  // Built from public pages only (2026-11-28). "planned" keeps it hidden from users until a live login run works.
  maturity: "planned",
  bookingVerified: false,

  login: (j, c) => serial(async () => {
    const r = await signIn(j, c);
    if (!r.ok) return r;
    const session: Sess = { cookies: r.cookies, user: c.username, pass: c.password };
    return { ok: true as const, session: session as unknown as Session };
  }),

  /** "My Records" on the signed-in record home, every page. */
  listPermits: (j, s) => serial(async () => {
    const { aca, home } = await client(j, s);
    const { agency } = site(j);
    const page = { url: home.url, fields: hiddenFields(home.text) };
    let r = parseRecordList(home.text);
    const rows = [...r.rows];
    for (let n = 0; r.next && n < 20; n++) {
      const d = await aca.postback(page, "ctl00$PlaceHolderMain$updatePanel", r.next);
      r = parseRecordList(Object.values(d.panels).join(""));
      rows.push(...r.rows);
    }
    for (const x of rows) capIds.set(`${agency}:${x.id.toUpperCase()}`, x.capId);
    return rows.map((x) => ({ id: x.id, jurisdiction: j.id, type: x.type, address: x.address, description: x.description || undefined, status: permitStatus(x.status), appliedAt: x.date, feesDue: 0, actions: x.actions }));
  }),

  getPermit: (j, s, id) => serial(async () => {
    const { aca } = await client(j, s);
    const cap = await findCap(aca, site(j).agency, id);
    return cap ? readPermit(aca, j, cap) : undefined;
  }),

  listInspections: async (j, s, permitId) => {
    const ids = permitId ? [permitId] : (await accela.listPermits(j, s)).filter((x) => x.status === "issued" || x.status === "inspection_phase").map((x) => x.id);
    return serial(async () => {
      const { aca } = await client(j, s);
      const out: Inspection[] = [], failed: string[] = [];
      for (const id of ids) {
        try {
          const cap = await findCap(aca, site(j).agency, id);
          if (!cap) throw new Error("not found");
          out.push(...await readInspections(aca, j, id, cap));
        } catch (e) { failed.push(`${id}: ${(e as Error).message}`); }
      }
      if (ids.length && failed.length === ids.length) throw new Error(`Could not read inspections. ${failed[0]}`);
      return out;
    });
  },

  getInspection: (j, s, permitId, inspectionId) => serial(async () => {
    if (!/^\d+$/.test(inspectionId)) throw new Error(`"${inspectionId}" is not an Accela inspection number (digits only).`);
    const { aca } = await client(j, s);
    const { agency } = site(j);
    const cap = await findCap(aca, agency, permitId);
    if (!cap) return undefined;
    const [a, b, c] = cap.split("-");
    const q = new URLSearchParams({ agencyCode: agency, RecordAltID: permitId, RecordID1: a, RecordID2: b, RecordID3: c, Module: MODULE, Action: "ViewDetails", ID: inspectionId, isPopup: "Y" });
    return parseInspectionDetail((await aca.get(`/Inspection/InspectionDetails.aspx?${q}`)).text, permitId, inspectionId);
  }),

  async proposeInspection(j) { throw new Error(`Booking for ${j.name} is not available yet.`); },
  async commit() { throw new Error("Booking inspections on Accela is not enabled yet."); },
};

/** For live probes without a login (public record pages). Not used by the app. */
export const publicReads = { Aca, findCap, readPermit, readInspections };
