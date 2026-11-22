# Permit MCP Standard

An open standard and reference [MCP](https://modelcontextprotocol.io) server for building permits, so any AI harness (Claude, ChatGPT, Codex, Grok) can manage permits and inspections the same way.

**For:** general contractors, subcontractors, and anyone in residential building juggling permits across multiple city portals and inspections.

## The problem
Every city has its own portal, forms, statuses, fees, and inspection rules. Contractors track it all by hand across tabs, emails, and spreadsheets.

## What this standard defines
1. **Common data model**: Permit, Project, Inspection, Jurisdiction, Document, Fee, Status (`spec/schemas/`).
2. **Standard MCP tools**: the same tool names and shapes regardless of city or harness.
3. **Jurisdiction adapters**: one plugin per city portal that maps its quirks to the common model.
4. **Harness packaging**: install configs for Claude, ChatGPT, Codex, Grok (`adapters/`).

## Quick start
```bash
git clone https://github.com/tracewalters/Permit-MCP && cd Permit-MCP
npm install && npm run build
node dist/cli.js login          # pick cities, log in once each (try the "Demo City": demo / demo)
claude mcp add permit -- node "$PWD/dist/mcp.js"
```
Then ask Claude: "What's the status of all my open permits?"

Every function is also a CLI: `permit permits`, `permit inspections`, `permit schedule`, `permit commit`. The MCP and the CLI share one implementation (`src/service.ts`).

## Tools
| Tool | Purpose |
|---|---|
| `list_connections` | Cities you are logged into |
| `list_permits` | Permits across all connected cities |
| `get_permit` | Detail and inspections for one permit |
| `list_inspections` | Needed, scheduled, passed, failed |
| `propose_inspection` | Step 1 of a write. Changes nothing |
| `commit_action` | Step 2. Runs only after you approve a prompt |

Passwords never go through chat. You enter them in the terminal (`permit login`). They are stored encrypted (AES-256-GCM) on your machine.

## Status
Working end to end with the fixture-backed **demo** adapter. Real adapters for Salesforce/Shape-Phoenix, Tyler, Accela, and OpenGov are **planned, not built yet**. See `docs/CONTRIBUTING.md` to add one.

## Repo layout
```
src/         CLI, MCP server, service layer, vault, adapters
data/        Jurisdiction list
test/        Tests (node:test)
apps/web/    Marketing, docs, billing and usage site
spec/        Standard text and JSON schemas
adapters/    Per-harness install configs
docs/        Architecture, vision, self-improving loop, contributing
```
See `VISION.md` and `docs/ARCHITECTURE.md`.

## License
MIT
