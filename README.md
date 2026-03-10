# 🏥 MediCore HMS

> **Full-stack Hospital Management System**
> Node.js · Express · React · Tailwind CSS · Microsoft SQL Server

---

## 🗂 Project Structure

```
medicore-hms/
├── backend/                    # Express REST API
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js     # MS SQL connection pool (mssql)
│   │   │   └── logger.js       # Winston logger
│   │   ├── controllers/
│   │   │   └── auth.controller.js
│   │   ├── middleware/
│   │   │   └── auth.middleware.js   # JWT + role guard + hospital scope
│   │   ├── routes/
│   │   │   ├── auth.routes.js       # /api/v1/auth/*
│   │   │   ├── hospital.routes.js   # /api/v1/hospitals/*
│   │   │   ├── geo.routes.js        # /api/v1/geo/*
│   │   │   ├── setup.routes.js      # /api/v1/setup/*
│   │   │   └── user.routes.js       # /api/v1/users/*
│   │   ├── services/
│   │   │   └── auth.service.js      # Login, OTP, forgot/reset password
│   │   ├── utils/
│   │   │   ├── AppError.js
│   │   │   └── apiResponse.js
│   │   ├── validators/
│   │   │   └── auth.validator.js
│   │   ├── app.js              # Express app (middleware chain)
│   │   └── server.js           # Entry point
│   ├── logs/                   # Auto-created by Winston
│   ├── .env                    # ← copy .env.example, fill in
│   └── package.json
│
├── frontend/                   # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   └── AppLayout.jsx     # Sidebar + topbar shell
│   │   │   └── ui/
│   │   │       └── GeoSelector.jsx   # Country→State→District→Pincode
│   │   ├── context/
│   │   │   └── AuthContext.jsx       # Auth state + login/logout
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   │   ├── LoginPage.jsx         # Split-panel login
│   │   │   │   ├── ForgotPasswordPage.jsx
│   │   │   │   └── ResetPasswordPage.jsx  # OTP digit input
│   │   │   ├── dashboard/
│   │   │   │   └── DashboardPage.jsx
│   │   │   ├── setup/
│   │   │   │   ├── HospitalSetupPage.jsx  # Tabbed setup form
│   │   │   │   ├── UsersPage.jsx          # Users list + create modal
│   │   │   │   └── GeoSetupPage.jsx       # Browse + add districts/pincodes
│   │   │   └── NotFoundPage.jsx
│   │   ├── services/
│   │   │   └── api.js            # Axios + all API methods
│   │   ├── App.jsx               # Router + guards
│   │   ├── main.jsx
│   │   └── index.css             # Tailwind + custom component classes
│   └── package.json
│
└── package.json                # Root: concurrently dev scripts
```

---

## ⚡ Quick Start

### 1. Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18+ |
| npm | 9+ |
| MS SQL Server | 2019+ or Azure SQL |
| SQL Server Management Studio | (optional) |

### 2. Database Setup

```sql
-- Run the full MediCore schema script (provided separately)
-- This creates all tables, triggers, views, seed data
USE HospitalDB;
-- ... (run schema.sql)
```

### 3. Backend Setup

```bash
cd backend
cp .env.example .env          # Edit DB credentials & JWT secrets
npm install
npm run dev                   # Starts on http://localhost:5000
```

**Key `.env` values to update:**
```env
DB_SERVER=localhost            # or your SQL Server hostname
DB_PASSWORD=YourStrong@Passw0rd
JWT_SECRET=<random 32+ char string>
JWT_REFRESH_SECRET=<another random string>
```

### 4. Frontend Setup

```bash
cd frontend
npm install
npm run dev                   # Starts on http://localhost:3000
```

### 5. Run Both Together (from root)

```bash
npm install                   # installs concurrently
npm run dev                   # starts backend + frontend simultaneously
```

---

## 🔐 Authentication Flow

```
POST /api/v1/auth/login
  → Returns: { accessToken, user }
  → Sets:    httpOnly refreshToken cookie

GET  /api/v1/auth/me           (Bearer token required)
POST /api/v1/auth/logout
POST /api/v1/auth/forgot-password   → sends OTP (dev: logged to console)
POST /api/v1/auth/verify-otp
POST /api/v1/auth/reset-password    → OTP + new password
```

