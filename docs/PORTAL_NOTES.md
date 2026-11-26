# Portal notes

Lessons per portal platform. Add an entry after every adapter fix or build.

Format: `## <platform>` then dated bullets: what changed, how it was found, how it was fixed.

## shape-phx (City of Phoenix, Salesforce/Clariti)
- 2026-11-26: first adapter built from Stanley 1.0's playbook (vault `Knowledge/sops/shapephx-cli.md`). No API; headless Chromium via `playwright-core` signed in as the user. Needs a Chromium install (`~/.cache/ms-playwright` or `PLAYWRIGHT_CHROMIUM`).
- Login: dismiss the whatfix "Alright!" modal (it lives in an iframe and blocks clicks), click `Login` with JS, then email and password on the Microsoft B2C page (`phxadb2c.b2clogin.com`). No CAPTCHA or MFA seen from a datacenter IP. Takes about 25 s. The saved session is reused; if it expired the adapter signs in again with the stored login.
- Permits: `/s/permits`, rows are `li.bgccApplicationWidgetItem` (number, address, applicant, type, work, status, action links). "Permits Shared With Me" is a plain table. Action links like `Request Inspection` and `Corrections Required` are exposed as `actions`.
- Inspections: open the permit with `View` to get `recordId` (cached), then `/s/inspection-scheduler?permitId=<rid>`. Three `lightning-datatable`s in order: Request Inspection (Pending), Scheduled, History. Tables render empty first; wait for an `INS-` row. Use Playwright locators (they see through shadow DOM); `document.querySelectorAll` does not.
- Permit numbers can contain a space (`CTR-102608432- SME`); we strip it for ids and match with `-\s*`.
- 2026-11-26: booking dry run (`proposeInspection`) built from Stanley's `request-inspection --stop-before-save`. **Not yet run live: no test login.** Steps: open the Inspection Scheduler, refuse if that type is already in Scheduled, find exactly one Pending row of the type, JS-click its `Request` button (it sits in a scrolled datatable, a normal click misses), wait for `section.slds-modal`, check its `Name` input is the INS, then for each field JS-focus + select, type with the real keyboard, fire `change` and blur. Fields: `SHPE_Preferred_Date__c` ("Oct 26, 2026"), `SHPE_Site_Contact_Name__c`, `SHPE_Site_Contact_Phone_Number__c`, `SHPE_Site_Contact_Email_Address__c`. Read the values back and check `.slds-form-element__help` for "required"/"invalid", then always press `Cancel`. The preview is the read-back values.
- Site contact comes from the Company profile (`userName`, `phone`, `email`). The portal says "Require either email or phone number", so we refuse up front if the profile has neither.
- Weekend, past-date and already-scheduled refusals live in `src/service.ts`, so every city gets them. Commit (Save, then confirm the INS moved to Scheduled) is ticket 05.
- If the first live dry run fails: likely suspects are the field names, the `Name` check in the modal, or the date picker not taking typed text.
