# Portal CLI playbook (draft)
Agent recipe for turning any permit portal into a CLI the server can run.

1. Recon: identify portal software (Accela, Tyler EnerGov, OpenGov, custom), login type, public vs authenticated pages.
2. Check for an API or open data feed first. Prefer official APIs over scraping.
3. Map core actions: search permit, get status, list inspections, list documents, fees. Writes (submit, schedule, pay) later and gated.
4. Build the CLI with the common output schema (`core/schemas`).
5. Test against 3 real permits the user supplies. Save fixtures.
6. User reviews output. Then publish to the jurisdiction registry for all tenants.
7. Maintenance: nightly canary check; flag when the portal changes.

Safety: credentials stored per tenant, never in the repo. Respect each portal's terms. Confirm before any write.
