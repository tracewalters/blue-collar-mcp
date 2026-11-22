# Blue Collar MCP

Guided AI for residential trades, inside Claude chat. A shared company brain, trade rule packs, and step-by-step workflows for people who have never used AI.

**For:** architects, drafters, interior designers, landscape and pool designers, GCs, home builders, and subs (electrical, plumbing, and more). Owner-run shops and small teams.

## Promise
- **One source of truth.** Owner and team get the same answer from the same live data. Stale data is flagged.
- **Guided, not technical.** Type `/brain-setup`. Claude asks multiple-choice questions and gives exact links and steps.
- **Trade-smart.** Rule packs keep answers short and right for residential construction.

## Packages
Setup flows for each are mapped in [`docs/ONBOARDING.md`](docs/ONBOARDING.md).

| Package | Command | Status |
|---|---|---|
| `brain` company memory: clients, jobs, meetings, decisions | `/brain-setup` | v1 |
| `rules` rule packs or your own | `/rules-setup` | v1 |
| `permits` any Phoenix-metro city portal, via portal CLIs | `/permits-setup` | v1, core built (`src/`) |
| `books` QuickBooks and bookkeeping | `/books-setup` | v1.5, read-only first |
| `crm` Jobber, JobTread, Buildertrend, HubSpot adapters | `/crm-setup` | v1.5 |
| `inventory` stock lookup and ordering (Pool Corp, Home Depot) | `/inventory-setup` | v2 |
| `subs`, `field`, `docs`, `comms` | later | stubs |

## Where the code is today
The permit engine (schemas, adapter SDK, CLI, MCP server, canary) lives in `src/`. It becomes `packages/permits` when the hosted server needs the split. `apps/web` is the marketing and account site. `packages/*` and `rule-packs/*` hold the product plan for now.

## Related
RIG / Stanley 2.0 is the private self-hosted system for Walters Renovations. This is the friendly public product. Walters rules can seed one rule pack. No Walters data lives here.

## Hosting and license
One multi-tenant server on a Hostinger VPS, free to start, usage-based paid tiers ([`docs/MONETIZATION.md`](docs/MONETIZATION.md)). MIT.
