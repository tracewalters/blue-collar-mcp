# Permit MCP web

Next.js (App Router) + TypeScript + Tailwind v4. Pages: `/`, `/docs`, `/account`, `/billing`.

The site never shows permit data or takes portal actions.

## Run

```bash
cd apps/web
npm install
npm run dev     # http://localhost:3000
```

Production: `npm run build && npm start`.

## Mock data

All account and billing data comes from `lib/mock.ts` (typed async functions).
Replace those functions with real API calls. Page code stays the same.

## Stubs

- Stripe: the "Manage plan" button is disabled. Wire it to a Customer Portal session.
- No auth yet. `/account` and `/billing` are open.
