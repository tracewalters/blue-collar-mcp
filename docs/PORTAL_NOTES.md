# Portal notes

Lessons per portal platform. Add an entry after every adapter fix or build.

Format: `## <platform>` then dated bullets: what changed, how it was found, how it was fixed.

## shape-phx (City of Phoenix, Salesforce/Clariti)
- 2026-11-26: first adapter built from Stanley 1.0's playbook (vault `Knowledge/sops/shapephx-cli.md`). No API; headless Chromium via `playwright-core` signed in as the user. Needs a Chromium install (`~/.cache/ms-playwright` or `PLAYWRIGHT_CHROMIUM`).
- Login: dismiss the whatfix "Alright!" modal (it lives in an iframe and blocks clicks), click `Login` with JS, then email and password on the Microsoft B2C page (`phxadb2c.b2clogin.com`). No CAPTCHA or MFA seen from a datacenter IP. Takes about 25 s. The saved session is reused; if it expired the adapter signs in again with the stored login.
- Permits: `/s/permits`, rows are `li.bgccApplicationWidgetItem` (number, address, applicant, type, work, status, action links). "Permits Shared With Me" is a plain table. Action links like `Request Inspection` and `Corrections Required` are exposed as `actions`.
- Inspections: open the permit with `View` to get `recordId` (cached), then `/s/inspection-scheduler?permitId=<rid>`. Three `lightning-datatable`s in order: Request Inspection (Pending), Scheduled, History. Tables render empty first; wait for an `INS-` row. Use Playwright locators (they see through shadow DOM); `document.querySelectorAll` does not.
- Permit numbers can contain a space (`CTR-102608432- SME`); we strip it for ids and match with `-\s*`.
- Booking (`request-inspection`) is not enabled yet. Stanley's notes: click Request with JS, date format "Oct 26, 2026", site contact is required, verify the INS appears under Scheduled after Save, never on weekends or past dates.
- 2026-11-26: the adapter no longer caches. Freshness lives in `src/service.ts` (ADR 0002: 15 min, served from a per-Company `cache.json`, stale data refreshed in the background). Reading all inspections now reads the permit list in the same browser session first, so one refresh is one sign-in.
