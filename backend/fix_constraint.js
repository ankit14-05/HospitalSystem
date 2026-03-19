require('dotenv').config();
const { query } = require('./src/config/database');

(async () => {
    try {
        console.log("Dropping CK_Users_Role...");
        await query(`ALTER TABLE dbo.Users DROP CONSTRAINT CK_Users_Role`);
        console.log("Successfully dropped constraint!");
    } catch (e) {
        console.error("Failed:", e.message);
    }
    process.exit(0);
})();
