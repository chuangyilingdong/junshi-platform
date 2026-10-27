import { randomUUID } from 'node:crypto';
import { CORS_ALLOWED_ORIGINS } from './config.js';

export function nowIso() {
  return new Date().toISOString();
}

export function id(prefix) {
  return `${String(prefix || 'id').replace(/[^A-Za-z0-9_-]/g, '')}_${randomUUID().replaceAll('-', '').slice(0, 20)}`;
}

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message || code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  toResponse() {
    const error = { code: this.code, message: this.message };
    if (this.details !== undefined) error.details = this.details;
    return { success: false, ok: false, error };
  }
}

export const errors = {
  unauthorized: (message = '登录状态无效', code = 'SESSION_INVALID', details) => new ApiError(401, code, message, details),
  tooMany: (message = '请求过于频繁，请稍后再试', code = 'RATE_LIMITED', details) => new ApiError(429, code, message, details),
  forbidden: (message = '无权访问', code = 'FORBIDDEN', details) => new ApiError(403, code, message, details),
  notFound: (message = '资源不存在', code = 'NOT_FOUND', details) => new ApiError(404, code, message, details),
  badRequest: (message = '请求参数错误', code = 'VALIDATION_ERROR', details) => new ApiError(400, code, message, details),
  conflict: (message = '资源状态冲突', code = 'CONFLICT', details) => new ApiError(409, code, message, details),
  serviceUnavailable: (message = '服务暂不可用', code = 'SERVICE_UNAVAILABLE', details) => new ApiError(503, code, message, details),
};

export function envelope(data) {
  return { success: true, ok: true, data: data ?? null };
}

export function requestContext(req) {
  const url = new URL(req.url || '/', 'http://local');
  return {
    pathname: url.pathname.replace(/\/+$/, '') || '/',
    search: url.searchParams,
    method: String(req.method || 'GET').toUpperCase(),
  };
}

export function securityHeaders(extra = {}) {
  return {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
    ...extra,
  };
}

export function corsHeaders(req, extra = {}) {
  const origin = String(req?.headers?.origin || '').trim();
  const allowed = !origin || CORS_ALLOWED_ORIGINS.includes(origin);
  return {
    ...securityHeaders(),
    'access-control-allow-headers': 'content-type,authorization,x-requested-with,x-junshi-mock-auth',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-max-age': '600',
    vary: 'Origin',
    ...(origin && allowed ? { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true' } : {}),
    ...extra,
  };
}

export function sendJson(res, status, payload, req, extraHeaders = {}) {
  const text = JSON.stringify(payload);
  res.writeHead(status, corsHeaders(req, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    'cache-control': 'no-store',
    ...extraHeaders,
  }));
  res.end(text);
}

export function sendNoContent(res, req, extraHeaders = {}) {
  res.writeHead(204, corsHeaders(req, extraHeaders));
  res.end();
}

export async function readBodyBuffer(req, limit = 2 * 1024 * 1024) {
  const maxBytes = Number(limit);
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) throw errors.badRequest('请求体过大', 'PAYLOAD_TOO_LARGE');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

export async function readJson(req, limit = 2 * 1024 * 1024) {
  const buffer = await readBodyBuffer(req, limit);
  if (!buffer.length) return {};
  const text = buffer.toString('utf8').trim();
  if (!text) return {};
  try {
    const value = JSON.parse(text);
    if (value === null || Array.isArray(value) || typeof value !== 'object') {
      throw errors.badRequest('请求体必须为 JSON 对象', 'INVALID_JSON');
    }
    return value;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw errors.badRequest('JSON 格式错误', 'INVALID_JSON');
  }
}