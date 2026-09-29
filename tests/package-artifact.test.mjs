import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const pkgPath = resolve(root, 'package.json');
const manifest = JSON.parse(readFileSync(pkgPath, 'utf8'));

test('package.json metadata and bin path adhere to npm 11 normalization standards', () => {
  assert.equal(manifest.name, '@gapwise/cli');
  assert.equal(manifest.publishConfig?.access, 'public');
  assert.equal(manifest.engines?.node, '>=22');

  // npm 11 @npmcli/package-json emits warnings and strips leading './' if present.
  // bin paths must be bare relative paths like "bin/gapwise.mjs".
  assert.equal(
    manifest.bin?.gapwise,
    'bin/gapwise.mjs',
    'bin.gapwise must be "bin/gapwise.mjs" without leading "./"'
  );
  assert.doesNotMatch(
    manifest.bin?.gapwise,
    /^\.\//,
    'bin path must not start with ./'
  );
});

test('CLI executable has valid shebang, LF line endings, and executable mode', () => {
  const binPath = resolve(root, manifest.bin.gapwise);
  const content = readFileSync(binPath, 'utf8');

  assert.ok(content.startsWith('#!/usr/bin/env node\n'), 'CLI entrypoint must start with #!/usr/bin/env node\\n');
  assert.ok(!content.includes('\r\n'), 'CLI entrypoint must use LF line endings, not CRLF');

  const stat = statSync(binPath);
  assert.ok((stat.mode & 0o111) !== 0, 'CLI entrypoint must have executable permission bits set');
});
