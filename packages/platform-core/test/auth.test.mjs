import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  normalizeUser,
  readToken,
  resolveAuthWithStore,
  tokenHash,
} from '../src/auth.js';
import { mysqlConfigFromEnv } from '../src/mysql-config.js';

const now = '2026-10-27T12:00:00.000Z';

function fakeStore(overrides = {}) {
  const session = {
    id: 'session_mock',
    token_hash: tokenHash('valid-token'),
    user_id: 'user_mock',
    expires_at: '2026-10-28T12:00:00.000Z',
    superseded_at: null,
    ...overrides.session,
  };
  const user = {
    id: 'user_mock',
    org_id: 'org_mock',
    login: 'org-admin',
    display_name: '机构管理员',
    role: 'ORG_ADMIN',
    permissions: '[]',
    status: 'ACTIVE',
    expires_at: null,
    must_bind_phone: 0,
    ...overrides.user,
  };
  const org = {
    id: 'org_mock',
    name: '测试机构',
    status: 'ACTIVE',
    contract_expires_at: '2027-10-27T00:00:00.000Z',
    ...overrides.org,
  };
  return async (sql, params) => {
    if (sql.includes('FROM sessions')) return params[0] === session.token_hash ? session : null;
    if (sql.includes('FROM users')) return params[0] === user.id ? user : null;
    if (sql.includes('FROM organizations')) return params[0] === org.id ? org : null;
    return null;
  };
}

test('readToken prefers bearer and falls back to platform cookies', () => {
  assert.equal(readToken({ headers: { authorization: 'Bearer bearer-token', cookie: 'platform_token=cookie-token' } }, '/api/junshi/workbench'), 'bearer-token');
  assert.equal(readToken({ headers: { cookie: 'a=1; platform_token=cookie-token' } }, '/api/junshi/workbench'), 'cookie-token');
  assert.equal(readToken({ headers: { cookie: 'platform_token_org=org-token' } }, '/api/junshi/workbench'), 'org-token');
  assert.equal(readToken({ headers: {} }, '/api/junshi/workbench'), null);
});

test('resolveAuthWithStore validates session, user and organization', async () => {
  const req = { headers: { authorization: 'Bearer valid-token' } };
  const result = await resolveAuthWithStore(req, '/api/junshi/workbench', { queryRow: fakeStore(), at: now });
  assert.equal(result.error, null);
  assert.equal(result.auth.user.id, 'user_mock');
  assert.equal(result.auth.user.orgId, 'org_mock');
  assert.equal(result.auth.org.name, '测试机构');
});

test('resolveAuthWithStore rejects superseded, expired, disabled user and expired org', async () => {
  const cases = [
    [{ session: { superseded_at: '2026-10-27T11:00:00.000Z' } }, 'SESSION_SUPERSEDED'],
    [{ session: { expires_at: '2026-10-27T11:00:00.000Z' } }, 'AUTH_EXPIRED'],
    [{ user: { status: 'DISABLED' } }, 'ACCOUNT_DISABLED'],
    [{ org: { contract_expires_at: '2026-10-27T11:00:00.000Z' } }, 'ORG_CONTRACT_EXPIRED'],
  ];
  for (const [overrides, code] of cases) {
    const result = await resolveAuthWithStore(
      { headers: { authorization: 'Bearer valid-token' } },
      '/api/junshi/workbench',
      { queryRow: fakeStore(overrides), at: now },
    );
    assert.equal(result.auth, null);
    assert.equal(result.error.code, code);
  }
});

test('normalizeUser keeps the auth fields used by Junshi routes', () => {
  const user = normalizeUser({
    id: 'u1', org_id: 'o1', login: 'org-admin', display_name: '管理员', role: 'ORG_ADMIN',
    permissions: '["ADMIN_WORKS"]', status: 'ACTIVE', created_at: now, updated_at: now,
  }, { includeAuthMeta: true });
  assert.deepEqual(user.permissions, ['ADMIN_WORKS']);
  assert.equal(user.displayName, '管理员');
  assert.equal(user.orgId, 'o1');
  assert.equal(user.authMeta.deletedAt, null);
});

test('mysqlConfigFromEnv supports shared and Junshi-specific env names', () => {
  const shared = mysqlConfigFromEnv({ MYSQL_HOST: 'db', MYSQL_PORT: '3307', MYSQL_USER: 'u', MYSQL_PASSWORD: 'p', MYSQL_DATABASE: 'd' });
  assert.equal(shared.host, 'db');
  assert.equal(shared.port, 3307);
  assert.equal(shared.database, 'd');
  assert.equal(shared.connectionLimit, 5);

  const junshi = mysqlConfigFromEnv({ JUNSHI_MYSQL_HOST: 'jdb', JUNSHI_MYSQL_PORT: '3308', JUNSHI_MYSQL_DATABASE: 'junshi', JUNSHI_MYSQL_POOL_SIZE: '3', MYSQL_HOST: 'old' });
  assert.equal(junshi.host, 'jdb');
  assert.equal(junshi.port, 3308);
  assert.equal(junshi.database, 'junshi');
  assert.equal(junshi.connectionLimit, 3);
});