const { getPool, sql } = require('../src/config/database');

async function debugDoctorQueue(userId) {
  try {
    const pool = await getPool();
    console.log(`Checking queue for User ID: ${userId}`);

    const docRes = await pool.request()
      .input('UserId', parseInt(userId))
      .query(`SELECT Id FROM dbo.DoctorProfiles WHERE UserId = @UserId`);

    if (!docRes.recordset.length) {
      console.log('Doctor profile not found');
      return;
    }
    const doctorProfileId = docRes.recordset[0].Id;
    console.log(`Doctor Profile ID: ${doctorProfileId}`);

    const queueResult = await pool.request()
      .input('DoctorId',  doctorProfileId)
      .input('QueueDate', new Date().toISOString().slice(0, 10))
      .query(`
        SELECT
          q.Id, q.PatientId,
          a.Id AS AppointmentId,
          (
            SELECT TOP 1 rx.Id
            FROM dbo.Prescriptions rx
            WHERE rx.AppointmentId = a.Id
            ORDER BY rx.CreatedAt DESC, rx.Id DESC
          ) AS LatestPrescriptionId
        FROM dbo.OpdQueue q
        LEFT JOIN dbo.Appointments a ON a.Id = q.AppointmentId
        WHERE q.DoctorId = @DoctorId
          AND q.QueueDate = @QueueDate
      `);

    const apptResult = await pool.request()
      .input('DoctorId', doctorProfileId)
      .input('Date',     new Date().toISOString().slice(0, 10))
      .query(`
        SELECT
          a.Id AS AppointmentId,
          (
            SELECT TOP 1 rx.Id
            FROM dbo.Prescriptions rx
            WHERE rx.AppointmentId = a.Id
            ORDER BY rx.CreatedAt DESC, rx.Id DESC
          ) AS LatestPrescriptionId
        FROM dbo.Appointments a
        WHERE a.DoctorId = @DoctorId
          AND a.AppointmentDate = @Date
      `);

    console.log('Appointment data:', apptResult.recordset);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

const userId = process.argv[2];
if (!userId) {
  console.error('Please provide a UserId');
  process.exit(1);
}

debugDoctorQueue(userId);
