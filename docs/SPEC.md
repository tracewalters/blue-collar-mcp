# Spec: Blue Collar MCP, permits parity and growth

Vocabulary follows `GLOSSARY.md`. Decisions follow `docs/adr/0001` to `0003`. Pricing is out of scope (own session).

## Problem Statement
A small residential **Contractor** juggles **Permits** and **Inspections** across many city **Portals**, each with its own login, layout and quirks. Booking an inspection, finding out why one failed, and knowing where a **Job** stands all mean logging in city by city. A GC with several project managers has no single view of what happened.

## Solution
One place for all of a **Company**'s permits and inspections, in Claude and on a dashboard. It shows everything the city portal shows, in one consistent UI. Inspections can be booked from Claude or the dashboard. Adding a new city is self-serve: the user's agent builds an **Adapter**, and we review it before listing it in the **Marketplace**.

## User Stories
1. As a Contractor, I want to add the connector in Claude and say "open my permit dashboard", so that setup takes a minute.
2. As a Contractor, I want to add a city by signing in on a secure page, so that my password never enters chat.
3. As a Contractor, I want my agent to notice when the connection is ready without me pasting anything, so that there are fewer steps.
4. As a Contractor, I want a paste-back key as a fallback when my agent can't check status, so that setup still works.
5. As a Contractor, I want to see all my permits across cities in one list, so that I stop logging into each portal.
6. As a Contractor, I want to open an inspection and read the inspector's comments, so that I know what to fix after a failure.
7. As a Contractor, I want to see permit corrections and review comments, so that I can respond quickly.
8. As a Contractor, I want to see fees and payment status, so that nothing blocks my permit.
9. As a Contractor, I want to see permit documents and plans, so that I don't need the portal for them.
10. As a Contractor, I want to book an inspection by asking Claude, so that I save time.
11. As a Contractor, I want to book from the dashboard too, so that I can use whichever is handy.
12. As a Contractor, I want to choose "send it" or "dry run first" with a simple multiple-choice prompt, so that I control the risk.
13. As a Contractor, I want weekends, past dates and already-scheduled inspections refused automatically, so that I don't make obvious mistakes.
14. As a Contractor, I want a clear disclaimer on a city's first booking and a way to send a screenshot if it failed, so that problems get fixed fast.
15. As a Contractor, I want to confirm twice before a booking is sent, so that nothing is booked by accident.
16. As a GC, I want to give each project manager a **Seat**, so that they can book inspections without my login.
17. As a GC, I want every booking tagged with who made it, so that I can see who did what.
18. As a GC, I want a recent **Activity feed**, so that I can see what happened without asking anyone.
19. As a GC, I want a bird's-eye view of all permits and inspections, so that I can see the state of the business.
20. As a GC, I want permits grouped into **Jobs** by site address, so that I can think per job.
21. As a GC, I want to rename and merge Jobs, so that the grouping matches how I work.
22. As a GC, I want a timeline of each permit and inspection, so that I can see how a job is progressing.
23. As a GC, I want a Job flagged as behind when its inspections lag the expected order (rough electrical before drywall), so that I can spot trouble early.
24. As a Contractor, I want a refresh button on the dashboard, so that I can pull the latest on demand.
25. As a Contractor, I want data to refresh on open when older than about 15 minutes, so that I rarely need the button.
26. As a Contractor, I want Claude to use the same refresh rule, so that answers match the dashboard.
27. As a Contractor, I want read-only use to be free and new accounts to start with credits, so that I can try it first.
28. As a Contractor, I want to add a city nobody has built, so that I'm not stuck waiting.
29. As a Contractor, I want a privately learned city to work for my Company right away, so that I get value before review.
30. As a Contractor, I want to browse the Marketplace and add a listed city in a click, so that setup is easy.
31. As the owner, I want a skill that builds every Adapter the same way, so that quality is consistent.
32. As the owner, I want each Adapter to pass the test loop before it can be listed, so that bad adapters don't ship.
33. As the owner, I want to review and publish adapters myself, so that other Companies' logins are protected.
34. As the owner, I want a checklist of every page and feature per portal, so that I know how close we are to parity.
35. As the owner, I want portal logins kept in a per-Company vault, so that a leak in one doesn't expose all.
36. As the owner, I want portal actions for one Company queued one at a time, so that two project managers don't kick each other out of the portal.

## Implementation Decisions
- **Connection flow:** the agent returns a secure link. The user signs in on our page and the login goes to the vault. The agent then checks status. A paste-back key is a fallback only. The agent never sees a password.
- **Adapter:** one per portal platform, built as a CLI, run only by the server-side runner. Learned adapters are private to a **Company**. Only the owner can publish to the **Marketplace**.
- **Test loop:** build, then test every function repeatedly in a sandbox until it passes N out of N (N to be decided, start with 10). Reads and booking dry runs only. See ADR 0001.
- **Booking:** two-phase (propose, then approved commit). The user picks "send it" or "dry run first" via the client's native choice prompt (MCP elicitation, text fallback). Booking commit turns on per city once an Adapter has passed the test loop. First real booking in a city shows a disclaimer.
- **Data model additions:** inspector comments on **Inspections**; permit corrections and review comments; fees; documents; **Job** (grouped by site address, renameable, mergeable); **Seat** and actor on every write; **Activity feed** event.
- **Freshness:** refresh on demand and on open when stale (about 15 minutes). The feed comes from diffs between refreshes. No background polling. See ADR 0002.
- **Teams:** one **Connection** per **Company** per **Portal**; portal actions serialised per Company; each **Seat** has its own connector link and dashboard login.
- **Dashboard:** list, per-permit timeline, activity feed, bird's-eye view, refresh button, Marketplace tab. Follows `TASTE.md`.
- **Build order:** inspector comments, then corrections, then fees, then documents, then the timeline and Job view.
- **Hand-built cities:** Phoenix (Shape PHX) and Scottsdale (Tyler EnerGov).

## Testing Decisions
- A good test checks behaviour from outside: MCP tool results and `/api/*` responses, not internals.
- One seam: the running server, like the existing `test/audit-*.test.mjs` files that spawn a real server on a free port. The demo city is the fake portal.
- Booking is tested through the dry-run path only. No live city is touched in any automated test.
- Adapter fixture checks run in the same suite. A daily read-only canary against live portals (see `docs/SELF_IMPROVING.md`) catches portal changes.
- Prior art: the existing `audit-*.test.mjs` tests and schema-match test.

## Out of Scope
- Pricing and billing (own session).
- Company brain, rules packs, books, CRM, inventory.
- Background polling and city email ingestion (revisit if refresh feels slow).
- Notifications from us.
- Large builders and architect-specific workflows beyond reading and tracking.

## Further Notes
- Shape PHX allows effectively one live session per account, hence the queue.
- Phoenix needs 24 hours' notice to cancel an inspection.
- Open: the right N for the test loop; Scottsdale research; how to detect a stale or expired portal login for the user.
- Not published as an issue: no tracker or labels are configured. Move it to GitHub when ready.
