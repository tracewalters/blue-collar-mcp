# Roadmap

**Now: permits.** One thing, done well. See `VISION.md`.

## Permits next steps
1. Shape PHX (City of Phoenix) public data adapter: permits by contractor, address or permit number. No login, updated weekly by the City.
2. Shape PHX private account adapter: live status, inspections, corrections, fees.
3. More Phoenix-metro cities using the portal playbook (below).
4. Inspection scheduling (two-phase: propose, then confirm).

## Portal playbook (new city)
1. Identify the portal software (Accela, Tyler EnerGov, OpenGov, Salesforce Experience, custom).
2. Look for an official API or open-data feed first. Browser automation last.
3. Map: search permit, status, inspections, documents, fees. Writes later and gated.
4. Build the adapter to the common schema (`spec/schemas`). Record fixtures from 3 real permits.
5. Review with the user, then publish to all tenants. A nightly canary flags changes (`docs/SELF_IMPROVING.md`).

## Parked (code exists, off by default)
The company brain and ingest (`src/brain/`, enable with `BCMCP_BRAIN=1`): notes, search with stale flags, cheap ingest that keeps receipts, conflict review. Ideas for later: rules packs by trade, QuickBooks and CRM adapters, inventory and ordering (Pool Corp, Home Depot), guided setup flows, usage-based pricing (ingest credits, seats, new portal builds, automations), notetaker integrations.

## Pricing (draft, needs its own session)
Tiers by active permits, inspections booked per month, and seats. Every account starts with about 100 free credits. Read-only is free. Numbers not decided.

## Direction (grill, 2026-11-26)
Stay on permits. Goal: as good as or better than the city portal. Adapters must cover everything the portal shows (inspector comments, fees, corrections, documents, emails). Dashboard adds: recent activity feed, bird's-eye view, per-permit timeline, and job progress (is the permit trail behind the schedule?). Teams: PMs book inspections, the owner watches.
