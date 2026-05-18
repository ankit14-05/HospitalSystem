require('dotenv').config();
const { getPool } = require('./src/config/database');

async function run() {
  try {
    const pool = await getPool();
    console.log("Checking Prescriptions table columns...");
    
    const columns = [
      { name: 'ParentPrescriptionId', type: 'bigint NULL' },
      { name: 'VersionNo', type: 'int NOT NULL DEFAULT 1' },
      { name: 'IsFinalized', type: 'bit NOT NULL DEFAULT 0' },
      { name: 'FinalizedAt', type: 'datetime2(7) NULL' },
      { name: 'FinalizedBy', type: 'bigint NULL' },
      { name: 'ArchivedPdfPath', type: 'nvarchar(1000) NULL' },
      { name: 'ArchivedPdfAt', type: 'datetime2(7) NULL' },
      { name: 'ArchivedPdfBy', type: 'bigint NULL' },
      { name: 'PayloadJson', type: 'nvarchar(max) NULL' },
      { name: 'UpdatedBy', type: 'bigint NULL' }
    ];

    for (const col of columns) {
      await pool.request().query(`
        IF NOT EXISTS (
          SELECT * FROM sys.columns 
          WHERE object_id = OBJECT_ID(N'[dbo].[Prescriptions]') 
          AND name = '${col.name}'
        )
        BEGIN
          ALTER TABLE [dbo].[Prescriptions] ADD [${col.name}] ${col.type};
          PRINT 'Column ${col.name} added to Prescriptions table.'
        END
        ELSE
        BEGIN
          PRINT 'Column ${col.name} already exists.'
        END
      `);
    }

    console.log("Database update complete!");
    process.exit(0);
  } catch (err) {
    console.error("Error updating database:", err);
    process.exit(1);
  }
}

run();