### Role Hierarchy

| Role | Access Level |
|------|-------------|
| `superadmin` | All hospitals, all features |
| `admin` | Own hospital, all features |
| `doctor` | Clinical: appointments, prescriptions, lab |
| `nurse` | Clinical: appointments, admissions |
| `receptionist` | Appointments, billing, patient reg |
| `pharmacist` | Pharmacy, prescriptions |
| `labtech` | Lab orders |
| `patient` | Own records only |
| `auditor` | Read-only audit logs |

---

## 🌐 API Reference

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/login` | ✗ | Login with username/email |
| POST | `/auth/logout` | ✓ | Revoke session |
| GET  | `/auth/me` | ✓ | Get current user |
| POST | `/auth/forgot-password` | ✗ | Send OTP |
| POST | `/auth/reset-password` | ✗ | Reset with OTP |

### Geography
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/geo/countries` | All countries |
| GET | `/geo/countries/:id/states` | States for country |
| GET | `/geo/states/:id/districts` | Districts for state |
| GET | `/geo/districts/:id/pincodes` | Pincodes for district |
| GET | `/geo/pincodes/search?q=411` | Search pincodes |
| POST | `/geo/districts/custom` | Add custom district (admin) |
| POST | `/geo/pincodes/custom` | Add custom pincode (admin) |
| GET | `/geo/lookup/:category` | Lookup values (roles, genders…) |

### Hospitals
| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/hospitals` | superadmin | List all hospitals |
| GET | `/hospitals/:id` | admin+ | Get hospital detail |
| POST | `/hospitals` | superadmin | Create hospital |
| PUT | `/hospitals/:id` | admin+ | Update hospital |
| DELETE | `/hospitals/:id` | superadmin | Soft-delete |
| GET | `/hospitals/:id/setup-log` | auditor+ | Change history |
| GET | `/hospitals/:id/departments` | all | List departments |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users` | List users (paginated + filterable) |
| POST | `/users` | Create user |
| PATCH | `/users/:id/toggle-active` | Activate / deactivate |
| PATCH | `/users/:id/change-password` | Change password |

---

## 🎨 Frontend Pages

| Route | Page | Roles |
|-------|------|-------|
| `/login` | Login (split-panel) | public |
| `/forgot-password` | Forgot Password | public |
| `/reset-password` | Reset with OTP | public |
| `/dashboard` | Dashboard (stats + activity) | all |
| `/setup/hospital` | Hospital Setup (tabbed) | admin+ |
| `/setup/users` | Users Management | admin+ |
| `/setup/geography` | Geography Setup | admin+ |

---

## 🔒 Security Features

- **JWT** access tokens (8h) + **httpOnly** refresh cookies
- **Bcrypt** password hashing (10 rounds dev, 12 prod)
- **Account lockout** after N failed logins (configurable)
- **OTP** expiry + attempt limiting
- **Rate limiting** on all routes; stricter on auth endpoints
- **Helmet** HTTP security headers
- **CORS** whitelist
- **SQL injection** prevention via parameterized queries (mssql)
- **Audit log** (immutable — trigger blocks UPDATE/DELETE)
- **Hospital scope** middleware — users cannot access other hospitals
- **Soft deletes** — no hard deletes on patients/users/hospitals

---

## 📋 Environment Variables

See `backend/.env.example` for full reference.

---

## 🚀 Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong, random `JWT_SECRET` (32+ chars)
- [ ] Set `DB_ENCRYPT=true` for Azure SQL
- [ ] Configure SMTP for real OTP emails
- [ ] Set `BCRYPT_ROUNDS=12`
- [ ] Restrict `CORS_ORIGINS` to your domain
- [ ] Enable HTTPS (reverse proxy: nginx / Caddy)
- [ ] Set up log rotation
- [ ] Configure DB backups

---

## 📄 License

MIT — MediCore HMS. Built for educational / internal use.
