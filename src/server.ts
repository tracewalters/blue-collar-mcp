#!/usr/bin/env node
import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { BRAIN_INSTRUCTIONS, registerBrain } from "./brain-tools.ts";
import { registerIngest } from "./ingest-tools.ts";
import { requestInfo, tenantDir } from "./brain.ts";
import { spawn } from "node:child_process";
import { home } from "./vault.ts";

/**
 * Hosted mode, v0. Brain tools only. Permit tools stay local until the vault is per-tenant.
 * Each company gets a secret connector URL: /t/<secret>/mcp. Only a hash of the secret is stored.
 */
const dataDir = () => process.env.BCMCP_DATA ?? join(home(), "hosted");
const tenantsFile = () => join(dataDir(), "tenants.json");
type Tenants = Record<string, { name: string; created: string; folder?: string }>; // key = sha256(secret)
const readTenants = (): Tenants => (existsSync(tenantsFile()) ? JSON.parse(readFileSync(tenantsFile(), "utf8")) : {});
const hash = (s: string) => createHash("sha256").update(s).digest("hex");

export const createTenant = (name: string) => {
  mkdirSync(dataDir(), { recursive: true });
  const secret = randomBytes(24).toString("base64url");
  const t = readTenants();
  t[hash(secret)] = { name, created: new Date().toISOString(), folder: randomBytes(8).toString("hex") };
  writeFileSync(tenantsFile(), JSON.stringify(t, null, 2), { mode: 0o600 });
  return secret;
};

/** Rotate: new URL, old URL stops working at once. Same brain folder, so data is kept. */
export const rotateTenant = (name: string) => {
  const t = readTenants();
  const old = Object.entries(t).find(([, v]) => v.name === name);
  if (!old) throw new Error(`No company named "${name}".`);
  const secret = randomBytes(24).toString("base64url");
  const folder = old[1].folder ?? old[0].slice(0, 16);
  delete t[old[0]];
  t[hash(secret)] = { ...old[1], folder, created: new Date().toISOString() };
  writeFileSync(tenantsFile(), JSON.stringify(t, null, 2), { mode: 0o600 });
  return secret;
};
export const revokeTenant = (name: string) => {
  const t = readTenants();
  const k = Object.keys(t).filter((x) => t[x].name === name);
  if (!k.length) throw new Error(`No company named "${name}".`);
  for (const x of k) delete t[x];
  writeFileSync(tenantsFile(), JSON.stringify(t, null, 2), { mode: 0o600 });
};

const tenantFor = (secret: string) => {
  const id = hash(secret), t = readTenants()[id];
  return t ? join(dataDir(), "tenants", t.folder ?? id.slice(0, 16), "brain") : null;
};

const handle = async (req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => {
  const m = req.url?.match(/^\/t\/([\w-]+)\/(mcp|export\.tar\.gz)\/?$/);
  const dir = m ? tenantFor(m[1]) : null;
  if (!dir || !m) { res.writeHead(404).end("Not found"); return; }
  if (m[2] === "export.tar.gz") {
    // Whole brain as plain markdown files. Opens directly in Obsidian.
    res.writeHead(200, { "content-type": "application/gzip", "content-disposition": 'attachment; filename="company-brain.tar.gz"' });
    spawn("tar", ["czf", "-", "-C", dir, "."]).stdout.pipe(res);
    return;
  }
  if (req.method !== "POST") { res.writeHead(405, { allow: "POST" }).end(); return; }
  const server = new McpServer({ name: "blue-collar-mcp", version: "0.1.0" }, { instructions: BRAIN_INSTRUCTIONS });
  registerBrain(server);
registerIngest(server);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => { transport.close(); server.close(); });
  await server.connect(transport);
  const base = process.env.BCMCP_PUBLIC_URL ?? `http://${req.headers.host}`;
  await requestInfo.run({ exportUrl: `${base}/t/${m[1]}/export.tar.gz` }, () => tenantDir.run(dir, () => transport.handleRequest(req, res)));
};

if (process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js")) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "tenant") {
    const name = rest.join(" ") || "Company";
    const base = process.env.BCMCP_PUBLIC_URL ?? "https://YOUR-DOMAIN";
    console.log(`Connector URL for ${name} (shown once, treat like a password):\n${base}/t/${createTenant(name)}/mcp`);
  } else if (cmd === "rotate") {
    const name = rest.join(" ");
    console.log(`New URL for ${name}; the old one no longer works:\n${process.env.BCMCP_PUBLIC_URL ?? "https://YOUR-DOMAIN"}/t/${rotateTenant(name)}/mcp`);
  } else if (cmd === "revoke") {
    revokeTenant(rest.join(" "));
    console.log("Revoked. That connector URL no longer works.");
  } else {
    const port = Number(process.env.PORT ?? 3300);
    createServer((req, res) => handle(req, res).catch((e) => { console.error(e); res.headersSent || res.writeHead(500).end(); }))
      .listen(port, "127.0.0.1", () => console.log(`blue-collar-mcp hosted on 127.0.0.1:${port}`));
  }
}
