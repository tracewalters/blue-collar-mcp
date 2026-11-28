import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

test('mcp sign-in: add one public URL, sign in, approve, tools work; bad codes and tokens are refused', { timeout: 25000 }, async () => {
  const probe = createServer().listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const { port } = probe.address();
  await new Promise((r) => probe.close(r));
  const host = 'http://127.0.0.1:' + port;
  const env = { ...process.env, BCMCP_PUBLIC_URL: host, BCMCP_DATA: mkdtempSync(join(tmpdir(), 'bc-oauth-')), BCMCP_MASTER_KEY: Buffer.alloc(32, 7).toString('base64'), PORT: String(port) };
  const proc = spawn(process.execPath, ['src/server.ts'], { env, stdio: ['ignore', 'pipe', 'inherit'] });
  const stop = once(proc, 'exit');
  await once(proc.stdout, 'data');
  try {
    // 1. no token: 401 that points at the metadata
    const r0 = await fetch(host + '/mcp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(r0.status, 401);
    assert.match(r0.headers.get('www-authenticate'), /resource_metadata=".*oauth-protected-resource"/);
    const prm = await (await fetch(host + '/.well-known/oauth-protected-resource')).json();
    assert.equal(prm.resource, host + '/mcp');
    const as = await (await fetch(host + '/.well-known/oauth-authorization-server')).json();
    assert.ok(as.registration_endpoint && as.token_endpoint && as.authorization_endpoint);

    // 2. the user has a website account
    const up = await fetch(host + '/auth/signup', { method: 'POST', headers: { 'content-type': 'application/json', 'x-bc': '1' }, body: JSON.stringify({ email: 'kim@example.com', password: 'a long password 1', company: 'Kim Electric' }) });
    const ck = up.headers.get('set-cookie').split(';')[0];

    // 3. the AI app registers itself, then sends the user to authorize (PKCE)
    const redirect = 'http://localhost:8123/callback';
    const reg = await (await fetch(as.registration_endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ redirect_uris: [redirect], client_name: 'TestGPT' }) })).json();
    assert.equal((await fetch(as.registration_endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ redirect_uris: ['http://evil.example/cb'] }) })).status, 400, 'plain http redirects are refused');
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const q = new URLSearchParams({ response_type: 'code', client_id: reg.client_id, redirect_uri: redirect, state: 'st1', code_challenge: challenge, code_challenge_method: 'S256' });
    const signedOut = await fetch(`${host}/oauth/authorize?${q}`, { redirect: 'manual' });
    assert.match(signedOut.headers.get('location'), /^\/signin\?next=/, 'signed out: sign in first');
    const page = await fetch(`${host}/oauth/authorize?${q}`, { headers: { cookie: ck } });
    assert.match(await page.text(), /Connect TestGPT\?[\s\S]*Kim Electric/);
    assert.equal((await fetch(`${host}/oauth/authorize?${q.toString().replace('localhost%3A8123', 'evil.example')}`, { headers: { cookie: ck } })).status, 400, 'redirect must match registration');

    const deny = await fetch(`${host}/oauth/authorize`, { method: 'POST', redirect: 'manual', headers: { cookie: ck, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...Object.fromEntries(q), decision: 'deny' }) });
    assert.match(deny.headers.get('location'), /error=access_denied.*state=st1|state=st1.*error=access_denied/);
    const allow = await fetch(`${host}/oauth/authorize`, { method: 'POST', redirect: 'manual', headers: { cookie: ck, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...Object.fromEntries(q), decision: 'allow' }) });
    const back = new URL(allow.headers.get('location'));
    assert.equal(back.searchParams.get('state'), 'st1');
    const code = back.searchParams.get('code');

    // 4. token exchange: wrong verifier fails, right one works once
    const tok = (body) => fetch(as.token_endpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
    const base = { grant_type: 'authorization_code', code, redirect_uri: redirect, client_id: reg.client_id };
    assert.equal((await tok({ ...base, code_verifier: 'x'.repeat(43) })).status, 400);
    const good = await tok({ ...base, code_verifier: verifier });
    assert.equal(good.status, 200);
    const t = await good.json();
    assert.equal((await tok({ ...base, code_verifier: verifier })).status, 400, 'a code works once');

    // 5. the MCP client uses the bearer token on the public URL
    const c = new Client({ name: 'x', version: '1' });
    await c.connect(new StreamableHTTPClientTransport(new URL(host + '/mcp'), { requestInit: { headers: { authorization: `Bearer ${t.access_token}` } } }));
    assert.ok((await c.listTools()).tools.some((x) => x.name === 'list_permits'));
    await c.close();
    assert.equal((await fetch(host + '/mcp', { method: 'POST', headers: { authorization: 'Bearer junk', 'content-type': 'application/json' }, body: '{}' })).status, 401);

    // 6. refresh gives a working token for the same company
    const rf = await (await tok({ grant_type: 'refresh_token', refresh_token: t.refresh_token })).json();
    assert.ok(rf.access_token);
    assert.equal((await tok({ grant_type: 'refresh_token', refresh_token: t.access_token })).status, 400, 'an access token is not a refresh token');
  } finally { proc.kill(); await stop; }
});
