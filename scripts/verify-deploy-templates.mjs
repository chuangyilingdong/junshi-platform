import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const service = await readFile(path.join(root, 'deploy/systemd/junshi-api.service'), 'utf8');
const serviceEnv = await readFile(path.join(root, 'deploy/systemd/production.env.example'), 'utf8');
const nginx = await readFile(path.join(root, 'deploy/nginx/junshi-api-location.conf'), 'utf8');

assert.match(service, /EnvironmentFile=\/etc\/ai-kids-platform\/production\.env/);
assert.match(service, /EnvironmentFile=-\/etc\/junshi-platform\/production\.env/);
assert.match(service, /apps\/api\/src\/index\.js/);
assert.match(service, /NoNewPrivileges=true/);
assert.match(serviceEnv, /JUNSHI_API_MODE=independent/);
assert.match(serviceEnv, /DB_DRIVER=mysql/);
assert.match(serviceEnv, /PORT=8790/);
assert.doesNotMatch(serviceEnv, /PASSWORD\s*=/i);
assert.match(nginx, /location \^~ \/api\/junshi\//);
assert.match(nginx, /proxy_pass http:\/\/127\.0\.0\.1:8790/);
assert.match(nginx, /proxy_buffering off/);
assert.match(nginx, /proxy_read_timeout 300s/);
assert.doesNotMatch(nginx, /location \/api\/\s*\{/);

console.log('Deployment templates passed');