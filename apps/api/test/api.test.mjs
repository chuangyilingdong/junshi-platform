import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createApiServer } from '../src/index.js';
import { resetMockDb, seedMockDb } from '../src/lib.js';

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

test('workbench compliance check returns a safe verdict for normal enrollment copy', async () => {
  const { response, payload } = await request('/api/junshi/workbench/compliance/check', {
    method: 'POST',
    auth: true,
    body: { content: '家长先了解课程安排，再预约一次试听，按孩子的实际情况选择。' },
  });
  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data.verdict.level, 'ok');
  assert.equal(payload.data.pass, true);
  assert.ok(payload.data.rules.name);
});

test('workbench compliance check blocks qualification redlines', async () => {
  const { response, payload } = await request('/api/junshi/workbench/compliance/check', {
    method: 'POST',
    auth: true,
    body: { content: '本机构可以提供考试包过服务，绝对有效。' },
  });
  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data.verdict.level, 'block');
  assert.equal(payload.data.pass, false);
  assert.ok(payload.data.redlines.some((item) => item.field === '教育培训'));
  assert.ok(payload.data.hits.some((item) => item.word === '绝对'));
});

test('workbench compliance check rejects empty content', async () => {
  const { response, payload } = await request('/api/junshi/workbench/compliance/check', {
    method: 'POST',
    auth: true,
    body: { content: '   ' },
  });
  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.equal(payload.error.code, 'VALIDATION_ERROR');
});
test('published work links to a generated package and report insight context', async () => {
  const ownerKey = 'org:org_junshi_mock';
  seedMockDb('junshi_workbench_published_works', [{
    id: 'pub-1', owner_key: ownerKey, account_id: 'default', aweme_id: '7300000000000000001',
    title: '家长先别急着报班', plays: 3200, likes: 61, comments: 7, shares: 4, saves: 18,
    published_at: '2026-11-01T00:00:00.000Z', updated_at: '2026-11-03T01:00:00.000Z',
  }]);
  seedMockDb('junshi_workbench_video_packages', [{
    id: 'pkg-1', owner_key: ownerKey, account_id: 'default', work_id: 'work-1', status: 'ready',
    title: '家长先别急着报班', created_at: '2026-11-02T01:00:00.000Z',
  }]);
  seedMockDb('junshi_workbench_video_works', [{
    id: 'work-1', owner_key: ownerKey, account_id: 'default', plan_id: 'plan-1', title: '家长问得最多的不是价格',
  }]);
  seedMockDb('junshi_workbench_plans', [{
    id: 'plan-1', owner_key: ownerKey, account_id: 'default', title: '先别急着报班',
    hook: '家长第一句问多少钱，不代表只关心价格。', objective: '建立信任',
  }]);
  seedMockDb('junshi_workbench_published_links', []);
  const before = await request('/api/junshi/workbench/reports?accountId=default', { auth: true });
  assert.equal(before.response.status, 200);
  assert.equal(before.payload.data.counts.linked, 0);
  assert.equal(before.payload.data.linkable.length, 1);

  const linked = await request('/api/junshi/workbench/published-works/pub-1/link', {
    method: 'POST', auth: true, body: { packageId: 'pkg-1', accountId: 'default' },
  });
  assert.equal(linked.response.status, 200);
  assert.equal(linked.payload.data.link.planTitle, '先别急着报班');

  const after = await request('/api/junshi/workbench/reports?accountId=default', { auth: true });
  assert.equal(after.response.status, 200);
  assert.equal(after.payload.data.counts.linked, 1);
  assert.equal(after.payload.data.items[0].link.packageId, 'pkg-1');
  assert.equal(after.payload.data.items[0].strategy.hook, '家长第一句问多少钱，不代表只关心价格。');
  assert.equal(after.payload.data.linkable.length, 0);

  const unlinked = await request('/api/junshi/workbench/published-works/pub-1/link?accountId=default', { method: 'DELETE', auth: true });
  assert.equal(unlinked.response.status, 200);
  assert.equal(unlinked.payload.data.unlinked, true);
});

test('transcript metrics endpoint returns recent quality aggregates', async () => {
  seedMockDb('junshi_workbench_transcript_metrics', [
    {
      id: 'm1', owner_key: 'org:org_junshi_mock', account_id: 'default', event_type: 'extraction', mode: 'auto', status: 'succeeded',
      result_source: 'visual', duration_ms: 12000, asr_status: 'empty', asr_duration_ms: 5000,
      visual_status: 'succeeded', visual_duration_ms: 6000, visual_chars: 215, visual_frames: 12,
      result_chars: 215, result_segments: 8, created_at: new Date().toISOString(),
    },
    {
      id: 'm2', owner_key: 'org:org_junshi_mock', account_id: 'default', event_type: 'extraction', mode: 'speech', status: 'failed',
      duration_ms: 8000, asr_status: 'failed', asr_duration_ms: 7000, error_code: 'WORKBENCH_ASR_FAILED', error: 'ASR failed',
      created_at: new Date().toISOString(),
    },
    {
      id: 'm3', owner_key: 'org:org_junshi_mock', account_id: 'default', event_type: 'confirmation', mode: 'auto', status: 'confirmed',
      original_chars: 200, edited_chars: 210, edit_ratio: 0.05, created_at: new Date().toISOString(),
    },
  ]);
  const { response, payload } = await request('/api/junshi/workbench/metrics/transcripts?accountId=default&days=7', { auth: true });
  assert.equal(response.status, 200);
  assert.equal(payload.data.extractions, 2);
  assert.equal(payload.data.successRate, 50);
  assert.equal(payload.data.visual.succeeded, 1);
  assert.equal(payload.data.confirmations.total, 1);
  assert.equal(payload.data.failureReasons[0].code, 'WORKBENCH_ASR_FAILED');
});

test('cutover readiness blocks mock provider and local storage', async () => {
  const { response, payload } = await request('/cutover-ready');
  assert.equal(response.status, 409);
  assert.equal(payload.status, 'blocked');
  assert.ok(payload.blockers.includes('SHARED_STORAGE_NOT_OSS'));
  assert.equal(payload.billing.ready, true);
  assert.ok(payload.blockers.some((item) => item.startsWith('PROVIDER_MOCK_ACTIVE:')));
});
