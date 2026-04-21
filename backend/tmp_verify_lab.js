
const { query } = require('./src/config/database');
const labService = require('./src/services/lab.service.js');
const sql = require('mssql');
require('dotenv').config();

(async () => {
    try {
        console.log('--- DIAGNOSTIC START ---');
        const pendingRes = await query("SELECT TOP 1 Id FROM dbo.LabOrders WHERE Status = 'Pending'");
        if (!pendingRes.recordset.length) {
            console.log('No pending orders found.');
        } else {
            const orderId = pendingRes.recordset[0].Id;
            console.log('Testing Order ID:', orderId);
            
            await labService.updateOrderStatus(orderId, 1, 'Processing', 34);
            
            const verifyRes = await query("SELECT SampleId, CollectedAt FROM dbo.LabOrders WHERE Id = @id", { id: { type: sql.BigInt, value: orderId }});
            console.log('Verified Order:', JSON.stringify(verifyRes.recordset[0]));
            
            if (verifyRes.recordset[0]?.SampleId && verifyRes.recordset[0].SampleId.startsWith('#smp-')) {
                console.log('✅ Sample ID validation passed.');
            } else {
                console.log('❌ Sample ID validation failed.');
            }
        }
        console.log('--- DIAGNOSTIC END ---');
    } catch(e) { console.error(e); }
    process.exit(0);
})();
