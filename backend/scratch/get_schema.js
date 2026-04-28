require('dotenv').config();
const { getPool } = require('../src/config/database');

async function run() {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME IN ('Prescriptions', 'PrescriptionItems')
      ORDER BY TABLE_NAME, ORDINAL_POSITION;
    `);
    
    console.log(JSON.stringify(result.recordset, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
