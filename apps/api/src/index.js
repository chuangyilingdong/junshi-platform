import { createServer } from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { handleJunshi } from './routes/junshi.js';
import { ApiError, DB_DRIVER, envelope, errors, ping, readBodyBuffer, requestContext, resolveAuth, sendJson, sendNoContent } from './lib.js';
import { JUNSHI_API_MODE, PORT } from './config.js';

const MOCK_ORG_ID = 'org_junshi_mock';
const MOCK_USER_ID = 'usr_junshi_mock_org_admin';

function mockAuthFor(req) {
  if (JUNSHI_API_MODE !== 'mock') return null;
  const authorization = String(req.headers?.authorization || '').trim();
  const explicitMock = String(req.headers?.['x-junshi-mock-auth'] || '').trim() === '1';
  if (!explicitMock && !/^Bearer\s+/i.test(authorization)) return null;
  const token = authorization.replace(/^Bearer\s+/i, '').trim() || 'mock-token';
  return {
    token,
    session: { id: 'sess_junshi_mock', mock: true },
    user: {
      id: MOCK_USER_ID,
      orgId: MOCK_ORG_ID,
      login: 'org-admin',
      displayName: 'Mock 机构管理员',
      role: 'ORG_ADMIN',
      permissions: [],
      status: 'ACTIVE',
    },
    rawUser: { id: MOCK_USER_ID, org_id: MOCK_ORG_ID, login: 'org-admin', role: 'ORG_ADMIN' },
    org: { id: MOCK_ORG_ID, name: 'Junshi Mock 机构' },
  };
}

async function parseRequest(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return { rawBody: Buffer.alloc(0), body: {} };
  const rawBody = await readBodyBuffer(req, Number(process.env.JUNSHI_MAX_BODY_BYTES || 200 * 1024 * 1024));
  const contentType = String(req.headers?.['content-type'] || '').toLowerCase();
  let body = {};
  if (contentType.includes('application/json') && rawBody.length) {
    try {
      body = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw errors.badRequest('JSON 格式错误', 'INVALID_JSON');
    }
  }
  return { rawBody, body };
}

export function createApiServer() {
  return createServer(async (req, res) => {
    try {
      const context = requestContext(req);
      if (context.method === 'OPTIONS') return sendNoContent(res, req);

      if ((context.pathname === '/health' || context.pathname === '/api/junshi/health') && context.method === 'GET') {
        return sendJson(res, 200, {
          status: 'ok',
          service: 'junshi-api',
          mode: JUNSHI_API_MODE,
          database: DB_DRIVER,
          version: '0.1.0',
          baseline: 'bf98fed22be069b1fafd0d0980d48d8608d0c3fa',
          now: new Date().toISOString(),
        }, req);
      }

      if ((context.pathname === '/ready' || context.pathname === '/api/junshi/ready') && context.method === 'GET') {
        const databaseHealth = await ping();
        return sendJson(res, 200, {
          status: 'ready',
          service: 'junshi-api',
          mode: JUNSHI_API_MODE,
          database: DB_DRIVER,
          databaseHealth,
          now: new Date().toISOString(),
        }, req);
      }

      if (!context.pathname.startsWith('/api/junshi')) {
        throw errors.notFound('该路径不属于独立 Junshi API', 'ROUTE_NOT_FOUND');
      }

      const parsed = await parseRequest(req);
      let auth = null;
      let authError = null;
      if (JUNSHI_API_MODE === 'mock') {
        auth = mockAuthFor(req);
      } else {
        const resolved = await resolveAuth(req, context.pathname);
        auth = resolved.auth;
        authError = resolved.error;
      }
      const ctx = {
        ...context,
        req,
        res,
        ...parsed,
        auth,
        authError,
      };
      const result = await handleJunshi(ctx);
      if (result?.__streamed) return;
      if (result === null || result === undefined) throw errors.notFound('Junshi API 路由不存在', 'ROUTE_NOT_FOUND');
      return sendJson(res, 200, envelope(result), req);
    } catch (error) {
      if (res.writableEnded || res.destroyed) return;
      const apiError = error instanceof ApiError ? error : errors.serviceUnavailable(
        String(error?.message || 'Junshi API 内部错误').slice(0, 500),
        String(error?.code || 'INTERNAL_ERROR'),
      );
      return sendJson(res, apiError.status, apiError.toResponse(), req);
    }
  });
}

export async function startApiServer({ port = PORT, host = '127.0.0.1' } = {}) {
  const server = createApiServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  return server;
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  startApiServer().then(() => {
    console.log(`[junshi-api] listening on http://127.0.0.1:${PORT} (${JUNSHI_API_MODE})`);
  }).catch((error) => {
    console.error('[junshi-api] failed to start:', error);
    process.exitCode = 1;
  });
}