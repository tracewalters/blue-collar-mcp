#!/usr/bin/env node
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { BRAIN_INSTRUCTIONS, registerBrain } from "./brain/tools.ts";
import { requestInfo } from "./brain/notes.ts";
import { registerIngest } from "./brain/ingest-tools.ts";
import { getAdapter } from "./adapter.ts";
import "./adapters/index.ts";
import { listJurisdictions } from "./jurisdictions.ts";
import { registerPermits } from "./permit-tools.ts";
import { getProfile, saveProfile } from "./profile.ts";
import { registerSetup, registerSetupForm } from "./setup-tools.ts";
import * as svc from "./service.ts";
import { migrateLegacyVault } from "./store.ts";
import { home, requireHostedMasterKey, tenantDir } from "./vault.ts";

/**
 * Hosted mode. Each company gets a secret connector URL /t/<secret>/mcp for Claude, and a website
 * dashboard reached through a one-time link that Claude hands out (open_dashboard). Only hashes are stored.
 * Permits is the product. Brain tools stay off unless BCMCP_BRAIN=1.
 */
const dataDir = () => process.env.BCMCP_DATA ?? join(home(), "hosted");
const tenantsFile = () => join(dataDir(), "tenants.json");
type Tenants = Record<string, { name: string; created: string; folder?: string }>; // key = sha256(secret)
const readTenants = (): Tenants => (existsSync(tenantsFile()) ? JSON.parse(readFileSync(tenantsFile(), "utf8")) : {});
const writeTenants = (t: Tenants) => { mkdirSync(dataDir(), { recursive: true }); writeFileSync(tenantsFile(), JSON.stringify(t, null, 2), { mode: 0o600 }); };
const hash = (s: string) => createHash("sha256").update(s).digest("hex");

export const createTenant = (name: string) => {
  const secret = randomBytes(24).toString("base64url");
  const t = readTenants();
  t[hash(secret)] = { name, created: new Date().toISOString(), folder: randomBytes(8).toString("hex") };
  writeTenants(t);
  return secret;
};
/** Rotate: new URL, old URL stops working at once. Same folder, so data is kept. */
export const rotateTenant = (name: string) => {
  const t = readTenants();
  const old = Object.entries(t).find(([, v]) => v.name === name);
  if (!old) throw new Error(`No company named "${name}".`);
  const secret = randomBytes(24).toString("base64url");
  const folder = old[1].folder ?? old[0].slice(0, 16);
  delete t[old[0]];
  t[hash(secret)] = { ...old[1], folder, created: new Date().toISOString() };
  writeTenants(t);
  return secret;
};
export const revokeTenant = (name: string) => {
  const t = readTenants();
  const k = Object.keys(t).filter((x) => t[x].name === name);
  if (!k.length) throw new Error(`No company named "${name}".`);
  for (const x of k) delete t[x];
  writeTenants(t);
};

const tenantByHash = (id: string) => {
  const t = readTenants()[id];
  return t ? { id, name: t.name, dir: join(dataDir(), "tenants", t.folder ?? id.slice(0, 16), "brain") } : null;
};

const prepareVaults = () => {
  requireHostedMasterKey();
  for (const id of Object.keys(readTenants())) {
    const tenant = tenantByHash(id);
    if (tenant) tenantDir.run(tenant.dir, migrateLegacyVault);
  }
};

