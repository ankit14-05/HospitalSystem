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

async function testLabApiLogic() {
  const pool = await sql.connect(dbConfig);
  const patientId = 4;
  const hospitalId = 1;

  console.log(`\n🧪 LOGIC TEST (Patient: ${patientId}, Hospital: ${hospitalId})\n` + '='.repeat(60));

  const q = `
    SELECT
      lo.Id AS OrderId, lo.OrderNumber, lo.OrderDate, lo.Priority, lo.Status,
      lo.PlaceType, lo.RoomNo, lo.ExternalLabName, lo.SampleId,
      pp.FirstName + ' ' + pp.LastName AS PatientName, pp.UHID AS PatientUHID,
      u.FirstName + ' ' + u.LastName AS DoctorName,
      li.Id AS ItemId, lt.Name AS TestName, lt.Category,
      li.ResultValue, li.ResultUnit, li.NormalRange, li.IsAbnormal, li.Remarks, li.Status AS ItemStatus,
      COUNT(*) OVER() AS TotalCount
    FROM dbo.LabOrders lo
    JOIN dbo.LabOrderItems li     ON li.LabOrderId = lo.Id
    JOIN dbo.LabTests lt          ON lt.Id = li.TestId
    LEFT JOIN dbo.Users u         ON u.Id = lo.OrderedBy
    LEFT JOIN dbo.PatientProfiles pp ON pp.Id = lo.PatientId
    WHERE lo.PatientId = @patientId AND lo.HospitalId = @hospitalId
  `;

  const r = await pool.request()
    .input('patientId', sql.BigInt, patientId)
    .input('hospitalId', sql.BigInt, hospitalId)
    .query(q);

  console.log(`Results Found: ${r.recordset.length}`);
  if (r.recordset.length > 0) {
    console.log('Sample Row:');
    console.log(JSON.stringify(r.recordset[0], null, 2));
    
    const statuses = r.recordset.map(row => row.Status);
    const uniqueStatuses = [...new Set(statuses)];
    console.log('\nStatuses present in results:', uniqueStatuses);
  } else {
    console.log('NO RESULTS RETURNED by the JOIN query.');
    
    // Check if LabOrders exist but LabOrderItems don't
    const r2 = await pool.request().input('pid', sql.BigInt, patientId).query('SELECT Id, Status FROM dbo.LabOrders WHERE PatientId = @pid');
    console.log(`\nRaw LabOrders count: ${r2.recordset.length}`);
    r2.recordset.forEach(o => console.log(`  Order ${o.Id}: Status=${o.Status}`));
  }

  await pool.close();
}

testLabApiLogic().catch(console.error);
