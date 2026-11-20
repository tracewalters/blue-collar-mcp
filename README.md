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

## Planned tools (draft)
| Tool | Purpose |
|---|---|
| `list_permits` | All permits across projects and jurisdictions, filterable by status |
| `get_permit` | Full detail and history for one permit |
| `get_permit_status` | Live status from the city portal |
| `list_inspections` | Upcoming, passed, failed, and needed inspections |
| `schedule_inspection` | Request an inspection (confirmation required) |
| `list_required_documents` | What a jurisdiction needs for a permit type |
| `get_jurisdiction` | Portal, fees, turnaround, and rules for a city |
| `get_deadlines` | Expirations, resubmittals, and inspection windows |

Write actions (submit, schedule, pay) always require explicit user confirmation.

## Repo layout
```
spec/        Standard text and JSON schemas
src/         Reference MCP server (tools, jurisdiction adapters)
adapters/    Per-harness install configs (codex, chatgpt, claude, grok)
examples/    Sample data and prompts
docs/        Guides and contributor docs
```

## Status
Early draft. Nothing is implemented yet. See `spec/README.md`.

## License
MIT
