# Project Vision

## One line
A guided AI crew for residential trades, inside Claude chat. One shared brain, one set of rules, every tool connected.

## Who it's for
Architects, drafters, interior designers, landscape and pool designers, GCs, home builders, and subs like electricians and plumbers. Mostly owner-run shops and small teams, many new to AI.

## The problem
Business info is scattered across Gmail, Drive, Finder, texts, a CRM, QuickBooks, and city portals. The owner and team get different answers from outdated sources, and nobody has time to learn a new tool.

## The experience
1. Add the Blue Collar MCP to Claude (the owner does it once; each person signs in).
2. Run a setup command, for example `/brain-setup`.
3. Claude asks multiple-choice questions, gives exact links and steps, connects your sources, and ingests what you already have.
4. Pick a rule pack, or let Claude propose rules mined from your own history.
5. Ask in plain English. Everyone on the team gets the same, short, correct answer.

## Packages
brain, rules, permits, books, crm, inventory, then subs, field, docs, comms. Each ships with its own guided setup (see `docs/ONBOARDING.md`).

## Permits (first package, already built)
- A CLI per portal platform; the MCP is a thin layer over the same code.
- Any Phoenix-metro city. When a portal has no adapter yet, an agent builds one from a playbook, the user reviews it, and it is shared with everyone.
- Common data model, encrypted vault, two-phase writes (propose, then confirm), and credentials never go through the model.
- Self-improving: fixtures plus canaries tell an agent when a portal changed (`docs/SELF_IMPROVING.md`).

## Principles
- Beginner-friendly first. Plain English, one question at a time.
- One source of truth, with `updated` dates so stale data is visible.
- Writes always need a confirm. Secrets never go in chat.
- Never touch a portal or account that isn't the user's own.
- Few dependencies, few files, plain code.

## Business model
Free to start (brain, rules, permits). Paid on usage: ingest credits, seats, new portal builds, automations (`docs/MONETIZATION.md`). Hosted on our own VPS; open source and self-hostable.

## Not this
RIG / Stanley 2.0 is the private power system for one company. This is the simple public product.

## Roadmap
1. Brain and rules: guided setup, ingest, rule packs.
2. Permits on the hosted multi-tenant server (Phoenix metro first).
3. Books (read-only), then CRM adapters.
4. Inventory and ordering.
5. Subs, field, docs, comms.
