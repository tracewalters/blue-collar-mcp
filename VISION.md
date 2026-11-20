# Project Vision

## One line
One MCP for every permit portal. Log in once. Then Claude can read and act on all your permits.

## Who it's for
General contractors, subcontractors, and anyone in residential building who juggles permits and inspections across many city portals (Tyler Portico/EnerGov, Accela, OpenGov, Salesforce-based portals like Shape/Phoenix, and more).

## The problem
Every city has its own portal, logins, forms, statuses, and fees. Contractors track it all by hand across tabs, emails, and spreadsheets.

## The experience
1. Install the MCP into Claude Code.
2. Run the guided login. Pick the cities where you have active permits.
3. Log into each city portal one by one. Only once.
4. From then on, ask Claude. It reads and writes to those portals through the MCP.

Example asks: "What's the status of every open permit?", "Which inspections failed this week?", "Schedule the framing inspection at 12 Oak St."

## How it's built
- **A CLI per portal platform.** Each platform adapter is a CLI first (`permit <platform> <command>`). The MCP is a thin layer over the same code. One implementation, two front doors.
- **One login protocol.** City picker, then per-city login, then sessions stored in an encrypted vault. Re-login only when a session expires or asks for 2FA.
- **Common data model.** Permit, Project, Inspection, Jurisdiction, Document, Fee, Status. Same shapes no matter the city.
- **Safe writes.** Anything that submits, schedules, or pays is two-phase: propose, then confirm. Always user-approved.
- **Credentials never go through the model.** Logins are entered in the terminal or a secure link, not chat.

See `docs/ARCHITECTURE.md` for the technical design.

## Open source and hosting
- MIT licensed. Anyone can self-host or run it locally.
- We also run a hosted instance on our own VPS.
- Local mode and hosted mode share one codebase.

## Website
Marketing and docs, plus account, billing, and usage for the hosted MCP. The site never reads permit data or takes portal actions.

## Principles
- Speed over polish. Ship small, ship often.
- API first, browser only when needed.
- Few dependencies, few files, plain code.
- Never touch a portal with anyone's account but their own.
- Keep the repo clean.

## Self-improving
Every adapter has recorded fixtures and a scheduled canary. When a portal changes and a canary fails, an agent is told which adapter broke, reproduces it from fixtures, and proposes the fix as a PR. See `docs/SELF_IMPROVING.md`.

## Roadmap
1. Core schemas, adapter SDK, CLI, stdio MCP with fixture-backed reads.
2. Guided login + vault.
3. First real adapter (Salesforce Experience / Shape-Phoenix), then Tyler.
4. Safe writes (inspection scheduling first).
5. Website, billing, hosted deploy.