// ---- Sessions: signed, httpOnly cookie. Claim links are one-time and short-lived.
const sigKey = () => {
  const f = join(dataDir(), "session.key");
  mkdirSync(dataDir(), { recursive: true });
  if (!existsSync(f)) writeFileSync(f, randomBytes(32).toString("base64"), { mode: 0o600 });
  return Buffer.from(readFileSync(f, "utf8"), "base64");
};
const sign = (v: string) => createHmac("sha256", sigKey()).update(v).digest("base64url");
const mint = (tenant: string, ttlMs: number, kind: string, nonce = "") => { const body = `${kind}.${tenant}.${Date.now() + ttlMs}.${nonce}`; return `${body}.${sign(body)}`; };
const check = (token: string | undefined, kind: string) => {
  const p = (token ?? "").split(".");
  if (p.length !== 5 || p[0] !== kind) return null;
  const want = Buffer.from(sign(p.slice(0, 4).join("."))), got = Buffer.from(p[4]);
  if (want.length !== got.length || !timingSafeEqual(want, got) || Number(p[2]) < Date.now()) return null;
  return { tenant: p[1], nonce: p[3] };
};
// A claim link works once, but link previews and double clicks reload it right away, so reuse is allowed for a short grace window.
const used = new Map<string, number>();
const GRACE_MS = Number(process.env.BCMCP_CLAIM_GRACE_MS ?? 120_000);
const SESSION_MS = 30 * 864e5;
export const dashboardLink = (tenant: string, base: string, next = "/dashboard") => `${base}/auth/claim?t=${mint(tenant, 10 * 60_000, "claim", randomBytes(8).toString("hex"))}&next=${encodeURIComponent(next)}`;

