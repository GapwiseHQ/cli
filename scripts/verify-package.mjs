import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const temp = mkdtempSync(join(tmpdir(), 'gapwise-cli-package-'));
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 1024 * 1024 });
  assert.equal(result.status, 0, `${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

try {
  assert.equal(manifest.name, '@gapwise/cli');
  assert.equal(manifest.publishConfig.access, 'public');
  assert.ok(readFileSync(join(root, manifest.bin.gapwise), 'utf8').startsWith('#!/usr/bin/env node\n'));
  assert.ok(statSync(join(root, manifest.bin.gapwise)).mode & 0o111, 'CLI entrypoint must be executable');

  const [packed] = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', temp]));
  assert.ok(packed.size < 100_000, `Package exceeds 100 KB: ${packed.size}`);
  const paths = packed.files.map(({ path }) => path).sort();
  assert.deepEqual(paths, ['LICENSE', 'README.md', 'bin/gapwise.mjs', 'bin/public-api.mjs', 'package.json']);
  const tarListing = run('tar', ['-tvzf', join(temp, packed.filename)]);
  assert.match(tarListing, /-rwxr-xr-x\s+[^\n]*package\/bin\/gapwise\.mjs/);

  run('npm', ['install', '--global', '--prefix', temp, '--ignore-scripts', '--no-audit', '--no-fund', join(temp, packed.filename)]);
  const binary = join(temp, 'bin/gapwise');
  assert.equal(run(binary, ['--version']).trim(), manifest.version);
  assert.match(run(binary, ['--help']), /gapwise universities/);
  console.log(`Verified ${manifest.name}@${manifest.version}: ${packed.size} bytes, ${paths.length} files, clean global install and executable.`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
