import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const fresh = () => ({ ...process.env, PERMIT_MCP_HOME: mkdtempSync(join(tmpdir(), 'bcmcp-audit-')), BRAIN_DIR: '', BCMCP_BRAIN: '1' });
const cli = (env, args, input) => spawnSync(process.execPath, ['src/cli.ts', ...args], { env, input, encoding: 'utf8', timeout: 5000 });
const ok = (result) => {
  assert.equal(result.status, 0, result.stderr || String(result.error ?? ''));
  return result.stdout;
};
test('built CLI smoke: help, login, connections, city filters, detail, proposal, commit, logout', () => {
  const env = fresh();
  const cities = JSON.parse(ok(cli(env, ['cities', '--json'])));
  const demo = cities.findIndex((city) => city.id === 'demo-city') + 1;
  assert.ok(demo > 0);
  assert.match(ok(cli(env, [])), /schedule/);
  assert.match(ok(cli(env, ['login'], demo + '\nwrong\nwrong\ndemo\ndemo\n')), /Connected/);
  const phoenix = cities.findIndex(city => city.id === 'scottsdale-az') + 1;
  assert.match(ok(cli(env, ['login'], phoenix + '\nfixture\nfixture\n')), /not built yet/);
  assert.equal(JSON.parse(ok(cli(env, ['connections', '--json']))).length, 1);
  assert.equal(JSON.parse(ok(cli(env, ['permits', '--city', 'demo-city', '--json']))).length, 3);
  const permit = JSON.parse(ok(cli(env, ['permit', 'demo-city', 'BLD-2026-0142', '--json'])));
  assert.equal(permit.inspections.length, 2);
  const proposal = JSON.parse(ok(cli(env, ['schedule', 'demo-city', permit.permit.id, '--type', 'Framing', '--date', '2026-12-01', '--json'])));
  assert.match(ok(cli(env, ['commit', proposal.token])), /Scheduled/);
  ok(cli(env, ['logout', 'demo-city']));
  assert.deepEqual(JSON.parse(ok(cli(env, ['connections', '--json']))), []);
  assert.equal(cli(env, ['schedule']).status, 1);
  assert.equal(cli(env, ['permits', '--city', 'unknown-city']).status, 1);
});
test('CLI retains a scheduled demo inspection across invocations', () => {
  const env = fresh();
  const cities = JSON.parse(ok(cli(env, ['cities', '--json'])));
  const demo = cities.findIndex((city) => city.id === 'demo-city') + 1;
  ok(cli(env, ['login'], demo + '\ndemo\ndemo\n'));
  const before = JSON.parse(ok(cli(env, ['inspections', '--json'])));
  const proposal = JSON.parse(ok(cli(env, ['schedule', 'demo-city', 'BLD-2026-0142', '--type', 'Framing', '--date', '2026-12-01', '--json'])));
  assert.equal(JSON.parse(ok(cli(env, ['commit', proposal.token, '--json']))).ok, true);
  const after = JSON.parse(ok(cli(env, ['inspections', '--json'])));
  assert.equal(after.length, before.length + 1);
});
test('invalid inspection dates are rejected before approval', () => {
  const env = fresh();
  const cities = JSON.parse(ok(cli(env, ['cities', '--json'])));
  const demo = cities.findIndex((city) => city.id === 'demo-city') + 1;
  ok(cli(env, ['login'], demo + '\ndemo\ndemo\n'));
  assert.equal(cli(env, ['schedule', 'demo-city', 'BLD-2026-0142', '--type', 'Framing', '--date', 'not-a-date', '--json']).status, 1);
});
test('brain notes with distinct titles survive when their slugs match', async () => {
  process.env.PERMIT_MCP_HOME = fresh().PERMIT_MCP_HOME;
  delete process.env.BRAIN_DIR;
  const {saveNote, searchNotes} = await import('../src/brain/notes.ts');
  saveNote({ type: 'job', title: 'Lot 7-A', body: 'first job', source: 'human' });
  saveNote({ type: 'job', title: 'Lot 7 A', body: 'second job', source: 'human' });
  assert.throws(() => saveNote({type: 'job', title: '!', body: '', source: 'human'}), /Title needed/);
  assert.equal(searchNotes('Lot 7', 'job').length, 2);
});
test('built stdio MCP lists tools and prompts and handles an approved brain write', async () => {
  const env = fresh();
  env.BRAIN_DIR = env.PERMIT_MCP_HOME;
  const client = new Client({ name: 'audit', version: '1.0.0' }, { capabilities: { elicitation: { form: {} } } });
  let approvals = 0;
  const { ElicitRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');
  client.setRequestHandler(ElicitRequestSchema, () => ({ action: 'accept', content: { approve: ++approvals !== 1 } }));
  try {
    await client.connect(new StdioClientTransport({ command: process.execPath, args: ['src/mcp.ts'], env }));
    assert.equal((await client.listTools()).tools.length, 14);
    assert.equal((await client.getPrompt({ name: 'brain-setup' })).messages.length, 1);
    const call = (name, args) => client.callTool({ name, arguments: args });
    assert.ok((await call('list_connections', {})).content[0].text.includes('demo-city'));
    assert.deepEqual(JSON.parse((await call('list_permits', {})).content[0].text), []);
    assert.deepEqual(JSON.parse((await call('list_inspections', {})).content[0].text), []);
    assert.equal((await call('get_permit', {city:'demo-city', permitId: 'x'})).isError, true);
    assert.equal((await call('propose_inspection', {city:'demo-city', permitId:'x', type:'Frame', date:'2026-12-01'})).isError, true);
    assert.equal((await call('commit_action', {token:'unknown'})).isError, true);
    const args = { type:'job', title:'Local fixture', body:'North fence', source:'human' };
    assert.equal((await call('brain_save', args)).isError, true);
    assert.equal((await call('brain_get', {type:'job',slug:'local-fixture'})).isError, true);
    assert.equal(JSON.parse((await call('brain_save', args)).content[0].text).slug, 'local-fixture');
    assert.match((await call('brain_get', {type:'job',slug:'local-fixture'})).content[0].text, /North fence/);
    assert.match((await call('brain_search', {query:'fence',type:'job'})).content[0].text, /local-fixture/);
    const cities = JSON.parse(ok(cli(env, ['cities', '--json'])));
    const demo = cities.findIndex(city => city.id === 'demo-city') + 1;
    ok(cli(env, ['login'], demo + '\ndemo\ndemo\n'));
    const before = JSON.parse((await call('list_inspections', {})).content[0].text).length;
    const proposed = await call('propose_inspection', {city:'demo-city', permitId:'BLD-2026-0142', type:'Framing', date:'2026-12-01'});
    const {token} = JSON.parse(proposed.content[0].text);
    assert.equal(JSON.parse((await call('list_inspections', {})).content[0].text).length, before);
    assert.equal(JSON.parse((await call('commit_action', {token})).content[0].text).ok, true);
    assert.equal(JSON.parse((await call('list_inspections', {})).content[0].text).length, before + 1);
    assert.equal((await call('commit_action', {token})).isError, true);
  } finally {
    await client.close();
  }
});
test('schema generation matches tracked schemas', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bcmcp-schemas-'));
  execFileSync(process.execPath, [join(process.cwd(), 'scripts/gen-schemas.ts')], { cwd: dir });
  for (const name of ['permit', 'inspection', 'jurisdiction', 'plan']) {
    const path = 'spec/schemas/' + name + '.json';
    assert.deepEqual(JSON.parse(readFileSync(join(dir, path))), JSON.parse(readFileSync(path)));
  }
});