const cookie = (req: IncomingMessage) => Object.fromEntries((req.headers.cookie ?? "").split(/;\s*/).map((c) => c.split("=") as [string, string]));
const json = (res: ServerResponse, code: number, data: unknown) => { res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" }).end(JSON.stringify(data)); };
const body = (req: IncomingMessage) => new Promise<any>((ok, no) => { let b = ""; req.on("data", (c) => { b += c; if (b.length > 20_000) req.destroy(); }); req.on("end", () => { try { ok(JSON.parse(b || "{}")); } catch { no(new Error("Bad JSON")); } }); });
const attempts = new Map<string, number[]>();
const tooMany = (key: string) => { const now = Date.now(), a = (attempts.get(key) ?? []).filter((t) => now - t < 60_000); a.push(now); attempts.set(key, a); return a.length > 10; };

/** Dashboard API. Cookie session only. Credentials go straight to the vault and are never logged or echoed. */
const api = async (req: IncomingMessage, res: ServerResponse, path: string) => {
  const s = check(cookie(req).bc_session, "sess");
  const tenant = s && tenantByHash(s.tenant);
  if (!tenant) return json(res, 401, { error: "Signed out. Ask Claude to open your dashboard again." });
  if (req.method !== "GET" && req.headers["x-bc"] !== "1") return json(res, 403, { error: "Bad request" });
  await tenantDir.run(tenant.dir, async () => {
    try {
      const q = new URL(req.url!, "http://x").searchParams;
      if (path === "/me") {
        const profile = getProfile();
        const cities = listJurisdictions().map((j) => ({ ...j, maturity: (() => { try { return getAdapter(j.platform).maturity; } catch { return "planned"; } })() }));
        return json(res, 200, { company: profile?.company ?? tenant.name, userName: profile?.userName, profile, connections: svc.listConnections(), cities });
      }
      if (path === "/profile" && req.method === "POST") {
        const b = z.object({ addCity: z.string().optional(), removeCity: z.string().optional() }).parse(await body(req));
        const cur = getProfile();
        if (!cur) return json(res, 400, { error: "Tell Claude to set up your company first." });
        const cities = cur.cities.filter((c) => c !== b.removeCity).concat(b.addCity ? [b.addCity] : []);
        return json(res, 200, saveProfile({ cities }));
      }
      const refresh = q.get("refresh") === "1";
      if (path === "/permits") return json(res, 200, await svc.listPermits(q.get("city") ?? undefined, { refresh }));
      if (path === "/inspections") return json(res, 200, await svc.listInspections(q.get("city") ?? undefined, { refresh }));
      if (path === "/inspection") return json(res, 200, await svc.getInspection(q.get("city")!, q.get("permit")!, q.get("id")!));
      if (path === "/jobs") return json(res, 200, await svc.listJobs());
      if (path === "/jobs/rename" && req.method === "POST") { const b = z.object({ job: z.string(), name: z.string().max(120) }).parse(await body(req)); return json(res, 200, await svc.renameJobTo(b.job, b.name)); }
      if (path === "/jobs/merge" && req.method === "POST") { const b = z.object({ from: z.string(), into: z.string() }).parse(await body(req)); return json(res, 200, await svc.mergeJob(b.from, b.into)); }
      if (path === "/permit") return json(res, 200, await svc.getPermit(q.get("city")!, q.get("id")!, { refresh }));
      if (path === "/connect" && req.method === "POST") {
        if (tooMany(tenant.id)) return json(res, 429, { error: "Too many tries. Wait a minute." });
        const b = z.object({ city: z.string(), username: z.string().min(1), password: z.string().min(1) }).parse(await body(req));
        const r = await svc.login(b.city, { username: b.username, password: b.password });
        return json(res, r.ok ? 200 : 400, r.ok ? { ok: true, key: svc.issueConnectKey(b.city) } : { ok: false, message: (r as { message?: string }).message ?? "Login failed." });
      }
      if (path === "/disconnect" && req.method === "POST") { await svc.logout(z.object({ city: z.string() }).parse(await body(req)).city); return json(res, 200, { ok: true }); }
      if (path === "/signout" && req.method === "POST") { res.setHeader("set-cookie", "bc_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax"); return json(res, 200, { ok: true }); }
      json(res, 404, { error: "Not found" });
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });
};

type Sess = { transport: StreamableHTTPServerTransport; server: McpServer; tenant: string; last: number };
const sessions = new Map<string, Sess>();
setInterval(() => { for (const [id, x] of sessions) if (Date.now() - x.last > 30 * 60_000) { x.transport.close(); sessions.delete(id); } }, 60_000).unref();

const buildServer = (tenant: { id: string }, dash: string) => {
  const server = new McpServer({ name: "blue-collar-mcp", version: "0.1.0" }, {
    instructions: "Blue Collar MCP: permits for residential contractors. ALWAYS call get_setup first. If needsSetup is true, call run_setup (it shows a form in the chat); if the client cannot show forms, ask the questions get_setup gives, with your multiple-choice question tool if you have one. Then call open_dashboard. Use the permit tools for any question about permits, inspections, jobs or deadlines. Keep replies under 6 short lines. If no city is connected, call open_dashboard and tell the user to connect their portal there. Never ask for portal passwords in chat." + (process.env.BCMCP_BRAIN ? " " + BRAIN_INSTRUCTIONS : ""),
  });
  registerSetup(server);
  registerSetupForm(server);
  registerPermits(server, { writes: false, connectHint: "call open_dashboard and tell the user to connect their city portal there." });
  server.registerTool("open_dashboard", {
    description: "Give the user a private link (valid 10 minutes) to their permit dashboard. If no city portal is connected yet, or `city` is given, the link opens straight to the connect form for that city (login is typed there, never in chat). Say only: the link, and one line on what they will see.",
    inputSchema: { city: z.string().optional().describe("City id to connect, e.g. phoenix-az") },
    annotations: { readOnlyHint: true },
  }, async ({ city }) => {
    const connected = svc.listConnections().map((c) => c.id);
    const profile = getProfile();
    const firstReal = listJurisdictions().find((j) => { try { const a = getAdapter(j.platform); return a.maturity === "ready" && a.platform !== "demo"; } catch { return false; } })?.id;
    const pending = (profile?.cities ?? []).filter((c) => !connected.includes(c));
    const target = city ?? (profile ? pending[0] : connected.length ? undefined : firstReal);
    const next = target && !connected.includes(target) ? `/dashboard/connect?city=${encodeURIComponent(target)}` : "/dashboard";
    const where = next === "/dashboard" ? "your permit dashboard" : `the page to connect ${pending.length > 1 ? "your cities" : "your city portal"}`;
    const after = next === "/dashboard" ? "" : "\n(For you, not the user: after they sign in there, call list_connections to see it connected. If they paste a key like ABCD-1234, pass it as key.)";
    return { content: [{ type: "text" as const, text: `Open ${where}: ${dashboardLink(tenant.id, dash, next)}${after}` }] };
  });
  if (process.env.BCMCP_BRAIN) { registerBrain(server); registerIngest(server); }
  return server;
};

const handle = async (req: IncomingMessage, res: ServerResponse) => {
  const url = req.url ?? "";
  const base = process.env.BCMCP_PUBLIC_URL ?? `http://${req.headers.host}`;
  if (url.startsWith("/api/")) return api(req, res, url.slice(4).split("?")[0]);

  if (url.startsWith("/auth/claim")) {
    const q = new URL(url, base).searchParams, t = check(q.get("t") ?? "", "claim");
    const next = /^\/dashboard[\w/?=&.%-]*$/.test(q.get("next") ?? "") ? q.get("next")! : "/dashboard"; // only our own dashboard pages
    if (!t || (used.has(t.nonce) && Date.now() - used.get(t.nonce)! > GRACE_MS) || !tenantByHash(t.tenant)) { res.writeHead(401, { "content-type": "text/plain" }).end("This link expired or was already used. Ask Claude to open your dashboard again."); return; }
    if (!used.has(t.nonce)) used.set(t.nonce, Date.now());
    res.writeHead(302, { location: next, "set-cookie": `bc_session=${mint(t.tenant, SESSION_MS, "sess")}; Path=/; Max-Age=${SESSION_MS / 1000}; HttpOnly; Secure; SameSite=Lax` }).end();
    return;
  }

  const m = url.match(/^\/t\/([\w-]+)\/(mcp|export\.tar\.gz)\/?$/);
  const tenant = m ? tenantByHash(hash(m[1])) : null;
  if (!tenant || !m) { res.writeHead(404).end("Not found"); return; }
  if (m[2] === "export.tar.gz") {
    res.writeHead(200, { "content-type": "application/gzip", "content-disposition": 'attachment; filename="company-brain.tar.gz"' });
    spawn("tar", ["czf", "-", "-C", tenant.dir, "."]).stdout.pipe(res);
    return;
  }
  const ctx = { exportUrl: `${base}/t/${m[1]}/export.tar.gz`, tenant: tenant.id };
  const sid = req.headers["mcp-session-id"] as string | undefined;

  // Stateful path: only for clients that can show forms (elicitation). They need a session so the form answer finds its tool call.
  if (sid) {
    const sess = sessions.get(sid);
    if (!sess || sess.tenant !== tenant.id) { res.writeHead(404, { "content-type": "application/json" }).end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32001, message: "Session not found" }, id: null })); return; }
    sess.last = Date.now();
    const parsed = req.method === "POST" ? await body(req) : undefined;
    await requestInfo.run(ctx, () => tenantDir.run(tenant.dir, () => sess.transport.handleRequest(req, res, parsed)));
    return;
  }
  if (req.method !== "POST") { res.writeHead(405, { allow: "POST" }).end(); return; }

  const parsed = await body(req);
  const canForm = parsed?.method === "initialize" && Boolean(parsed.params?.capabilities?.elicitation);
  const server = buildServer(tenant, base);
  let transport: StreamableHTTPServerTransport;
  if (canForm) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: randomUUID,
      onsessioninitialized: (id) => { sessions.set(id, { transport, server, tenant: tenant.id, last: Date.now() }); },
    });
    transport.onclose = () => { if (transport.sessionId) sessions.delete(transport.sessionId); };
  } else {
    transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => { transport.close(); server.close(); });
  }
  await server.connect(transport);
  await requestInfo.run(ctx, () => tenantDir.run(tenant.dir, () => transport.handleRequest(req, res, parsed)));
};

if (process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js")) {
  prepareVaults();
  const [cmd, ...rest] = process.argv.slice(2);
  const pub = process.env.BCMCP_PUBLIC_URL ?? "https://YOUR-DOMAIN";
  if (cmd === "tenant") { const name = rest.join(" ") || "Company"; console.log(`Connector URL for ${name} (shown once, treat like a password):\n${pub}/t/${createTenant(name)}/mcp`); }
  else if (cmd === "rotate") console.log(`New URL for ${rest.join(" ")}; the old one no longer works:\n${pub}/t/${rotateTenant(rest.join(" "))}/mcp`);
  else if (cmd === "revoke") { revokeTenant(rest.join(" ")); console.log("Revoked. That connector URL no longer works."); }
  else {
    const port = Number(process.env.PORT ?? 3300);
    createServer((req, res) => handle(req, res).catch((e) => { console.error(e); res.headersSent || res.writeHead(500).end(); }))
      .listen(port, "127.0.0.1", () => console.log(`blue-collar-mcp hosted on 127.0.0.1:${port}`));
  }
}
