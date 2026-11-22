# Hosting (v0)
Hosted mode serves the brain tools over HTTPS, one secret connector URL per company. Permit tools stay local until the vault is per-tenant.

```sh
npm ci
BCMCP_DATA=/var/lib/bcmcp BCMCP_PUBLIC_URL=https://YOUR-DOMAIN node src/server.ts tenant "Company name"   # prints the connector URL once
BCMCP_DATA=/var/lib/bcmcp PORT=3300 node src/server.ts                                                     # listens on 127.0.0.1
```
Put a reverse proxy with TLS (Caddy or nginx) in front. Claude chat needs a public HTTPS URL. In Claude: Settings > Connectors > Add custom connector > paste the URL.
Notes: the URL is the password, so treat it like one (only its hash is stored). Rotate by creating a new tenant URL. Per-user sign-in (OAuth) is next.
