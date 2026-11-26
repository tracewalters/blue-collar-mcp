# TASTE.md

How Blue Collar MCP looks and sounds. Use this for the website, dashboards, PDFs, reports, and anything Claude or the MCP makes for a user.
This is a living file. Add to it when you learn something. Keep it short.

Starting point: the Higgsfield MCP site (higgsfield.ai/mcp). We borrow its *principles*, not its logo, art, or copy.

## Principles
1. **Show the output, not the pitch.** Every feature gets a real-looking preview of what it makes: a chat answer, a permit table, a P&L. Pictures of results beat sentences about results.
2. **One accent, used sparingly.** Hi-vis lime marks the single most important thing on screen: the main button, the selected item, a "New" tag. If everything is lime, nothing is.
3. **Black canvas, white ink, three tones.** Text is white at 100% (titles), 60% (body), 35% (hints). No grays invented on the fly.
4. **Loud headline, quiet everything else.** One big, bold, uppercase headline per page. Everything under it is calm, small-ish, and regular weight.
5. **Commands are first-class.** Show the exact thing to type (`/brain-setup`) as a chip, everywhere. It's the product.
6. **Catalog, not brochure.** Group features into a sidebar with counts ("Packages 6") and rows on the right. Easy to scan, easy to add to.
7. **Plain words.** Short sentences a busy GC reads on a phone in a truck. No AI hype, no jargon.
8. **Dense but breathable.** Tight inside components, generous space between sections.

## Tokens
| Token | Value | Use |
|---|---|---|
| `bg` | `#000000` | page |
| `panel` | `#0f1012` | cards, menus |
| `panel-2` | `#17191c` | inputs, hovered rows, secondary buttons |
| `line` | `rgba(255,255,255,.08)` | borders, dividers |
| `ink` | `#f7f7f8` | titles |
| `ink-2` | `rgba(255,255,255,.6)` | body text |
| `ink-3` | `rgba(255,255,255,.35)` | hints, counts, inactive tabs |
| `lime` | `#d4ff1f` (hi-vis) | primary action, active state, "New" |
| `lime-ink` | `#141414` | text on lime |
| `ok` / `warn` / `bad` | `#4ade80` / `#fbbf24` / `#f87171` | status dots only, never big fills |

**Type**
- Display: Space Grotesk 700, UPPERCASE, letter-spacing -0.04em, line-height 0.95. Hero 48 to 88px. Accent words in lime.
- Body/UI: Inter. 16px body (never below 15px for our audience), 14px for chips and meta. Titles 600 weight, -0.01em.
- Mono: for commands only, inside chips.

**Shape**
- Radius: 10 to 12px buttons and inputs, 16 to 20px cards and media, pill (9999) for tabs, chips, and tags.
- Borders: 1px `line`. No shadows on dark, except a soft glow behind the hero.
- Spacing: 4px grid. Sections 96 to 128px apart on desktop, 64px on mobile.

## Components
- **Primary button:** lime fill, `lime-ink` text, 600 weight. One per view.
- **White button:** white fill, black text. "Try now" or "Add to Claude". Can sit next to primary.
- **Dark button:** `panel-2` fill, white text. "Learn more" or "How it works".
- **Tag:** tiny lime pill with black text: `New`, `Ready`. Grey pill for `Soon`.
- **Command chip:** pill, 1px `line` border, lime slash then mono text: `/ brain-setup`.
- **Pill tabs:** inactive `ink-3` text, active white text on `rgba(255,255,255,.1)`.
- **Underline tabs:** second nav row, active item white with a 2px white underline.
- **Sidebar:** icon tile (32px, rounded 8px) + label. Active row: `panel-2` background, lime icon tile, lime label. Section headings show a count in `ink-3`.
- **Feature row:** preview (16:10, radius 16) on the left. Title, then a 2-line description in `ink-2`, then chips, then buttons pinned to the bottom.
- **Mega menu:** `panel` sheet, radius 20, grid of icon tiles, bottom upsell bar (`panel-2`, radius 14, text + "→").
- **Background texture:** a faint blueprint grid (lines at 4% white), fading out at the edges. It's our version of their code rain: it reads "plans and drawings".

## Layout
- Max width 1280px. Center hero. Catalog: 300px sticky sidebar plus a flexible column.
- Mobile first: the sidebar becomes a horizontal pill scroller. Feature rows stack (preview on top). Tap targets at least 44px.
- Fixed aspect ratios on previews are desktop only; on mobile let them grow, or content gets clipped.
- Status chips inside a grid stretch to full width on phones. Give them `w-fit`.
- Grid children that hold horizontal scrollers need `min-w-0`, or the page scrolls sideways on phones. Always check `scrollWidth == 390` at mobile width.

## Voice
- Talk like a good foreman: direct, specific, friendly. "Type `/permits-setup`. Pick your city. Done."
- Name the trade and the real task: "Which inspections are this week?", not "unlock insights".
- Never: "revolutionize", "AI-powered", "seamless", "leverage", emoji in UI copy.

## Applying it elsewhere
- **Dashboards:** same dark tokens. Numbers big and white, labels `ink-3` uppercase 12px. Charts: white or lime lines on black, gridlines at `line`. Status as small colored dots plus words. Sort problems first (corrections, failed inspections, expiring soon). Problem counts get a red dot, not lime.
- **PDFs and print:** flip to light. White paper, `#111` ink, grey `#666` body. Lime only as a highlight band behind a word or a thin rule, never as text on white. Display headline stays Space Grotesk uppercase. Put the command or job name in a mono chip in the header.
- **Chat replies (MCP output):** short. Lead with the answer, then a small table if needed. Show the next command to run.

## Don'ts
- No second accent color. No gradients except the soft hero glow.
- No stock photos of hard hats and handshakes. Show the product working.
- No walls of text. If a block passes 3 lines, cut it or make it a list.
- Don't copy Higgsfield's logo, art, or wording.

## Changelog
- 2026-11-22: First version, from the Higgsfield MCP page. Hi-vis lime chosen because it is already safety-vest color.
- 2026-11-22: Website rebuilt on these rules. Added the mobile layout lessons.
- 2026-11-26: Permit dashboard (`/dashboard`) built on these rules. Added status chip and problem-first notes.
- 2026-11-26: Setup checklist (`/dashboard/connect`): one card per city, slow steps (portal login ~30 s) show a named progress state in place, success flips the card without a reload.
- 2026-11-26: Jobs section on `/dashboard`: one row per site, worst problem as a dot note, permits as small status-dot pills, one dark Edit button that opens rename and "Same site as" merge in place. Rows with no address say "No site address" instead of a blank title.
