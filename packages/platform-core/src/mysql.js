import mysql from 'mysql2/promise';

import { mysqlConfigFromEnv } from './mysql-config.js';

export { mysqlConfigFromEnv };
export const dbConfig = mysqlConfigFromEnv();
export const pool = mysql.createPool(dbConfig);

function translateSqlite(sql) {
  let out = String(sql || '');
  out = out.replace(/\s+NULLS\s+(?:LAST|FIRST)/gi, '');
  out = out.replace(/\s+COLLATE\s+NOCASE/gi, '');
  out = out.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT IGNORE INTO');
  out = out.replace(/INSERT\s+OR\s+REPLACE\s+INTO/gi, 'REPLACE INTO');
  out = out.replace(/datetime\s*\(\s*'now'\s*\)/gi, 'UTC_TIMESTAMP()');
  out = out.replace(/date\s*\(\s*'now'\s*\)/gi, 'UTC_DATE()');
  out = out.replace(/\bIS\s+\?/gi, '<=> ?');
  return out;
}

async function execute(sql, params = []) {
  const translated = translateSqlite(sql);
  try {
    const [result] = await pool.execute(translated, params);
    return result;
  } catch (error) {
    if (error?.code === 'ER_UNSUPPORTED_PS' || error?.code === 'ER_PARSE_ERROR') {
      const [result] = await pool.query(translated, params);
      return result;
    }
    const wrapped = new Error(`[数据访问/MySQL] ${error?.code || ''} ${error?.message || error}`);
    wrapped.code = error?.code;
    wrapped.sqlState = error?.sqlState;
    wrapped.cause = error;
    throw wrapped;
  }
}

export async function aq(sql, params = []) {
  const result = await execute(sql, params);
  return {
    changes: Number(result?.affectedRows ?? 0),
    affectedRows: Number(result?.affectedRows ?? 0),
    lastInsertRowid: Number(result?.insertId ?? 0),
    insertId: Number(result?.insertId ?? 0),
  };
}

export async function arows(sql, params = []) {
  const result = await execute(sql, params);
  return Array.isArray(result) ? result.map((row) => ({ ...row })) : [];
}

export async function arow(sql, params = []) {
  return (await arows(sql, params))[0] || null;
}

export async function rawExec(sql, params = []) {
  return execute(sql, params);
}

export async function ping() {
  await pool.query('SELECT 1');
  return { ok: true, driver: 'mysql', database: dbConfig.database };
}

export async function closePool() {
  await pool.end();
}

export { translateSqlite };