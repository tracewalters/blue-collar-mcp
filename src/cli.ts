#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { listAdapters } from "./adapter.ts";
import "./adapters/index.ts";
import { listJurisdictions } from "./jurisdictions.ts";
import * as svc from "./service.ts";

const args = process.argv.slice(2);
const json = args.includes("--json");
const pos = args.filter((a) => !a.startsWith("--"));
const flag = (n: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const out = (data: unknown, human: string) => console.log(json ? JSON.stringify(data, null, 2) : human);

// One shared line queue, so piped input and typed input behave the same.
const mute = { on: false };
const lines: string[] = [];
const waiting: ((l: string) => void)[] = [];
let rl: ReturnType<typeof createInterface> | undefined;
const ask = (q: string, hidden = false) => {
  if (!rl) {
    rl = createInterface({
      input: process.stdin,
      output: new Writable({ write(c, e, cb) { if (!mute.on) process.stdout.write(c, e); cb(); } }),
      terminal: Boolean(process.stdin.isTTY),
    });
    rl.on("line", (l) => (waiting.shift() ?? ((x: string) => lines.push(x)))(l));
  }
  process.stdout.write(q);
  mute.on = hidden;
  return new Promise<string>((res) => {
    const done = (l: string) => { mute.on = false; if (hidden) process.stdout.write("\n"); res(l.trim()); };
    const l = lines.shift();
    l !== undefined ? done(l) : waiting.push(done);
  });
};

const table = (rows: Record<string, unknown>[]) =>
  rows.length ? rows.map((r) => Object.values(r).join("  |  ")).join("\n") : "(none)";

/** The guided login: pick cities, log into each one, once. */
async function loginFlow() {
  const maturity = new Map(listAdapters().map((a) => [a.platform, a.maturity]));
  const cities = listJurisdictions();
  console.log("Cities:\n");
  cities.forEach((c, i) => console.log(`  ${i + 1}. ${c.name}, ${c.state}  [${c.platform}${maturity.get(c.platform) === "planned" ? ", not built yet" : ""}]`));
  const picks = (await ask("\nWhich cities have your active permits? (numbers, comma separated): "))
    .split(",").map((s) => cities[Number(s.trim()) - 1]).filter(Boolean);
  for (const c of picks) {
    console.log(`\n== ${c.name}, ${c.state} ==`);
    for (let tries = 0; tries < 3; tries++) {
      const username = await ask("Username: ");
      const password = await ask("Password: ", true);
      const r = await svc.login(c.id, { username, password });
      if (r.ok) { console.log("Connected. You won't need to log in here again."); break; }
      console.log(r.message);
      if (r.reason === "unsupported") break;
    }
  }
  console.log("\nDone. Add the MCP to Claude Code: claude mcp add permit -- npx permit-mcp");
}

const help = `permit <command>

  login                         Guided login: pick cities, log in once each
  logout <city>                 Remove a saved login
  cities                        List supported cities
  connections                   List cities you are logged into
  permits [--city ID]           List permits (all connected cities by default)
  permit <city> <permitId>      Permit detail and inspections
  inspections [--city ID]       List inspections
  inspection <city> <permitId> <inspectionId>   One inspection with the inspector's comments
  schedule <city> <permitId> --type TYPE --date YYYY-MM-DD
                                Propose an inspection (prints a token)
  commit <token>                Execute a proposed action
Add --json for machine-readable output.`;

async function main() {
  const [cmd, a, b, c] = pos;
  switch (cmd) {
    case "login": return loginFlow();
    case "logout": svc.logout(a); return console.log("Removed.");
    case "cities": { const c = listJurisdictions(); return out(c, table(c.map((x) => ({ id: x.id, name: `${x.name}, ${x.state}`, platform: x.platform })))); }
    case "connections": { const c = svc.listConnections(); return out(c, table(c)); }
    case "permits": { const p = await svc.listPermits(flag("city")); return out(p, table(p.map((x) => ({ id: x.id, type: x.type, address: x.address, status: x.status })))); }
    case "permit": { const r = await svc.getPermit(a, b); return out(r, JSON.stringify(r, null, 2)); }
    case "inspections": { const i = await svc.listInspections(flag("city")); return out(i, table(i.map((x) => ({ id: x.id, permit: x.permitId, type: x.type, status: x.status })))); }
    case "inspection": { const i = await svc.getInspection(a, b, c); return out(i, `${i.id} ${i.type}: ${i.status}${i.scheduledFor ? ` (${i.scheduledFor})` : ""}\nInspector: ${i.comments ?? "no comments"}`); }
    case "schedule": {
      const type = flag("type"), date = flag("date");
      if (!type || !date) throw new Error("--type and --date are required");
      const r = await svc.proposeInspection(a, { permitId: b, type, date });
      return out(r, `${r.summary}\nTo execute: permit commit ${r.token}   (expires in ${r.expiresInMinutes} min)`);
    }
    case "commit": { const r = await svc.commit(a); return out(r, r.message); }
    default: console.log(help);
  }
}
main().then(() => rl?.close()).catch((e) => { console.error(`Error: ${e.message}`); process.exit(1); });
