// src/app.js
require('dotenv').config();
const fs           = require('fs');
const path         = require('path');
const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const compression  = require('compression');
const cookieParser = require('cookie-parser');
const morgan       = require('morgan');
const rateLimit    = require('express-rate-limit');
const logger       = require('./config/logger');

// ── Route imports ─────────────────────────────────────────────────────────────
const authRoutes         = require('./routes/auth.routes');
const registerRoutes     = require('./routes/register.routes');
const hospitalRoutes     = require('./routes/hospital.routes');
const geoRoutes          = require('./routes/geo.routes');
const setupRoutes        = require('./routes/setup.routes');
const userRoutes         = require('./routes/user.routes');
const appointmentRoutes  = require('./routes/appointment.routes');
const patientRoutes      = require('./routes/patient.routes');
const departmentRoutes   = require('./routes/department.routes');
const doctorRoutes       = require('./routes/doctor.routes');
const prescriptionRoutes = require('./routes/prescription.routes');
const reportRoutes       = require('./routes/report.routes');
const billRoutes         = require('./routes/bill.routes');
const schedulingRoutes   = require('./routes/scheduling.routes');   // ← NEW
const dashboardRoutes    = require('./routes/dashboard.routes');
const profileRoutes      = require('./routes/profile.routes');
const rolesRoutes        = require('./routes/roles.routes');
const emrRoutes          = require('./routes/emr.routes');          // ← EMR module
const labRoutes          = require('./routes/lab.routes');           // ← Lab module

const app = express();
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
const frontendIndexPath = path.join(frontendDistPath, 'index.html');
const hasBuiltFrontend = fs.existsSync(frontendIndexPath);
const isRateLimitEnabled = (value, defaultValue = true) => {
  if (value == null || value === '') return defaultValue;
  return !['false', '0', 'off', 'no'].includes(String(value).trim().toLowerCase());
};

// TEMPORARY DEBUG — remove in production
app.use((req, res, next) => {
  console.log(`>>> ${req.method} ${req.originalUrl} → path: ${req.path}`);
  next();
});

// ── Security headers ──────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    originAgentCluster: false,
  })
);

// ── CORS ──────────────────────────────────────────────────────────────────────
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

// ── Compression & parsing ─────────────────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ── HTTP logging ──────────────────────────────────────────────────────────────
app.use(
  morgan('combined', {
    stream: { write: (msg) => logger.http(msg.trim()) },
    skip: (req) => req.path === '/health',
  })
);

// ── Global rate limiter ───────────────────────────────────────────────────────
if (isRateLimitEnabled(process.env.ENABLE_GLOBAL_RATE_LIMIT, true)) {
  app.use(
    rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
      max:      parseInt(process.env.RATE_LIMIT_MAX)       || 100,
      standardHeaders: true,
      legacyHeaders:   false,
      message: { success: false, message: 'Too many requests. Please try again later.' },
    })
  );
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'MediCore HMS API' });
});

// ── API routes ────────────────────────────────────────────────────────────────
const prefix = process.env.API_PREFIX || '/api/v1';

app.use(`${prefix}/auth`,          authRoutes);
app.use(`${prefix}/register`,      registerRoutes);
app.use(`${prefix}/hospitals`,     hospitalRoutes);
app.use(`${prefix}/geo`,           geoRoutes);
app.use(`${prefix}/setup`,         setupRoutes);
app.use(`${prefix}/users`,         userRoutes);
app.use(`${prefix}/appointments`,  appointmentRoutes);
app.use(`${prefix}/patients`,      patientRoutes);
app.use(`${prefix}/departments`,   departmentRoutes);
app.use(`${prefix}/doctors`,       doctorRoutes);
app.use(`${prefix}/prescriptions`, prescriptionRoutes);
app.use(`${prefix}/reports`,       reportRoutes);
app.use(`${prefix}/bills`,         billRoutes);
app.use(`${prefix}/scheduling`,    schedulingRoutes);               // ← NEW
app.use(`${prefix}/dashboard`,     dashboardRoutes);
app.use(`${prefix}/profile`,       profileRoutes);
app.use(`${prefix}/roles`,         rolesRoutes);
app.use(`${prefix}/emr`,           emrRoutes);            // ← EMR module
app.use(`${prefix}/lab`,           labRoutes);            // ← Lab module

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

if (hasBuiltFrontend) {
  app.use(express.static(frontendDistPath));

  // In production-style deployments, serve the built SPA for non-API routes.
  app.get(/^\/(?!api(?:\/|$)|health$).*/, (req, res) => {
    res.sendFile(frontendIndexPath);
  });
}

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// ── Global error handler ──────────────────────────────────────────────────────
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
