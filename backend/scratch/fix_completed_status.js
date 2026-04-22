require('dotenv').config();
const { sql, getPool, query } = require('../src/config/database');

async function fixStatuses() {
  try {
    await getPool();
    console.log("Connected to DB. Running status cleanup query...");

    const checkQ = `
        SELECT Id, OrderNumber, Status, VerifiedAt 
        FROM dbo.LabOrders 
        WHERE Status = 'Completed' AND VerifiedAt IS NULL
    `;
    const checkRes = await query(checkQ);
    console.log(`Found ${checkRes.recordset.length} orders incorrectly marked as Completed.`);

    if (checkRes.recordset.length > 0) {
      const updateQ = `
          UPDATE dbo.LabOrders
          SET Status = 'Pending Approval'
          WHERE Status = 'Completed' AND VerifiedAt IS NULL
      `;
      const result = await query(updateQ);
      console.log(`Successfully reverted ${result.rowsAffected[0]} orders to 'Pending Approval'.`);
    } else {
      console.log("No orders needed fixing.");
    }

  } catch (err) {
    console.error("Error fixing statuses:", err);
  } finally {
    process.exit(0);
  }
}

fixStatuses();
