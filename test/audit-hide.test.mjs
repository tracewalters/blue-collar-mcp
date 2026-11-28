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

test('hide: a hidden permit leaves the lists, jobs and Claude; it can come back; companies are separate', { timeout: 60000 }, async () => {
  const probe = createServer().listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const { port } = probe.address();
  await new Promise((r) => probe.close(r));
  const host = 'http://127.0.0.1:' + port;
  const env = { ...process.env, BCMCP_PUBLIC_URL: host, BCMCP_DATA: mkdtempSync(join(tmpdir(), 'bc-hide-')), BCMCP_MASTER_KEY: Buffer.alloc(32, 7).toString('base64'), PORT: String(port), BCMCP_CLAIM_GRACE_MS: '0' };
  const mk = (n) => execFileSync(process.execPath, ['src/server.ts', 'tenant', n], { env, encoding: 'utf8' }).trim().split('\n').at(-1);
  const [a, b] = [mk('A'), mk('B')];
  const proc = spawn(process.execPath, ['src/server.ts'], { env, stdio: ['ignore', 'pipe', 'inherit'] });
  const stop = once(proc, 'exit');
  await once(proc.stdout, 'data');
  const mcp = async (endpoint, name, args = {}) => {
    const c = new Client({ name: 'x', version: '1' });
    await c.connect(new StreamableHTTPClientTransport(new URL(endpoint)));
    try { return await c.callTool({ name, arguments: args }); } finally { await c.close(); }
  };
  const session = async (endpoint) => (await fetch((await mcp(endpoint, 'open_dashboard')).content[0].text.match(/https?:\/\/\S+/)[0], { redirect: 'manual' })).headers.get('set-cookie').split(';')[0];
  const get = async (ck, p) => (await fetch(host + p, { headers: { cookie: ck } })).json();
  const post = (ck, p, body) => fetch(host + p, { method: 'POST', headers: { cookie: ck, 'content-type': 'application/json', 'x-bc': '1' }, body: JSON.stringify(body) });
  const ids = (r) => r.permits.map((p) => p.id);
  try {
    const [ckA, ckB] = [await session(a), await session(b)];
    for (const ck of [ckA, ckB]) assert.equal((await post(ck, '/api/connect', { city: 'demo-city', username: 'demo', password: 'demo' })).status, 200);
    const all = ids(await get(ckA, '/api/permits'));
    const target = all[0];

    assert.equal((await post(ckA, '/api/hide', { city: 'demo-city', id: target, hidden: true })).status, 200);
    assert.ok(!ids(await get(ckA, '/api/permits')).includes(target), 'gone from the default list');
    const full = await get(ckA, '/api/permits?includeHidden=1');
    assert.ok(ids(full).includes(target) && full.hidden.includes(`demo-city|${target}`), 'dashboard can still see it, marked hidden');
    assert.ok(!ids(JSON.parse((await mcp(a, 'list_permits')).content[0].text)).includes(target), 'Claude does not see it');
    assert.ok(ids(JSON.parse((await mcp(a, 'list_permits', { includeHidden: true })).content[0].text)).includes(target), 'unless asked');
    const jobs = await get(ckA, '/api/jobs');
    assert.ok(![...jobs.jobs.flatMap((j) => j.permits), ...jobs.ungrouped].some((p) => p.id === target), 'not in jobs');
    assert.ok(ids(await get(ckB, '/api/permits')).includes(target), 'another company is unaffected');
    assert.equal((await post(ckA, '/api/hide', { city: 'demo-city', id: 'NOPE-1', hidden: true })).status, 400);
    assert.equal((await post(ckA, '/api/hide', { city: 'demo-city', id: target, hidden: true })).status, 200, 'hiding twice is fine');

    assert.equal((await post(ckA, '/api/hide', { city: 'demo-city', id: target, hidden: false })).status, 200);
    assert.ok(ids(await get(ckA, '/api/permits')).includes(target), 'unhide brings it back');
  } finally { proc.kill(); await stop; }
});
