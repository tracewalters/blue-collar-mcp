# Hosting (v0)
Hosted mode serves the brain tools over HTTPS, one secret connector URL per company. Permit tools stay local until the vault is per-tenant.

```sh
npm ci
BCMCP_MASTER_KEY="$(openssl rand -base64 32)" # generate once; store outside BCMCP_DATA and reuse
BCMCP_DATA=/var/lib/bcmcp BCMCP_MASTER_KEY="$BCMCP_MASTER_KEY" BCMCP_PUBLIC_URL=https://YOUR-DOMAIN node src/server.ts tenant "Company name"
BCMCP_DATA=/var/lib/bcmcp BCMCP_MASTER_KEY="$BCMCP_MASTER_KEY" PORT=3300 node src/server.ts
```
Hosted mode refuses to start without `BCMCP_MASTER_KEY`. On the first start with it, legacy tenant vaults are re-encrypted and their per-tenant key files are removed. Back up the master key securely: losing it makes every hosted vault unrecoverable.
Put a reverse proxy with TLS (Caddy or nginx) in front. Claude chat needs a public HTTPS URL. In Claude: Settings > Connectors > Add custom connector > paste the URL.
Notes: the URL is the password, so treat it like one (only its hash is stored). Rotate with `node src/server.ts rotate "Company name"` (new URL, old one stops working, data kept) or cut off access with `revoke "Company name"`. Per-user sign-in (OAuth) is next.

Writes in hosted mode are two steps: the first call returns a preview and a token tied to that exact content and company; repeating it with the token saves. This stops content changing after the preview. It does not prove a human said yes, so the Claude app's tool-approval prompt is still the real gate.

Website and API on one host: Caddy sends `/t/*`, `/auth/*` and `/api/*` to the hosted server (port 3300) and everything else to the Next.js app (`apps/web`, `next start`, port 3301). Dashboard sign-in links come from the `open_dashboard` MCP tool. Brain tools are off unless `BCMCP_BRAIN=1`.

Shape PHX needs Chromium on the server: `npx playwright-core install chromium` (or set `PLAYWRIGHT_CHROMIUM` to a Chrome binary). Reading inspections for all permits takes about a minute the first time; results are cached for 5 minutes.
