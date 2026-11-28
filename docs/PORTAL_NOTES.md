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
- 2026-11-26: the adapter no longer caches. Freshness lives in `src/service.ts` (ADR 0002: 15 min, served from a per-Company `cache.json`, stale data refreshed in the background for the dashboard, while Claude waits for the fresh read and gets cached data marked `stale` only on error or timeout). Reading all inspections now reads the permit list in the same browser session first, so one refresh is one sign-in.
- 2026-11-26: booking dry run (`proposeInspection`) built from Stanley's `request-inspection --stop-before-save`. **Not yet run live: no test login.** Steps: open the Inspection Scheduler, refuse if that type is already in Scheduled, find exactly one Pending row of the type, JS-click its `Request` button (it sits in a scrolled datatable, a normal click misses), wait for `section.slds-modal`, check its `Name` input is the INS, then for each field JS-focus + select, type with the real keyboard, fire `change` and blur. Fields: `SHPE_Preferred_Date__c` ("Oct 26, 2026"), `SHPE_Site_Contact_Name__c`, `SHPE_Site_Contact_Phone_Number__c`, `SHPE_Site_Contact_Email_Address__c`. Read the values back and check `.slds-form-element__help` for "required"/"invalid", then always press `Cancel`. The preview is the read-back values.
- Site contact comes from the Company profile (`userName`, `phone`, `email`). The portal says "Require either email or phone number", so we refuse up front if the profile has neither.
- Weekend, past-date and already-scheduled refusals live in `src/service.ts`, so every city gets them. Commit (Save, then confirm the INS moved to Scheduled) is ticket 05.
- If the first live dry run fails: likely suspects are the field names, the `Name` check in the modal, or the date picker not taking typed text.
- 2026-11-26: inspector comments (`getInspection`, MCP `get_inspection`). Follows Stanley's `inspection <P> <INS>`: related list `/s/permit2/related/<rid>/MUSW__Inspections__r` (lazy-loads, scroll until the `INS-` link shows), open its `/s/inspection/<id>` record and read label/value pairs (`Inspection Comments`, `Status`, `Inspection Type`, `Completed Date`). Read on demand only, never in the inspection list (one browser session per inspection). **Not yet verified live**: built without credentials; the label parsing is covered by `test/shape-phx.test.ts` on made-up page text.
- 2026-11-26: booking is gated per adapter (`bookingVerified`). Shape PHX is `false` until the dry run works once against the real portal; until then `proposeInspection` says "Booking for Phoenix is being tested; not available yet." Flip it in `src/adapters/shape-phx.ts` after a live test. The "already scheduled" check lives only in `src/service.ts` now and compares by inspection number when the caller passes one (`inspectionId`), otherwise by type. `pressModalCancel` throws if it cannot press Cancel on an open form, so a dry run never leaves a form that could be saved. Found in the integration review.

