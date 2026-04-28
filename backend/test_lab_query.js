const { getPool, sql } = require('./src/config/database');
const labService = require('./src/services/lab.service');

async function test() {
  try {
    const pool = await getPool();
    // find a patient id
    const pRes = await pool.request().query('SELECT TOP 1 Id FROM dbo.PatientProfiles');
    if (!pRes.recordset.length) {
      console.log('No patients found');
      process.exit(0);
    }
    const patientId = pRes.recordset[0].Id;
    console.log('Testing for Patient ID:', patientId);
    
    const results = await labService.getPatientLabResults(patientId, null, { page: 1, limit: 100 });
    console.log('Results:', JSON.stringify(results, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}
test();
