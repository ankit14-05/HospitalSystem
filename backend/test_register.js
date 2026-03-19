require('dotenv').config();
const { query, sql } = require('./src/config/database');
const bcrypt = require('bcryptjs');

(async () => {
    try {
        console.log("Adding mock Otp...");
        await query(`DELETE FROM dbo.OtpTokens WHERE Contact = 'teststaff5@example.com'`);
        await query(`INSERT INTO dbo.OtpTokens (Contact, ContactType, Purpose, OtpHash, IsVerified, ExpiresAt, Attempts, MaxAttempts, IpAddress) VALUES ('teststaff5@example.com', 'email', 'email_verify_registration', 'hash', 1, DATEADD(hour, 1, SYSUTCDATETIME()), 0, 5, '127.0.0.1')`);
        
        console.log("Sending POST Request...");
        const res = await fetch('http://localhost:5000/api/v1/register/staff', {
            method: 'POST',
            body: JSON.stringify({
                hospitalId: 1,
                firstName: 'Test',
                lastName: 'User',
                gender: 'Male',
                email: 'teststaff5@example.com',
                phone: '9999999988',
                role: 'nurse',
                countryCode: 'IND',
                street1: '123 Main St',
                city: 'Testville',
                password: 'Password123!',
                username: 'teststaff55'
            }),
            headers: { 'Content-Type': 'application/json' }
        });
        
        console.log("Status:", res.status);
        const data = await res.json();
        console.log("Data:", data);
    } catch (e) {
        console.error("Crash!", e);
    }
    process.exit(0);
})();
