require('dotenv').config();
const { query, sql, getPool } = require('../src/config/database');

async function setupSignatureTable() {
  try {
    console.log("--- Setting up LabInchargeProfiles Table ---");
    
    // Ensure we can connect even with latency
    await getPool();
    
    
    // Create the table for signature settings
    await query(`
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[LabInchargeProfiles]') AND type in (N'U'))
      BEGIN
        CREATE TABLE [dbo].[LabInchargeProfiles] (
          [Id] [bigint] IDENTITY(1,1) NOT NULL PRIMARY KEY,
          [UserId] [bigint] NOT NULL UNIQUE,
          [SignatureImagePath] [nvarchar](max) NULL,
          [SignatureText] [nvarchar](200) NULL,
          [SignaturePreference] [nvarchar](20) NOT NULL DEFAULT 'NewPage',
          [CreatedAt] [datetime2](0) NOT NULL DEFAULT GETDATE(),
          [UpdatedAt] [datetime2](0) NOT NULL DEFAULT GETDATE(),
          CONSTRAINT [FK_LabInchargeProfiles_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users] ([Id])
        );
        PRINT 'Table LabInchargeProfiles created.';
      END
      ELSE
      BEGIN
        PRINT 'Table LabInchargeProfiles already exists.';
      END
    `);
    
    console.log("✅ Database setup complete.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error setting up database:", err);
    process.exit(1);
  }
}

setupSignatureTable();
