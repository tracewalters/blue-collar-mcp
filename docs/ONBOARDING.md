# Onboarding maps

Pattern for every package: **command -> multiple-choice branch -> exact links and steps -> verify -> first useful result.**
Rules: one question at a time, plain English, always give the exact link, never ask for secrets in chat (use a secure connect link), confirm before any write.
Open question: confirm how Claude chat renders choices (interactive widget vs lettered options). Design for lettered options first.

## /brain-setup
1. Where should your company brain live?
   - A. Hosted by us (default, nothing to install) -> go to 3
   - B. Obsidian (files on your computer, synced) -> 2B
   - C. Google Drive folder -> 2C
   - D. Notion -> 2D
2B. Obsidian: download link, create vault, install sync option (iCloud/Obsidian Sync/Git), paste vault path or connect folder. Verify by writing a test note.
2C/2D: connect and verify the same way.
3. Who is on your team? (solo / 2-5 / 6+) -> invite links, roles (owner, member).
4. What do you keep info in today? (multi-select) Gmail, Google Drive, local folders/Finder, text messages, CRM (JobTread, Jobber, Buildertrend, other), QuickBooks, meeting notes app, photos, other.
5. Per source: connect steps, then scope (last 12 months / all / pick folders) and a privacy check (what to skip).
6. **/ingest** runs per source: extract clients, jobs, people, companies, documents, commitments. Show a preview count and 10 samples. User confirms before anything is saved.
7. Review queue: low-confidence matches and duplicates, one at a time.
8. First win: "Ask me anything about your most recent job." Then offer `/rules-setup`.

Core brain rules (from the Walters vault): every live file has an `updated` date; edit in place; unknown means null, never invent; AI-written notes are labeled; raw data is separate from curated facts.

## /meeting-setup (part of brain)
1. Which notetaker? Bee, Granola, Fireflies, Otter, Fathom, Claude Meetings, none/paste.
2. Connect steps per tool (research needed on each API/export).
3. Each meeting becomes: attendees, client/job link, decisions (decided vs discussed), commitments (who, what, when). Suggestions only, never auto-act.

## /rules-setup
1. Start how?
   - A. Pick a rule pack (landscape/pool, residential GC, design/architect, electrical, plumbing)
   - B. Mine my brain: scan for things we repeat, propose rules, user accepts or edits each
   - C. Start from scratch: guided interview
2. Review rules one at a time: keep / edit / drop. Tag each (pricing, voice, process, safety).
3. Set reply style (short by default), name, and voice sample.
4. Publish as version 1. Team sees the same version. Changes are logged.

## /permits-setup
1. Which city or cities? (Phoenix metro list: Queen Creek to Cave Creek, Maricopa, etc.)
2. Do we already have a portal adapter for it?
   - Yes -> connect login via secure link, verify with a read-only status pull.
   - No -> run the **portal CLI playbook** (`packages/permits/portal-cli-playbook/`): an agent builds and tests a CLI for that portal, user reviews, then it is saved for everyone.
3. Import existing permits (from brain, email, spreadsheet).
4. Set alerts: inspections, expirations, resubmittals.

## /books-setup
1. Which software? QuickBooks Online / Desktop / Xero / other / spreadsheet.
2. Connect (read-only first). Verify with a P&L pull.
3. Mine past categorization into a method note, then propose categorization rules for review.
4. Optional: enable approval-gated writes.

## /crm-setup
1. Which tool? JobTread / Jobber / Buildertrend / HubSpot / spreadsheet / none (use the built-in brain).
2. Connect, map fields to the common model (lead, job, quote, price book).
3. Import into brain. Confirm.

## /inventory-setup
1. Which suppliers? Pool Corp (POOL360), Home Depot, Lowe's, local yards, other.
2. Connect or use a portal CLI via the same playbook.
3. Set job-based shopping lists, stock lookup by location, and order drafts. Orders always need a confirm.
