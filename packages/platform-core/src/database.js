import { JUNSHI_API_MODE } from './config.js';

const configured = String(process.env.DB_DRIVER || '').trim().toLowerCase();
export const DB_DRIVER = configured || (JUNSHI_API_MODE === 'mock' ? 'mock' : 'mysql');
if (!['mock', 'mysql'].includes(DB_DRIVER)) throw new Error(`不支持的 DB_DRIVER: ${DB_DRIVER}`);

const impl = DB_DRIVER === 'mysql' ? await import('./mysql.js') : await import('./mock-db.js');

export const aq = impl.aq;
export const arow = impl.arow;
export const arows = impl.arows;
export const ping = impl.ping || (async () => ({ ok: true, driver: DB_DRIVER }));
export const closeDb = impl.closeDb || impl.closePool || (async () => {});
export const dbConfig = impl.dbConfig || { driver: DB_DRIVER };

export async function resetMockDb() {
  if (DB_DRIVER !== 'mock') throw new Error(`resetMockDb() 仅用于 mock 驱动，当前为 ${DB_DRIVER}`);
  return impl.resetMockDb();
}

export async function seedMockDb(name, rows) {
  if (DB_DRIVER !== 'mock') throw new Error(`seedMockDb() 仅用于 mock 驱动，当前为 ${DB_DRIVER}`);
  return impl.seedMockDb(name, rows);
}