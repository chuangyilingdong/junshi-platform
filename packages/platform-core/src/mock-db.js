const tables = new Map();

function getTable(name) {
  if (!tables.has(name)) tables.set(name, []);
  return tables.get(name);
}

function tableName(sql) {
  return String(sql || '').match(/\bFROM\s+([A-Za-z0-9_]+)/i)?.[1]
    || String(sql || '').match(/\bINTO\s+([A-Za-z0-9_]+)/i)?.[1]
    || String(sql || '').match(/\bUPDATE\s+([A-Za-z0-9_]+)/i)?.[1]
    || null;
}

function whereText(sql) {
  const match = String(sql || '').match(/\bWHERE\b([\s\S]*?)(?:\bORDER\s+BY\b|\bLIMIT\b|$)/i);
  return match?.[1]?.trim() || '';
}

function matchesWhere(row, sql, params) {
  const where = whereText(sql);
  if (!where) return true;
  let parameterIndex = 0;
  for (const clause of where.split(/\s+AND\s+/i)) {
    const normalized = clause.trim().replace(/^\(|\)$/g, '').trim();
    const nullMatch = normalized.match(/^([A-Za-z0-9_.]+)\s+IS\s+(NOT\s+)?NULL$/i);
    if (nullMatch) {
      const value = row[nullMatch[1]];
      const shouldBeNull = !nullMatch[2];
      if ((value == null) !== shouldBeNull) return false;
      continue;
    }
    const inMatch = normalized.match(/^([A-Za-z0-9_.]+)\s+IN\s*\(([^)]*)\)$/i);
    if (inMatch) {
      const count = inMatch[2].split(',').filter((item) => item.trim() === '?').length;
      const values = params.slice(parameterIndex, parameterIndex + count);
      parameterIndex += count;
      if (!values.includes(row[inMatch[1]])) return false;
      continue;
    }
    const eqMatch = normalized.match(/^([A-Za-z0-9_.]+)\s*=\s*(\?|'[^']*'|"[^"]*"|\d+)$/);
    if (!eqMatch) continue;
    let expected = eqMatch[2];
    if (expected === '?') expected = params[parameterIndex++];
    else if (/^['"]/.test(expected)) expected = expected.slice(1, -1);
    else expected = Number(expected);
    if (row[eqMatch[1]] !== expected) return false;
  }
  return true;
}

function orderAndLimit(rows, sql) {
  let result = [...rows];
  const order = String(sql || '').match(/\bORDER\s+BY\s+([A-Za-z0-9_]+)(?:\s+(ASC|DESC))?/i);
  if (order) {
    const key = order[1];
    const direction = String(order[2] || 'ASC').toUpperCase() === 'DESC' ? -1 : 1;
    result.sort((a, b) => String(a[key] ?? '').localeCompare(String(b[key] ?? '')) * direction);
  }
  const limit = String(sql || '').match(/\bLIMIT\s+(\d+)/i);
  if (limit) result = result.slice(0, Number(limit[1]));
  return result;
}

export async function arows(sql, params = []) {
  const normalized = String(sql || '').trim();
  if (/^SELECT\s+COUNT\s*\(/i.test(normalized)) {
    const name = tableName(normalized);
    const rows = name ? getTable(name).filter((row) => matchesWhere(row, normalized, params)) : [];
    return [{ n: rows.length }];
  }
  const name = tableName(normalized);
  if (!name || !/^SELECT\b/i.test(normalized)) return [];
  return orderAndLimit(getTable(name).filter((row) => matchesWhere(row, normalized, params)), normalized);
}

export async function arow(sql, params = []) {
  return (await arows(sql, params))[0] || null;
}

export async function aq(sql, params = []) {
  const normalized = String(sql || '').trim();
  const name = tableName(normalized);
  if (!name) return { affectedRows: 0 };
  if (/^INSERT\b/i.test(normalized)) {
    const match = normalized.match(/\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
    if (!match) return { affectedRows: 0 };
    const columns = match[1].split(',').map((item) => item.trim());
    const row = {};
    columns.forEach((column, index) => { row[column] = params[index] ?? null; });
    getTable(name).push(row);
    return { affectedRows: 1, insertId: row.id || null };
  }
  if (/^UPDATE\b/i.test(normalized)) {
    const rows = getTable(name).filter((row) => matchesWhere(row, normalized, params));
    return { affectedRows: rows.length };
  }
  if (/^DELETE\b/i.test(normalized)) {
    const rows = getTable(name);
    const kept = rows.filter((row) => !matchesWhere(row, normalized, params));
    tables.set(name, kept);
    return { affectedRows: rows.length - kept.length };
  }
  return { affectedRows: 0 };
}

export function resetMockDb() {
  tables.clear();
}

export function seedMockDb(name, rows = []) {
  tables.set(name, rows.map((row) => ({ ...row })));
}