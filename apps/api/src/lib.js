export {
  nowIso,
  id,
  ApiError,
  errors,
  envelope,
  requestContext,
  corsHeaders,
  sendJson,
  sendNoContent,
  readBodyBuffer,
  readJson,
} from '../../../packages/platform-core/src/http.js';
export { aq, arow, arows, resetMockDb, seedMockDb } from '../../../packages/platform-core/src/mock-db.js';
import { errors } from '../../../packages/platform-core/src/http.js';

export function requireAuth(ctx) {
  if (ctx?.auth) return ctx.auth;
  throw ctx?.authError || errors.unauthorized();
}

export function requireRole(ctx, roles) {
  const auth = requireAuth(ctx);
  if (!roles.includes(auth.user?.role)) throw errors.forbidden('当前角色无权访问该资源');
  return auth;
}