import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const temp = mkdtempSync(join(tmpdir(), 'gapwise-cli-package-'));
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 1024 * 1024 });
  assert.equal(result.status, 0, `${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  return result;
}

try {
  // 1. Manifest structure & bin configuration
  assert.equal(manifest.name, '@gapwise/cli');
  assert.equal(manifest.publishConfig?.access, 'public');
  assert.equal(
    manifest.bin?.gapwise,
    'bin/gapwise.mjs',
    'bin.gapwise must be bare relative path "bin/gapwise.mjs" (no leading ./) to avoid npm normalization warnings'
  );

  // 2. Shebang, LF line endings, and file permissions
  const binContent = readFileSync(join(root, manifest.bin.gapwise), 'utf8');
  assert.ok(binContent.startsWith('#!/usr/bin/env node\n'), 'CLI entrypoint must start with #!/usr/bin/env node\\n');
  assert.ok(!binContent.includes('\r\n'), 'CLI entrypoint must use LF line endings');
  assert.ok(statSync(join(root, manifest.bin.gapwise)).mode & 0o111, 'CLI entrypoint must be executable');

  // 3. Dry-run publish must emit zero normalization warnings
  const dryRun = spawnSync('npm', ['publish', '--dry-run'], { cwd: root, encoding: 'utf8' });
  assert.equal(dryRun.status, 0, `npm publish --dry-run failed:\n${dryRun.stdout}\n${dryRun.stderr}`);
  assert.ok(
    !dryRun.stderr.includes('npm auto-corrected') && !dryRun.stderr.includes('was invalid and removed'),
    `npm publish emitted bin normalization warning:\n${dryRun.stderr}`
  );

  // 4. Pack tarball and verify contents & metadata
  const packResult = run('npm', ['pack', '--json', '--pack-destination', temp]);
  const [packed] = JSON.parse(packResult.stdout);
  assert.ok(packed.size < 100_000, `Package exceeds 100 KB: ${packed.size}`);
  const paths = packed.files.map(({ path }) => path).sort();
  assert.deepEqual(paths, ['LICENSE', 'README.md', 'bin/gapwise.mjs', 'bin/public-api.mjs', 'package.json']);

  const tarballPath = join(temp, packed.filename);
  const tarListing = run('tar', ['-tvzf', tarballPath]).stdout;
  assert.match(tarListing, /-rwxr-xr-x\s+[^\n]*package\/bin\/gapwise\.mjs/);

  // Verify packed package.json bin property
  const packedPkgJson = JSON.parse(run('tar', ['-xOf', tarballPath, 'package/package.json']).stdout);
  assert.equal(packedPkgJson.bin?.gapwise, 'bin/gapwise.mjs');

  // 5. Global installation test (prefix in isolated temp)
  const globalPrefix = join(temp, 'global');
  run('npm', ['install', '--global', '--prefix', globalPrefix, '--ignore-scripts', '--no-audit', '--no-fund', tarballPath]);
  const globalBinary = join(globalPrefix, 'bin/gapwise');
  assert.equal(run(globalBinary, ['--version']).stdout.trim(), manifest.version);
  assert.match(run(globalBinary, ['--help']).stdout, /gapwise universities/);

  // 6. Local consumer installation test in isolated project
  const consumerDir = join(temp, 'consumer');
  mkdirSync(consumerDir, { recursive: true });
  writeFileSync(join(consumerDir, 'package.json'), JSON.stringify({ name: 'consumer-test', private: true }));
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarballPath], consumerDir);
  const localBinary = join(consumerDir, 'node_modules/.bin/gapwise');
  assert.equal(run(localBinary, ['--version'], consumerDir).stdout.trim(), manifest.version);
  assert.equal(run('npx', ['gapwise', '--version'], consumerDir).stdout.trim(), manifest.version);

  // 7. npx --package execution from an isolated directory
  const npxTestDir = join(temp, 'npx-test');
  mkdirSync(npxTestDir, { recursive: true });
  const npxRun = run('npx', ['--yes', '--package', tarballPath, 'gapwise', '--version'], npxTestDir);
  assert.equal(npxRun.stdout.trim(), manifest.version);
  assert.ok(!npxRun.stderr.includes('not found'), `npx stderr contained "not found": ${npxRun.stderr}`);

  console.log(`Verified ${manifest.name}@${manifest.version}: ${packed.size} bytes, ${paths.length} files, zero npm warnings, clean global & npx execution.`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
