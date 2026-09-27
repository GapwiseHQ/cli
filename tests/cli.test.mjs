import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { universityPlan } from '../bin/gapwise.mjs';

const fixtureSource = resolve(import.meta.dirname, 'fixtures');
function fixture() {
  const workspace = mkdtempSync(join(tmpdir(), 'gapwise-cli-'));
  for (const file of [
    'gapwise/universities.json',
    'gapwise/src/universities/timetable-adapters.ts',
    'gapwise/src/data/campuses/index.ts',
    'data/schemas/universities/campus.schema.json',
  ]) {
    const target = join(workspace, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(join(fixtureSource, file)));
  }
  return workspace;
}

test('dry run shows integration and data files without changing the workspace', () => {
  const workspace = fixture();
  try {
    const before = readFileSync(join(workspace, 'gapwise/universities.json'));
    const result = spawnSync('node', ['bin/gapwise.mjs', 'university', 'create', 'example-university', '--dry-run', '--workspace', workspace],
      { cwd: resolve(import.meta.dirname, '..'), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /No application UI files are created or modified/);
    assert.deepEqual(readFileSync(join(workspace, 'gapwise/universities.json')), before);
    assert.equal(existsSync(join(workspace, 'gapwise/src/universities/example-university')), false);
    assert.equal(existsSync(join(workspace, 'data/universities/example-university')), false);
  } finally { rmSync(workspace, { recursive: true, force: true }); }
});

test('installed bin symlink executes the CLI', () => {
  const workspace = fixture();
  try {
    const installedBin = join(workspace, 'gapwise-bin');
    symlinkSync(resolve(import.meta.dirname, '../bin/gapwise.mjs'), installedBin);
    const result = spawnSync(installedBin, ['university', 'create', 'example-university', '--dry-run', '--workspace', workspace],
      { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Dry run for example-university/);
  } finally { rmSync(workspace, { recursive: true, force: true }); }
});

test('scaffold creates adapter, manifest, test, and empty campus snapshots', () => {
  const workspace = fixture();
  try {
    const plan = universityPlan('sample-university', workspace, ['--name', 'Sample University', '--short-name', 'Sample']);
    assert.equal(plan.length, 11);
    assert.ok(plan.every(([path]) => !path.includes('/src/components/') && !path.includes('/src/routes/')));
    const result = spawnSync('node', ['bin/gapwise.mjs', 'university', 'create', 'sample-university', '--name', 'Sample University', '--short-name', 'Sample', '--workspace', workspace],
      { cwd: resolve(import.meta.dirname, '..'), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const manifest = JSON.parse(readFileSync(join(workspace, 'gapwise/universities.json')));
    assert.equal(manifest.universities.at(-1).name, 'Sample University');
    assert.equal(manifest.universities.at(-1).status, 'scaffold');
    assert.deepEqual(JSON.parse(readFileSync(join(workspace, 'data/universities/sample-university/campus.json'))).entrances, []);
    assert.deepEqual(JSON.parse(readFileSync(join(workspace, 'gapwise/src/data/campuses/sample-university/catalog.json'))).buildings, []);
    assert.match(readFileSync(join(workspace, 'gapwise/src/data/campuses/index.ts'), 'utf8'), /"sample-university": sample_universityCatalogRaw/);
    assert.deepEqual(readdirSync(join(workspace, 'gapwise/src/universities/sample-university')).sort(), ['adapter.test.ts', 'adapter.ts', 'demo-timetable.ts']);
  } finally { rmSync(workspace, { recursive: true, force: true }); }
});

test('rejects unsafe IDs and duplicate registration', () => {
  const workspace = fixture();
  try {
    assert.throws(() => universityPlan('../evil', workspace), /ID/);
    assert.throws(() => universityPlan('carleton', workspace), /already registered/);
    assert.throws(() => universityPlan('tmu', workspace), /already registered/);
  } finally { rmSync(workspace, { recursive: true, force: true }); }
});

test('quoted university names remain valid generated adapter code', () => {
  const workspace = fixture();
  try {
    const plan = universityPlan('saint-johns', workspace, ['--name', "St. John's University"]);
    const adapter = plan.find(([path]) => path.endsWith('/adapter.ts'))[1];
    assert.match(adapter, /throw new Error\("St\. John's University timetable ingestion/);
    assert.throws(() => universityPlan('unsafe', workspace, ['--name', 'Line\nBreak']), /single-line/);
  } finally { rmSync(workspace, { recursive: true, force: true }); }
});

test('university validate detects scaffold state and unknown universities', () => {
  const workspace = fixture();
  try {
    // Unknown university
    const unknown = spawnSync('node', ['bin/gapwise.mjs', 'university', 'validate', 'nonexistent', '--workspace', workspace],
      { cwd: resolve(import.meta.dirname, '..'), encoding: 'utf8' });
    assert.notEqual(unknown.status, 0);
    assert.match(unknown.stderr, /nonexistent is not registered/);

    // Scaffold an unregistered institution
    spawnSync('node', ['bin/gapwise.mjs', 'university', 'create', 'sample-university', '--workspace', workspace],
      { cwd: resolve(import.meta.dirname, '..'), encoding: 'utf8' });

    // Validating unactivated scaffold fails
    const scaffoldCheck = spawnSync('node', ['bin/gapwise.mjs', 'university', 'validate', 'sample-university', '--workspace', workspace],
      { cwd: resolve(import.meta.dirname, '..'), encoding: 'utf8' });
    assert.notEqual(scaffoldCheck.status, 0);
    assert.match(scaffoldCheck.stderr, /still a scaffold/);
  } finally { rmSync(workspace, { recursive: true, force: true }); }
});
