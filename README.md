# Blue Collar MCP

Permits for residential contractors, inside Claude. Ask "what's the status of my permits?" and get one answer across every city portal. Open the website dashboard to see it laid out.

## How it works
1. In Claude, add the connector, then say **"open my permit dashboard"**.
2. Claude gives you a private one-time link. On the site, connect your city portal (login goes straight to your private vault, never through Claude).
3. Ask Claude about permits, inspections and deadlines. The dashboard shows the same data.

## What exists
- Permit engine: common schemas, adapter SDK, CLI (`permit`), MCP server, canary tests. Only a demo city works today (login `demo` / `demo`). Shape PHX is next.
- Hosted server: one private connector URL and vault per company, website sign-in by one-time link.
- Website (`apps/web`): landing and docs, plus the permit dashboard.
- Parked: company brain and ingest in `src/brain/` (off by default).

## Layout
```
src/          engine, CLI, MCP tools, hosted server (src/brain = parked)
spec/schemas  JSON schemas (generated)
apps/web      Next.js site and dashboard
data/         jurisdictions
docs/         architecture, hosting, roadmap, portal notes
test/         tests;  scripts/sim.ts = no-model simulation
```

## Run it
```sh
npm ci && npm run typecheck && npm test
npm run dev:cli        # local CLI
npm run dev:hosted     # hosted server, see docs/HOSTING.md
```
MIT licensed. Rules for contributors and agents: `AGENTS.md`. Visual style: `TASTE.md`.
