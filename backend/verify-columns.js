require('dotenv').config();
const { getPool } = require('./src/config/database');

async function run() {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Prescriptions'
    `);
    console.log("Columns in Prescriptions table:");
    console.log(result.recordset.map(r => r.COLUMN_NAME).join(', '));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
