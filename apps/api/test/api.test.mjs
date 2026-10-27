import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createApiServer } from '../src/index.js';
import { resetMockDb } from '../src/lib.js';

let server;
let baseUrl;

before(async () => {
  server = createApiServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

beforeEach(() => {
  resetMockDb();
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function request(pathname, { method = 'GET', auth = false, body } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(auth ? { 'x-junshi-mock-auth': '1' } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

test('health reports mock mode and migration baseline', async () => {
  const { response, payload } = await request('/health');
  assert.equal(response.status, 200);
  assert.equal(payload.status, 'ok');
  assert.equal(payload.service, 'junshi-api');
  assert.equal(payload.mode, 'mock');
  assert.equal(payload.baseline, 'bf98fed22be069b1fafd0d0980d48d8608d0c3fa');
});

test('ready performs the database health check', async () => {
  const { response, payload } = await request('/ready');
  assert.equal(response.status, 200);
  assert.equal(payload.status, 'ready');
  assert.equal(payload.database, 'mock');
  assert.equal(payload.databaseHealth.ok, true);
});

test('protected workbench routes reject missing mock auth', async () => {
  const { response, payload } = await request('/api/junshi/workbench/bootstrap');
  assert.equal(response.status, 401);
  assert.equal(payload.success, false);
  assert.equal(payload.error.code, 'SESSION_INVALID');
});

test('workbench bootstrap returns an empty isolated account', async () => {
  const { response, payload } = await request('/api/junshi/workbench/bootstrap', { auth: true });
  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data.signedIn, true);
  assert.equal(payload.data.accounts[0].id, 'default');
  assert.deepEqual(payload.data.stats, {
    messages: 0,
    copy_drafts: 0,
    videos: 0,
    assets: 0,
    references: 0,
    jobs: 0,
  });
});

test('overview loads bundled junshi reference data', async () => {
  const { response, payload } = await request('/api/junshi/overview', { auth: true });
  assert.equal(response.status, 200);
  assert.equal(payload.data.signedIn, true);
  assert.equal(payload.data.orgName, 'Junshi Mock 机构');
  assert.ok(payload.data.stats.library > 0);
  assert.ok(payload.data.stats.objections > 0);
  assert.ok(payload.data.stats.complianceWords > 0);
});

test('accounts and profile persist in the mock database', async () => {
  const created = await request('/api/junshi/workbench/accounts', {
    method: 'POST',
    auth: true,
    body: { name: 'Mock 抖音号', platform: '抖音', note: '独立 API 验收' },
  });
  assert.equal(created.response.status, 200);
  assert.equal(created.payload.data.account.name, 'Mock 抖音号');

  const accounts = await request('/api/junshi/workbench/accounts', { auth: true });
  assert.equal(accounts.response.status, 200);
  assert.ok(accounts.payload.data.accounts.some((item) => item.name === 'Mock 抖音号'));

  const profile = await request('/api/junshi/workbench/profile', {
    method: 'PUT',
    auth: true,
    body: { profile: { name: '招生测试号', platform: '抖音', product: '少儿美术' } },
  });
  assert.equal(profile.response.status, 200);
  assert.equal(profile.payload.data.profile.name, '招生测试号');

  const loaded = await request('/api/junshi/workbench/profile', { auth: true });
  assert.equal(loaded.response.status, 200);
  assert.equal(loaded.payload.data.profile.product, '少儿美术');
});
test('chat stream completes through the local mock provider', async () => {
  const response = await fetch(`${baseUrl}/api/junshi/workbench/chat/stream`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-junshi-mock-auth': '1' },
    body: JSON.stringify({ message: '你好，介绍一下当前链路' }),
  });
  assert.equal(response.status, 200);
  assert.match(String(response.headers.get('content-type')), /text\/event-stream/);
  const text = await response.text();
  assert.match(text, /event: start/);
  assert.match(text, /event: done/);
  assert.match(text, /"provider":"demo"/);

  const history = await request('/api/junshi/workbench/chat', { auth: true });
  assert.equal(history.response.status, 200);
  assert.equal(history.payload.data.messages.length, 2);
  assert.equal(history.payload.data.messages[0].role, 'user');
  assert.equal(history.payload.data.messages[1].role, 'assistant');
});
test('cutover readiness blocks mock provider and local storage', async () => {
  const { response, payload } = await request('/cutover-ready');
  assert.equal(response.status, 409);
  assert.equal(payload.status, 'blocked');
  assert.ok(payload.blockers.includes('SHARED_STORAGE_NOT_OSS'));
  assert.equal(payload.billing.ready, true);
  assert.ok(payload.blockers.some((item) => item.startsWith('PROVIDER_MOCK_ACTIVE:')));
});