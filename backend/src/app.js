// src/app.js
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const logger = require('./config/logger');

// Route imports
const authRoutes     = require('./routes/auth.routes');
const registerRoutes = require('./routes/register.routes');
const hospitalRoutes = require('./routes/hospital.routes');
const geoRoutes      = require('./routes/geo.routes');
const setupRoutes    = require('./routes/setup.routes');
const userRoutes     = require('./routes/user.routes');

const app = express();

// ── Security headers
app.use(helmet());

// ── CORS
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',');
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Hospital-Id'],
  })
);

// ── Compression & parsing
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ── HTTP logging
app.use(
  morgan('combined', {
    stream: { write: (msg) => logger.http(msg.trim()) },
    skip: (req) => req.path === '/health',
  })
);

// ── Global rate limiter
app.use(
  rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please try again later.' },
  })
);

// ── Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'MediCore HMS API' });
});

// ── API routes
const prefix = process.env.API_PREFIX || '/api/v1';
app.use(`${prefix}/auth`,      authRoutes);
app.use(`${prefix}/register`,  registerRoutes);
app.use(`${prefix}/hospitals`, hospitalRoutes);
app.use(`${prefix}/geo`,       geoRoutes);
app.use(`${prefix}/setup`,     setupRoutes);
app.use(`${prefix}/users`,     userRoutes);

// ── 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// ── Global error handler
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  logger.error(`${status} — ${err.message}`, { stack: err.stack, path: req.path });

  res.status(status).json({
    success: false,
    message: status === 500 ? 'Internal server error' : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

module.exports = app;
