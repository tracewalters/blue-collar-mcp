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

test('jobs: permits group by site address, rename and merge persist per company, Claude and dashboard agree', { timeout: 60000 }, async () => {
  const probe = createServer().listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const { port } = probe.address();
  await new Promise((r) => probe.close(r));
  const host = 'http://127.0.0.1:' + port;
  const env = { ...process.env, BCMCP_PUBLIC_URL: host, BCMCP_DATA: mkdtempSync(join(tmpdir(), 'bc-jobs-')), BCMCP_MASTER_KEY: Buffer.alloc(32, 7).toString('base64'), PORT: String(port), BCMCP_CLAIM_GRACE_MS: '0' };
  const mk = (n) => execFileSync(process.execPath, ['src/server.ts', 'tenant', n], { env, encoding: 'utf8' }).trim().split('\n').at(-1);
  const [a, b] = [mk('A'), mk('B')];
  let proc = spawn(process.execPath, ['src/server.ts'], { env, stdio: ['ignore', 'pipe', 'inherit'] });
  await once(proc.stdout, 'data');

  const mcp = async (endpoint, name, args = {}) => {
    const c = new Client({ name: 'x', version: '1' });
    await c.connect(new StreamableHTTPClientTransport(new URL(endpoint)));
    try { return (await c.callTool({ name, arguments: args })); } finally { await c.close(); }
  };
  const session = async (endpoint) => {
    const link = (await mcp(endpoint, 'open_dashboard')).content[0].text.match(/https?:\/\/\S+/)[0];
    return (await fetch(link, { redirect: 'manual' })).headers.get('set-cookie').split(';')[0];
  };
  const get = async (ck, p) => (await fetch(host + p, { headers: { cookie: ck } })).json();
  const post = (ck, p, body) => fetch(host + p, { method: 'POST', headers: { cookie: ck, 'content-type': 'application/json', 'x-bc': '1' }, body: JSON.stringify(body) });
  const jobsOf = async (endpoint) => JSON.parse((await mcp(endpoint, 'list_jobs')).content[0].text);
  const permitIds = (job) => job.permits.map((p) => p.id).sort();

  try {
    const ckA = await session(a);
    assert.equal((await post(ckA, '/api/connect', { city: 'demo-city', username: 'demo', password: 'demo' })).status, 200);

    // Auto-grouping: "12 Oak St" and "12 OAK STREET." are one site; East/E, Road/Rd, Unit/#/Suite match; unit numbers keep sites apart.
    let r = await jobsOf(a);
    const oak = r.jobs.find((j) => j.permits.some((p) => p.id === 'BLD-2026-0142'));
    assert.deepEqual(permitIds(oak), ['BLD-2026-0142', 'ELE-2026-0388']);
    assert.equal(oak.name, '12 Oak St');
    const unit4 = r.jobs.find((j) => j.permits.some((p) => p.id === 'PLM-2026-0077'));
    assert.deepEqual(permitIds(unit4), ['MEC-2026-0090', 'PLM-2026-0077']);
    const unit5 = r.jobs.find((j) => j.permits.some((p) => p.id === 'SLR-2026-0012'));
    assert.notEqual(unit5.id, unit4.id, 'a different unit is a different site');
    assert.deepEqual(r.ungrouped.map((p) => p.id), ['SHR-2026-0005'], 'permits with no address stay ungrouped');
    assert.equal(r.jobs.length, 4);

    // Dashboard reads the same jobs.
    assert.deepEqual(await get(ckA, '/api/jobs'), r);

    // Rename and merge from the dashboard.
    assert.equal((await post(ckA, '/api/jobs/rename', { job: oak.id, name: 'Miller kitchen remodel' })).status, 200);
    const pine = r.jobs.find((j) => j.permits.some((p) => p.id === 'BLD-2026-0201'));
    assert.equal((await post(ckA, '/api/jobs/merge', { from: pine.id, into: oak.id })).status, 200);
    assert.equal((await post(ckA, '/api/jobs/merge', { from: oak.id, into: oak.id })).status, 400, 'cannot merge a job into itself');
    assert.equal((await post(ckA, '/api/jobs/rename', { job: 'nope', name: 'x' })).status, 400, 'unknown job');

    // Restart: rename and merge survive, and Claude sees them.
    proc.kill(); await once(proc, 'exit');
    proc = spawn(process.execPath, ['src/server.ts'], { env, stdio: ['ignore', 'pipe', 'inherit'] });
    await once(proc.stdout, 'data');
    r = await jobsOf(a);
    const merged = r.jobs.find((j) => j.id === oak.id);
    assert.equal(merged.name, 'Miller kitchen remodel');
    assert.deepEqual(permitIds(merged), ['BLD-2026-0142', 'BLD-2026-0201', 'ELE-2026-0388']);
    assert.ok(merged.addresses.includes('48 Pine Ave'));
    assert.equal(r.jobs.length, 3);

    // Company B sees none of A's jobs or names.
    const ckB = await session(b);
    assert.equal((await post(ckB, '/api/connect', { city: 'demo-city', username: 'demo', password: 'demo' })).status, 200);
    const rb = await get(ckB, '/api/jobs');
    assert.equal(rb.jobs.length, 4);
    assert.ok(!rb.jobs.some((j) => j.name === 'Miller kitchen remodel'));
  } finally {
    proc.kill();
    await once(proc, 'exit');
  }
});
