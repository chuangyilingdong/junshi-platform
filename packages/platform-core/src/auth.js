import { createHash } from 'node:crypto';
import { errors, nowIso } from './http.js';
import { arow } from './database.js';

const LEGACY_COOKIE_NAME = 'platform_token';
const SCOPED_COOKIE_NAMES = { admin: 'platform_token_admin', org: 'platform_token_org' };
const SCOPED_COOKIE_PATHS = { admin: '/api/admin', org: '/api/org' };

export function tokenHash(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

function cookieNameForPath(pathname) {
  const value = String(pathname || '');
  for (const [clientType, prefix] of Object.entries(SCOPED_COOKIE_PATHS)) {
    if (value === prefix || value.startsWith(`${prefix}/`)) return SCOPED_COOKIE_NAMES[clientType];
  }
  return LEGACY_COOKIE_NAME;
}

export function readCookieValue(req, name) {
  const part = String(req?.headers?.cookie || '')
    .split(/;\s*/)
    .find((item) => item.startsWith(`${name}=`));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : null;
}

export function readToken(req, pathname = '') {
  const authorization = String(req?.headers?.authorization || '').trim();
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (bearer) return bearer;
  return readCookieValue(req, cookieNameForPath(pathname))
    || readCookieValue(req, LEGACY_COOKIE_NAME)
    || readCookieValue(req, SCOPED_COOKIE_NAMES.admin)
    || readCookieValue(req, SCOPED_COOKIE_NAMES.org);
}

function parsePermissions(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function normalizeUser(user, { includeAuthMeta = false } = {}) {
  if (!user) return null;
  const result = {
    id: user.id,
    orgId: user.org_id || null,
    login: user.login,
    displayName: user.display_name,
    role: user.role,
    permissions: parsePermissions(user.permissions),
    phone: user.phone || null,
    phoneVerifiedAt: user.phone_verified_at || null,
    mustBindPhone: Boolean(user.must_bind_phone),
    status: user.status,
    expiresAt: user.expires_at || null,
    studentUsageScope: user.student_usage_scope || null,
    billingPackageId: user.billing_package_id || null,
    avatarKey: user.avatar_key || null,
    homeToken: user.home_token || null,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
  if (includeAuthMeta) result.authMeta = { deletedAt: user.deleted_at || null };
  return result;
}

export function assertUserAccountAvailable(user, org = null, at = nowIso()) {
  if (!user || user.deleted_at) throw errors.unauthorized('账号不存在或已删除', 'SESSION_INVALID');
  if (user.status !== 'ACTIVE') throw errors.unauthorized('账号已停用', 'ACCOUNT_DISABLED');
  if (user.expires_at && user.expires_at <= at) throw errors.unauthorized('账号已过期', 'ACCOUNT_EXPIRED');
  if (user.must_bind_phone && !user.phone_verified_at) throw errors.unauthorized('请先绑定手机号', 'PHONE_NOT_BOUND');
  if (!org) return;
  if (org.status === 'FROZEN') throw errors.unauthorized('机构当前已冻结', 'ORG_FROZEN');
  if (org.status === 'DISABLED') throw errors.unauthorized('机构当前已停用', 'ORG_DISABLED');
  if (org.status === 'EXPIRED' || (org.contract_expires_at && org.contract_expires_at <= at)) {
    throw errors.unauthorized('机构合同已到期', 'ORG_CONTRACT_EXPIRED');
  }
}

export async function resolveAuthWithStore(req, pathname = '', { queryRow = arow, at = nowIso() } = {}) {
  const token = readToken(req, pathname);
  if (!token) return { auth: null, error: null };
  const session = await queryRow('SELECT * FROM sessions WHERE token_hash = ?', [tokenHash(token)]);
  if (!session) return { auth: null, error: errors.unauthorized('登录状态无效', 'SESSION_INVALID') };
  if (session.superseded_at) return { auth: null, error: errors.unauthorized('当前账号已在其他设备登录', 'SESSION_SUPERSEDED') };
  if (session.expires_at <= at) return { auth: null, error: errors.unauthorized('登录状态已过期', 'AUTH_EXPIRED') };
  const user = await queryRow('SELECT * FROM users WHERE id = ?', [session.user_id]);
  const org = user?.org_id ? await queryRow('SELECT * FROM organizations WHERE id = ?', [user.org_id]) : null;
  try {
    assertUserAccountAvailable(user, org, at);
  } catch (error) {
    return { auth: null, error };
  }
  return {
    auth: {
      token,
      session,
      user: normalizeUser(user, { includeAuthMeta: true }),
      rawUser: user,
      org,
    },
    error: null,
  };
}

export async function resolveAuth(req, pathname = '') {
  return resolveAuthWithStore(req, pathname);
}

export async function getAuth(req, pathname = '') {
  return (await resolveAuth(req, pathname)).auth;
}