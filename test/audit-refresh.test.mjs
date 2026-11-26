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

// Refresh rule (ADR 0002): fresh data is served without touching the Portal, stale data is served at once
// and refreshed in the background, the refresh flag forces a read, and every result says when it was fetched.
// Short timings here stand in for the real 15 minutes. The demo city plays the slow Portal.

const freePort = async () => { const s = createServer().listen(0, '127.0.0.1'); await once(s, 'listening'); const { port } = s.address(); await new Promise((r) => s.close(r)); return port; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('refresh rule: fresh is cached, stale refreshes in the background, refresh forces, cache survives a restart', { timeout: 30000 }, async () => {
  const port = await freePort();
  const host = 'http://127.0.0.1:' + port;
  const env = { ...process.env, BCMCP_PUBLIC_URL: host, BCMCP_DATA: mkdtempSync(join(tmpdir(), 'bc-refresh-')), BCMCP_MASTER_KEY: Buffer.alloc(32, 9).toString('base64'), PORT: String(port),
    BCMCP_STALE_MS: '1500', BCMCP_REFRESH_WAIT_MS: '2000', BCMCP_DEMO_DELAY_MS: '300' };
  const secret = execFileSync(process.execPath, ['src/server.ts', 'tenant', 'A'], { env, encoding: 'utf8' }).trim().split('\n').at(-1);
  const start = async () => { const p = spawn(process.execPath, ['src/server.ts'], { env, stdio: ['ignore', 'pipe', 'inherit'] }); await once(p.stdout, 'data'); return p; };
  let proc = await start();
  const mcp = new Client({ name: 'x', version: '1' });
  try {
    await mcp.connect(new StreamableHTTPClientTransport(new URL(secret)));
    const tool = async (name, args = {}) => JSON.parse((await mcp.callTool({ name, arguments: args })).content[0].text);
    const link = (await mcp.callTool({ name: 'open_dashboard', arguments: {} })).content[0].text.match(/https?:\/\/\S+/)[0];
    const ck = (await fetch(link, { redirect: 'manual' })).headers.get('set-cookie').split(';')[0];
    const get = async (p) => { const t = Date.now(); const body = await (await fetch(host + p, { headers: { cookie: ck } })).json(); return { ...body, ms: Date.now() - t }; };
    assert.equal((await fetch(host + '/api/connect', { method: 'POST', headers: { cookie: ck, 'content-type': 'application/json', 'x-bc': '1' }, body: JSON.stringify({ city: 'demo-city', username: 'demo', password: 'demo' }) })).status, 200);

    // No cache yet: wait for the Portal.
    const first = await get('/api/permits');
    assert.equal(first.permits.length, 3);
    assert.ok(first.fetchedAt && !first.refreshing);
    assert.ok(first.ms >= 250, 'first read goes to the Portal');

    // Fresh: served from cache, no Portal read. Claude sees the same data and time.
    const again = await get('/api/permits');
    assert.equal(again.fetchedAt, first.fetchedAt);
    assert.ok(again.ms < 250, 'fresh data does not wait on the Portal');
    assert.equal((await tool('list_permits')).fetchedAt, first.fetchedAt);
    const insp = await get('/api/inspections');
    assert.ok(insp.inspections.length >= 2 && insp.fetchedAt);
    const detail = await get('/api/permit?city=demo-city&id=BLD-2026-0142');
    assert.equal(detail.permit.id, 'BLD-2026-0142');
    assert.equal(detail.inspections.length, 2);
    assert.ok(detail.fetchedAt);

    // Stale: old data comes back at once while a refresh runs, then the new time shows up.
    await sleep(1600);
    const stale = await get('/api/permits');
    assert.equal(stale.fetchedAt, first.fetchedAt);
    assert.equal(stale.refreshing, true);
    assert.ok(stale.ms < 250, 'stale data is served without waiting');
    await sleep(600);
    const after = await get('/api/permits');
    assert.ok(after.fetchedAt > first.fetchedAt, 'background refresh landed');
    assert.equal(after.refreshing, false);

    // The button (and Claude's refresh flag) force a Portal read even when fresh.
    const forced = await get('/api/permits?refresh=1');
    assert.ok(forced.fetchedAt > after.fetchedAt);
    const viaClaude = await tool('list_permits', { refresh: true });
    assert.ok(viaClaude.fetchedAt > forced.fetchedAt);
    assert.equal(typeof viaClaude.ageMinutes, 'number');

    // Cache is kept per Company on disk, so a restart serves it without a Portal read.
    proc.kill(); await once(proc, 'exit');
    proc = await start();
    const restarted = await get('/api/permits');
    assert.equal(restarted.fetchedAt, viaClaude.fetchedAt);
    assert.ok(restarted.ms < 250);

    // Disconnecting forgets that city's data.
    await fetch(host + '/api/disconnect', { method: 'POST', headers: { cookie: ck, 'content-type': 'application/json', 'x-bc': '1' }, body: JSON.stringify({ city: 'demo-city' }) });
    const gone = await get('/api/permits');
    assert.deepEqual(gone.permits, []);
    assert.equal(gone.fetchedAt, null);
  } finally {
    await mcp.close().catch(() => {});
    proc.kill();
  }
});
