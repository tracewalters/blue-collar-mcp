# Security and data review (2026-11-26)

Two read-only reviews by Codex sub-agents. No critical flaw. Status as of this commit.

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Vault key stored beside the encrypted logins | High | **Fixed** (PR #16: per-company keys derived from `BCMCP_MASTER_KEY` in a root-only file) |
| 2 | Chromium runs with `--no-sandbox` under the shared service user | High | Open. Run the service under its own restricted OS user or container, then drop `--no-sandbox` |
| 3 | One company can exhaust or block the shared process (no limit on MCP sessions, one global portal queue) | High | Open. Per-company and global session caps, per-company browser queues, bounded global concurrency |
| 4 | Company secret is in every request URL (`/t/<secret>/mcp`) | Medium | Open. Move to a non-secret id in the path plus an auth header or OAuth; redact paths in logs |
| 5 | "One-time" dashboard links are replayable (2-minute grace; consumed list lost on restart) | Medium | Open. Exchange through a human-triggered POST and persist consumed nonces |
| 6 | Shape PHX caches are keyed by portal username only, not company | High | Open. Key by company + jurisdiction + account; evict on login and logout |
| 7 | Hosted brain approval token is not a human gate; any non-empty `BCMCP_BRAIN` enables it | Medium (parked feature) | Open. Never reuse this gate for portal writes; enable only on `BCMCP_BRAIN === "1"` |
| 8 | Daily canary can pass without testing anything (no credentials in the workflow) | Medium | Open. Wire scoped test credentials; fail if zero adapters ran |
| 9 | Deployment not restart-safe | Medium | **Fixed** (systemd units, Caddyfile block) |
| 10 | JSON state writes are not atomic or locked | High | Partly fixed in PR #16 (atomic state writes). Profiles, tenants and rids still open; add per-company locking |
| 11 | A partly failed inspections read can look like "no inspections" or return stale data | High | Open. Fail partial reads or return `{data, warnings, staleAt}` |
| 12 | First dashboard load repeats browser work (permits and inspections both miss the cache) | Medium | Open (ticket 02 addresses caching). Coalesce in-flight reads |
| 13 | Refreshed Shape PHX session is kept only in memory | Medium | Open. Persist refreshed state |
| 14 | Runtime data and published schemas disagree (`jurisdiction` on inspections); stored JSON not validated | Medium | Open. Validate storage and adapter output with Zod; add schema versions |
| 15 | No graceful shutdown; rate-limit and claim maps unbounded | Medium | Open |
| 16 | Multi-city reads fail as one unit | Low | Open. Use `allSettled` with per-city warnings |

## Hardening ideas
Require `BCMCP_PUBLIC_URL` and reject unexpected `Host` and `Origin`. Add CSP, HSTS, `Referrer-Policy: no-referrer`, `__Host-` cookies. Redacted audit events for claims, connection changes, sessions and writes. Provision tenants by immutable id, not name. Remove duplicate API routing between Next rewrites and Caddy. Add dependency update automation (audits currently show zero known vulnerabilities).

## Before real portal writes
Persist plan state (`executing`, `succeeded`, `failed`) before calling the portal; today the token is deleted first. Namespace Shape PHX record ids by jurisdiction.

## Database
No database is needed now. Add SQLite (WAL) before scheduled sync, a second process or hosted writes: tables `tenants`, `profiles`, `connections`, `plans`, `used_claims`; keep encrypted sessions as opaque blobs; import JSON once in a transaction; Postgres only for multiple hosts.
