const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    // Attempt to select from Roles table. Provide fallback if table doesn't exist.
    try {
      const result = await query('SELECT RoleName FROM dbo.Roles WHERE IsActive = 1 ORDER BY SortOrder ASC');
      const roles = result.recordset.map(row => row.RoleName);
      return res.json({ success: true, roles });
    } catch(err) {
      // If table doesn't exist, return fallback roles (this prevents crashes before DB migration)
      return res.json({
        success: true,
        roles: [
          'Nurse',
          'Receptionist',
          'Pharmacist',
          'Lab Technician',
          'Ward Boy',
          'Housekeeping',
          'Security',
          'Admin Staff',
          'OPD Manager'
        ]
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error fetching roles' });
  }
});

module.exports = router;
