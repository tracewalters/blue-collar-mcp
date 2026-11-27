import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync } from 'node:fs';
import { createServer } from 'node:http';
import { createServer as net } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const freePort = async () => { const p = net().listen(0, '127.0.0.1'); await once(p, 'listening'); const { port } = p.address(); await new Promise((r) => p.close(r)); return port; };

test('google sign-in: new account, same account again, bad state, unverified email', { timeout: 20000 }, async () => {
  let claims = { email: 'sam@example.com', email_verified: true, name: 'Sam Roofing', aud: 'cid' };
  const fake = createServer((req, res) => { // stands in for Google's token endpoint
    const idt = `x.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.y`;
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ id_token: idt }));
  }).listen(await freePort(), '127.0.0.1');
  await once(fake, 'listening');
  const port = await freePort();
  const host = 'http://127.0.0.1:' + port;
  const env = { ...process.env, BCMCP_PUBLIC_URL: host, BCMCP_DATA: mkdtempSync(join(tmpdir(), 'bc-goog-')), BCMCP_MASTER_KEY: Buffer.alloc(32, 7).toString('base64'), PORT: String(port), GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'sec', BCMCP_GOOGLE_TOKEN_URL: `http://127.0.0.1:${fake.address().port}/token` };
  const proc = spawn(process.execPath, ['src/server.ts'], { env, stdio: ['ignore', 'pipe', 'inherit'] });
  const stop = once(proc, 'exit');
  await once(proc.stdout, 'data');
  try {
    assert.deepEqual(await (await fetch(host + '/auth/config')).json(), { google: true });
    const go = async () => { const r = await fetch(host + '/auth/google', { redirect: 'manual' }); assert.equal(r.status, 302); return { state: new URL(r.headers.get('location')).searchParams.get('state'), ck: r.headers.get('set-cookie').split(';')[0] }; };
    const back = (state, ck) => fetch(`${host}/auth/google/callback?code=c&state=${state}`, { redirect: 'manual', headers: { cookie: ck } });

    let { state, ck } = await go();
    const first = await back(state, ck);
    assert.equal(first.headers.get('location'), '/account?welcome=1');
    const sess = first.headers.getSetCookie().find((c) => c.startsWith('bc_session=')).split(';')[0];
    const me = await (await fetch(host + '/api/me', { headers: { cookie: sess } })).json();
    assert.equal(me.account.email, 'sam@example.com');
    assert.equal(me.company, 'Sam Roofing');

    ({ state, ck } = await go());
    const again = await back(state, ck);
    assert.equal(again.headers.get('location'), '/dashboard', 'same email signs into the same company');

    ({ state, ck } = await go());
    assert.match((await back('wrong', ck)).headers.get('location'), /error=google/, 'state must match');
    claims = { ...claims, email_verified: false };
    ({ state, ck } = await go());
    assert.match((await back(state, ck)).headers.get('location'), /error=google/, 'unverified email refused');
  } finally { proc.kill(); fake.close(); await stop; }
});
