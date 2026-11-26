# Portal notes

Lessons per portal platform. Add an entry after every adapter fix or build.

Format: `## <platform>` then dated bullets: what changed, how it was found, how it was fixed.

## shape-phx (City of Phoenix, Salesforce/Clariti)
- 2026-11-26: first adapter built from Stanley 1.0's playbook (vault `Knowledge/sops/shapephx-cli.md`). No API; headless Chromium via `playwright-core` signed in as the user. Needs a Chromium install (`~/.cache/ms-playwright` or `PLAYWRIGHT_CHROMIUM`).
- Login: dismiss the whatfix "Alright!" modal (it lives in an iframe and blocks clicks), click `Login` with JS, then email and password on the Microsoft B2C page (`phxadb2c.b2clogin.com`). No CAPTCHA or MFA seen from a datacenter IP. Takes about 25 s. The saved session is reused; if it expired the adapter signs in again with the stored login.
- Permits: `/s/permits`, rows are `li.bgccApplicationWidgetItem` (number, address, applicant, type, work, status, action links). "Permits Shared With Me" is a plain table. Action links like `Request Inspection` and `Corrections Required` are exposed as `actions`.
- Inspections: open the permit with `View` to get `recordId` (cached), then `/s/inspection-scheduler?permitId=<rid>`. Three `lightning-datatable`s in order: Request Inspection (Pending), Scheduled, History. Tables render empty first; wait for an `INS-` row. Use Playwright locators (they see through shadow DOM); `document.querySelectorAll` does not.
- Permit numbers can contain a space (`CTR-102608432- SME`); we strip it for ids and match with `-\s*`.
- 2026-11-26: Jobs group permits by site address. "Permits Shared With Me" rows carry no address, so they stay ungrouped. Addresses are matched after normalizing case, punctuation, directions (E/East), street types (St/Street) and unit labels (Unit/Ste/Apt/# keep their number, so different units are different jobs).
- Booking (`request-inspection`) is not enabled yet. Stanley's notes: click Request with JS, date format "Oct 26, 2026", site contact is required, verify the INS appears under Scheduled after Save, never on weekends or past dates.
- 2026-11-26: the adapter no longer caches. Freshness lives in `src/service.ts` (ADR 0002: 15 min, served from a per-Company `cache.json`, stale data refreshed in the background). Reading all inspections now reads the permit list in the same browser session first, so one refresh is one sign-in.
- 2026-11-26: booking dry run (`proposeInspection`) built from Stanley's `request-inspection --stop-before-save`. **Not yet run live: no test login.** Steps: open the Inspection Scheduler, refuse if that type is already in Scheduled, find exactly one Pending row of the type, JS-click its `Request` button (it sits in a scrolled datatable, a normal click misses), wait for `section.slds-modal`, check its `Name` input is the INS, then for each field JS-focus + select, type with the real keyboard, fire `change` and blur. Fields: `SHPE_Preferred_Date__c` ("Oct 26, 2026"), `SHPE_Site_Contact_Name__c`, `SHPE_Site_Contact_Phone_Number__c`, `SHPE_Site_Contact_Email_Address__c`. Read the values back and check `.slds-form-element__help` for "required"/"invalid", then always press `Cancel`. The preview is the read-back values.
- Site contact comes from the Company profile (`userName`, `phone`, `email`). The portal says "Require either email or phone number", so we refuse up front if the profile has neither.
- Weekend, past-date and already-scheduled refusals live in `src/service.ts`, so every city gets them. Commit (Save, then confirm the INS moved to Scheduled) is ticket 05.
- If the first live dry run fails: likely suspects are the field names, the `Name` check in the modal, or the date picker not taking typed text.
- 2026-11-26: inspector comments (`getInspection`, MCP `get_inspection`). Follows Stanley's `inspection <P> <INS>`: related list `/s/permit2/related/<rid>/MUSW__Inspections__r` (lazy-loads, scroll until the `INS-` link shows), open its `/s/inspection/<id>` record and read label/value pairs (`Inspection Comments`, `Status`, `Inspection Type`, `Completed Date`). Read on demand only, never in the inspection list (one browser session per inspection). **Not yet verified live**: built without credentials; the label parsing is covered by `test/shape-phx.test.ts` on made-up page text.

## Parity checklists

One checklist per **Portal**: every page and action the city portal has, ticked when Blue Collar MCP can do it. Tick a box only when it works through the **Adapter** (CLI, MCP and dashboard). Add a dated note above when you tick one.

Template for a new portal (copy it, keep the groups, drop what the portal lacks):
```md
### <platform> parity (<city>) — updated YYYY-MM-DD
Source: <SOP, recording or how the map was found>. Built = what src/adapters/<platform>.ts does today.

**Sign in** (`<path>`)
- [ ] Sign in
- [ ] Reuse the saved session, sign in again when stale

**Permits list** (`<path>`)
- [ ] Permit number, address, type, status
- [ ] Action buttons per permit
- [ ] Permits shared with me
- [ ] Applied, issued and expiry dates

**Permit record** (`<path>`)
- [ ] Fields and alerts
- [ ] Reviews and review comments
- [ ] Corrections
- [ ] Fees
- [ ] Files and download
- [ ] Milestones / timeline

**Inspections** (`<path>`)
- [ ] Needed
- [ ] Scheduled
- [ ] History
- [ ] Inspector comments
- [ ] Request (two-phase, dry run first)
- [ ] Cancel
- [ ] Reschedule

**Money** (`<path>`)
- [ ] Balance
- [ ] Invoices
- [ ] Receipts
- [ ] Pay

**Other records** (`<path>`)
- [ ] Applications
- [ ] Licenses and registrations
- [ ] Requests
- [ ] Complaints
- [ ] Profile

**New work** (`<path>`)
- [ ] New application
- [ ] Revision or cancellation request
- [ ] Upload
```

### shape-phx parity (City of Phoenix) — updated 2026-11-26
Source: the portal map in Stanley's SOP (`Knowledge/sops/shapephx-cli.md`) and `scripts/bin/shapephx.py`. Built = what `src/adapters/shape-phx.ts` does today.

**Sign in**
- [x] Sign in (whatfix modal, B2C email + password)
- [x] Reuse the saved session, sign in again when stale

**Home `/s/`**
- [ ] User name and account balance
- [ ] Menu map (PAY, DATA/REPORTS, SHARE APPLICATION, REQUESTS, INVOICES, MORE)

**Permits `/s/permits`**
- [x] Permit number, address, type, work, status
- [x] Action buttons per permit (`Request Inspection`, `Corrections Required`)
- [x] Permits Shared With Me (no address, so not in a **Job**)
- [ ] Applied, issued and expiry dates (only shared permits carry a date today)

**Permit record `/s/application-reviewer?recordId=<rid>`**
- [x] Record id lookup (`View`, cached)
- [ ] Record fields
- [ ] Alerts
- [ ] Sharing Log
- [ ] File History
- [ ] Permit Request button (revision or cancellation, see below)
- [x] Schedule Inspection button (opens the scheduler, used to read inspections)

**Permit related lists `/s/permit2/related/<rid>/...`**
- [ ] Milestones (`MUSW__Milestones__r`)
- [ ] Submissions (`MUSW__Submissions__r`)
- [ ] Reviews and review comments (`MUSW__Reviews__r`, `/s/review/<id>`)
- [ ] Inspections related list (`MUSW__Inspections__r`)
- [ ] Clearances (`Clearances__r`)
- [ ] Files (`AttachedContentDocuments`)
- [ ] Download a file (PDF previewer)
- [ ] Related permits (`Permits__r`)

**Inspection Scheduler `/s/inspection-scheduler?permitId=<rid>`**
- [x] Request Inspection table (needed)
- [x] Scheduled Inspections table
- [x] Inspection History table (result and comment text)
- [ ] One inspection record `/s/inspection/<id>` (status, source, result, inspector comments)
- [ ] Request: Preferred Date, Site Contact Name, Phone, Email, Site Specific Instructions, Save (two-phase, dry run first)
- [ ] Cancel a scheduled inspection (24 h notice)
- [ ] Reschedule (cancel, then request again: the portal has no reschedule)

**Money**
- [ ] Balance
- [ ] Invoices `/s/invoices`
- [ ] Receipts `/s/receipts`
- [ ] PAY search `/s/search-pay` (Invoice #, Permit #, Application #, Registration #), read only
- [ ] Pay (not planned to automate)

**My records (MORE menu)**
- [ ] Applications `/s/applications`
- [ ] Registrations `/s/registrations`
- [ ] Licenses `/s/licenses`
- [ ] Requests `/s/request`
- [ ] Complaints `/s/complaints`
- [ ] Profile: contact, company, registered contractor (`/s/contact/<id>`, `/s/account/<id>`, `/s/shpe-registered-contractor/<id>`)
- [ ] Address and parcel records (`/s/address/<id>`, `/s/parcel/<id>`)

**Other pages**
- [ ] DATA/REPORTS search `/s/advanced-search` (12 categories)
- [ ] Share an application `/s/shpeapplicationshare`
- [ ] Revision/Cancellation request form `/s/revision-application?...` (preview only)
- [ ] New applications: `/s/permit-navigation`, `/s/site-development-applications`, `/s/Zoning-Application`, `/s/license-application`, `/s/registration-application`, `/s/code-modification-application`, `/s/complaint-form` (preview only)
- [ ] Upload to a submission slot (not planned to automate)

**Ours, built on top of the portal**
- [x] **Jobs**: permits grouped by site address, rename and merge (2026-11-26)
