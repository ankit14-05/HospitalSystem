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
    // Increased from 30s → 60s to accommodate the remote server latency
    connectTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 60000,
    requestTimeout: parseInt(process.env.DB_REQUEST_TIMEOUT) || 60000,
  },
  pool: {
    max: parseInt(process.env.DB_POOL_MAX) || 15,
    min: parseInt(process.env.DB_POOL_MIN) || 2,  // Keep 2 warm connections alive
    // How long a connection can sit idle before being removed from the pool
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT) || 60000,
    // How long to wait for a connection from the pool before giving up
    acquireTimeoutMillis: 30000,
  },
};

let pool = null;
let isConnecting = false;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL_MS = 30_000; // Only ping DB every 30s, not on every request

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function createPool(attempt = 1) {
  const maxAttempts = 5;
  try {
    const newPool = await new sql.ConnectionPool(dbConfig).connect();
    newPool.on('error', (err) => {
      logger.error('SQL Pool Error — connection lost:', err.message || err);
      pool = null; // Mark as dead so next request triggers reconnect
    });
    logger.info(`✅ Connected to MS SQL: ${dbConfig.server}/${dbConfig.database}`);
    return newPool;
  } catch (err) {
    if (attempt >= maxAttempts) {
      logger.error(`❌ DB connection failed after ${maxAttempts} attempts:`, err.message || err);
      throw err;
    }
    const delay = Math.min(1000 * 2 ** (attempt - 1), 15000); // 1s, 2s, 4s, 8s, 15s cap
    logger.warn(`⚠️  DB connect attempt ${attempt} failed. Retrying in ${delay}ms…`);
    await sleep(delay);
    return createPool(attempt + 1);
  }
}

async function getPool() {
  // Fast path: pool looks healthy and was recently verified — return immediately
  if (pool && pool.connected) {
    const now = Date.now();
    if (now - lastHealthCheck < HEALTH_CHECK_INTERVAL_MS) {
      return pool; // ← skip the SELECT 1, trust the pool is healthy
    }
    // Time for a periodic health check (every 30s), non-blocking for other callers
    try {
      await pool.request().query('SELECT 1');
      lastHealthCheck = now;
      return pool;
    } catch {
      logger.warn('⚠️  Periodic pool health check failed — forcing reconnect');
      pool = null;
    }
  }

  // If another call is already reconnecting, wait for it
  if (isConnecting) {
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      if (pool && pool.connected) return pool;
    }
    throw new Error('Database reconnect timed out — please retry');
  }

  // We are the one responsible for reconnecting
  isConnecting = true;
  try {
    pool = await createPool();
    lastHealthCheck = Date.now();
    return pool;
  } finally {
    isConnecting = false;
  }
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






 