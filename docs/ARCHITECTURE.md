# Architecture

```
Claude ──MCP (HTTPS)──┐
                      ├─ src/server.ts  ── src/service.ts ── adapters (demo, shape-phx next)
Website (apps/web) ───┘   hosted, per-company            └─ vault (encrypted logins + sessions)
        /api, /auth       tenant folders
CLI (src/cli.ts) ───────── same service, local mode
```

- **One service, three front doors.** `src/service.ts` does the work. The CLI, the MCP tools (`src/permit-tools.ts`) and the dashboard API (`src/server.ts`) all call it.
- **Adapters per platform, not per city.** One adapter per portal software; each city is a small entry in `data/jurisdictions.json`. API first, browser only when needed.
- **Credentials never touch the model.** Portal logins are entered on the website (or the CLI), straight into the vault. Claude only sees connection ids.
- **Writes are two-phase.** Propose returns a token; commit needs the user's approval. Hosted mode is read-only for now.
- **Multi-tenant.** Each company has a secret connector URL (only its hash is stored) and a tenant-specific vault key derived from the hosted master key. The master key stays outside tenant storage. Requests run inside that tenant context (`tenantDir` in `src/vault.ts`).
- **Sign-in without passwords.** Claude's `open_dashboard` tool returns a one-time, 10-minute link. It sets an HttpOnly session cookie for 30 days.
- **Self-improving.** Fixtures and a daily canary (`docs/SELF_IMPROVING.md`).
- **Parked:** the brain and ingest live in `src/brain/` and are off unless `BCMCP_BRAIN=1`.
