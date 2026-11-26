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
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';

test('setup form: clients that can show forms get a real form, others get a text fallback', { timeout: 20000 }, async () => {
  const probe = createServer().listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const { port } = probe.address();
  await new Promise((r) => probe.close(r));
  const env = { ...process.env, BCMCP_PUBLIC_URL: 'http://127.0.0.1:' + port, BCMCP_DATA: mkdtempSync(join(tmpdir(), 'bc-form-')), PORT: String(port) };
  const url = execFileSync(process.execPath, ['src/server.ts', 'tenant', 'F'], { env, encoding: 'utf8' }).trim().split('\n').at(-1);
  const proc = spawn(process.execPath, ['src/server.ts'], { env, stdio: ['ignore', 'pipe', 'inherit'] });
  const stop = once(proc, 'exit');
  await once(proc.stdout, 'data');
  try {
    // A client without forms: stateless, gets the text fallback.
    const plain = new Client({ name: 'plain', version: '1' });
    await plain.connect(new StreamableHTTPClientTransport(new URL(url)));
    const fb = JSON.parse((await plain.callTool({ name: 'run_setup', arguments: {} })).content[0].text);
    assert.equal(fb.fallback, true);
    await plain.close();

    // A client that can show forms: the server asks, the client answers, the profile is saved.
    const c = new Client({ name: 'forms', version: '1' }, { capabilities: { elicitation: { form: {} } } });
    let seen;
    c.setRequestHandler(ElicitRequestSchema, (req) => {
      seen = req.params.requestedSchema;
      return { action: 'accept', content: { company: 'Form Co', userName: 'Pat', role: 'Electrician', cities: ['phoenix-az', 'scottsdale-az'], phone: '555-0100' } };
    });
    await c.connect(new StreamableHTTPClientTransport(new URL(url)));
    const r = JSON.parse((await c.callTool({ name: 'run_setup', arguments: {} })).content[0].text);
    assert.equal(r.saved, true);
    assert.deepEqual(r.profile.cities, ['phoenix-az', 'scottsdale-az']);
    assert.equal(seen.properties.cities.type, 'array');
    assert.ok(seen.properties.role.oneOf.length >= 5);
    assert.ok(seen.properties.cities.items.anyOf.find((x) => x.const === 'phoenix-az' && !/coming soon/.test(x.title)));
    assert.ok(seen.properties.cities.items.anyOf.find((x) => x.const === 'mesa-az' && /coming soon/.test(x.title)));
    const setup = JSON.parse((await c.callTool({ name: 'get_setup', arguments: {} })).content[0].text);
    assert.equal(setup.profile.company, 'Form Co');
    await c.close();

    // Cancelled form saves nothing new.
    const d = new Client({ name: 'cancel', version: '1' }, { capabilities: { elicitation: { form: {} } } });
    d.setRequestHandler(ElicitRequestSchema, () => ({ action: 'cancel' }));
    await d.connect(new StreamableHTTPClientTransport(new URL(url)));
    assert.equal(JSON.parse((await d.callTool({ name: 'run_setup', arguments: {} })).content[0].text).saved, false);
    await d.close();
  } finally {
    proc.kill();
    await stop;
  }
});
