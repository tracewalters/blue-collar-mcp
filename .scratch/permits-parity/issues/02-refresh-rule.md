# 02: Refresh rule

**What to build:** The dashboard has a refresh button and refreshes on open when data is older than about 15 minutes. Claude uses the same rule. No background polling (ADR 0002).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Stale data triggers a refresh on open
- [ ] Fresh data does not hit the Portal
- [ ] Button forces a refresh
