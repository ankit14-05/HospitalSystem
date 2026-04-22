
require('dotenv').config();
const { query } = require('./src/config/database');
(async () => {
    console.log('Running migration: Create LabOrderAttachments...');
    const sqlStr = `
        IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE object_id = OBJECT_ID('dbo.LabOrderAttachments'))
        BEGIN
            CREATE TABLE [dbo].[LabOrderAttachments](
                [Id] [bigint] IDENTITY(1,1) PRIMARY KEY,
                [LabOrderId] [bigint] NOT NULL,
                [FileName] [nvarchar](255) NOT NULL,
                [FilePath] [nvarchar](500) NOT NULL,
                [FileType] [nvarchar](100) NULL,
                [FileSize] [bigint] NULL,
                [UploadedBy] [bigint] NULL,
                [UploadedAt] [datetime2] DEFAULT GETUTCDATE(),
                CONSTRAINT FK_LabOrderAttachments_LabOrder FOREIGN KEY (LabOrderId) REFERENCES dbo.LabOrders(Id)
            )
        END
    `;
    await query(sqlStr);
    console.log('Success.');
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
