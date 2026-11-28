import { createHash, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * MCP sign-in (OAuth 2.1 authorization code + PKCE, dynamic client registration), so a user adds ONE public URL
 * (`/mcp`) to ChatGPT, Claude or any MCP app and signs in, with no secret link to copy.
 * Everything is stateless: client ids, codes and tokens are signed blobs. Tokens are for one company (tenant id).
 */
export type OAuthDeps = {
  base: string;
  sign: (v: string) => string;
  /** Tenant id from the website session cookie, or null. */
  session: (req: IncomingMessage) => string | null;
  tenantName: (id: string) => string | null;
};

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const CODE_MS = 5 * 60_000, ACCESS_MS = 60 * 60_000, REFRESH_MS = 90 * 864e5;
const usedCodes = new Map<string, number>();
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const oauthFns = (d: OAuthDeps) => {
  const pack = (o: Record<string, unknown>, ttl: number) => { const body = b64({ ...o, exp: Date.now() + ttl }); return `${body}.${d.sign(body)}`; };
  const unpack = (t: string | undefined | null, kind: string): Record<string, any> | null => {
    const [body, sig] = (t ?? "").split(".");
    if (!body || !sig) return null;
    const want = Buffer.from(d.sign(body)), got = Buffer.from(sig);
    if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
    try { const o = JSON.parse(Buffer.from(body, "base64url").toString()); return o.k === kind && o.exp > Date.now() ? o : null; } catch { return null; }
  };
  /** Tenant id behind an `Authorization: Bearer` access token, or null. */
  const bearer = (req: IncomingMessage) => unpack((req.headers.authorization ?? "").replace(/^Bearer /i, ""), "at")?.t as string | undefined ?? null;
  return { pack, unpack, bearer };
};

const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type, mcp-session-id, mcp-protocol-version", "access-control-expose-headers": "www-authenticate, mcp-session-id" };
const send = (res: ServerResponse, code: number, data: unknown, extra: Record<string, string> = {}) => { res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store", ...cors, ...extra }).end(JSON.stringify(data)); };
const form = (req: IncomingMessage) => new Promise<URLSearchParams>((ok) => { let b = ""; req.on("data", (c) => { b += c; if (b.length > 20_000) req.destroy(); }); req.on("end", () => ok(new URLSearchParams(b))); });
const jsonBody = (req: IncomingMessage) => new Promise<any>((ok) => { let b = ""; req.on("data", (c) => { b += c; if (b.length > 20_000) req.destroy(); }); req.on("end", () => { try { ok(JSON.parse(b || "{}")); } catch { ok({}); } }); });
const okRedirect = (u: string) => { try { const x = new URL(u); return x.protocol === "https:" || (x.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(x.hostname)); } catch { return false; } };

export const unauthorized = (res: ServerResponse, base: string) =>
  send(res, 401, { error: "unauthorized" }, { "www-authenticate": `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource"` });

/** Handles the OAuth endpoints. Returns false when the URL is not one of ours. */
export const oauthRoute = async (req: IncomingMessage, res: ServerResponse, d: OAuthDeps): Promise<boolean> => {
  const { pack, unpack } = oauthFns(d);
  const u = new URL(req.url ?? "/", d.base), path = u.pathname;
  if (!(path.startsWith("/.well-known/oauth-") || path.startsWith("/oauth/"))) return false;
  if (req.method === "OPTIONS") { res.writeHead(204, { ...cors, "access-control-allow-methods": "GET, POST, OPTIONS" }).end(); return true; }

  if (path.startsWith("/.well-known/oauth-protected-resource")) {
    send(res, 200, { resource: `${d.base}/mcp`, authorization_servers: [d.base], bearer_methods_supported: ["header"] });
    return true;
  }
  if (path.startsWith("/.well-known/oauth-authorization-server")) {
    send(res, 200, {
      issuer: d.base, authorization_endpoint: `${d.base}/oauth/authorize`, token_endpoint: `${d.base}/oauth/token`, registration_endpoint: `${d.base}/oauth/register`,
      response_types_supported: ["code"], grant_types_supported: ["authorization_code", "refresh_token"], code_challenge_methods_supported: ["S256"], token_endpoint_auth_methods_supported: ["none"], scopes_supported: ["permits"],
    });
    return true;
  }

  if (path === "/oauth/register" && req.method === "POST") {
    const b = await jsonBody(req);
    const uris: unknown = b.redirect_uris;
    if (!Array.isArray(uris) || !uris.length || uris.length > 10 || !uris.every((x) => typeof x === "string" && okRedirect(x))) return send(res, 400, { error: "invalid_redirect_uri" }), true;
    const name = String(b.client_name ?? "An AI app").slice(0, 60);
    const client_id = pack({ k: "cl", r: uris, n: name }, 3650 * 864e5);
    send(res, 201, { client_id, client_name: name, redirect_uris: uris, grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none" });
    return true;
  }

  if (path === "/oauth/authorize") {
    const post = req.method === "POST";
    const q = post ? await form(req) : u.searchParams;
    const client = unpack(q.get("client_id"), "cl"), redirect = q.get("redirect_uri") ?? "";
    const bad = (m: string) => { res.writeHead(400, { "content-type": "text/plain" }).end(m); return true; };
    if (!client || !client.r.includes(redirect)) return bad("Unknown app or redirect address.");
    if (q.get("response_type") !== "code" || q.get("code_challenge_method") !== "S256" || !q.get("code_challenge")) return bad("This app must use the authorization code flow with PKCE (S256).");
    const back = (params: Record<string, string>) => { const r = new URL(redirect); for (const [k, v] of Object.entries(params)) r.searchParams.set(k, v); if (q.get("state")) r.searchParams.set("state", q.get("state")!); res.writeHead(302, { location: r.toString() }).end(); return true; };
    const tenant = d.session(req);
    if (!tenant) { // sign in on the website first, then come back here
      res.writeHead(302, { location: `/signin?next=${encodeURIComponent(`/oauth/authorize${u.search}`)}` }).end();
      return true;
    }
    if (post) {
      if (q.get("decision") !== "allow") return back({ error: "access_denied" });
      const code = pack({ k: "code", t: tenant, c: client_id(q), r: redirect, ch: q.get("code_challenge") }, CODE_MS);
      return back({ code });
    }
    const company = d.tenantName(tenant) ?? "your company";
    const hidden = ["client_id", "redirect_uri", "response_type", "code_challenge", "code_challenge_method", "state"].map((k) => `<input type="hidden" name="${k}" value="${esc(q.get(k) ?? "")}">`).join("");
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https: http://localhost:* http://127.0.0.1:*", "x-frame-options": "DENY" }).end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect · Blue Collar MCP</title>
<style>body{margin:0;background:#000;color:#fff;font:16px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh}main{max-width:420px;padding:24px}h1{font-size:28px;margin:0 0 8px}p{color:#bbb}.b{display:flex;gap:12px;margin-top:24px}button{flex:1;min-height:48px;border-radius:12px;border:0;font:600 16px system-ui;cursor:pointer}.y{background:#d9ff00;color:#111}.n{background:#222;color:#fff}</style>
<main><h1>Connect ${esc(String(client.n))}?</h1><p>It will be able to read <b>${esc(company)}</b>'s permits and inspections through Blue Collar MCP. It never sees your city portal logins.</p>
<form method="post" action="/oauth/authorize">${hidden}<div class="b"><button class="n" name="decision" value="deny">Cancel</button><button class="y" name="decision" value="allow">Allow</button></div></form></main>`);
    return true;
  }

  if (path === "/oauth/token" && req.method === "POST") {
    const q = await form(req), grant = q.get("grant_type");
    const issue = (t: string, c: string) => send(res, 200, { token_type: "Bearer", access_token: pack({ k: "at", t }, ACCESS_MS), expires_in: ACCESS_MS / 1000, refresh_token: pack({ k: "rt", t, c }, REFRESH_MS) });
    if (grant === "authorization_code") {
      const code = unpack(q.get("code"), "code"), verifier = q.get("code_verifier") ?? "";
      const key = (q.get("code") ?? "").slice(-24);
      if (!code || usedCodes.has(key) || code.r !== q.get("redirect_uri") || code.c !== q.get("client_id")) return send(res, 400, { error: "invalid_grant" }), true;
      if (createHash("sha256").update(verifier).digest("base64url") !== code.ch) return send(res, 400, { error: "invalid_grant" }), true;
      usedCodes.set(key, Date.now());
      for (const [k, t] of usedCodes) if (Date.now() - t > CODE_MS) usedCodes.delete(k);
      return issue(code.t, code.c), true;
    }
    if (grant === "refresh_token") {
      const rt = unpack(q.get("refresh_token"), "rt");
      if (!rt || !d.tenantName(rt.t)) return send(res, 400, { error: "invalid_grant" }), true;
      return issue(rt.t, rt.c), true;
    }
    send(res, 400, { error: "unsupported_grant_type" });
    return true;
  }
  res.writeHead(404, cors).end();
  return true;
};

const client_id = (q: URLSearchParams) => q.get("client_id") ?? "";
