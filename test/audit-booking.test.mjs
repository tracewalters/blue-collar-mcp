import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

// Dates relative to today so the test never goes stale.
const iso = (d) => d.toISOString().slice(0, 10);
const shift = (days, wantWeekend) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + days); while ((d.getUTCDay() % 6 === 0) !== wantWeekend) d.setUTCDate(d.getUTCDate() + 1); return d; };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const portal = (d) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`; // "Oct 26, 2026"

test('booking dry run in the hosted server: fills the form from the Company profile, never saves, refuses obvious mistakes', { timeout: 15000 }, async () => {
  const probe = createServer().listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const { port } = probe.address();
  await new Promise((r) => probe.close(r));
  const host = 'http://127.0.0.1:' + port;
  const env = { ...process.env, BCMCP_PUBLIC_URL: host, BCMCP_DATA: mkdtempSync(join(tmpdir(), 'bc-book-')), BCMCP_MASTER_KEY: Buffer.alloc(32, 7).toString('base64'), PORT: String(port) };
  const url = execFileSync(process.execPath, ['src/server.ts', 'tenant', 'Acme'], { env, encoding: 'utf8' }).trim().split('\n').at(-1);
  const proc = spawn(process.execPath, ['src/server.ts'], { env, stdio: ['ignore', 'pipe', 'inherit'] });
  const stop = once(proc, 'exit');
  await once(proc.stdout, 'data');
  const c = new Client({ name: 'x', version: '1' });
  try {
    await c.connect(new StreamableHTTPClientTransport(new URL(url)));
    const call = (name, args = {}) => c.callTool({ name, arguments: args });
    const tools = (await c.listTools()).tools.map((t) => t.name);
    assert.ok(tools.includes('propose_inspection'));
    assert.ok(!tools.includes('commit_action'), 'booking commit stays off in hosted mode');

    // Company profile holds the site contact; the demo city is connected on the dashboard.
    await call('save_setup', { company: 'Acme Builders', userName: 'Pat Lee', phone: '602-555-0100', email: 'pat@acme.test', cities: [] });
    const link = (await call('open_dashboard')).content[0].text.match(/https?:\/\/\S+/)[0];
    const ck = (await fetch(link, { redirect: 'manual' })).headers.get('set-cookie').split(';')[0];
    const connect = await fetch(host + '/api/connect', { method: 'POST', headers: { cookie: ck, 'content-type': 'application/json', 'x-bc': '1' }, body: JSON.stringify({ city: 'demo-city', username: 'demo', password: 'demo' }) });
    assert.equal(connect.status, 200);
    const inspections = async () => JSON.parse((await call('list_inspections')).content[0].text);
    const before = await inspections();

    const day = shift(3, false);
    const r = await call('propose_inspection', { city: 'demo-city', permitId: 'BLD-2026-0142', type: 'framing', date: iso(day) });
    assert.ok(!r.isError, r.content[0].text);
    const dry = JSON.parse(r.content[0].text);
    assert.deepEqual(dry.preview, {
      Permit: 'BLD-2026-0142', Inspection: 'INS-1 Framing', 'Preferred Date': portal(day),
      'Site Contact Name': 'Pat Lee', 'Site Contact Phone': '602-555-0100', 'Site Contact Email': 'pat@acme.test',
    });
    assert.equal(dry.token, undefined, 'no token: nothing can be committed from hosted yet');
    assert.deepEqual(await inspections(), before, 'dry run never saves');

    const refused = async (args, re) => {
      const x = await call('propose_inspection', { city: 'demo-city', permitId: 'BLD-2026-0142', type: 'Framing', ...args });
      assert.equal(x.isError, true, x.content[0].text);
      assert.match(x.content[0].text, re);
      assert.ok(!x.content[0].text.includes('\n') && x.content[0].text.length < 120, 'one short line');
    };
    const sat = shift(3, true);
    await refused({ date: iso(sat) }, new RegExp(`${portal(sat)} is a (Saturday|Sunday)`));
    await refused({ date: iso(shift(-10, false)) }, /has passed|not after today/);
    await refused({ date: iso(new Date()) }, /not after today/);
    await refused({ permitId: 'ELE-2026-0388', type: 'Rough Electrical', date: iso(day) }, /already scheduled/);
    await refused({ type: 'Roof Nail', date: iso(day) }, /No Roof Nail inspection/);
  } finally {
    await c.close().catch(() => {});
    proc.kill();
    await stop;
  }
});
