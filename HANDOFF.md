# HANDOFF

Read `AGENTS.md`, `VISION.md`, `docs/ARCHITECTURE.md`, `docs/PORTAL_NOTES.md` first. Trace (the owner) wants **very short, plain replies** (2-3 sentences, "tldr"), one feature at a time, and never any secrets in chat.

## What this is
**Blue Collar MCP**: permits for residential contractors, inside Claude. A hosted MCP server plus a website dashboard. Permits is the only feature right now. Brain, rules, books, CRM and inventory are parked (`docs/ROADMAP.md`).

## State (as of 2026-11-26)
- Repo: https://github.com/tracewalters/blue-collar-mcp. `main` has everything through PR #15 once merged. 37 tests pass (`npm run typecheck && npm test`).
- **Works end to end:** onboarding in Claude (`get_setup`, `run_setup` form via MCP elicitation, `save_setup`) -> `open_dashboard` one-time link -> website connect checklist (log in to each city) -> Claude reads permits and inspections -> dashboard shows the same data.
- **Real portal:** only **Shape PHX (City of Phoenix)** via `src/adapters/shape-phx.ts` (headless Chromium with `playwright-core`, signed in as the user). Tested with Trace's real account: 13 permits, 46 inspections. Demo city (`demo` / `demo`) also works. Other cities in `data/jurisdictions.json` are `tbd` placeholders ("coming soon"); only Scottsdale (Tyler EnerGov) and Avondale (Accela) have a known platform.
- **Not built:** booking inspections (`proposeInspection` and `commit` in the Shape PHX adapter throw "not enabled"); hosted mode is read-only.

## Code map
```
src/server.ts          hosted server: /t/<secret>/mcp, /auth/claim, /api/*; sessions, tenants
src/service.ts         the one place that does work (CLI, MCP and dashboard all call it)
src/permit-tools.ts    permit MCP tools;  src/setup-tools.ts  onboarding tools (run_setup form)
src/profile.ts         company profile + chosen cities (per company)
src/jobs.ts            Jobs: permits grouped by site address; rename/merge saved per company (jobs.json)
src/adapters/          demo, shape-phx (real), planned placeholders
src/vault.ts           per-company encrypted vault; tenantDir (AsyncLocalStorage) scopes everything
src/brain/             PARKED notes + ingest (BCMCP_BRAIN=1 turns on)
apps/web               Next.js site and dashboard (follow TASTE.md)
test/                  node:test; audit-*.test.mjs spawn the real server
scripts/sim.ts         no-model simulation of the (parked) ingest pipeline
```
Key design rules: one adapter per portal platform, API first, writes two-phase (propose then approved commit), credentials never go through the model, each company has its own folder and a vault key derived from a host master key, only hashes of connector secrets are stored.

## How hosted mode works
- Company gets a secret connector URL `https://mcp.waltreno.systems/t/<secret>/mcp` (add in Claude as a custom connector). Create with `node src/server.ts tenant "Name"`; rotate or revoke with `rotate` / `revoke`.
- `open_dashboard` returns `/auth/claim?t=...&next=...`: signed, 10 minutes, reusable for 2 minutes after first use, then sets a 30-day HttpOnly cookie. Dashboard API (`/api/*`) needs the cookie; POSTs need header `x-bc: 1`.
- Clients that advertise MCP **elicitation** get a stateful session (so the form answer finds its tool call); all others stay stateless. Don't break the stateless path.
- Brain tools are off unless `BCMCP_BRAIN=1`.

