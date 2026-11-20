# Architecture (draft)

One MCP server. Many permit portals. The user plugs it into Claude, connects their portal logins once, and Claude can read permits and take actions across every city.

## Core ideas

1. **Adapters per platform, not per city.** Most cities run on a handful of vendors (Tyler EnerGov/Portico, Accela, OpenGov, Salesforce Experience Cloud such as Shape/Phoenix, CityView). Write one adapter per platform. Each city is a small YAML config on top (base URL, labels, quirks).
2. **API first, browser second.** Use the portal's own HTTP/JSON endpoints (Salesforce Aura/Apex, Accela REST) when they exist. Fall back to Playwright only when they don't. HTTP is faster, cheaper, and breaks less.
3. **Credentials never touch the model.** Logins are entered out-of-band (secure link or CLI), never through chat. Claude only ever sees a `connection_id`.
4. **Writes are two-phase.** `propose_*` returns a plan and a confirmation token. `commit` executes it. Nothing is submitted, scheduled, or paid without it.
5. **Local mode and hosted mode are the same code.** Local: stdio, SQLite, OS keychain. Hosted: HTTP, Postgres, KMS. Open source users can self-host; we run a hosted instance.

## Components

```
Claude (or any MCP client)
        |  Streamable HTTP + OAuth 2.1  (or stdio for local mode)
        v
 apps/server   MCP server: tools, auth, metering, confirmation tokens
        |  job queue (Postgres, pg-boss)
        v
 apps/worker   runs adapters, owns browser pool + sessions
        |
        v
 city portals  (Tyler, Accela, Salesforce, ...)

 apps/web      marketing/docs + account, billing, usage. Read-mostly. No portal actions.
```

## Repo layout

```
apps/
  server/        MCP server (TypeScript, official MCP SDK)
  worker/        Job runner, Playwright pool, session refresh
  web/           Next.js: landing, docs, billing, usage dashboard, connect-portal form
packages/
  core/          Zod schemas for Permit, Inspection, Fee, etc. (generates spec/schemas/*.json)
  adapters/
    sdk/         PortalAdapter interface, test harness, recorded-fixture tools
    tyler-energov/
    accela/
    opengov/
    salesforce-experience/   (Shape / Phoenix)
  jurisdictions/ YAML per city: platform, base_url, permit types, fees, quirks
  vault/         Envelope encryption for credentials + session cookies
  db/            Drizzle schema + migrations (Postgres / SQLite)
  billing/       Stripe + usage metering
spec/            Standard text + JSON schemas (existing)
adapters/        Harness install configs: claude, chatgpt, codex, grok (existing)
deploy/          docker-compose.yml, Caddyfile, backup scripts
docs/            Guides, this file
examples/        Sample data, prompts, recorded portal fixtures
```

## Adapter interface

```ts
interface PortalAdapter {
  platform: string;
  login(creds, ctx): Promise<Session>;          // may return NEEDS_USER (2FA/CAPTCHA)
  listPermits(s, filter): Promise<Permit[]>;
  getPermit(s, id): Promise<Permit>;
  listInspections(s, permitId): Promise<Inspection[]>;
  // writes return a plan; commit() executes it
  proposeInspection(s, req): Promise<Plan>;
  proposeSubmission(s, req): Promise<Plan>;
  commit(s, plan): Promise<Result>;
}
```

Every adapter ships with recorded fixtures so CI runs without hitting real portals.

## MCP tools

Read: `list_connections`, `list_permits`, `get_permit`, `get_permit_status`, `list_inspections`, `list_required_documents`, `get_jurisdiction`, `get_deadlines`.

Setup: `connect_portal` returns a one-time URL to enter credentials. `connection_status` reports healthy / needs re-login / needs 2FA.

Write: `propose_inspection`, `propose_submission`, `propose_payment`, then `commit(token)`. Tokens are single-use, expire in minutes, and are bound to the exact plan. Also use MCP elicitation so the client asks the human.

## Credentials and sessions

- Envelope encryption: per-tenant data key, wrapped by a master key (KMS or file key on the VPS).
- Store session cookies, not just passwords, so 2FA is rare.
- 2FA / CAPTCHA: connection flips to `needs_user`; the user finishes it via the same secure link.
- Each tenant gets an isolated browser context. No shared cookies, ever.
- Audit log of every tool call and commit (who, what, which portal). Never log credentials or page bodies with PII.

## Website

Scope: landing page, docs, sign in, billing, usage, connection list, and the connect-portal form. No permit data is shown, and no actions are taken from the site. The connect form is the one exception to "no functionality", and it exists so credentials never go through the model.

## Billing and usage

Meter per tool call, weighted: reads cheap, browser-backed reads and writes higher. Stripe subscription plus usage records. Usage table lives in Postgres, and the dashboard reads it.

## Deployment (single VPS)

`docker compose`: caddy (TLS), server, worker, web, postgres. pg-boss for the queue, so no Redis. Worker has a memory cap and a browser pool limit. Nightly encrypted Postgres backups off-box.

## Risks to decide on early

- **Credential custody.** Hosting other people's city logins is the biggest liability. Local mode must be first-class, and the hosted threat model needs to be written down.
- **Portal terms of service.** Rate-limit per portal, identify honestly where possible, only use the user's own account.
- **Fragility.** Portals change. Fixture tests plus a scheduled canary per adapter that alerts us.
- **Payments.** Defer `propose_payment` until the rest is solid.

## Build order

1. `packages/core` schemas + `apps/server` stdio with fixture-backed read tools (works in Claude today).
2. First adapter: Salesforce Experience (Shape/Phoenix), reads only, local mode.
3. Second adapter: Tyler. Proves the interface.
4. Vault + `connect_portal` + hosted HTTP/OAuth.
5. Two-phase writes (inspection scheduling first).
6. Web app, Stripe, metering, VPS deploy.
