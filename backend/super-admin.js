// scripts/seed-superadmin.js
const bcrypt = require('bcryptjs');
const sql = require('mssql');

const config = {
  server: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'medicore',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASS || 'your_password',
  options: { encrypt: false, trustServerCertificate: true }
};

async function seedSuperAdmin() {
  await sql.connect(config);
  const hash = await bcrypt.hash('Admin@123', 12);

  await sql.query`
    IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'superadmin')
    BEGIN
      INSERT INTO users (username, email, password, role, is_active, created_at)
      VALUES ('superadmin', 'superadmin@medicore.local', ${hash}, 'superadmin', 1, GETDATE())
    END
  `;

  console.log('✅ Superadmin inserted');
  process.exit(0);
}

seedSuperAdmin().catch(err => { console.error(err); process.exit(1); });