test('canary can run in an empty test environment', () => {
  assert.match(execFileSync(process.execPath, ['src/canary.ts'], { encoding: 'utf8', env: fresh() }), /^skip phoenix-az: no canary creds\n$/);
});

test('service rejects expired tokens and missing permits, and logout works in a fresh home', async () => {
  process.env.PERMIT_MCP_HOME = fresh().PERMIT_MCP_HOME;
  const svc = await import('../src/service.ts');
  const {readDb, writeDb} = await import('../src/store.ts');
  svc.logout('demo-city');
  await assert.rejects(() => svc.getPermit('demo-city', 'missing'), /Not connected/);
  await svc.login('demo-city', {username:'demo', password:'demo'});
  const detail = await svc.getPermit('demo-city','BLD-2026-0142');
  assert.equal(detail.inspections.length, 2);
  await assert.rejects(() => svc.getPermit('demo-city','missing'), /not found/);
  const {token} = await svc.proposeInspection('demo-city', {permitId:detail.permit.id, type:'Framing', date:'2026-12-01'});
  const db = readDb();
  db.plans[token].expires = Date.now() - 1;
  writeDb(db);
  assert.throws(() => svc.peek(token), /expired/);
  await assert.rejects(() => svc.commit(token), /expired/);
  assert.equal(readDb().plans[token], undefined);
});

test('planned adapters reject requests and never contact the portal', async () => {
  const {getAdapter} = await import('../src/adapter.ts');
  const city = (await import('../src/jurisdictions.ts')).getJurisdiction('scottsdale-az');
  await assert.rejects(() => getAdapter(city.platform).listPermits(city, {}), /planned but not built/);
});
test('canary reports missing credentials, success, and failure with a fixture adapter', () => {
  const run = (creds) => spawnSync(process.execPath, ['--import', './test/audit-canary-fixture.mjs', 'src/canary.ts'], {
    env: {...fresh(), CANARY_DEMO_CITY_USER: creds, CANARY_DEMO_CITY_PASS: creds}, encoding: 'utf8', timeout: 5000,
  });
  assert.match(ok(run('')), /skip demo-city: no canary creds/);
  assert.match(ok(run('demo')), /ok +demo-city: 3 permits/);
  const failed = run('invalid-fixture');
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /FAIL demo-city/);
});
