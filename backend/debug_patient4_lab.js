const sql = require('mssql');
require('dotenv').config({ path: __dirname + '/.env' });

const dbConfig = {
  server:   process.env.DB_SERVER,
  port:     parseInt(process.env.DB_PORT) || 1433,
  database: process.env.DB_DATABASE || 'HospitalDB',
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
};

async function checkPatient4Lab() {
  const pool = await sql.connect(dbConfig);
  const patientId = 4; // Based on logs seeing /api/v1/emr/4/lab-reports

  console.log(`\n🔍 CHECKING LAB DATA FOR PATIENT ID: ${patientId}\n` + '='.repeat(60));

  // 1. Check LabOrders
  const r1 = await pool.request().input('pid', sql.BigInt, patientId).query(`
    SELECT Id, OrderNumber, OrderDate, Status, Priority, HospitalId
    FROM dbo.LabOrders
    WHERE PatientId = @pid
  `);
  console.log(`\n📦 LabOrders (${r1.recordset.length}):`);
  console.table(r1.recordset);

  // 2. Check LabOrderItems for these orders
  if (r1.recordset.length > 0) {
    const ids = r1.recordset.map(row => row.Id).join(',');
    const r2 = await pool.request().query(`
      SELECT li.Id, li.LabOrderId, li.TestId, lt.Name AS TestName, li.Status
      FROM dbo.LabOrderItems li
      JOIN dbo.LabTests lt ON lt.Id = li.TestId
      WHERE li.LabOrderId IN (${ids})
    `);
    console.log(`\n🧪 LabOrderItems (${r2.recordset.length}):`);
    console.table(r2.recordset);
  }

  // 3. Try the actual query logic from the service
  const hospitalId = r1.recordset[0]?.HospitalId || 1;
  const q = `
    SELECT
      lo.Id AS OrderId, lo.OrderNumber, lo.OrderDate, lo.Priority, lo.Status,
      pp.FirstName + ' ' + pp.LastName AS PatientName, pp.UHID AS PatientUHID,
      li.Id AS ItemId, lt.Name AS TestName
    FROM dbo.LabOrders lo
    JOIN dbo.LabOrderItems li     ON li.LabOrderId = lo.Id
    JOIN dbo.LabTests lt          ON lt.Id = li.TestId
    LEFT JOIN dbo.PatientProfiles pp ON pp.Id = lo.PatientId
    WHERE lo.PatientId = @patientId AND lo.HospitalId = @hospitalId
  `;
  const r3 = await pool.request()
    .input('patientId', sql.BigInt, patientId)
    .input('hospitalId', sql.BigInt, hospitalId)
    .query(q);
  console.log(`\n🔬 Result of JOIN query (${r3.recordset.length}):`);
  console.table(r3.recordset);

  await pool.close();
}

checkPatient4Lab().catch(e => { console.error('Error:', e); process.exit(1); });
