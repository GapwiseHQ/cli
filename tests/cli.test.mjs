import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { universityPlan } from '../bin/gapwise.mjs';

const realWorkspace = resolve(import.meta.dirname, '../..');
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
    writeFileSync(target, readFileSync(join(realWorkspace, file)));
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

test('scaffold creates adapter, manifest, test, and empty campus snapshots', () => {
  const workspace = fixture();
  try {
    const plan = universityPlan('mcmaster', workspace, ['--name', 'McMaster University', '--short-name', 'McMaster']);
    assert.equal(plan.length, 11);
    assert.ok(plan.every(([path]) => !path.includes('/src/components/') && !path.includes('/src/routes/')));
    const result = spawnSync('node', ['bin/gapwise.mjs', 'university', 'create', 'mcmaster', '--name', 'McMaster University', '--short-name', 'McMaster', '--workspace', workspace],
      { cwd: resolve(import.meta.dirname, '..'), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const manifest = JSON.parse(readFileSync(join(workspace, 'gapwise/universities.json')));
    assert.equal(manifest.universities.at(-1).name, 'McMaster University');
    assert.equal(manifest.universities.at(-1).status, 'scaffold');
    assert.deepEqual(JSON.parse(readFileSync(join(workspace, 'data/universities/mcmaster/campus.json'))).entrances, []);
    assert.deepEqual(JSON.parse(readFileSync(join(workspace, 'gapwise/src/data/campuses/mcmaster/catalog.json'))).buildings, []);
    assert.match(readFileSync(join(workspace, 'gapwise/src/data/campuses/index.ts'), 'utf8'), /"mcmaster": mcmasterCatalogRaw/);
    assert.deepEqual(readdirSync(join(workspace, 'gapwise/src/universities/mcmaster')).sort(), ['adapter.test.ts', 'adapter.ts', 'demo-timetable.ts']);
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

test('university validate detects scaffold state and unknown universities', () => {
  const workspace = fixture();
  try {
    // Unknown university
    const unknown = spawnSync('node', ['bin/gapwise.mjs', 'university', 'validate', 'nonexistent', '--workspace', workspace],
      { cwd: resolve(import.meta.dirname, '..'), encoding: 'utf8' });
    assert.notEqual(unknown.status, 0);
    assert.match(unknown.stderr, /nonexistent is not registered/);

    // Scaffold mcmaster
    spawnSync('node', ['bin/gapwise.mjs', 'university', 'create', 'mcmaster', '--workspace', workspace],
      { cwd: resolve(import.meta.dirname, '..'), encoding: 'utf8' });

    // Validating unactivated scaffold fails
    const scaffoldCheck = spawnSync('node', ['bin/gapwise.mjs', 'university', 'validate', 'mcmaster', '--workspace', workspace],
      { cwd: resolve(import.meta.dirname, '..'), encoding: 'utf8' });
    assert.notEqual(scaffoldCheck.status, 0);
    assert.match(scaffoldCheck.stderr, /still a scaffold/);
  } finally { rmSync(workspace, { recursive: true, force: true }); }
});

