# 05: Booking commit

**What to build:** The user picks 'send it' or 'dry run first' with the native choice prompt, confirms twice, and sees the first-booking disclaimer. Portal actions run one at a time per Company (ADR 0001).

**Blocked by:** 04: Booking dry run

**Status:** ready-for-agent

- [ ] Choice prompt via MCP elicitation with text fallback
- [ ] Booking is verified under Scheduled after Save
- [ ] Disclaimer asks for a screenshot if it failed
- [ ] Portal actions are queued per Company
