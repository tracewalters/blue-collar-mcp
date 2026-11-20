# Self-improving loop

Portals change. The repo is set up so breakage is found fast and fixed by an agent.

1. **Fixtures.** Every adapter has recorded portal responses in `test/fixtures/<platform>/`. CI runs against them, so no real portal is hit.
2. **Canary.** `.github/workflows/canary.yml` runs daily. For each `ready` adapter it logs into a test account and lists permits (`npm run canary`).
3. **Alert.** If a canary fails, the workflow opens a GitHub issue labeled `adapter-broke` with the log.
4. **Repair.** An agent picks up the issue: re-record the fixture from the live portal, update the adapter until fixtures and canary pass, open a PR. A human reviews and merges.
5. **Learn.** After each fix, add the cause to `docs/PORTAL_NOTES.md` (what changed, how it was found). Agents read it before touching an adapter.

Rules for repair agents: never commit credentials or recorded personal data (scrub fixtures), keep the diff to one adapter, and never loosen the two-phase write checks.
