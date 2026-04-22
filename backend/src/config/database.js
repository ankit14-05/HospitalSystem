// src/config/database.js
const sql = require('mssql');
const logger = require('./logger');

const dbConfig = {
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT) || 1433,
  database: process.env.DB_DATABASE || 'HospitalDB',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
    enableArithAbort: true,
    connectTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 30000,
    requestTimeout: parseInt(process.env.DB_REQUEST_TIMEOUT) || 30000,
  },
  pool: {
    max: parseInt(process.env.DB_POOL_MAX) || 10,
    min: parseInt(process.env.DB_POOL_MIN) || 0,
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT) || 30000,
  },
};

let pool = null;

async function getPool() {
  if (pool && pool.connected) return pool;
  pool = await new sql.ConnectionPool(dbConfig).connect();
  pool.on('error', (err) => {
    logger.error('SQL Pool Error:', err);
    pool = null;
  });
  logger.info(`✅ Connected to MS SQL: ${dbConfig.server}/${dbConfig.database}`);
  return pool;
}

async function query(queryStr, params = {}) {
  const p = await getPool();
  const request = p.request();

  for (const [key, { type, value }] of Object.entries(params)) {
    if (value === undefined) continue;

    let t = type;
    let v = value;

    const isTemporal = (
      type === sql.Time     ||
      type === sql.Date     ||
      type === sql.DateTime ||
      type === sql.DateTime2
    );
    
    if (isTemporal && (v === null || v === '')) {
      t = sql.NVarChar(10);
      v = null;
    }

    request.input(key, t, v);
  }

  return request.query(queryStr);
}

async function execute(procedure, params = {}, outputs = {}) {
  const p = await getPool();
  const request = p.request();

  for (const [key, { type, value }] of Object.entries(params)) {
    if (value === undefined) continue;

    let t = type;
    let v = value;

    const isTemporal = (
      type === sql.Time     ||
      type === sql.Date     ||
      type === sql.DateTime ||
      type === sql.DateTime2
    );
    
    if (isTemporal && (v === null || v === '')) {
      t = sql.NVarChar(10);
      v = null;
    }

    request.input(key, t, v);
  }
  for (const [key, type] of Object.entries(outputs)) {
    request.output(key, type);
  }

  return request.execute(procedure);
}

async function withTransaction(fn) {
  const p = await getPool();
  const transaction = new sql.Transaction(p);
  await transaction.begin();
  try {
    const result = await fn(transaction);
    await transaction.commit();
    return result;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function closePool() {
  if (pool) {
    await pool.close();
    pool = null;
    logger.info('SQL pool closed.');
  }
}

module.exports = {
  sql,
  getPool,
  getDb: getPool,
  query,
  execute,
  withTransaction,
  closePool,
};














