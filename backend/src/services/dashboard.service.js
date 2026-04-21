const { getPool, sql } = require('../config/database');
const { STAFF_PROFILE_ROLES, normalizeRole } = require('../constants/roles');

const STAFF_ROLES = STAFF_PROFILE_ROLES.map(normalizeRole);
const STAFF_ROLE_SQL = STAFF_ROLES.map((role) => `'${role}'`).join(', ');

const parseHospitalId = (value) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const resolveHospitalId = (user, requestedHospitalId) => {
  if (user?.role === 'superadmin') {
    return parseHospitalId(requestedHospitalId ?? user?.hospitalId ?? user?.HospitalId);
  }
  return parseHospitalId(user?.hospitalId ?? user?.HospitalId);
};

const scopedRequest = (pool, hospitalId) =>
  pool.request().input('HospitalId', sql.BigInt, hospitalId || null);

const formatActivityType = (type) => {
  switch (type) {
    case 'patient':
      return 'patient_registered';
    case 'doctor':
      return 'doctor_registration';
    case 'doctor_approved':
      return 'doctor_approved';
    case 'staff':
      return 'staff_registration';
    case 'staff_approved':
      return 'staff_approved';
    case 'appointment':
      return 'appointment_booked';
    case 'appointment_cancelled':
      return 'appointment_cancelled';
    case 'appointment_completed':
      return 'appointment_completed';
    case 'bill':
      return 'bill_generated';
    default:
      return type || 'activity';
  }
};

const getRecentActivity = async (pool, hospitalId, limit = 10) => {
  const auditRequest = scopedRequest(pool, hospitalId).input('Limit', sql.Int, limit);
  const auditRows = await auditRequest.query(`
    SELECT TOP (@Limit)
      CreatedAt,
      Description,
      Module,
      Action,
      TableName
    FROM dbo.AuditLogs
    WHERE (@HospitalId IS NULL OR HospitalId = @HospitalId)
    ORDER BY CreatedAt DESC
  `);

  if (auditRows.recordset.length) {
    return auditRows.recordset.map((row) => ({
      type: formatActivityType(row.Module || row.TableName || row.Action),
      title: row.Description || `${row.Action || 'Activity'} recorded`,
      subtitle: row.Module || row.TableName || 'System',
      createdAt: row.CreatedAt,
    }));
  }

  const fallbackRequest = scopedRequest(pool, hospitalId).input('Limit', sql.Int, limit);
  const fallbackRows = await fallbackRequest.query(`
    SELECT TOP (@Limit)
      ActivityType,
      Title,
      Subtitle,
      CreatedAt
    FROM (
      SELECT
        'patient' AS ActivityType,
        CONCAT(p.FirstName, ' ', p.LastName, ' registered as a patient') AS Title,
        COALESCE(p.UHID, p.Phone, p.Email, 'Patient registration') AS Subtitle,
        p.CreatedAt
      FROM dbo.PatientProfiles p
      WHERE p.DeletedAt IS NULL
        AND (@HospitalId IS NULL OR p.HospitalId = @HospitalId)

      UNION ALL

      SELECT
        'doctor' AS ActivityType,
        CONCAT('Doctor registration submitted: Dr. ', u.FirstName, ' ', u.LastName) AS Title,
        COALESCE(dep.Name, 'Awaiting department assignment') AS Subtitle,
        dp.CreatedAt
      FROM dbo.DoctorProfiles dp
      JOIN dbo.Users u ON u.Id = dp.UserId
      LEFT JOIN dbo.Departments dep ON dep.Id = dp.DepartmentId
      WHERE u.DeletedAt IS NULL
        AND (@HospitalId IS NULL OR dp.HospitalId = @HospitalId)

      UNION ALL

      SELECT
        'doctor_approved' AS ActivityType,
        CONCAT('Doctor approved: Dr. ', u.FirstName, ' ', u.LastName) AS Title,
        COALESCE(dep.Name, 'Doctor approval') AS Subtitle,
        dp.ApprovedAt AS CreatedAt
      FROM dbo.DoctorProfiles dp
      JOIN dbo.Users u ON u.Id = dp.UserId
      LEFT JOIN dbo.Departments dep ON dep.Id = dp.DepartmentId
      WHERE dp.ApprovedAt IS NOT NULL
        AND (@HospitalId IS NULL OR dp.HospitalId = @HospitalId)

      UNION ALL

      SELECT
        'staff' AS ActivityType,
        CONCAT('Staff registration submitted: ', u.FirstName, ' ', u.LastName) AS Title,
        COALESCE(dep.Name, sp.Role, u.Role, 'Staff registration') AS Subtitle,
        sp.CreatedAt
      FROM dbo.StaffProfiles sp
      JOIN dbo.Users u ON u.Id = sp.UserId
      LEFT JOIN dbo.Departments dep ON dep.Id = sp.DepartmentId
      WHERE u.DeletedAt IS NULL
        AND (@HospitalId IS NULL OR sp.HospitalId = @HospitalId)

      UNION ALL

      SELECT
        'staff_approved' AS ActivityType,
        CONCAT('Staff approved: ', u.FirstName, ' ', u.LastName) AS Title,
        COALESCE(dep.Name, sp.Role, u.Role, 'Staff approval') AS Subtitle,
        sp.ApprovedAt AS CreatedAt
      FROM dbo.StaffProfiles sp
      JOIN dbo.Users u ON u.Id = sp.UserId
      LEFT JOIN dbo.Departments dep ON dep.Id = sp.DepartmentId
      WHERE sp.ApprovedAt IS NOT NULL
        AND (@HospitalId IS NULL OR sp.HospitalId = @HospitalId)

      UNION ALL

      SELECT
        'appointment' AS ActivityType,
        CONCAT('Appointment booked for ', pp.FirstName, ' ', pp.LastName) AS Title,
        CONCAT('Dr. ', du.FirstName, ' ', du.LastName, ' on ', CONVERT(varchar(10), a.AppointmentDate, 120)) AS Subtitle,
        a.CreatedAt
      FROM dbo.Appointments a
      JOIN dbo.PatientProfiles pp ON pp.Id = a.PatientId
      JOIN dbo.DoctorProfiles dp ON dp.Id = a.DoctorId
      JOIN dbo.Users du ON du.Id = dp.UserId
      WHERE (@HospitalId IS NULL OR a.HospitalId = @HospitalId)

      UNION ALL

      SELECT
        'appointment_cancelled' AS ActivityType,
        CONCAT('Appointment cancelled for ', pp.FirstName, ' ', pp.LastName) AS Title,
        COALESCE(a.CancelReason, 'Cancelled appointment') AS Subtitle,
        a.CancelledAt AS CreatedAt
      FROM dbo.Appointments a
      JOIN dbo.PatientProfiles pp ON pp.Id = a.PatientId
      WHERE a.CancelledAt IS NOT NULL
        AND (@HospitalId IS NULL OR a.HospitalId = @HospitalId)

      UNION ALL

      SELECT
        'appointment_completed' AS ActivityType,
        CONCAT('Appointment completed for ', pp.FirstName, ' ', pp.LastName) AS Title,
        COALESCE(a.AppointmentNo, 'Completed appointment') AS Subtitle,
        a.UpdatedAt AS CreatedAt
      FROM dbo.Appointments a
      JOIN dbo.PatientProfiles pp ON pp.Id = a.PatientId
      WHERE a.Status = 'Completed'
        AND (@HospitalId IS NULL OR a.HospitalId = @HospitalId)

      UNION ALL

      SELECT
        'bill' AS ActivityType,
        CONCAT('Bill generated for ', pp.FirstName, ' ', pp.LastName) AS Title,
        CONCAT(b.BillNumber, ' / Rs. ', CAST(CAST(b.TotalAmount AS decimal(12, 2)) AS varchar(32))) AS Subtitle,
        b.CreatedAt
      FROM dbo.Bills b
      JOIN dbo.PatientProfiles pp ON pp.Id = b.PatientId
      WHERE (@HospitalId IS NULL OR b.HospitalId = @HospitalId)
    ) activity
    WHERE CreatedAt IS NOT NULL
    ORDER BY CreatedAt DESC
  `);

  return fallbackRows.recordset.map((row) => ({
    type: formatActivityType(row.ActivityType),
    title: row.Title,
    subtitle: row.Subtitle,
    createdAt: row.CreatedAt,
  }));
};

