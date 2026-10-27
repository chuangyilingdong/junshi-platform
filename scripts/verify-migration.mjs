import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const manifestPath = path.join(root, 'docs', 'migration', 'baseline-manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

const failures = [];
for (const entry of manifest.entries) {
  const target = path.join(root, entry.target);
  try {
    await stat(target);
    const digest = createHash('sha256').update(await readFile(target)).digest('hex');
    if (digest !== entry.sha256) {
      failures.push(`${entry.target}: hash mismatch`);
    }
  } catch {
    failures.push(`${entry.target}: missing`);
  }
}

if (failures.length) {
  console.error(`Migration verification failed (${failures.length}/${manifest.entries.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Migration verification passed (${manifest.entries.length} files)`);
}