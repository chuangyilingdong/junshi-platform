process.env.JUNSHI_API_MODE = 'independent';
process.env.DB_DRIVER = 'mysql';
process.env.JUNSHI_MYSQL_HOST ||= '127.0.0.1';

const { startApiServer } = await import('../apps/api/src/index.js');
const { closeDb } = await import('../packages/platform-core/src/database.js');
const server = await startApiServer({ port: 0, host: '127.0.0.1' });
try {
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/health`);
  const payload = await response.json();
  if (!response.ok) throw new Error(`health HTTP ${response.status}`);
  if (payload.mode !== 'independent' || payload.database !== 'mysql') {
    throw new Error(`unexpected health payload: ${JSON.stringify(payload)}`);
  }
  console.log(JSON.stringify({ ok: true, mode: payload.mode, database: payload.database }));
} finally {
  await new Promise((resolve) => server.close(resolve));
  await closeDb();
}