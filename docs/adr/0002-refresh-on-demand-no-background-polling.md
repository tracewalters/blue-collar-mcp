# Data refreshes when someone looks, not on a schedule

We considered scheduled portal checks and reading city result emails. We chose neither for now: the dashboard and Claude refresh a **Company**'s data on demand, with a refresh button and an automatic refresh on open when data is older than about 15 minutes. This avoids paying for portal reads nobody uses and avoids asking for email access. The **Activity feed** is built from changes found at each refresh, so event times come from the portal when shown, otherwise the time we noticed. Email-triggered refresh stays possible later.
