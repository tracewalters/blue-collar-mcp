# Contributing

Adding an adapter for a portal platform is the best first contribution.

1. Copy `src/adapters/demo.ts` to `src/adapters/<platform>.ts` and implement `PortalAdapter` (`src/adapter.ts`). Prefer the portal's HTTP/JSON endpoints. Use a browser only if you must.
2. Remove the platform from `PLANNED_PLATFORMS` in `src/adapters/planned.ts` and register yours in `src/adapters/index.ts`. Set `maturity: "ready"`.
3. Add cities to `data/jurisdictions.json`.
4. Record scrubbed fixtures in `test/fixtures/<platform>/` and write tests.
5. `npm run typecheck && npm test`.

Rules: use only the user's own account. Writes must be two-phase (propose, then commit). Never log credentials. Keep it small.
