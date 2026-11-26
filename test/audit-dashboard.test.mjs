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

test('dashboard: Claude hands out a one-time link, session reads and connects, tenants are isolated', { timeout: 15000 }, async () => {
  const probe = createServer().listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const { port } = probe.address();
  await new Promise((r) => probe.close(r));
  const host = 'http://127.0.0.1:' + port;
  const env = { ...process.env, BCMCP_PUBLIC_URL: host, BCMCP_DATA: mkdtempSync(join(tmpdir(), 'bc-dash-')), BCMCP_MASTER_KEY: Buffer.alloc(32, 7).toString('base64'), PORT: String(port), BCMCP_CLAIM_GRACE_MS: '0' };
  const mk = (n) => execFileSync(process.execPath, ['src/server.ts', 'tenant', n], { env, encoding: 'utf8' }).trim().split('\n').at(-1);
  const [a, b] = [mk('A'), mk('B')];
  const proc = spawn(process.execPath, ['src/server.ts'], { env, stdio: ['ignore', 'pipe', 'inherit'] });
  const stop = once(proc, 'exit');
  await once(proc.stdout, 'data');
  try {
    const link = async (endpoint) => {
      const c = new Client({ name: 'x', version: '1' });
      await c.connect(new StreamableHTTPClientTransport(new URL(endpoint)));
      const text = (await c.callTool({ name: 'open_dashboard', arguments: {} })).content[0].text;
      await c.close();
      return text.match(/https?:\/\/\S+/)[0];
    };
    let lastNext = '';
    const session = async (l) => {
      const r = await fetch(l, { redirect: 'manual' });
      assert.equal(r.status, 302);
      assert.match(r.headers.get('location'), /^\/dashboard/);
      lastNext = r.headers.get('location');
      const set = r.headers.get('set-cookie');
      assert.match(set, /HttpOnly/);
      return set.split(';')[0];
    };
    const get = (ck, p) => fetch(host + p, { headers: { cookie: ck } });
    const post = (ck, p, body, h = { 'x-bc': '1' }) => fetch(host + p, { method: 'POST', headers: { cookie: ck, 'content-type': 'application/json', ...h }, body: JSON.stringify(body) });

    assert.equal((await fetch(host + '/api/me')).status, 401, 'no cookie, no data');
    const linkA = await link(a);
    const ckA = await session(linkA);
    assert.equal(lastNext, '/dashboard/connect?city=phoenix-az', 'nothing connected: link opens the connect form');
    assert.equal((await fetch(linkA, { redirect: 'manual' })).status, 401, 'link is single use');
    assert.equal((await fetch(host + '/auth/claim?t=junk')).status, 401);

    let me = await (await get(ckA, '/api/me')).json();
    assert.equal(me.company, 'A');
    assert.equal(me.connections.length, 0);
    assert.equal((await post(ckA, '/api/connect', { city: 'demo-city', username: 'demo', password: 'bad' })).status, 400);
    assert.equal((await post(ckA, '/api/connect', { city: 'demo-city', username: 'demo', password: 'demo' }, {})).status, 403, 'needs x-bc header');
    assert.equal((await post(ckA, '/api/connect', { city: 'demo-city', username: 'demo', password: 'demo' })).status, 200);

    const { permits } = await (await get(ckA, '/api/permits')).json();
    assert.ok(permits.length >= 3);
    assert.ok((await (await get(ckA, '/api/inspections')).json()).inspections.length >= 2);
    assert.equal((await (await get(ckA, '/api/permit?city=demo-city&id=BLD-2026-0142')).json()).permit.id, 'BLD-2026-0142');

    // Claude sees the same connection through the MCP.
    const c = new Client({ name: 'x', version: '1' });
    await c.connect(new StreamableHTTPClientTransport(new URL(a)));
    assert.ok(JSON.parse((await c.callTool({ name: 'list_permits', arguments: {} })).content[0].text).permits.length >= 3);
    await c.close();

    // Onboarding through Claude: questions answered, cities chosen, link opens at the first city to connect.
    const c2 = new Client({ name: 'x', version: '1' });
    await c2.connect(new StreamableHTTPClientTransport(new URL(b)));
    const call = async (name, args = {}) => c2.callTool({ name, arguments: args });
    assert.equal(JSON.parse((await call('get_setup')).content[0].text).needsSetup, true);
    assert.equal((await call('save_setup', { company: 'Acme', userName: 'Pat', cities: ['nowhere-az'] })).isError, true, 'unknown city rejected');
    const saved = JSON.parse((await call('save_setup', { company: 'Acme Builders', userName: 'Pat', role: 'GC', phone: '555-0100', cities: ['phoenix-az', 'scottsdale-az'] })).content[0].text);
    assert.deepEqual(saved.cities, ['phoenix-az', 'scottsdale-az']);
    const setup = JSON.parse((await call('get_setup')).content[0].text);
    assert.equal(setup.needsSetup, false);
    assert.deepEqual(setup.stillToConnect, ['phoenix-az', 'scottsdale-az']);
    const ckB0 = await session(JSON.parse(JSON.stringify({})) && (await call('open_dashboard')).content[0].text.match(/https?:\/\/\S+/)[0]);
    assert.equal(lastNext, '/dashboard/connect?city=phoenix-az');
    await c2.close();
    const meB = await (await get(ckB0, '/api/me')).json();
    assert.equal(meB.company, 'Acme Builders');
    assert.deepEqual(meB.profile.cities, ['phoenix-az', 'scottsdale-az']);
    assert.ok(meB.cities.find((c) => c.id === 'phoenix-az').maturity === 'ready');
    assert.equal((await post(ckB0, '/api/profile', { addCity: 'mesa-az' })).status, 200);
    assert.deepEqual((await (await get(ckB0, '/api/me')).json()).profile.cities.at(-1), 'mesa-az');
    assert.equal((await post(ckB0, '/api/profile', { removeCity: 'mesa-az' })).status, 200);

    // Company B sees nothing of A.
    const ckB = await session(await link(b));
    me = await (await get(ckB, '/api/me')).json();
    assert.equal(me.company, 'Acme Builders');
    assert.equal(me.connections.length, 0);
    assert.deepEqual((await (await get(ckB, '/api/permits')).json()).permits, []);

    await post(ckA, '/api/signout', {});
  } finally {
    proc.kill();
    await stop;
  }
});
