import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const apiRoot = path.join(root, 'apps', 'api', 'src');

async function listJavaScriptFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await listJavaScriptFiles(fullPath));
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(fullPath);
  }
  return files;
}

const files = await listJavaScriptFiles(apiRoot);
const dependencies = [];

for (const file of files.sort()) {
  const source = await readFile(file, 'utf8');
  const specifiers = new Set();
  for (const match of source.matchAll(/(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g)) {
    specifiers.add(match[1]);
  }
  for (const specifier of [...specifiers].sort()) {
    const relativeImport = specifier.startsWith('.');
    const resolved = relativeImport
      ? path.resolve(path.dirname(file), specifier)
      : null;
    let exists = true;
    if (relativeImport) {
      try {
        await readdir(resolved).catch(async () => await readFile(resolved));
      } catch {
        exists = false;
      }
    }
    dependencies.push({
      importer: path.relative(root, file).replaceAll('\\', '/'),
      specifier,
      kind: relativeImport ? 'relative' : (specifier.startsWith('node:') ? 'node' : 'package'),
      exists,
      target: resolved ? path.relative(root, resolved).replaceAll('\\', '/') : null,
    });
  }
}

const missing = dependencies.filter((item) => !item.exists);
const report = {
  generatedForDate: '2026-10-27',
  apiRoot: 'apps/api/src',
  fileCount: files.length,
  dependencyCount: dependencies.length,
  missingCount: missing.length,
  missing,
  dependencies,
};
const outputPath = path.join(root, 'docs', 'migration', 'api-dependencies.json');
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Audited ${files.length} API files: ${missing.length} missing relative dependencies`);
for (const item of missing) console.log(`- ${item.importer} -> ${item.specifier}`);