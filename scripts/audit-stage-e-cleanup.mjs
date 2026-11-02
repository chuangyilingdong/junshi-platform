import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.env.JUNSHI_OLD_REPO || 'E:\\学习平台正常');
if (!fs.existsSync(path.join(root, '.git'))) throw new Error(`old repo not found: ${root}`);

function git(args, options = {}) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', ...options }).trim();
}
function tracked(pathspec) {
  const raw = git(['ls-files', '-z', '--', pathspec]);
  return raw ? raw.split('\0').filter(Boolean) : [];
}
function sizeOf(files) {
  return files.reduce((sum, relative) => {
    const full = path.join(root, relative);
    return sum + (fs.existsSync(full) ? fs.statSync(full).size : 0);
  }, 0);
}
const groups = {
  duplicate_client: ['apps/junshi-desktop'],
  old_web_ui: ['apps/website/public/junshi', 'apps/website/public/assets/junshi', 'apps/website/public/douyin-assistant'],
  old_routes: ['apps/server/src/routes/junshi.js', 'apps/server/src/routes/junshiWorkbench.js'],
  old_services: [
    'apps/server/src/services/complianceEngine.js',
    'apps/server/src/services/junshiAvatar.js',
    'apps/server/src/services/junshiChat.js',
    'apps/server/src/services/junshiDouyin.js',
    'apps/server/src/services/junshiDouyinAssistant.js',
    'apps/server/src/services/junshiDouyinLogin.js',
    'apps/server/src/services/junshiTalkingHead.js',
    'apps/server/src/services/junshiWorkbenchContent.js',
    'apps/server/src/services/junshiWorkbenchHosting.js',
    'apps/server/src/services/junshiWorkbenchPackaging.js',
  ],
  python_workers: ['apps/server/src/douyin'],
  reference_data: ['apps/server/data/junshi'],
  deployment_setup: ['deploy/production/setup-junshi-douyin-browser.sh', 'deploy/production/setup-junshi-douyin-runtime.sh'],
};
const result = {
  repo: root,
  branch: git(['branch', '--show-current']),
  head: git(['rev-parse', 'HEAD']),
  dirty: git(['status', '--short']).split(/\r?\n/).filter(Boolean),
  groups: {},
};
for (const [name, pathspecs] of Object.entries(groups)) {
  const files = [...new Set(pathspecs.flatMap((pathspec) => tracked(pathspec)))].sort();
  result.groups[name] = { files: files.length, bytes: sizeOf(files), paths: files };
}
const migrationFiles = tracked('deploy/production/migrate').filter((file) => /(?:^|\/)(?:27|28|29|3\d|4[0-7])-junshi.*\.sql$/i.test(file));
result.groups.migrations = { files: migrationFiles.length, bytes: sizeOf(migrationFiles), paths: migrationFiles };
const scriptFiles = tracked('scripts').filter((file) => /junshi|p150-video-storyboard|p191-junshi|p192-junshi/.test(file));
result.groups.acceptance_scripts = { files: scriptFiles.length, bytes: sizeOf(scriptFiles), paths: scriptFiles };
const integrationFiles = ['apps/server/src/index.js', 'deploy/production/build-production.sh', 'apps/website/scripts/stamp-junshi.mjs', 'package.json', 'pnpm-lock.yaml', '.gitignore', 'THIRD-PARTY-NOTICES.md'];
result.integration_points = integrationFiles.filter((file) => fs.existsSync(path.join(root, file)));
result.total = Object.values(result.groups).reduce((sum, group) => ({ files: sum.files + group.files, bytes: sum.bytes + group.bytes }), { files: 0, bytes: 0 });
console.log(JSON.stringify(result, null, 2));