require('dotenv').config();
const { query, sql } = require('../src/config/database');

async function updateSchema() {
  try {
    console.log("--- Updating LabOrders Schema: Adding RejectionReason ---");
    
    // Check if column exists
    const checkCol = await query(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID(N'[dbo].[LabOrders]') 
        AND name = 'RejectionReason'
      )
      BEGIN
        ALTER TABLE [dbo].[LabOrders] ADD [RejectionReason] NVARCHAR(MAX) NULL;
        PRINT 'Column RejectionReason added.';
      END
      ELSE
      BEGIN
        PRINT 'Column RejectionReason already exists.';
      END
    `);
    
    console.log("✅ Success! Database schema updated.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error updating schema:", err);
    process.exit(1);
  }
}

updateSchema();
