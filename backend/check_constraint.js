require('dotenv').config();
const { query } = require('./src/config/database');

(async () => {
    try {
        const res = await query(`
            SELECT definition 
            FROM sys.check_constraints 
            WHERE name = 'CK_Users_Role'
        `);
        console.log("CK_Users_Role definition:", res.recordset[0]);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
})();
