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

test('built hosted MCP initializes, lists brain tools, and restricts access to provisioned connectors', { timeout: 10000 }, async () => {
  const probe = createServer().listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close((err) => err ? reject(err) : resolve()));
  const host = 'http://127.0.0.1:' + port;
  const env = { ...process.env, BCMCP_PUBLIC_URL: host, BCMCP_DATA: mkdtempSync(join(tmpdir(), 'bcmcp-host-audit-')), BCMCP_MASTER_KEY: Buffer.alloc(32, 7).toString('base64'), PORT: String(port) };
  const entry = 'src/server.ts';
  const url = (name) => execFileSync(process.execPath, [entry, 'tenant', name], { env, encoding: 'utf8' }).trim().split('\n').at(-1);
  const a = url('Fixture A');
  const b = url('Fixture B');
  assert.notEqual(a, b);
  const proc = spawn(process.execPath, [entry], { env, stdio: ['ignore', 'pipe', 'inherit'] });
  const stop = once(proc, 'exit');
  const firstLog = once(proc.stdout, 'data');
  try {
    assert.match(String((await Promise.race([firstLog, stop]))[0]), /hosted on/);
    assert.equal((await fetch(host + '/mcp', { signal: AbortSignal.timeout(2000) })).status, 404);
    assert.equal((await fetch(a, { signal: AbortSignal.timeout(2000) })).status, 405);
    for (const endpoint of [a, b]) {
      const client = new Client({ name:'audit', version:'1.0.0' });
      try {
        await client.connect(new StreamableHTTPClientTransport(new URL(endpoint)));
        assert.deepEqual((await client.listTools()).tools.map(t => t.name).sort(), ['get_inspection', 'get_permit', 'get_setup', 'list_connections', 'list_inspections', 'list_permits', 'open_dashboard', 'propose_inspection', 'run_setup', 'save_setup']);
        assert.equal(JSON.parse((await client.callTool({ name:'list_connections', arguments:{} })).content[0].text).connections.length, 0);
        assert.match((await client.callTool({ name:'open_dashboard', arguments:{} })).content[0].text, /\/auth\/claim\?t=/);
      } finally {
        await client.close();
      }
    }
  } finally {
    proc.kill();
    await stop;
  }
});
