# Architecture (draft)
- One remote MCP server (public HTTPS) on a Hostinger VPS. Claude chat connects as a custom connector; the org owner adds it once, each user signs in.
- Multi-tenant: every query is scoped by tenant. Postgres for brain data (markdown notes + metadata), with import/export for Obsidian and Drive.
- Setup commands are MCP prompts that drive the guided flows in `docs/ONBOARDING.md`.
- Rules are versioned; every answer cites the rule version and data `updated` date so staleness is visible.
- Writes are approval-gated. Secrets are never entered in chat.
- Adapters (crm, books, inventory, permits portals) all map to `core/schemas`.
