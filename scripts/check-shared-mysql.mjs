process.env.DB_DRIVER = 'mysql';
const { arow, closeDb, dbConfig, ping } = await import('../packages/platform-core/src/database.js');

try {
  const health = await ping();
  const sessions = await arow('SELECT COUNT(*) AS n FROM sessions');
  const orgAdmins = await arow("SELECT COUNT(*) AS n FROM users WHERE role='ORG_ADMIN' AND deleted_at IS NULL");
  const organizations = await arow('SELECT COUNT(*) AS n FROM organizations');
  const junshiTables = await arow(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema=? AND table_name LIKE 'junshi_%'",
    [dbConfig.database],
  );
  console.log(JSON.stringify({
    ok: health.ok,
    driver: health.driver,
    database: health.database,
    host: dbConfig.host,
    port: dbConfig.port,
    sessions: Number(sessions?.n || 0),
    orgAdmins: Number(orgAdmins?.n || 0),
    organizations: Number(organizations?.n || 0),
    junshiTables: Number(junshiTables?.n || 0),
  }, null, 2));
} finally {
  await closeDb();
}