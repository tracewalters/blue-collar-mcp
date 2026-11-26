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

// Connection flow: the user signs in on our page, the agent checks status itself, and a short
// paste-back key is the fallback. The password only ever goes to the vault.

const freePort = async () => { const s = createServer().listen(0, '127.0.0.1'); await once(s, 'listening'); const { port } = s.address(); await new Promise((r) => s.close(r)); return port; };

test('connection flow: agent sees pending and connected cities, paste-back key is single-use and short-lived', { timeout: 20000 }, async () => {
  const port = await freePort();
  const host = 'http://127.0.0.1:' + port;
  const env = { ...process.env, BCMCP_PUBLIC_URL: host, BCMCP_DATA: mkdtempSync(join(tmpdir(), 'bc-connect-')), BCMCP_MASTER_KEY: Buffer.alloc(32, 5).toString('base64'), PORT: String(port), BCMCP_CONNECT_KEY_MS: '1500' };
  const mk = (n) => execFileSync(process.execPath, ['src/server.ts', 'tenant', n], { env, encoding: 'utf8' }).trim().split('\n').at(-1);
  const [a, b] = [mk('A'), mk('B')];
  const proc = spawn(process.execPath, ['src/server.ts'], { env, stdio: ['ignore', 'pipe', 'inherit'] });
  await once(proc.stdout, 'data');
  const clients = [];
  const agent = async (url) => {
    const c = new Client({ name: 'x', version: '1' });
    await c.connect(new StreamableHTTPClientTransport(new URL(url)));
    clients.push(c);
    return async (name, args = {}) => { const r = await c.callTool({ name, arguments: args }); return { error: r.isError, text: r.content[0].text, json: () => JSON.parse(r.content[0].text) }; };
  };
  try {
    const call = await agent(a);
    await call('save_setup', { company: 'Acme', userName: 'Pat', cities: ['demo-city', 'phoenix-az'] });
    let status = (await call('list_connections')).json();
    assert.deepEqual(status.connections, []);
    assert.deepEqual(status.pending.map((c) => c.id), ['demo-city', 'phoenix-az'], 'cities chosen in setup but not signed in yet');

    const dash = (await call('open_dashboard', { city: 'demo-city' })).text;
    assert.match(dash, /list_connections/, 'tells the agent how to check status after sign-in');
    const ck = (await fetch(dash.match(/https?:\/\/\S+/)[0], { redirect: 'manual' })).headers.get('set-cookie').split(';')[0];
    const connect = async () => {
      const r = await fetch(host + '/api/connect', { method: 'POST', headers: { cookie: ck, 'content-type': 'application/json', 'x-bc': '1' }, body: JSON.stringify({ city: 'demo-city', username: 'demo', password: 'demo' }) });
      assert.equal(r.status, 200);
      const text = await r.text();
      assert.doesNotMatch(text, /"password"|demo"\s*}/, 'login is never echoed');
      return JSON.parse(text);
    };
    const { key } = await connect();
    assert.match(key, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/);

    // The agent polls status itself: no paste needed.
    status = (await call('list_connections')).json();
    assert.deepEqual(status.connections.map((c) => c.id), ['demo-city']);
    assert.deepEqual(status.pending.map((c) => c.id), ['phoenix-az']);
    assert.doesNotMatch(JSON.stringify(status), /demo-session|password|username/, 'no session or login reaches the agent');

    // Fallback: another Company cannot use the key; the right one can, once.
    const other = await agent(b);
    assert.equal((await other('list_connections', { key })).error, true, 'key is tied to its Company');
    const confirmed = (await call('list_connections', { key })).json();
    assert.equal(confirmed.confirmed.id, 'demo-city');
    assert.equal((await call('list_connections', { key })).error, true, 'single use');

    // Short-lived.
    const { key: late } = await connect();
    await new Promise((r) => setTimeout(r, 1700));
    assert.match((await call('list_connections', { key: late })).text, /expired|unknown/i);
  } finally {
    for (const c of clients) await c.close().catch(() => {});
    proc.kill();
  }
});