## accela (Queen Creek "Development Nexus", Accela Citizen Access)
- 2026-11-28: adapter `src/adapters/accela.ts` built from public recon only (**no login yet, not verified live**). One adapter for every Accela city: the jurisdiction `baseUrl` is `https://<host>/<AGENCY>` (Queen Creek: `https://aca-prod.accela.com/QC`). `maturity` stays `planned` until a live login run works.
- URLs: town page `queencreekaz.gov/.../development-nexus-home` blocks curl (403) but works in Chromium. New portal shell `https://qc-prod.accela.com/portal/` (Angular, dotCMS) only links into classic ACA `https://aca-prod.accela.com/QC/...`. All data lives in classic ACA.
- Login: Accela Civic ID = FusionAuth at `login.accela.com` (OAuth2 code flow, client `da2d05a1-...`, redirect `/QC/SSO/FaResponse.aspx`). `/QC/Login.aspx` redirects there. Form: `#username`, `#password`, submit button, hidden `captcha_token` (CAPTCHA may switch on), optional "Remember me". MFA: unknown until we have an account (FusionAuth supports it). We sign in with Chromium once, keep the `aca-prod` cookies, then read with plain HTTP.
- Public (logged out) works: general search `Cap/CapHome.aspx?module=Permits` (async postback on `ctl00$PlaceHolderMain$btnNewSearch`, permit number field `txtGSPermitNumber`, format `Byy-####`, one hit returns a `pageRedirect` to the record). Record page `Cap/CapDetail.aspx?Module=Permits&capID1=PMT26&capID2=00000&capID3=00220&agencyCode=QC` shows status, type, work location, description.
- Inspections are NOT in the first HTML: the page fires an async postback `ctl00$PlaceHolderMain$InspectionList$btnRefreshGridView` (panel `...InspectionList$inspectionUpdatePanel`). Plain HTTP works if you send all hidden fields, `ctl00$PlaceHolderMain$addForDetailPage$collection=rdoExistCollection`, `X-MicrosoftAjax: Delta=true` and a `Referer`; without them you get `Error.aspx`. Completed list is 5 per page, "Next" is another postback (`gvListCompleted$ctl08$ctl04`). Responses are ASP.NET delta format (`len|type|id|content|`); lengths count `\r\n`, so read fixtures without newline conversion.
- Inspector comments: `Inspection/InspectionDetails.aspx?agencyCode=QC&RecordAltID=<B26-...>&RecordID1..3=<capID>&Module=Permits&Action=ViewDetails&ID=<inspection id>&isPopup=Y`, public. Result comments in `...ResultCommentList..._lblResultComment`. Inspection ids are digits (e.g. 19328603).
- Fees: page methods on the record page (JSON, same session): `POST Cap/CapDetail.aspx/DisplayFeeNoPaid {"pageNum":"1","moduleName":"Permits"}` (outstanding) and `DisplayFeePaid`. They return an HTML table in `d`. `GetProcessingData {"agencyCode":"QC","moduleName":"Permits"}` returns the workflow (reviews) tree. Documents come from Velosimo (`connect.velosimo.io/app/docqcprod/documents?recordId=PMT26-00000-00220`).
- **Gotcha: Cloudflare rate limit.** About 20 quick requests (a browser page load counts each asset) got us `429` / error 1015 for 10+ minutes on `Cap/CapHome.aspx`. The adapter sends one request at a time with a 1.2 s gap (`BCMCP_ACCELA_GAP_MS`) and turns 429 into "the city portal is limiting requests".
- Inspections: phone 480-358-3030, text 844-347-6270. Booking stays off (`bookingVerified: false`); the wizard is `Inspection/InspectionWizardInputType.aspx?...`.
- Needs to finish: a Queen Creek Development Nexus (Accela Civic ID) account with at least one permit on it, to verify sign-in, the "My Records" list on `CapHome.aspx` when signed in (parser assumes the same `gdvPermitList` grid as search results), and MFA/CAPTCHA behavior.

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
- [x] Inspections related list (`MUSW__Inspections__r`, used to find one inspection's record; unverified live)
- [ ] Clearances (`Clearances__r`)
- [ ] Files (`AttachedContentDocuments`)
- [ ] Download a file (PDF previewer)
- [ ] Related permits (`Permits__r`)

**Inspection Scheduler `/s/inspection-scheduler?permitId=<rid>`**
- [x] Request Inspection table (needed)
- [x] Scheduled Inspections table
- [x] Inspection History table (result and comment text)
- [x] One inspection record `/s/inspection/<id>` (status, source, result, inspector comments; unverified live)
- [x] Request dry run: Preferred Date, Site Contact Name, Phone, Email, then Cancel (**unverified live**; refused until `bookingVerified`)
- [ ] Request Save (ticket 05) and Site Specific Instructions
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

## Scottsdale (found 2026-11-28, not built yet)
- New permits since Jan 6, 2026 go through **SPUR**: Tyler EnerGov self service at `https://cityofscottsdaleaz-energovweb.tylerhost.net/apps/selfservice`. Users register an account there; guide linked from https://www.scottsdaleaz.gov/planning-development/scottsdale-spur.
- Older projects stay on the legacy eServices (`https://eservices.scottsdaleaz.gov/bldgresources/BuildingPermit`); online inspection scheduling there needs the keycode printed on the permit receipt. Inspection Services: 480-312-5750.
- Next: probe EnerGov's own JSON endpoints first (playbook step 2), then browser automation only if needed. Needs a real SPUR login to test.

### accela parity (Queen Creek) — updated 2026-11-28
Source: public recon of `aca-prod.accela.com/QC` (logged out). Built = what `src/adapters/accela.ts` does today. Nothing verified signed in yet.

**Sign in** (`login.accela.com`, FusionAuth)
- [x] Sign in (Chromium, username + password; unverified live)
- [x] Reuse the saved cookies, sign in again when stale (unverified live)

**Permits list** (`Cap/CapHome.aspx?module=Permits`, signed in = My Records)
- [x] Permit number, address, type, status (unverified live: parser tested on search-grid markup)
- [x] Action links per permit
- [ ] Records in other modules (Engineering, Planning, Code Compliance)
- [x] Applied date (list Date column)

**Permit record** (`Cap/CapDetail.aspx`)
- [x] Status, type, work location, description (verified on public pages)
- [ ] Workflow / reviews (`GetProcessingData`)
- [ ] Conditions
- [x] Fees due (`DisplayFeeNoPaid`)
- [ ] Documents (Velosimo)

**Inspections** (record page, inspections postback)
- [x] Upcoming (scheduled / pending)
- [x] Completed, all pages (verified on public pages)
- [x] Inspector comments (`InspectionDetails.aspx`, verified on public pages)
- [ ] Request (two-phase, dry run first)
- [ ] Cancel
- [ ] Reschedule

**Money**
- [ ] Invoices, receipts, pay (not planned to automate)

