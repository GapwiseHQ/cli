import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';

const cli = resolve(import.meta.dirname, '../bin/gapwise.mjs');

async function run(args, base) {
  const child = spawn(process.execPath, [cli, ...args], {
    env: { ...process.env, GAPWISE_API_BASE_URL: base },
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const [code] = await once(child, 'close');
  return { code, stdout, stderr };
}

async function fixture(t) {
  const seen = [];
  const universities = [
    { id: 'uoft', name: 'University of Toronto', campuses: ['utm', 'utsg', 'utsc'], defaultCampus: 'utm', routableCampuses: ['utm'], hosts: ['gapwise.ca'], status: 'supported' },
    { id: 'carleton', name: 'Carleton University', campuses: ['carleton'], defaultCampus: 'carleton', routableCampuses: ['carleton'], hosts: ['carleton.gapwise.ca'], status: 'supported' },
    { id: 'york', name: 'York University', campuses: ['keele'], defaultCampus: 'keele', routableCampuses: ['keele'], hosts: ['york.gapwise.ca'], status: 'supported' },
    { id: 'tmu', name: 'Toronto Metropolitan University', campuses: ['tmu'], defaultCampus: 'tmu', routableCampuses: ['tmu'], hosts: ['tmu.gapwise.ca'], status: 'supported' },
  ];
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const part of req) body += part;
    seen.push({ url: req.url, body });
    const url = new URL(req.url, 'http://localhost');
    const data = url.pathname === '/v1/universities' ? universities
      : url.pathname === '/v1/campuses' ? [{ id: 'keele', universityId: 'york', name: 'York University', routable: true }]
      : url.pathname === '/v1/buildings' ? [{ code: 'BSB', name: 'Behavioural Sciences Building', category: url.searchParams.get('category') ?? 'academic' }]
      : url.pathname === '/v1/routes' ? { university: JSON.parse(body).university, campus: JSON.parse(body).campus, distanceMeters: 750 }
      : [];
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ data, meta: { apiVersion: 'v1' } }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  return { base: `http://127.0.0.1:${server.address().port}/v1`, seen };
}

test('help and version are useful without a checkout or network', async () => {
  const help = await run(['--help']);
  assert.equal(help.code, 0);
  assert.match(help.stdout, /gapwise universities/);
  assert.match(help.stdout, /--university ID/);
  const version = await run(['--version']);
  assert.equal(version.code, 0);
  assert.match(version.stdout, /^0\.2\.0\n$/);
});

test('discovery and JSON output use the public API', async (t) => {
  const { base } = await fixture(t);
  const result = await run(['universities', '--json'], base);
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).data.map(({ id }) => id), ['uoft', 'carleton', 'york', 'tmu']);
  const campuses = await run(['campuses', '--university', 'york'], base);
  assert.equal(campuses.code, 0, campuses.stderr);
  assert.match(campuses.stdout, /keele\tYork University/);
});

test('queries require an explicit university and never inherit UTM', async (t) => {
  const { base, seen } = await fixture(t);
  const missing = await run(['buildings', '--json'], base);
  assert.equal(missing.code, 1);
  assert.match(missing.stderr, /--university ID is required/);
  assert.equal(seen.length, 0);
  const invalid = await run(['buildings', '--university', 'unknown'], base);
  assert.equal(invalid.code, 1);
  assert.match(invalid.stderr, /Unknown or unsupported university/);
  const wrongCampus = await run(['buildings', '--university', 'york', '--campus', 'utm'], base);
  assert.equal(wrongCampus.code, 1);
  assert.match(wrongCampus.stderr, /does not belong to York University/);
  const result = await run(['residences', '--university', 'york', '--json'], base);
  assert.equal(result.code, 0, result.stderr);
  const request = seen.find(({ url }) => url.startsWith('/v1/buildings'));
  assert.match(request.url, /university=york/);
  assert.match(request.url, /campus=keele/);
  assert.match(request.url, /category=residence/);
  assert.doesNotMatch(request.url, /utm/);
});

test('route includes the selected university and rejects unsupported campuses', async (t) => {
  const { base, seen } = await fixture(t);
  const route = await run(['route', '--university', 'carleton', '--from', 'TB', '--to', 'ML', '--json'], base);
  assert.equal(route.code, 0, route.stderr);
  assert.equal(JSON.parse(route.stdout).data.university, 'carleton');
  const body = JSON.parse(seen.find(({ url }) => url === '/v1/routes').body);
  assert.equal(body.campus, 'carleton');
  const unsupported = await run(['route', '--university', 'uoft', '--campus', 'utsg', '--from', 'A', '--to', 'B'], base);
  assert.equal(unsupported.code, 1);
  assert.match(unsupported.stderr, /Routing is unavailable/);
});

test('bad options and network failures return nonzero and actionable errors', async (t) => {
  const { base } = await fixture(t);
  const bad = await run(['buildings', '--university', 'tmu', '--limit', '999'], base);
  assert.equal(bad.code, 1);
  assert.match(bad.stderr, /--limit must be/);
  const offline = await run(['universities'], 'http://127.0.0.1:1/v1');
  assert.equal(offline.code, 1);
  assert.match(offline.stderr, /Gapwise API request failed/);
});