## Where it runs (Hostinger VPS)
- **Persistent now (systemd + Caddyfile).** Services `bcmcp-api` (127.0.0.1:3300) and `bcmcp-web` (127.0.0.1:3301), both `User=cloudroom-agent`, `Restart=always`, enabled at boot. Caddy: a `mcp.waltreno.systems` block in `/etc/caddy/Caddyfile` (`/t/* /auth/* /api/*` -> 3300, rest -> 3301). The Stanley block is untouched. Backups: `/etc/caddy/Caddyfile.bak-bcmcp-*`.
- **Root access:** none in the agent sandbox. Use the Mac relay: `room-cli mac run 'ssh -o BatchMode=yes -i ~/.ssh/stanley_vps stanley@100.103.126.68 "sudo ..."'` (Tailscale, Trace's Mac must be on). For longer scripts pass them base64-encoded into `sudo bash`.
- **Master key:** `/etc/bcmcp/bcmcp.env` (root, 0600, read by systemd; the agent user cannot read it). It holds `BCMCP_MASTER_KEY`, `BCMCP_DATA`, `BCMCP_PUBLIC_URL`, `PORT`, `BCMCP_DEBUG_DIR`. Losing it makes every stored portal login unreadable, so keep a copy somewhere safe (Trace has none yet: tell him to store it).
- **Deploy:** `cd /home/cloudroom-agent/bcmcp-run && git fetch && git checkout --detach origin/main`, then `cd apps/web && npx next build` (only if web changed), then `sudo systemctl restart bcmcp-api bcmcp-web` through the relay. Never leave a stale `next start` running by hand: it takes the port and serves a mismatched build. Always branch from `origin/main`, not a stale local `main`.
- Data: `/home/cloudroom-agent/bcmcp-data` (tenants, backups, debug screenshots, session key). **Never commit or print anything in there.** Debug: failed Shape PHX sign-ins drop a screenshot in `bcmcp-data/debug/`; server logs are `journalctl -u bcmcp-api`.
- DNS: `mcp.waltreno.systems` A record at Hostinger -> `82.180.137.78`. Chromium for Playwright is in `~/.cache/ms-playwright`.
- Shape PHX allows effectively one live session per account: logging in from tests can invalidate the stored session of the real user, and the adapter then signs in again (about 25 s). Don't run test logins against Trace's account while he is using it.

## GitHub access
`gh` is logged in on the VPS as `tracewalters` (shared home folder, so every thread has it). Token expires; if pushes fail, ask Trace to renew via the secure form. Local branch naming: work on a branch, open a PR to `main`, end PR bodies with `Built with [Cloudroom](https://cloudroom.dev)`. Stacked PRs got messy: prefer one PR into `main`.

## Decisions and plan
Read `GLOSSARY.md`, `docs/SPEC.md` (36 user stories, one test seam: the running server), `docs/adr/0001-0003`, and the 18 tickets in `.scratch/permits-parity/issues/`. Build order: booking dry run (04) then booking commit (05) first, then inspector comments (01), refresh rule (02), the rest. Security and data findings and their status: `docs/SECURITY-REVIEW.md`.

## Next steps (in order)
1. **Inspection booking on Shape PHX** (the product's core promise). Port Stanley 1.0's playbook: `/home/cloudroom-agent/stanley-build/stanley-project/scripts/bin/shapephx.py` and the SOP `rules/vault/Knowledge/sops/shapephx-cli.md` (same dir). Rules: Request button is in a scrolled datatable, click with JS; date format "Oct 26, 2026"; site contact name + phone/email required (use the company profile); refuse weekends and past dates; refuse an INS already scheduled; verify the INS appears under Scheduled after Save; cancel needs 24 h notice. Build `propose` + `commit` in `shape-phx.ts`, test with a dry run that stops before Save (press Cancel) and only do one live booking with Trace's explicit approval. In hosted mode writes need a two-step approval (see `src/brain/approval.ts` `gate` for a preview+token pattern; move it to `src/`), plus the Claude app's own tool-approval prompt.
2. **Make the deployment permanent** (needs Trace to run root commands): systemd units for API and web, Caddy snippet.
3. **Dashboard**: sort ready cities to the top of "Add more cities"; show inspections as a calendar; loading states for the slow (~1 min) first inspections read.
4. **More cities**: research which portal software each Phoenix-metro city uses (Queen Creek, Cave Creek, Maricopa, Mesa, Chandler, Gilbert...) and use `docs/ROADMAP.md` portal playbook. Public Shape PHX data (ArcGIS layer at `mapportal.phoenix.gov/pds/rest/services/ShapePHX/ShapePHXPermitsPoints/MapServer`, weekly) is a no-login fallback.
5. Scheduled sync / alerts (failed inspection, expiring permit). Not built; everything is on request with a 5-minute in-memory cache.
6. Parked: company brain, rules packs, books, CRM, inventory, usage-based pricing. See `docs/ROADMAP.md`.

## Gotchas
- Shape PHX: dismiss the whatfix "Alright!" iframe modal, click Login with JS, sign in on `phxadb2c.b2clogin.com`. Playwright locators see through shadow DOM; `document.querySelectorAll` does not. Permit numbers can contain a space (`CTR-102608432- SME`). Details in `docs/PORTAL_NOTES.md`.
- The schema changed: permit status `cancelled`, inspection status `completed`, `appliedAt` and `actions` optional. `npm run schemas` regenerates `spec/schemas` (a test checks they match).
- Tests spawn real servers on free ports; don't run them while something else holds your ports. Don't use ports 3300/3301 for dev (production).
- Parallel portal sessions are serialized in-process on purpose.
- The user's Claude client (inside Cloudroom) may or may not show MCP forms; the text fallback exists. Test in a NEW chat (tool lists are cached per chat).

## How to verify quickly
```sh
npm ci && npm run typecheck && npm test           # 37 pass
curl -s -o /dev/null -w "%{http_code}\n" https://mcp.waltreno.systems/dashboard   # 200
curl -s -o /dev/null -w "%{http_code}\n" https://stanley.waltreno.systems/healthz # 200 (must stay up)
```
