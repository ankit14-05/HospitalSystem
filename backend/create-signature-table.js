require('dotenv').config();
const { getPool } = require('./src/config/database');

async function run() {
  try {
    const pool = await getPool();
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DoctorPrescriptionSignatures]') AND type in (N'U'))
      BEGIN
        CREATE TABLE [dbo].[DoctorPrescriptionSignatures](
          [UserId] [bigint] NOT NULL,
          [SignatureText] [nvarchar](200) NULL,
          [SignaturePreference] [nvarchar](20) NULL,
          [SignatureImagePath] [nvarchar](max) NULL,
          [CreatedAt] [datetime2](7) NOT NULL DEFAULT (SYSUTCDATETIME()),
          [UpdatedAt] [datetime2](7) NOT NULL DEFAULT (SYSUTCDATETIME()),
          CONSTRAINT [PK_DoctorPrescriptionSignatures] PRIMARY KEY CLUSTERED 
          (
            [UserId] ASC
          )
        ) ON [PRIMARY]
        PRINT 'Table DoctorPrescriptionSignatures created.'
      END
      ELSE
      BEGIN
        PRINT 'Table DoctorPrescriptionSignatures already exists.'
      END
    `);
    console.log("Success!");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