const getAdminOverview = async ({ user, requestedHospitalId }) => {
  const hospitalId = resolveHospitalId(user, requestedHospitalId);
  const pool = await getPool();

  const statsRequest = scopedRequest(pool, hospitalId);
  const statsPromise = statsRequest.query(`
    SELECT COUNT(*) AS TotalPatients
    FROM dbo.PatientProfiles
    WHERE DeletedAt IS NULL
      AND (@HospitalId IS NULL OR HospitalId = @HospitalId);

    SELECT COUNT(*) AS ActiveDoctors
    FROM dbo.DoctorProfiles dp
    JOIN dbo.Users u ON u.Id = dp.UserId
    WHERE u.DeletedAt IS NULL
      AND u.IsActive = 1
      AND dp.ApprovalStatus = 'approved'
      AND (@HospitalId IS NULL OR dp.HospitalId = @HospitalId);

    SELECT COUNT(*) AS TotalStaff
    FROM dbo.StaffProfiles sp
    JOIN dbo.Users u ON u.Id = sp.UserId
    WHERE u.DeletedAt IS NULL
      AND u.IsActive = 1
      AND sp.ApprovalStatus = 'approved'
      AND u.Role IN (${STAFF_ROLE_SQL})
      AND (@HospitalId IS NULL OR sp.HospitalId = @HospitalId);

    SELECT
      SUM(CASE WHEN b.Status = 'occupied' THEN 1 ELSE 0 END) AS OccupiedBeds,
      COUNT(*) AS TotalBeds
    FROM dbo.Beds b
    JOIN dbo.Wards w ON w.Id = b.WardId
    WHERE b.IsActive = 1
      AND (@HospitalId IS NULL OR w.HospitalId = @HospitalId);

    SELECT COALESCE(SUM(TotalAmount), 0) AS RevenueToday
    FROM dbo.Bills
    WHERE BillDate = CAST(GETDATE() AS date)
      AND (@HospitalId IS NULL OR HospitalId = @HospitalId);

    SELECT COUNT(*) AS PendingDoctors
    FROM dbo.DoctorProfiles
    WHERE ApprovalStatus = 'pending'
      AND (@HospitalId IS NULL OR HospitalId = @HospitalId);

    SELECT COUNT(*) AS PendingStaff
    FROM dbo.StaffProfiles
    WHERE ApprovalStatus = 'pending'
      AND (@HospitalId IS NULL OR HospitalId = @HospitalId);

    SELECT
      (
        SELECT COUNT(*)
        FROM dbo.DoctorLeaves dl
        WHERE dl.Status = 'pending'
          AND (@HospitalId IS NULL OR dl.HospitalId = @HospitalId)
      ) +
      (
        SELECT COUNT(*)
        FROM dbo.StaffLeaves sl
        WHERE sl.Status = 'pending'
          AND (@HospitalId IS NULL OR sl.HospitalId = @HospitalId)
      ) AS PendingLeaves;

    SELECT COUNT(*) AS TodayAppointments
    FROM dbo.Appointments
    WHERE AppointmentDate = CAST(GETDATE() AS date)
      AND Status NOT IN ('Cancelled', 'NoShow')
      AND (@HospitalId IS NULL OR HospitalId = @HospitalId);

    SELECT COUNT(*) AS TodayQueueCount
    FROM dbo.OpdQueue
    WHERE QueueDate = CAST(GETDATE() AS date)
      AND (@HospitalId IS NULL OR HospitalId = @HospitalId);
  `);

  const pendingDoctorsPromise = scopedRequest(pool, hospitalId)
    .query(`
      SELECT TOP 5
        dp.Id,
        dp.UserId,
        dp.ApprovalStatus AS Status,
        dp.ExperienceYears,
        dp.ConsultationFee,
        dp.LicenseNumber,
        dp.CreatedAt,
        u.FirstName,
        u.LastName,
        u.Email,
        u.Phone,
        dep.Name AS DepartmentName,
        sp.Name AS SpecializationName,
        q.FullName AS QualificationName
      FROM dbo.DoctorProfiles dp
      JOIN dbo.Users u ON u.Id = dp.UserId
      LEFT JOIN dbo.Departments dep ON dep.Id = dp.DepartmentId
      LEFT JOIN dbo.Specializations sp ON sp.Id = dp.SpecializationId
      LEFT JOIN dbo.Qualifications q ON q.Id = dp.QualificationId
      WHERE dp.ApprovalStatus = 'pending'
        AND (@HospitalId IS NULL OR dp.HospitalId = @HospitalId)
      ORDER BY dp.CreatedAt DESC
    `);

  const pendingStaffPromise = scopedRequest(pool, hospitalId)
    .query(`
      SELECT TOP 5
        sp.Id,
        sp.UserId,
        sp.ApprovalStatus AS Status,
        sp.EmployeeId,
        sp.Shift,
        sp.ExperienceYears,
        sp.CreatedAt,
        u.FirstName,
        u.LastName,
        u.Email,
        u.Phone,
        u.Role,
        dep.Name AS DepartmentName
      FROM dbo.StaffProfiles sp
      JOIN dbo.Users u ON u.Id = sp.UserId
      LEFT JOIN dbo.Departments dep ON dep.Id = sp.DepartmentId
      WHERE sp.ApprovalStatus = 'pending'
        AND (@HospitalId IS NULL OR sp.HospitalId = @HospitalId)
      ORDER BY sp.CreatedAt DESC
    `);

  const doctorSchedulesPromise = scopedRequest(pool, hospitalId)
    .query(`
      SELECT TOP 100
        ds.Id,
        ds.DayOfWeek,
        CONVERT(varchar(5), ds.StartTime, 108) AS StartTime,
        CONVERT(varchar(5), ds.EndTime, 108) AS EndTime,
        ds.SlotDurationMins,
        ds.VisitType,
        ds.MaxSlots,
        ds.IsActive,
        dp.Id AS DoctorId,
        CONCAT(u.FirstName, ' ', u.LastName) AS DoctorName,
        dep.Name AS DepartmentName,
        sp.Name AS Specialization
      FROM dbo.DoctorSchedules ds
      JOIN dbo.DoctorProfiles dp ON dp.Id = ds.DoctorId
      JOIN dbo.Users u ON u.Id = dp.UserId
      LEFT JOIN dbo.Departments dep ON dep.Id = dp.DepartmentId
      LEFT JOIN dbo.Specializations sp ON sp.Id = dp.SpecializationId
      WHERE ds.IsActive = 1
        AND (@HospitalId IS NULL OR ds.HospitalId = @HospitalId)
      ORDER BY ds.DayOfWeek ASC, ds.StartTime ASC
    `);

  const staffShiftsPromise = scopedRequest(pool, hospitalId)
    .query(`
      SELECT TOP 100
        ss.Id,
        ss.DayOfWeek,
        ss.ShiftType,
        CONVERT(varchar(5), ss.StartTime, 108) AS StartTime,
        CONVERT(varchar(5), ss.EndTime, 108) AS EndTime,
        ss.IsActive,
        st.Id AS StaffId,
        CONCAT(u.FirstName, ' ', u.LastName) AS StaffName,
        COALESCE(st.Designation, u.Designation, u.Role) AS Role,
        dep.Name AS DepartmentName
      FROM dbo.StaffSchedules ss
      JOIN dbo.StaffProfiles st ON st.Id = ss.StaffId
      JOIN dbo.Users u ON u.Id = st.UserId
      LEFT JOIN dbo.Departments dep ON dep.Id = st.DepartmentId
      WHERE ss.IsActive = 1
        AND (@HospitalId IS NULL OR ss.HospitalId = @HospitalId)
      ORDER BY ss.DayOfWeek ASC, ss.StartTime ASC
    `);

  const slotSummaryPromise = scopedRequest(pool, hospitalId)
    .query(`
      SELECT TOP 20
        s.DoctorId,
        CONCAT(u.FirstName, ' ', u.LastName) AS DoctorName,
        dep.Name AS DepartmentName,
        COUNT(*) AS TotalSlots,
        SUM(CASE WHEN s.Status IN ('Booked', 'Confirmed', 'Completed') THEN 1 ELSE 0 END) AS BookedSlots,
        SUM(CASE WHEN s.Status = 'Available' THEN 1 ELSE 0 END) AS AvailableSlots
      FROM dbo.AppointmentSlots s
      JOIN dbo.DoctorProfiles dp ON dp.Id = s.DoctorId
      JOIN dbo.Users u ON u.Id = dp.UserId
      LEFT JOIN dbo.Departments dep ON dep.Id = dp.DepartmentId
      WHERE s.SlotDate = CAST(GETDATE() AS date)
        AND (@HospitalId IS NULL OR s.HospitalId = @HospitalId)
      GROUP BY s.DoctorId, u.FirstName, u.LastName, dep.Name
      ORDER BY BookedSlots DESC, TotalSlots DESC
    `);

  const pendingLeavesPromise = scopedRequest(pool, hospitalId)
    .query(`
      SELECT TOP 20
        'doctor' AS Type,
        dl.Id,
        dl.LeaveDate,
        dl.LeaveType,
        dl.Reason,
        CONCAT(u.FirstName, ' ', u.LastName) AS StaffName,
        dep.Name AS DepartmentName
      FROM dbo.DoctorLeaves dl
      JOIN dbo.DoctorProfiles dp ON dp.Id = dl.DoctorId
      JOIN dbo.Users u ON u.Id = dp.UserId
      LEFT JOIN dbo.Departments dep ON dep.Id = dp.DepartmentId
      WHERE dl.Status = 'pending'
        AND (@HospitalId IS NULL OR dl.HospitalId = @HospitalId)

      UNION ALL

      SELECT TOP 20
        'staff' AS Type,
        sl.Id,
        sl.LeaveDate,
        sl.LeaveType,
        sl.Reason,
        CONCAT(u.FirstName, ' ', u.LastName) AS StaffName,
        dep.Name AS DepartmentName
      FROM dbo.StaffLeaves sl
      JOIN dbo.StaffProfiles st ON st.Id = sl.StaffId
      JOIN dbo.Users u ON u.Id = st.UserId
      LEFT JOIN dbo.Departments dep ON dep.Id = st.DepartmentId
      WHERE sl.Status = 'pending'
        AND (@HospitalId IS NULL OR sl.HospitalId = @HospitalId)
      ORDER BY LeaveDate ASC
    `);

  const opdQueuePromise = scopedRequest(pool, hospitalId)
    .query(`
      SELECT TOP 20
        q.Id,
        q.TokenNumber,
        q.QueueStatus,
        q.Priority,
        q.PatientName,
        CONCAT(u.FirstName, ' ', u.LastName) AS DoctorName,
        q.CreatedAt
      FROM dbo.OpdQueue q
      JOIN dbo.DoctorProfiles dp ON dp.Id = q.DoctorId
      JOIN dbo.Users u ON u.Id = dp.UserId
      WHERE q.QueueDate = CAST(GETDATE() AS date)
        AND (@HospitalId IS NULL OR q.HospitalId = @HospitalId)
      ORDER BY q.TokenNumber ASC
    `);

  const departmentOverviewPromise = scopedRequest(pool, hospitalId)
    .query(`
      SELECT TOP 8
        d.Id,
        d.Name,
        COUNT(DISTINCT CASE WHEN dp.ApprovalStatus = 'approved' THEN dp.Id END) AS DoctorCount,
        COUNT(DISTINCT CASE
          WHEN a.AppointmentDate = CAST(GETDATE() AS date) AND a.Status NOT IN ('Cancelled', 'NoShow')
          THEN a.Id
        END) AS TodayAppointments
      FROM dbo.Departments d
      LEFT JOIN dbo.DoctorProfiles dp ON dp.DepartmentId = d.Id
      LEFT JOIN dbo.Appointments a ON a.DepartmentId = d.Id
        AND a.HospitalId = d.HospitalId
        AND a.AppointmentDate = CAST(GETDATE() AS date)
      WHERE d.IsActive = 1
        AND (@HospitalId IS NULL OR d.HospitalId = @HospitalId)
      GROUP BY d.Id, d.Name
      ORDER BY TodayAppointments DESC, DoctorCount DESC, d.Name ASC
    `);

  const [
    statsRes,
    pendingDoctorsRes,
    pendingStaffRes,
    doctorSchedulesRes,
    staffShiftsRes,
    slotSummaryRes,
    pendingLeavesRes,
    opdQueueRes,
    departmentOverviewRes,
    recentActivity,
  ] = await Promise.all([
    statsPromise,
    pendingDoctorsPromise,
    pendingStaffPromise,
    doctorSchedulesPromise,
    staffShiftsPromise,
    slotSummaryPromise,
    pendingLeavesPromise,
    opdQueuePromise,
    departmentOverviewPromise,
    getRecentActivity(pool, hospitalId, 12),
  ]);

  const stats = {
    totalPatients: statsRes.recordsets[0]?.[0]?.TotalPatients || 0,
    activeDoctors: statsRes.recordsets[1]?.[0]?.ActiveDoctors || 0,
    totalStaff: statsRes.recordsets[2]?.[0]?.TotalStaff || 0,
    occupiedBeds: statsRes.recordsets[3]?.[0]?.OccupiedBeds || 0,
    totalBeds: statsRes.recordsets[3]?.[0]?.TotalBeds || 0,
    revenueToday: Number(statsRes.recordsets[4]?.[0]?.RevenueToday || 0),
    pendingDoctors: statsRes.recordsets[5]?.[0]?.PendingDoctors || 0,
    pendingStaff: statsRes.recordsets[6]?.[0]?.PendingStaff || 0,
    pendingLeaves: statsRes.recordsets[7]?.[0]?.PendingLeaves || 0,
    todayAppointments: statsRes.recordsets[8]?.[0]?.TodayAppointments || 0,
    todayQueueCount: statsRes.recordsets[9]?.[0]?.TodayQueueCount || 0,
  };

  return {
    hospitalId,
    stats,
    pendingDoctors: pendingDoctorsRes.recordset,
    pendingStaff: pendingStaffRes.recordset,
    doctorSchedules: doctorSchedulesRes.recordset,
    staffShifts: staffShiftsRes.recordset,
    slotSummary: slotSummaryRes.recordset,
    pendingLeaves: pendingLeavesRes.recordset,
    opdQueue: opdQueueRes.recordset,
    recentActivity,
    departmentOverview: departmentOverviewRes.recordset,
  };
};

