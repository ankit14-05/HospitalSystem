require('dotenv').config();
const { query } = require('./src/config/database');

async function check() {
  try {
    const res2 = await query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Users'
    `);
    console.table(res2.recordset);
  } catch(e) {
    console.error(e.message);
  }
  process.exit(0);
}
check();
