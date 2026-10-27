function numberFrom(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function mysqlConfigFromEnv(env = process.env) {
  return {
    host: env.JUNSHI_MYSQL_HOST || env.MYSQL_HOST || env.RDS_HOST || '127.0.0.1',
    port: numberFrom(env.JUNSHI_MYSQL_PORT || env.MYSQL_PORT || env.RDS_PORT, 3306),
    user: env.JUNSHI_MYSQL_USER || env.MYSQL_USER || env.RDS_USER || 'root',
    password: env.JUNSHI_MYSQL_PASSWORD || env.MYSQL_PASSWORD || env.RDS_PASSWORD || '',
    database: env.JUNSHI_MYSQL_DATABASE || env.MYSQL_DATABASE || env.RDS_DATABASE || 'aild_admin',
    charset: env.MYSQL_CHARSET || 'utf8mb4_general_ci',
    waitForConnections: true,
    connectionLimit: numberFrom(env.JUNSHI_MYSQL_POOL_SIZE || env.MYSQL_POOL_SIZE, 5),
    queueLimit: 0,
    idleTimeout: numberFrom(env.MYSQL_IDLE_TIMEOUT, 30000),
    decimalNumbers: true,
    dateStrings: true,
    multipleStatements: false,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
  };
}