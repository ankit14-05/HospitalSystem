const sql = require('mssql');
require('dotenv').config({ path: '.env' });

const config = {
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 60000,
    requestTimeout: 60000
  }
};

async function merge() {
  const fromId = 2; // HMS-20260318-00002 (suyash mishra)
  const toId = 4;   // HMS-20260319-00004 (Suyash MIshra)

  console.log(`🚀 Starting merge: Patient ${fromId} -> Patient ${toId}`);

  try {
    const pool = await sql.connect(config);
    console.log('✅ Connected to Database');

    const tables = [
      'EMRMedicalHistory',
      'OpdQueue',
      'EMRDiagnoses',
      'EMRClinicalNotes',
      'Prescriptions',
      'EMRAllergies',
      'PatientProfileAccess',
      'EMRMedicationHistory',
      'EMRDocuments',
      'PatientProfileRegistrations',
      'Admissions',
      'Appointments',
      'Bills',
      'AppointmentConsultations',
      'LabOrders'
    ];

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      for (const table of tables) {
        console.log(`   Merging ${table}...`);
        const result = await transaction.request()
          .input('from', sql.BigInt, fromId)
          .input('to', sql.BigInt, toId)
          .query(`UPDATE dbo.${table} SET PatientId = @to WHERE PatientId = @from`);
        console.log(`   - Updated ${result.rowsAffected[0]} rows in ${table}`);
      }

      // Deactivate/Rename the old profile so it's not used inadvertently
      console.log('   Deactivating Patient 2 profile...');
      await transaction.request()
        .input('from', sql.BigInt, fromId)
        .query(`UPDATE dbo.PatientProfiles SET DeletedAt = GETUTCDATE(), UHID = UHID + '-MERGED-' + CAST(Id as varchar) WHERE Id = @from`);

      await transaction.commit();
      console.log('🎊 COMPLETED: All data merged successfully into Patient 4.');
    } catch (err) {
      await transaction.rollback();
      console.error('❌ FAILED: Transaction rolled back.', err);
    }

    await pool.close();
  } catch (err) {
    console.error('❌ Connection Error:', err);
  }
}

merge();
