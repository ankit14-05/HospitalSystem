// src/server.js
require('dotenv').config();
const app = require('./app');
const { getPool, closePool } = require('./config/database');
const logger = require('./config/logger');

const PORT = parseInt(process.env.PORT) || 5000;

async function startServer() {
  try {
    // Warm up DB pool
    await getPool();

    const server = app.listen(PORT, () => {
      logger.info(`🚀 MediCore HMS API running on port ${PORT} [${process.env.NODE_ENV}]`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`${signal} received — shutting down gracefully...`);
      server.close(async () => {
        await closePool();
        logger.info('Server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled Rejection:', reason);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
