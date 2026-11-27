# AGENTS.md

Keep all answers very concise, and always answer in short, plain English.

## Project rules
- Read `VISION.md` first. Keep the repo clean and small. Few files, few dependencies.
- Anything visual (site, dashboard, PDF, report) follows `TASTE.md`. Add what you learn to it.
- Before touching an adapter, read `docs/PORTAL_NOTES.md` and `docs/SELF_IMPROVING.md`. After a fix, add a note.
- Writes stay two-phase (propose, then user-approved commit). Never log or commit credentials.
- Run `npm run typecheck && npm test` before committing.

## Blocked on an outside login or keys
When the only blocker is something Trace must do on an outside site (sign in, create an API key, copy a secret, set up an OAuth client), do not explain it in the main chat. Spawn a child right away: `room-cli thread spawn --parent-self --shared-sandbox --provider claude-code --model claude-opus-5-5 --title "<Service> setup guide" --prompt ...`.
- The child is very concise: numbered steps, direct links, exact values to type. It checks current menu names with a quick search first. It never touches code or servers and never asks for secrets in chat.
- It ends by telling Trace to say "ready" in the parent thread. Secrets go in only through `room-cli secret request`, one per form, after he says ready.
- Once Trace confirms he is done, the child pings the parent (`room-cli thread tell --parent "done: <what>"`) and archives itself (`room-cli thread archive --self`).
- In the main chat, say one line: what the child is for and what to say when done.
