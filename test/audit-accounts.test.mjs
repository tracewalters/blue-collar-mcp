import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

test('accounts: sign up on the website, get the connector link, sign in again, reset the link', { timeout: 20000 }, async () => {
  const probe = createServer().listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const { port } = probe.address();
  await new Promise((r) => probe.close(r));
  const host = 'http://127.0.0.1:' + port;
  const env = { ...process.env, BCMCP_PUBLIC_URL: host, BCMCP_DATA: mkdtempSync(join(tmpdir(), 'bc-acct-')), BCMCP_MASTER_KEY: Buffer.alloc(32, 7).toString('base64'), PORT: String(port) };
  const proc = spawn(process.execPath, ['src/server.ts'], { env, stdio: ['ignore', 'pipe', 'inherit'] });
  const stop = once(proc, 'exit');
  await once(proc.stdout, 'data');
  try {
    const post = (p, body, ck = '', h = { 'x-bc': '1' }) => fetch(host + p, { method: 'POST', headers: { 'content-type': 'application/json', cookie: ck, ...h }, body: JSON.stringify(body) });
    const good = { email: 'Pat@Example.com', password: 'correct horse 1', company: 'Pat Pools' };

    assert.equal((await post('/auth/signup', good, '', {})).status, 403, 'needs the x-bc header');
    assert.equal((await post('/auth/signup', { ...good, password: 'short' })).status, 400);
    const up = await post('/auth/signup', good);
    assert.equal(up.status, 200);
    const { connectorUrl } = await up.json();
    const ck = up.headers.get('set-cookie').split(';')[0];
    assert.match(connectorUrl, /\/t\/[\w-]+\/mcp$/);
    assert.equal((await post('/auth/signup', good)).status, 400, 'email taken');

    const me = await (await fetch(host + '/api/me', { headers: { cookie: ck } })).json();
    assert.equal(me.account.email, 'pat@example.com');
    assert.equal(me.company, 'Pat Pools');

    const c = new Client({ name: 'x', version: '1' });
    await c.connect(new StreamableHTTPClientTransport(new URL(connectorUrl)));
    assert.ok((await c.listTools()).tools.length > 0, 'the connector link works');
    await c.close();

    assert.equal((await post('/auth/login', { email: 'pat@example.com', password: 'wrong password' })).status, 401);
    assert.equal((await post('/auth/login', { email: 'nobody@example.com', password: 'wrong password' })).status, 401);
    const inn = await post('/auth/login', { email: 'PAT@example.com', password: good.password });
    assert.equal(inn.status, 200);
    const ck2 = inn.headers.get('set-cookie').split(';')[0];

    const reset = await post('/api/connector/reset', {}, ck2);
    assert.equal(reset.status, 200);
    const fresh = (await reset.json()).connectorUrl;
    assert.notEqual(fresh, connectorUrl);
    assert.equal((await fetch(connectorUrl, { method: 'POST' })).status, 404, 'old link is dead');
    const ck3 = reset.headers.get('set-cookie').split(';')[0];
    assert.equal((await (await fetch(host + '/api/me', { headers: { cookie: ck3 } })).json()).account.email, 'pat@example.com', 'account follows the new link');
    assert.equal((await post('/auth/login', { email: 'pat@example.com', password: good.password })).status, 200, 'can still sign in after reset');
  } finally { proc.kill(); await stop; }
});
