# New booking adapters are proven live by the first user, not on a fake portal

We considered a record-and-replay fake portal for testing inspection booking, but it needs someone to record a real booking and can't prove the city accepts it. Instead, each **Adapter** is built as a CLI and its reads and dry runs are tested repeatedly in a sandbox. The first real booking is done by a real **Contractor**, who confirms twice, gets a "you are the first to test this" disclaimer, then checks the city **Portal** themselves. If it failed, they send a screenshot in chat and the agent debugs it.

Consequence: a failed first booking can touch a real city account, so the double confirm, the disclaimer and the screenshot loop are required parts of the booking flow, not extras.

The user picks "send it" or "dry run first" with the client's native multiple-choice prompt (MCP elicitation in Claude, text fallback elsewhere). Obvious mistakes (weekend, past date, already scheduled) are refused without asking. A wrong booking can be cancelled by hand in the portal, though some cities need notice (Phoenix: 24 h).