const getOpdOverview = async ({ user, requestedHospitalId }) => {
  const hospitalId = resolveHospitalId(user, requestedHospitalId);
  const pool = await getPool();
  const dayOfWeek = new Date().getDay();

  const statsPromise = scopedRequest(pool, hospitalId)
    .input('DayOfWeek', sql.TinyInt, dayOfWeek)
    .query(`
      SELECT
        (
          SELECT COUNT(*)
          FROM dbo.Appointments a
          WHERE a.AppointmentDate = CAST(GETDATE() AS date)
            AND a.Status NOT IN ('Cancelled', 'NoShow')
            AND (@HospitalId IS NULL OR a.HospitalId = @HospitalId)
        ) AS TodayAppointments,
        (
          SELECT COUNT(*)
          FROM dbo.Appointments a
          WHERE a.AppointmentDate = CAST(GETDATE() AS date)
            AND a.Status = 'Scheduled'
            AND (@HospitalId IS NULL OR a.HospitalId = @HospitalId)
        ) AS ScheduledToday,
        (
          SELECT COUNT(*)
          FROM dbo.Appointments a
          WHERE a.AppointmentDate = CAST(GETDATE() AS date)
            AND a.Status = 'Confirmed'
            AND (@HospitalId IS NULL OR a.HospitalId = @HospitalId)
        ) AS ConfirmedToday,
        (
          SELECT COUNT(*)
          FROM dbo.Appointments a
          WHERE a.AppointmentDate = CAST(GETDATE() AS date)
            AND a.Status = 'Completed'
            AND (@HospitalId IS NULL OR a.HospitalId = @HospitalId)
        ) AS CompletedToday,
        (
          SELECT COUNT(*)
          FROM dbo.OpdQueue q
          WHERE q.QueueDate = CAST(GETDATE() AS date)
            AND q.QueueStatus IN ('waiting', 'current')
            AND (@HospitalId IS NULL OR q.HospitalId = @HospitalId)
        ) AS LiveQueue,
        (
          SELECT COUNT(DISTINCT ds.DoctorId)
          FROM dbo.DoctorSchedules ds
          WHERE ds.DayOfWeek = @DayOfWeek
            AND ds.IsActive = 1
            AND ds.EffectiveFrom <= CAST(GETDATE() AS date)
            AND (ds.EffectiveTo IS NULL OR ds.EffectiveTo >= CAST(GETDATE() AS date))
            AND (@HospitalId IS NULL OR ds.HospitalId = @HospitalId)
        ) AS DoctorsOnDuty,
        (
          SELECT COUNT(*)
          FROM dbo.Appointments a
          WHERE a.AppointmentDate >= CAST(GETDATE() AS date)
            AND a.Status IN ('Scheduled', 'Confirmed', 'Rescheduled')
            AND (@HospitalId IS NULL OR a.HospitalId = @HospitalId)
        ) AS UpcomingAppointments
    `);

  const upcomingAppointmentsPromise = scopedRequest(pool, hospitalId)
    .query(`
      SELECT TOP 12
        a.Id,
        a.AppointmentNo,
        a.AppointmentDate,
        CONVERT(varchar(5), TRY_CONVERT(time, a.AppointmentTime), 108) AS AppointmentTime,
        CONVERT(varchar(5), TRY_CONVERT(time, a.EndTime), 108) AS EndTime,
        a.VisitType,
        a.Status,
        a.Priority,
        a.TokenNumber,
        a.Reason,
        CONCAT(pp.FirstName, ' ', pp.LastName) AS PatientName,
        CONCAT(du.FirstName, ' ', du.LastName) AS DoctorName,
        dp.Id AS DoctorId,
        dep.Name AS DepartmentName
      FROM dbo.Appointments a
      JOIN dbo.PatientProfiles pp ON pp.Id = a.PatientId
      JOIN dbo.DoctorProfiles dp ON dp.Id = a.DoctorId
      JOIN dbo.Users du ON du.Id = dp.UserId
      LEFT JOIN dbo.Departments dep ON dep.Id = a.DepartmentId
      WHERE a.AppointmentDate >= CAST(GETDATE() AS date)
        AND a.Status IN ('Scheduled', 'Confirmed', 'Rescheduled', 'Completed')
        AND (@HospitalId IS NULL OR a.HospitalId = @HospitalId)
      ORDER BY
        CASE WHEN a.AppointmentDate = CAST(GETDATE() AS date) THEN 0 ELSE 1 END,
        a.AppointmentDate ASC,
        TRY_CONVERT(time, a.AppointmentTime) ASC
    `);

  const doctorRosterPromise = scopedRequest(pool, hospitalId)
    .input('DayOfWeek', sql.TinyInt, dayOfWeek)
    .query(`
      SELECT TOP 16
        dp.Id AS DoctorId,
        u.FirstName,
        u.LastName,
        CONCAT(u.FirstName, ' ', u.LastName) AS DoctorName,
        u.Email,
        dep.Name AS DepartmentName,
        sp.Name AS Specialization,
        (
          SELECT COUNT(*)
          FROM dbo.Appointments a
          WHERE a.DoctorId = dp.Id
            AND a.AppointmentDate = CAST(GETDATE() AS date)
            AND a.Status NOT IN ('Cancelled', 'NoShow')
            AND (@HospitalId IS NULL OR a.HospitalId = @HospitalId)
        ) AS TodayAppointments,
        (
          SELECT COUNT(*)
          FROM dbo.Appointments a
          WHERE a.DoctorId = dp.Id
            AND a.AppointmentDate = CAST(GETDATE() AS date)
            AND a.Status = 'Completed'
            AND (@HospitalId IS NULL OR a.HospitalId = @HospitalId)
        ) AS CompletedToday,
        (
          SELECT TOP 1 CONVERT(varchar(5), TRY_CONVERT(time, a.AppointmentTime), 108)
          FROM dbo.Appointments a
          WHERE a.DoctorId = dp.Id
            AND a.AppointmentDate = CAST(GETDATE() AS date)
            AND a.Status IN ('Scheduled', 'Confirmed', 'Rescheduled')
            AND TRY_CONVERT(time, a.AppointmentTime) >= CAST(GETDATE() AS time)
            AND (@HospitalId IS NULL OR a.HospitalId = @HospitalId)
          ORDER BY TRY_CONVERT(time, a.AppointmentTime) ASC
        ) AS NextAppointmentTime,
        (
          SELECT TOP 1 CONVERT(varchar(5), TRY_CONVERT(time, a.EndTime), 108)
          FROM dbo.Appointments a
          WHERE a.DoctorId = dp.Id
            AND a.AppointmentDate = CAST(GETDATE() AS date)
            AND a.Status IN ('Scheduled', 'Confirmed', 'Rescheduled')
            AND TRY_CONVERT(time, a.AppointmentTime) >= CAST(GETDATE() AS time)
            AND (@HospitalId IS NULL OR a.HospitalId = @HospitalId)
          ORDER BY TRY_CONVERT(time, a.AppointmentTime) ASC
        ) AS NextAppointmentEndTime,
        STUFF((
          SELECT ', ' +
            LEFT(CONVERT(varchar(8), ds2.StartTime, 108), 5) + '-' +
            LEFT(CONVERT(varchar(8), ds2.EndTime, 108), 5)
          FROM dbo.DoctorSchedules ds2
          WHERE ds2.DoctorId = dp.Id
            AND ds2.DayOfWeek = @DayOfWeek
            AND ds2.IsActive = 1
            AND ds2.EffectiveFrom <= CAST(GETDATE() AS date)
            AND (ds2.EffectiveTo IS NULL OR ds2.EffectiveTo >= CAST(GETDATE() AS date))
            AND (@HospitalId IS NULL OR ds2.HospitalId = @HospitalId)
          ORDER BY ds2.StartTime
          FOR XML PATH(''), TYPE
        ).value('.', 'nvarchar(max)'), 1, 2, '') AS TodaySchedule
      FROM dbo.DoctorProfiles dp
      JOIN dbo.Users u ON u.Id = dp.UserId
      LEFT JOIN dbo.Departments dep ON dep.Id = dp.DepartmentId
      LEFT JOIN dbo.Specializations sp ON sp.Id = dp.SpecializationId
      WHERE u.DeletedAt IS NULL
        AND u.IsActive = 1
        AND dp.ApprovalStatus = 'approved'
        AND (@HospitalId IS NULL OR dp.HospitalId = @HospitalId)
      ORDER BY TodayAppointments DESC, DoctorName ASC
    `);

  const todaySchedulesPromise = scopedRequest(pool, hospitalId)
    .input('DayOfWeek', sql.TinyInt, dayOfWeek)
    .query(`
      SELECT TOP 12
        ds.Id,
        ds.DoctorId,
        CONCAT(u.FirstName, ' ', u.LastName) AS DoctorName,
        dep.Name AS DepartmentName,
        CONVERT(varchar(5), ds.StartTime, 108) AS StartTime,
        CONVERT(varchar(5), ds.EndTime, 108) AS EndTime,
        ds.SlotDurationMins,
        ds.MaxSlots,
        ds.VisitType
      FROM dbo.DoctorSchedules ds
      JOIN dbo.DoctorProfiles dp ON dp.Id = ds.DoctorId
      JOIN dbo.Users u ON u.Id = dp.UserId
      LEFT JOIN dbo.Departments dep ON dep.Id = dp.DepartmentId
      WHERE ds.DayOfWeek = @DayOfWeek
        AND ds.IsActive = 1
        AND ds.EffectiveFrom <= CAST(GETDATE() AS date)
        AND (ds.EffectiveTo IS NULL OR ds.EffectiveTo >= CAST(GETDATE() AS date))
        AND (@HospitalId IS NULL OR ds.HospitalId = @HospitalId)
      ORDER BY ds.StartTime ASC, DoctorName ASC
    `);

  const [statsRes, upcomingAppointmentsRes, doctorRosterRes, todaySchedulesRes, recentActivity] = await Promise.all([
    statsPromise,
    upcomingAppointmentsPromise,
    doctorRosterPromise,
    todaySchedulesPromise,
    getRecentActivity(pool, hospitalId, 8),
  ]);

  const stats = statsRes.recordset[0] || {};

  return {
    hospitalId,
    stats: {
      todayAppointments: stats.TodayAppointments || 0,
      scheduledToday: stats.ScheduledToday || 0,
      confirmedToday: stats.ConfirmedToday || 0,
      completedToday: stats.CompletedToday || 0,
      liveQueue: stats.LiveQueue || 0,
      doctorsOnDuty: stats.DoctorsOnDuty || 0,
      upcomingAppointments: stats.UpcomingAppointments || 0,
    },
    upcomingAppointments: upcomingAppointmentsRes.recordset,
    doctorRoster: doctorRosterRes.recordset,
    todaySchedules: todaySchedulesRes.recordset,
    recentActivity,
  };
};

