// Live health check per adapter. Run on a schedule (see .github/workflows/canary.yml).
// For each "ready" adapter, log into a test account and list permits.
// Creds come from env: CANARY_<CITY_ID>_USER / CANARY_<CITY_ID>_PASS (city id upper-cased, - to _).
import { listAdapters } from "./adapter.ts";
import "./adapters/index.ts";
import { listJurisdictions } from "./jurisdictions.ts";

let failed = 0;
for (const j of listJurisdictions()) {
  const a = listAdapters().find((x) => x.platform === j.platform);
  if (a?.maturity !== "ready") continue;
  const k = j.id.toUpperCase().replaceAll("-", "_");
  const username = process.env[`CANARY_${k}_USER`], password = process.env[`CANARY_${k}_PASS`];
  if (!username || !password) { console.log(`skip ${j.id}: no canary creds`); continue; }
  try {
    const r = await a.login(j, { username, password });
    if (!r.ok) throw new Error(r.message);
    const p = await a.listPermits(j, r.session);
    console.log(`ok   ${j.id}: ${p.length} permits`);
  } catch (e) {
    failed++;
    console.error(`FAIL ${j.id} (${j.platform}): ${(e as Error).message}`);
  }
}
process.exit(failed ? 1 : 0);
