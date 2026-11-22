# Blue Collar MCP

An MCP server that gives residential trades a shared company brain, trade rules, and guided workflows inside Claude chat. Built for people who have never used AI.

**For:** architects, drafters, interior designers, landscape and pool designers, GCs, home builders, and subs (electrical, plumbing, etc.). Mostly owner-run shops and small teams.

## Promise
- **One source of truth.** The owner and the team get the same answer, from the same live data. Stale data gets flagged.
- **Guided, not technical.** Type a command (`/brain-setup`). Claude asks multiple-choice questions and walks you through each step with exact links.
- **Trade-smart.** Rule packs make answers short and correct for residential construction.

## Packages
Each package has its own guided setup command. Maps live in [`docs/ONBOARDING.md`](docs/ONBOARDING.md).

| Package | Command | Status |
|---|---|---|
| `brain` company memory, meetings, clients, jobs, decisions | `/brain-setup` | v1 |
| `rules` rule packs and custom rules | `/rules-setup` | v1 |
| `permits` any Phoenix-metro city portal, via portal CLIs | `/permits-setup` | v1 |
| `books` QuickBooks and bookkeeping | `/books-setup` | v1.5, read-only first |
| `crm` adapters for Jobber, JobTread, Buildertrend, HubSpot, etc. | `/crm-setup` | v1.5 |
| `inventory` stock lookup and ordering (Pool Corp, Home Depot, etc.) | `/inventory-setup` | v2 |
| `subs`, `field`, `docs`, `comms` | later | stubs |

## Not this repo
RIG / Stanley 2.0 is the private, self-hosted power system for Walters Renovations. This is the friendly public product. Walters rules become one rule pack here. Walters data never goes in this repo.

## Hosting
One multi-tenant server on a Hostinger VPS. Each company is its own tenant. Users sign in per person, and the owner connects it once in Claude.

## Layout
```
core/         shared data model and schemas
packages/     one folder per package (tools, onboarding flow)
rule-packs/   starter rule sets by trade
docs/         architecture, onboarding maps, monetization, research
```

## Status
Planning. Nothing implemented. License: MIT.