const getPeopleDirectory = async ({
  user,
  requestedHospitalId,
  category = 'all',
  search = '',
  page = 1,
  limit = 20,
}) => {
  const hospitalId = resolveHospitalId(user, requestedHospitalId);
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const safeOffset = (safePage - 1) * safeLimit;
  const safeCategory = ['all', 'patient', 'doctor', 'staff'].includes(category) ? category : 'all';
  const safeSearch = String(search || '').trim();
  const pool = await getPool();

  const countRequest = scopedRequest(pool, hospitalId).input('Search', sql.NVarChar(255), safeSearch);
  const countRes = await countRequest.query(`
    SELECT
      (
        SELECT COUNT(*)
        FROM dbo.PatientProfiles p
        LEFT JOIN dbo.Users u ON u.Id = p.UserId
        WHERE p.DeletedAt IS NULL
          AND (@HospitalId IS NULL OR p.HospitalId = @HospitalId)
          AND (
            @Search = '' OR
            p.FirstName LIKE '%' + @Search + '%' OR
            p.LastName LIKE '%' + @Search + '%' OR
            p.UHID LIKE '%' + @Search + '%' OR
            COALESCE(p.Email, u.Email, '') LIKE '%' + @Search + '%' OR
            COALESCE(p.Phone, u.Phone, '') LIKE '%' + @Search + '%'
          )
      ) AS Patients,
      (
        SELECT COUNT(*)
        FROM dbo.DoctorProfiles dp
        JOIN dbo.Users u ON u.Id = dp.UserId
        WHERE u.DeletedAt IS NULL
          AND (@HospitalId IS NULL OR dp.HospitalId = @HospitalId)
          AND (
            @Search = '' OR
            u.FirstName LIKE '%' + @Search + '%' OR
            u.LastName LIKE '%' + @Search + '%' OR
            COALESCE(dp.DoctorId, '') LIKE '%' + @Search + '%' OR
            COALESCE(u.Email, '') LIKE '%' + @Search + '%' OR
            COALESCE(u.Phone, '') LIKE '%' + @Search + '%'
          )
      ) AS Doctors,
      (
        SELECT COUNT(*)
        FROM dbo.StaffProfiles sp
        JOIN dbo.Users u ON u.Id = sp.UserId
        WHERE u.DeletedAt IS NULL
          AND (@HospitalId IS NULL OR sp.HospitalId = @HospitalId)
          AND (
            @Search = '' OR
            u.FirstName LIKE '%' + @Search + '%' OR
            u.LastName LIKE '%' + @Search + '%' OR
            COALESCE(sp.EmployeeId, '') LIKE '%' + @Search + '%' OR
            COALESCE(u.Email, '') LIKE '%' + @Search + '%' OR
            COALESCE(u.Phone, '') LIKE '%' + @Search + '%'
          )
      ) AS Staff
  `);

  const listRequest = scopedRequest(pool, hospitalId)
    .input('Category', sql.NVarChar(20), safeCategory)
    .input('Search', sql.NVarChar(255), safeSearch)
    .input('Offset', sql.Int, safeOffset)
    .input('Limit', sql.Int, safeLimit);

  const listRes = await listRequest.query(`
    WITH People AS (
      SELECT
        'patient' AS Category,
        p.Id AS ProfileId,
        p.UserId,
        p.HospitalId,
        h.Name AS HospitalName,
        COALESCE(p.UHID, CONCAT('PAT-', p.Id)) AS Identifier,
        p.FirstName,
        p.LastName,
        CONCAT(p.FirstName, ' ', p.LastName) AS FullName,
        COALESCE(p.Email, u.Email) AS Email,
        COALESCE(p.Phone, u.Phone) AS Phone,
        CAST(NULL AS nvarchar(100)) AS DepartmentName,
        CAST(NULL AS nvarchar(100)) AS SpecializationName,
        'active' AS ApprovalStatus,
        ISNULL(u.IsActive, 1) AS IsActive,
        p.CreatedAt,
        'Patient' AS RoleLabel
      FROM dbo.PatientProfiles p
      LEFT JOIN dbo.Users u ON u.Id = p.UserId
      LEFT JOIN dbo.HospitalSetup h ON h.Id = p.HospitalId
      WHERE p.DeletedAt IS NULL
        AND (@HospitalId IS NULL OR p.HospitalId = @HospitalId)

      UNION ALL

      SELECT
        'doctor' AS Category,
        dp.Id AS ProfileId,
        dp.UserId,
        dp.HospitalId,
        h.Name AS HospitalName,
        COALESCE(dp.DoctorId, CONCAT('DOC-', dp.Id)) AS Identifier,
        u.FirstName,
        u.LastName,
        CONCAT(u.FirstName, ' ', u.LastName) AS FullName,
        u.Email,
        u.Phone,
        dep.Name AS DepartmentName,
        sp.Name AS SpecializationName,
        dp.ApprovalStatus AS ApprovalStatus,
        u.IsActive,
        dp.CreatedAt,
        'Doctor' AS RoleLabel
      FROM dbo.DoctorProfiles dp
      JOIN dbo.Users u ON u.Id = dp.UserId
      LEFT JOIN dbo.Departments dep ON dep.Id = dp.DepartmentId
      LEFT JOIN dbo.Specializations sp ON sp.Id = dp.SpecializationId
      LEFT JOIN dbo.HospitalSetup h ON h.Id = dp.HospitalId
      WHERE u.DeletedAt IS NULL
        AND (@HospitalId IS NULL OR dp.HospitalId = @HospitalId)

      UNION ALL

      SELECT
        'staff' AS Category,
        sp.Id AS ProfileId,
        sp.UserId,
        sp.HospitalId,
        h.Name AS HospitalName,
        COALESCE(sp.EmployeeId, CONCAT('STF-', sp.Id)) AS Identifier,
        u.FirstName,
        u.LastName,
        CONCAT(u.FirstName, ' ', u.LastName) AS FullName,
        u.Email,
        u.Phone,
        dep.Name AS DepartmentName,
        COALESCE(sp.Designation, u.Designation, u.Role) AS SpecializationName,
        sp.ApprovalStatus AS ApprovalStatus,
        u.IsActive,
        sp.CreatedAt,
        CASE LOWER(COALESCE(sp.Role, u.Role, 'staff'))
          WHEN 'labtech' THEN 'Lab Technician'
          WHEN 'lab_technician' THEN 'Lab Technician'
          WHEN 'lab_incharge' THEN 'Lab Incharge'
          WHEN 'labincharge' THEN 'Lab Incharge'
          WHEN 'ward_boy' THEN 'Ward Boy'
          WHEN 'admin_staff' THEN 'Admin Staff'
          WHEN 'opdmanager' THEN 'OPD Manager'
          WHEN 'opd_manager' THEN 'OPD Manager'
          ELSE
            UPPER(LEFT(REPLACE(COALESCE(sp.Role, u.Role, 'staff'), '_', ' '), 1)) +
            LOWER(SUBSTRING(REPLACE(COALESCE(sp.Role, u.Role, 'staff'), '_', ' '), 2, 100))
        END AS RoleLabel
      FROM dbo.StaffProfiles sp
      JOIN dbo.Users u ON u.Id = sp.UserId
      LEFT JOIN dbo.Departments dep ON dep.Id = sp.DepartmentId
      LEFT JOIN dbo.HospitalSetup h ON h.Id = sp.HospitalId
      WHERE u.DeletedAt IS NULL
        AND (@HospitalId IS NULL OR sp.HospitalId = @HospitalId)
    )
    SELECT
      Category,
      ProfileId,
      UserId,
      HospitalId,
      HospitalName,
      Identifier,
      FirstName,
      LastName,
      FullName,
      Email,
      Phone,
      DepartmentName,
      SpecializationName,
      ApprovalStatus,
      IsActive,
      CreatedAt,
      RoleLabel
    FROM People
    WHERE (@Category = 'all' OR Category = @Category)
      AND (
        @Search = '' OR
        FullName LIKE '%' + @Search + '%' OR
        Identifier LIKE '%' + @Search + '%' OR
        COALESCE(Email, '') LIKE '%' + @Search + '%' OR
        COALESCE(Phone, '') LIKE '%' + @Search + '%' OR
        COALESCE(DepartmentName, '') LIKE '%' + @Search + '%' OR
        COALESCE(SpecializationName, '') LIKE '%' + @Search + '%'
      )
    ORDER BY CreatedAt DESC
    OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
  `);

  const counts = countRes.recordset[0] || {};
  const totals = {
    patients: counts.Patients || 0,
    doctors: counts.Doctors || 0,
    staff: counts.Staff || 0,
  };

  const totalForCategory =
    safeCategory === 'patient' ? totals.patients :
    safeCategory === 'doctor' ? totals.doctors :
    safeCategory === 'staff' ? totals.staff :
    totals.patients + totals.doctors + totals.staff;

  return {
    hospitalId,
    filters: {
      category: safeCategory,
      search: safeSearch,
      page: safePage,
      limit: safeLimit,
    },
    totals,
    data: listRes.recordset,
    pagination: {
      total: totalForCategory,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.max(1, Math.ceil(totalForCategory / safeLimit)),
    },
  };
};

module.exports = {
  getAdminOverview,
  getOpdOverview,
  getPeopleDirectory,
  resolveHospitalId,
  STAFF_ROLES,
};
