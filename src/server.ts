#!/usr/bin/env node
import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerBrain } from "./brain-tools.ts";
import { registerIngest } from "./ingest-tools.ts";
import { tenantDir } from "./brain.ts";
import { home } from "./vault.ts";

/**
 * Hosted mode, v0. Brain tools only. Permit tools stay local until the vault is per-tenant.
 * Each company gets a secret connector URL: /t/<secret>/mcp. Only a hash of the secret is stored.
 */
const dataDir = () => process.env.BCMCP_DATA ?? join(home(), "hosted");
const tenantsFile = () => join(dataDir(), "tenants.json");
type Tenants = Record<string, { name: string; created: string }>; // key = sha256(secret)
const readTenants = (): Tenants => (existsSync(tenantsFile()) ? JSON.parse(readFileSync(tenantsFile(), "utf8")) : {});
const hash = (s: string) => createHash("sha256").update(s).digest("hex");

export const createTenant = (name: string) => {
  mkdirSync(dataDir(), { recursive: true });
  const secret = randomBytes(24).toString("base64url");
  const t = readTenants();
  t[hash(secret)] = { name, created: new Date().toISOString() };
  writeFileSync(tenantsFile(), JSON.stringify(t, null, 2), { mode: 0o600 });
  return secret;
};

const tenantFor = (secret: string) => {
  const id = hash(secret);
  return readTenants()[id] ? join(dataDir(), "tenants", id.slice(0, 16), "brain") : null;
};

const handle = async (req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => {
  const m = req.url?.match(/^\/t\/([\w-]+)\/mcp\/?$/);
  const dir = m ? tenantFor(m[1]) : null;
  if (!dir) { res.writeHead(404).end("Not found"); return; }
  if (req.method !== "POST") { res.writeHead(405, { allow: "POST" }).end(); return; }
  const server = new McpServer({ name: "blue-collar-mcp", version: "0.1.0" });
  registerBrain(server);
registerIngest(server);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => { transport.close(); server.close(); });
  await server.connect(transport);
  await tenantDir.run(dir, () => transport.handleRequest(req, res));
};

if (process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js")) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "tenant") {
    const name = rest.join(" ") || "Company";
    const base = process.env.BCMCP_PUBLIC_URL ?? "https://YOUR-DOMAIN";
    console.log(`Connector URL for ${name} (shown once, treat like a password):\n${base}/t/${createTenant(name)}/mcp`);
  } else {
    const port = Number(process.env.PORT ?? 3300);
    createServer((req, res) => handle(req, res).catch((e) => { console.error(e); res.headersSent || res.writeHead(500).end(); }))
      .listen(port, "127.0.0.1", () => console.log(`blue-collar-mcp hosted on 127.0.0.1:${port}`));
  }
}
