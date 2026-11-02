import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiRequire = createRequire(path.join(root, 'apps/api/package.json'));
const coreRequire = createRequire(path.join(root, 'packages/platform-core/package.json'));

for (const relative of [
  'apps/api/src/index.js',
  'packages/platform-core/src/index.js',
  'scripts/check-production-health.mjs',
]) {
  assert.ok(existsSync(path.join(root, relative)), `missing release file: ${relative}`);
}

const workspaceCore = apiRequire.resolve('@junshi/platform-core');
assert.ok(workspaceCore.includes(`${path.sep}packages${path.sep}platform-core${path.sep}`), `unexpected workspace core: ${workspaceCore}`);

const mysql2 = coreRequire.resolve('mysql2');
assert.ok(mysql2, 'mysql2 could not be resolved from platform-core');
assert.ok(mysql2.includes(`${path.sep}node_modules${path.sep}`), `unexpected mysql2 path: ${mysql2}`);

console.log(JSON.stringify({
  ok: true,
  workspaceCore: path.relative(root, workspaceCore),
  mysql2: path.relative(root, mysql2),
}));