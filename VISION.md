# Vision

## One line
One MCP for every permit portal. Ask Claude, or open your dashboard.

## Who it's for
General contractors, subs and builders in residential work who juggle permits and inspections across many city portals (Shape PHX, Tyler EnerGov, Accela, OpenGov and more). Starting with Phoenix metro.

## The experience
1. Add the connector in Claude and say "open my permit dashboard".
2. Connect your city portals once on the website. Credentials never go through chat.
3. Ask Claude anything about your permits. The dashboard shows the same data.

## How it's built
- One adapter per portal platform. Each is a CLI first; the MCP and site sit on the same code.
- API first, browser only when needed. Public data where it exists (Shape PHX), your own login for live detail.
- Common data model. Writes are two-phase (propose, then confirm). Each company has its own vault.
- Self-improving: fixtures plus a daily canary tell an agent when a portal changed (`docs/SELF_IMPROVING.md`).

## Principles
- One feature at a time. Permits first.
- Plain English for tradespeople. Speed over polish.
- Never touch a portal with anyone's account but their own.
- Few files, few dependencies.

## Later
Company brain, trade rule packs, books, CRM and inventory. See `docs/ROADMAP.md`.
