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

test('inspector comments: read one inspection in Claude and on the dashboard, not in the list', { timeout: 15000 }, async () => {
  const probe = createServer().listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const { port } = probe.address();
  await new Promise((r) => probe.close(r));
  const host = 'http://127.0.0.1:' + port;
  const env = { ...process.env, BCMCP_PUBLIC_URL: host, BCMCP_DATA: mkdtempSync(join(tmpdir(), 'bc-ins-')), BCMCP_MASTER_KEY: Buffer.alloc(32, 7).toString('base64'), PORT: String(port), BCMCP_CLAIM_GRACE_MS: '0' };
  const url = execFileSync(process.execPath, ['src/server.ts', 'tenant', 'A'], { env, encoding: 'utf8' }).trim().split('\n').at(-1);
  const proc = spawn(process.execPath, ['src/server.ts'], { env, stdio: ['ignore', 'pipe', 'inherit'] });
  const stop = once(proc, 'exit');
  await once(proc.stdout, 'data');
  const c = new Client({ name: 'x', version: '1' });
  try {
    await c.connect(new StreamableHTTPClientTransport(new URL(url)));
    const call = async (name, args = {}) => c.callTool({ name, arguments: args });
    const link = (await call('open_dashboard')).content[0].text.match(/https?:\/\/\S+/)[0];
    const ck = (await fetch(link, { redirect: 'manual' })).headers.get('set-cookie').split(';')[0];
    const get = async (p) => { const r = await fetch(host + p, { headers: { cookie: ck } }); return { status: r.status, body: await r.json() }; };
    const conn = await fetch(host + '/api/connect', { method: 'POST', headers: { cookie: ck, 'content-type': 'application/json', 'x-bc': '1' }, body: JSON.stringify({ city: 'demo-city', username: 'demo', password: 'demo' }) });
    assert.equal(conn.status, 200);

    // The list stays fast: no comments there.
    const list = JSON.parse((await call('list_inspections')).content[0].text);
    assert.ok(list.length >= 3);
    assert.ok(list.every((i) => i.comments === undefined));

    // Claude: a failed inspection carries the inspector's comments.
    const failed = JSON.parse((await call('get_inspection', { city: 'demo-city', permitId: 'ELE-2026-0388', inspectionId: 'INS-3' })).content[0].text);
    assert.equal(failed.status, 'failed');
    assert.match(failed.comments, /box fill/i);
    const passed = JSON.parse((await call('get_inspection', { city: 'demo-city', permitId: 'BLD-2026-0142', inspectionId: 'INS-2' })).content[0].text);
    assert.equal(passed.status, 'passed');
    assert.ok(passed.comments.length > 0);
    assert.equal((await call('get_inspection', { city: 'demo-city', permitId: 'BLD-2026-0142', inspectionId: 'INS-3' })).isError, true, 'inspection must belong to the permit');
    assert.equal((await call('get_inspection', { city: 'demo-city', permitId: 'BLD-2026-0142', inspectionId: 'INS-99' })).isError, true);

    // Dashboard: same data through the API.
    const d = await get('/api/inspection?city=demo-city&permit=ELE-2026-0388&id=INS-3');
    assert.equal(d.status, 200);
    assert.equal(d.body.comments, failed.comments);
    assert.equal((await get('/api/inspection?city=demo-city&permit=ELE-2026-0388&id=INS-99')).status, 400);
    assert.equal((await fetch(host + '/api/inspection?city=demo-city&permit=ELE-2026-0388&id=INS-3')).status, 401, 'signed out sees nothing');
  } finally {
    await c.close().catch(() => {});
    proc.kill();
    await stop;
  }
});
