const { getPool, sql } = require('../src/config/database');

async function checkPrescription(appointmentId) {
  try {
    const pool = await getPool();
    console.log(`Checking prescriptions for AppointmentId: ${appointmentId}`);

    const rxResult = await pool.request()
      .input('AppointmentId', sql.BigInt, appointmentId)
      .query(`
        SELECT Id, RxNumber, VersionNo, IsFinalized, Diagnosis, Notes, CreatedAt, UpdatedAt, PayloadJson
        FROM dbo.Prescriptions
        WHERE AppointmentId = @AppointmentId
        ORDER BY CreatedAt DESC
      `);

    console.log('Prescriptions found:', rxResult.recordset.length);
    for (const rx of rxResult.recordset) {
      console.log(`\n--- Prescription ID: ${rx.Id} ---`);
      console.log(`RxNumber: ${rx.RxNumber}`);
      console.log(`Version: ${rx.VersionNo}`);
      console.log(`Finalized: ${rx.IsFinalized}`);
      console.log(`Diagnosis: ${rx.Diagnosis}`);
      console.log(`UpdatedBy: ${rx.UpdatedBy}`);
      console.log(`CreatedAt: ${rx.CreatedAt}`);
      console.log(`UpdatedAt: ${rx.UpdatedAt}`);
      console.log(`PayloadJson: ${rx.PayloadJson}`);

      const itemsResult = await pool.request()
        .input('PrescriptionId', sql.BigInt, rx.Id)
        .query(`SELECT MedicineName, Dosage, Frequency FROM dbo.PrescriptionItems WHERE PrescriptionId = @PrescriptionId`);

      console.log('Items:', itemsResult.recordset);
    }

  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

const apptId = process.argv[2];
if (!apptId) {
  console.error('Please provide an AppointmentId');
  process.exit(1);
}

checkPrescription(apptId);
