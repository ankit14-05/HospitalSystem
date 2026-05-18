// migrate-prescription-tables.js
// Creates PrescriptionClinicalNotes and PrescriptionLabOrders tables.
// Safe to re-run — uses IF NOT EXISTS guards.
require('dotenv').config();
const { getPool } = require('./src/config/database');

async function run() {
  console.log('🔄 Starting prescription table migration...');
  const pool = await getPool();

  // ──────────────────────────────────────────────────────────────────────────
  // 1. PrescriptionClinicalNotes
  // ──────────────────────────────────────────────────────────────────────────
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM sys.objects
      WHERE object_id = OBJECT_ID(N'[dbo].[PrescriptionClinicalNotes]') AND type = 'U'
    )
    BEGIN
      CREATE TABLE [dbo].[PrescriptionClinicalNotes] (
        [Id]             BIGINT        NOT NULL IDENTITY(1,1),
        [PrescriptionId] BIGINT        NOT NULL,
        [NoteType]       NVARCHAR(50)  NOT NULL,
        [NoteContent]    NVARCHAR(MAX) NULL,
        [CreatedAt]      DATETIME2(7)  NOT NULL CONSTRAINT [DF_PCN_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt]      DATETIME2(7)  NOT NULL CONSTRAINT [DF_PCN_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_PrescriptionClinicalNotes] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_PCN_Prescriptions] FOREIGN KEY ([PrescriptionId])
          REFERENCES [dbo].[Prescriptions]([Id]) ON DELETE CASCADE
      );
      CREATE NONCLUSTERED INDEX [IX_PCN_PrescriptionId]
        ON [dbo].[PrescriptionClinicalNotes] ([PrescriptionId]);
      CREATE NONCLUSTERED INDEX [IX_PCN_NoteType]
        ON [dbo].[PrescriptionClinicalNotes] ([NoteType]);
      PRINT 'Table PrescriptionClinicalNotes created.';
    END
    ELSE
      PRINT 'Table PrescriptionClinicalNotes already exists — skipping.';
  `);

  // ──────────────────────────────────────────────────────────────────────────
  // 2. PrescriptionLabOrders
  // ──────────────────────────────────────────────────────────────────────────
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM sys.objects
      WHERE object_id = OBJECT_ID(N'[dbo].[PrescriptionLabOrders]') AND type = 'U'
    )
    BEGIN
      CREATE TABLE [dbo].[PrescriptionLabOrders] (
        [Id]             BIGINT         NOT NULL IDENTITY(1,1),
        [PrescriptionId] BIGINT         NOT NULL,
        [TestId]         BIGINT         NULL,
        [TestName]       NVARCHAR(200)  NOT NULL,
        [Criteria]       NVARCHAR(500)  NULL,
        [Details]        NVARCHAR(MAX)  NULL,
        [Status]         NVARCHAR(20)   NOT NULL CONSTRAINT [DF_PLO_Status]   DEFAULT ('Pending'),
        [Priority]       NVARCHAR(20)   NOT NULL CONSTRAINT [DF_PLO_Priority] DEFAULT ('Routine'),
        [CreatedAt]      DATETIME2(7)   NOT NULL CONSTRAINT [DF_PLO_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt]      DATETIME2(7)   NOT NULL CONSTRAINT [DF_PLO_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_PrescriptionLabOrders] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_PLO_Prescriptions] FOREIGN KEY ([PrescriptionId])
          REFERENCES [dbo].[Prescriptions]([Id]) ON DELETE CASCADE,
        CONSTRAINT [CK_PLO_Status]   CHECK ([Status]   IN ('Pending','Collected','Resulted','Cancelled')),
        CONSTRAINT [CK_PLO_Priority] CHECK ([Priority] IN ('Routine','Urgent','STAT'))
      );
      CREATE NONCLUSTERED INDEX [IX_PLO_PrescriptionId]
        ON [dbo].[PrescriptionLabOrders] ([PrescriptionId]);
      CREATE NONCLUSTERED INDEX [IX_PLO_Status]
        ON [dbo].[PrescriptionLabOrders] ([Status]);
      PRINT 'Table PrescriptionLabOrders created.';
    END
    ELSE
      PRINT 'Table PrescriptionLabOrders already exists — skipping.';
  `);

  console.log('✅ Migration complete.');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
