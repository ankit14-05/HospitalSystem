const { randomUUID } = require('crypto');
const { getPool, sql } = require('../config/database');
const AppError = require('../utils/AppError');

const DEFAULT_ACTIVITY_TYPES = [
  { code: 'OPD_SESSION', name: 'OPD Session', category: 'opd', colorToken: 'teal', allowsOpdSlots: true, requiresLocation: true, sortOrder: 1 },
  { code: 'CLINICAL_VISIT', name: 'Clinical Visit', category: 'opd', colorToken: 'blue', allowsOpdSlots: false, requiresLocation: true, sortOrder: 2 },
  { code: 'WARD_VISIT', name: 'Ward Visit', category: 'ward', colorToken: 'blue', allowsOpdSlots: false, requiresLocation: true, sortOrder: 3 },
  { code: 'WARD_ROUND', name: 'Ward Round', category: 'ward', colorToken: 'sky', allowsOpdSlots: false, requiresLocation: true, sortOrder: 4 },
  { code: 'SURGERY', name: 'Surgery', category: 'ot', colorToken: 'indigo', allowsOpdSlots: false, requiresLocation: true, sortOrder: 5 },
  { code: 'PROCEDURE', name: 'Procedure', category: 'ot', colorToken: 'violet', allowsOpdSlots: false, requiresLocation: true, sortOrder: 6 },
  { code: 'TELECONSULT', name: 'Teleconsult', category: 'opd', colorToken: 'violet', allowsOpdSlots: true, requiresLocation: false, sortOrder: 7 },
  { code: 'MEETING', name: 'Meeting', category: 'other', colorToken: 'amber', allowsOpdSlots: false, requiresLocation: false, sortOrder: 8 },
  { code: 'DOCTOR_DISCUSSION', name: 'Doctor Discussion', category: 'other', colorToken: 'orange', allowsOpdSlots: false, requiresLocation: false, sortOrder: 9 },
  { code: 'TEACHING', name: 'Teaching', category: 'other', colorToken: 'purple', allowsOpdSlots: false, requiresLocation: false, sortOrder: 10 },
  { code: 'ADMIN_BLOCK', name: 'Other Duty', category: 'other', colorToken: 'slate', allowsOpdSlots: false, requiresLocation: false, sortOrder: 11 },
  { code: 'LEAVE', name: 'Leave', category: 'other', colorToken: 'rose', allowsOpdSlots: false, requiresLocation: false, sortOrder: 12 },
];

let activityTypeSeedReady = false;
let activityTypeSeedPromise = null;

const normalizeDate = (value) => {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = String(value);
  const match = text.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : text.slice(0, 10);
};

const normalizeTime = (value) => {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(11, 16);
  }
  const text = String(value);
  const match = text.match(/(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : text.slice(0, 5);
};

const toSqlTimeValue = (value) => {
  const time = normalizeTime(value);
  if (!time) return null;

  const [hoursText, minutesText] = time.split(':');
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return null;
  }

  return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0, 0));
};

const toMinutes = (value) => {
  const time = normalizeTime(value);
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const getDateRange = ({ view = 'month', cursorDate }) => {
  const cursor = new Date(`${normalizeDate(cursorDate) || normalizeDate(new Date())}T00:00:00`);
  if (Number.isNaN(cursor.getTime())) {
    throw new AppError('Invalid schedule date', 400);
  }

  const safeView = ['month', 'week', 'day', 'year'].includes(view) ? view : 'month';
  const start = new Date(cursor);
  const end = new Date(cursor);

  if (safeView === 'week') {
    start.setDate(cursor.getDate() - cursor.getDay());
    end.setDate(start.getDate() + 6);
  } else if (safeView === 'year') {
    start.setMonth(0, 1);
    end.setMonth(11, 31);
  } else if (safeView === 'month') {
    start.setDate(1);
    end.setMonth(start.getMonth() + 1, 0);
  }

  return {
    view: safeView,
    cursorDate: normalizeDate(cursor),
    rangeStart: normalizeDate(start),
    rangeEnd: normalizeDate(end),
  };
};

const enumerateRepeatDates = ({
  assignmentDate,
  repeatEnabled,
  repeatFrequency,
  repeatUntil,
  repeatDays,
}) => {
  const startDate = normalizeDate(assignmentDate);
  const untilDate = normalizeDate(repeatUntil || assignmentDate);
  if (!startDate) {
    throw new AppError('Assignment date is required', 400);
  }

  if (!repeatEnabled || !untilDate || untilDate === startDate) {
    return [startDate];
  }

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${untilDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    throw new AppError('Repeat until must be on or after the assignment date', 400);
  }

  const frequency = (repeatFrequency || 'weekly').toLowerCase();
  const validDays = Array.isArray(repeatDays) && repeatDays.length
    ? repeatDays.map((day) => Number(day)).filter((day) => day >= 0 && day <= 6)
    : [start.getDay()];

  const dates = [];
  for (let current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
    if (frequency === 'daily') {
      dates.push(normalizeDate(current));
      continue;
    }
    if (validDays.includes(current.getDay())) {
      dates.push(normalizeDate(current));
    }
  }

  return dates.length ? dates : [startDate];
};

const getSchemaState = async (pool) => {
  const result = await pool.request().query(`
    SELECT name
    FROM sys.tables
    WHERE name IN ('DoctorScheduleActivityTypes', 'DoctorScheduleAssignments', 'OpdSlotSessions')
  `);

  const names = new Set(result.recordset.map((row) => row.name));
  return {
    hasActivityTypes: names.has('DoctorScheduleActivityTypes'),
    hasAssignments: names.has('DoctorScheduleAssignments'),
    hasOpdSlotSessions: names.has('OpdSlotSessions'),
    hasAdvancedScheduling:
      names.has('DoctorScheduleActivityTypes') &&
      names.has('DoctorScheduleAssignments') &&
      names.has('OpdSlotSessions'),
  };
};

const getScheduleMasterState = async (pool) => {
  const result = await pool.request().query(`
    SELECT
      CASE WHEN OBJECT_ID('dbo.HospitalLocations', 'U') IS NULL THEN 0 ELSE 1 END AS HasHospitalLocations,
      CASE WHEN OBJECT_ID('dbo.ShiftTemplates', 'U') IS NULL THEN 0 ELSE 1 END AS HasShiftTemplates,
      CASE WHEN OBJECT_ID('dbo.DoctorWeeklyScheduleTemplates', 'U') IS NULL THEN 0 ELSE 1 END AS HasWeeklyTemplates,
      CASE WHEN COL_LENGTH('dbo.DoctorScheduleAssignments', 'HospitalLocationId') IS NULL THEN 0 ELSE 1 END AS HasAssignmentHospitalLocationId,
      CASE WHEN COL_LENGTH('dbo.DoctorScheduleAssignments', 'ShiftTemplateId') IS NULL THEN 0 ELSE 1 END AS HasAssignmentShiftTemplateId
  `);

  const row = result.recordset[0] || {};
  return {
    hasHospitalLocations: Boolean(row.HasHospitalLocations),
    hasShiftTemplates: Boolean(row.HasShiftTemplates),
    hasWeeklyTemplates: Boolean(row.HasWeeklyTemplates),
    hasAssignmentHospitalLocationId: Boolean(row.HasAssignmentHospitalLocationId),
    hasAssignmentShiftTemplateId: Boolean(row.HasAssignmentShiftTemplateId),
  };
};

const ensureAdvancedScheduling = async (pool) => {
  const schema = await getSchemaState(pool);
  if (!schema.hasAdvancedScheduling) {
    throw new AppError(
      'Advanced scheduling tables are missing. Please run doctor_schedule_v2_updates.sql in MS SQL Server first.',
      400
    );
  }
  return schema;
};

const ensureActivityTypeSeedData = async (pool) => {
  await ensureAdvancedScheduling(pool);

  if (activityTypeSeedReady) {
    return;
  }

  if (!activityTypeSeedPromise) {
    activityTypeSeedPromise = (async () => {
      for (const activityType of DEFAULT_ACTIVITY_TYPES) {
        await pool.request()
          .input('Code', sql.NVarChar(40), activityType.code)
          .input('Name', sql.NVarChar(80), activityType.name)
          .input('Category', sql.NVarChar(30), activityType.category)
          .input('ColorToken', sql.NVarChar(30), activityType.colorToken)
          .input('AllowsOpdSlots', sql.Bit, activityType.allowsOpdSlots ? 1 : 0)
          .input('RequiresLocation', sql.Bit, activityType.requiresLocation ? 1 : 0)
          .input('SortOrder', sql.SmallInt, activityType.sortOrder)
          .query(`
            MERGE dbo.DoctorScheduleActivityTypes AS target
            USING (
              SELECT
                @Code AS Code,
                @Name AS Name,
                @Category AS Category,
                @ColorToken AS ColorToken,
                @AllowsOpdSlots AS AllowsOpdSlots,
                @RequiresLocation AS RequiresLocation,
                @SortOrder AS SortOrder
            ) AS source
            ON target.Code = source.Code
            WHEN MATCHED THEN
              UPDATE SET
                target.Name = source.Name,
                target.Category = source.Category,
                target.ColorToken = source.ColorToken,
                target.AllowsOpdSlots = source.AllowsOpdSlots,
                target.RequiresLocation = source.RequiresLocation,
                target.SortOrder = source.SortOrder,
                target.IsActive = 1,
                target.UpdatedAt = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN
              INSERT (Code, Name, Category, ColorToken, AllowsOpdSlots, RequiresLocation, SortOrder, IsActive)
              VALUES (source.Code, source.Name, source.Category, source.ColorToken, source.AllowsOpdSlots, source.RequiresLocation, source.SortOrder, 1);
          `);
      }
      activityTypeSeedReady = true;
    })().catch((error) => {
      activityTypeSeedPromise = null;
      throw error;
    });
  }

  await activityTypeSeedPromise;
};

const getDoctorSchedulesByIds = async (pool, hospitalId, ids, masterState = null) => {
  const uniqueIds = [...new Set((Array.isArray(ids) ? ids : []).map((value) => Number(value)).filter(Boolean))];
  if (!uniqueIds.length) {
    return [];
  }

  const resolvedMasterState = masterState || await getScheduleMasterState(pool);
  const request = pool.request()
    .input('HospitalId', sql.BigInt, hospitalId);

  const idPlaceholders = uniqueIds.map((id, index) => {
    const name = `Id${index}`;
    request.input(name, sql.BigInt, id);
    return `@${name}`;
  });

  const result = await request.query(`
      SELECT
        a.*,
        ${resolvedMasterState.hasAssignmentHospitalLocationId ? 'a.HospitalLocationId,' : 'CAST(NULL AS BIGINT) AS HospitalLocationId,'}
        ${resolvedMasterState.hasAssignmentShiftTemplateId ? 'a.ShiftTemplateId,' : 'CAST(NULL AS BIGINT) AS ShiftTemplateId,'}
        CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTimeText,
        CONVERT(VARCHAR(5), a.EndTime, 108) AS EndTimeText,
        atp.Code AS ActivityCode,
        atp.Name AS ActivityName,
        atp.Category AS ActivityCategory,
        atp.ColorToken,
        atp.AllowsOpdSlots,
        u.FirstName + ' ' + u.LastName AS DoctorName,
        d.Name AS DepartmentName,
        sp.Name AS SpecializationName,
        r.RoomNumber,
        r.RoomName,
        ${resolvedMasterState.hasHospitalLocations && resolvedMasterState.hasAssignmentHospitalLocationId ? 'hl.Code AS HospitalLocationCode,' : "CAST(NULL AS NVARCHAR(30)) AS HospitalLocationCode,"}
        ${resolvedMasterState.hasHospitalLocations && resolvedMasterState.hasAssignmentHospitalLocationId ? 'hl.Name AS HospitalLocationName,' : "CAST(NULL AS NVARCHAR(120)) AS HospitalLocationName,"}
        ${resolvedMasterState.hasShiftTemplates && resolvedMasterState.hasAssignmentShiftTemplateId ? 'st.Name AS ShiftTemplateName' : "CAST(NULL AS NVARCHAR(120)) AS ShiftTemplateName"}
      FROM dbo.DoctorScheduleAssignments a
      JOIN dbo.DoctorScheduleActivityTypes atp ON atp.Id = a.ActivityTypeId
      JOIN dbo.DoctorProfiles dp ON dp.Id = a.DoctorId
      JOIN dbo.Users u ON u.Id = dp.UserId
      LEFT JOIN dbo.Departments d ON d.Id = a.DepartmentId
      LEFT JOIN dbo.Specializations sp ON sp.Id = a.SpecializationId
      LEFT JOIN dbo.OpdRooms r ON r.Id = a.OpdRoomId
      ${resolvedMasterState.hasHospitalLocations && resolvedMasterState.hasAssignmentHospitalLocationId ? 'LEFT JOIN dbo.HospitalLocations hl ON hl.Id = a.HospitalLocationId' : ''}
      ${resolvedMasterState.hasShiftTemplates && resolvedMasterState.hasAssignmentShiftTemplateId ? 'LEFT JOIN dbo.ShiftTemplates st ON st.Id = a.ShiftTemplateId' : ''}
      WHERE a.HospitalId = @HospitalId
        AND a.Id IN (${idPlaceholders.join(', ')})
    `);

  const rowsById = new Map(result.recordset.map((row) => [Number(row.Id), row]));
  return uniqueIds.map((id) => rowsById.get(id)).filter(Boolean);
};

const getDoctorProfile = async (pool, { doctorId, hospitalId }) => {
  const result = await pool.request()
    .input('DoctorId', sql.BigInt, doctorId)
    .input('HospitalId', sql.BigInt, hospitalId)
    .query(`
      SELECT TOP 1
        dp.Id,
        dp.HospitalId,
        dp.DepartmentId,
        dp.SpecializationId,
        u.FirstName,
        u.LastName,
        u.Id AS UserId
      FROM dbo.DoctorProfiles dp
      JOIN dbo.Users u ON u.Id = dp.UserId
      WHERE dp.Id = @DoctorId
        AND dp.HospitalId = @HospitalId
    `);

  return result.recordset[0] || null;
};

const getActivityTypeById = async (pool, activityTypeId) => {
  const result = await pool.request()
    .input('ActivityTypeId', sql.BigInt, activityTypeId)
    .query(`
      SELECT TOP 1
        Id,
        Code,
        Name,
        Category,
        ColorToken,
        AllowsOpdSlots,
        RequiresLocation
      FROM dbo.DoctorScheduleActivityTypes
      WHERE Id = @ActivityTypeId
        AND IsActive = 1
    `);

  return result.recordset[0] || null;
};

const buildLocationLabel = (location) => {
  if (!location) return null;
  const code = String(location.Code || '').trim();
  const name = String(location.Name || '').trim();
  if (code && name) return `${code} • ${name}`;
  return code || name || null;
};

const getHospitalLocationById = async (pool, { hospitalId, locationId }) => {
  if (!locationId) return null;

  const masterState = await getScheduleMasterState(pool);
  if (!masterState.hasHospitalLocations) return null;

  const result = await pool.request()
    .input('HospitalId', sql.BigInt, hospitalId)
    .input('LocationId', sql.BigInt, locationId)
    .query(`
      SELECT TOP 1
        Id,
        HospitalId,
        DepartmentId,
        LocationKind,
        Code,
        Name,
        Floor,
        Notes,
        IsActive
      FROM dbo.HospitalLocations
      WHERE HospitalId = @HospitalId
        AND Id = @LocationId
        AND IsActive = 1
    `);

  return result.recordset[0] || null;
};

const getShiftTemplateById = async (pool, { hospitalId, shiftTemplateId }) => {
  if (!shiftTemplateId) return null;

  const masterState = await getScheduleMasterState(pool);
  if (!masterState.hasShiftTemplates) return null;

  const result = await pool.request()
    .input('HospitalId', sql.BigInt, hospitalId)
    .input('ShiftTemplateId', sql.BigInt, shiftTemplateId)
    .query(`
      SELECT TOP 1
        st.Id,
        st.HospitalId,
        st.Name,
        st.Category,
        st.ActivityTypeId,
        st.StartTime,
        st.EndTime,
        st.SlotDurationMins,
        st.DefaultMaxSlots,
        st.LocationKind,
        st.OpdRoomId,
        st.HospitalLocationId,
        st.Notes,
        st.IsActive
      FROM dbo.ShiftTemplates st
      WHERE st.HospitalId = @HospitalId
        AND st.Id = @ShiftTemplateId
        AND st.IsActive = 1
    `);

  return result.recordset[0] || null;
};

const findAssignmentConflict = async (pool, {
  doctorId,
  assignmentDate,
  startTime,
  endTime,
  excludeAssignmentId = null,
}) => {
  const result = await pool.request()
    .input('DoctorId', sql.BigInt, doctorId)
    .input('AssignmentDate', sql.Date, assignmentDate)
    .input('StartTime', sql.Time, toSqlTimeValue(startTime))
    .input('EndTime', sql.Time, toSqlTimeValue(endTime))
    .input('ExcludeAssignmentId', sql.BigInt, excludeAssignmentId)
    .query(`
      SELECT TOP 1
        a.Id,
        atp.Name AS ActivityTypeName,
        CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), a.EndTime, 108) AS EndTime
      FROM dbo.DoctorScheduleAssignments a
      JOIN dbo.DoctorScheduleActivityTypes atp ON atp.Id = a.ActivityTypeId
      WHERE a.DoctorId = @DoctorId
        AND a.AssignmentDate = @AssignmentDate
        AND a.Status IN ('Active', 'Published')
        AND (@ExcludeAssignmentId IS NULL OR a.Id <> @ExcludeAssignmentId)
        AND a.StartTime < @EndTime
        AND a.EndTime > @StartTime
      ORDER BY a.StartTime
    `);

  return result.recordset[0] || null;
};

const getActivityTypes = async () => {
  const pool = await getPool();
  const schema = await getSchemaState(pool);

  if (!schema.hasAdvancedScheduling) {
    return DEFAULT_ACTIVITY_TYPES.map((activityType, index) => ({
      Id: index + 1,
      Code: activityType.code,
      Name: activityType.name,
      Category: activityType.category,
      ColorToken: activityType.colorToken,
      AllowsOpdSlots: activityType.allowsOpdSlots,
      RequiresLocation: activityType.requiresLocation,
      SortOrder: activityType.sortOrder,
      IsActive: true,
    }));
  }

  await ensureActivityTypeSeedData(pool);

  const result = await pool.request().query(`
    SELECT
      Id,
      Code,
      Name,
      Category,
      ColorToken,
      AllowsOpdSlots,
      RequiresLocation,
      SortOrder,
      IsActive
    FROM dbo.DoctorScheduleActivityTypes
    WHERE IsActive = 1
    ORDER BY SortOrder, Name
  `);

  return result.recordset;
};

const getDoctorsList = async ({ hospitalId }) => {
  const pool = await getPool();
  const result = await pool.request()
    .input('HospitalId', sql.BigInt, hospitalId)
    .query(`
      SELECT
        dp.Id AS DoctorProfileId,
        dp.UserId,
        dp.DepartmentId,
        dp.SpecializationId,
        dp.ConsultationFee,
        dp.IsAvailable,
        dp.ApprovalStatus,
        u.FirstName + ' ' + u.LastName AS DoctorName,
        u.FirstName,
        u.LastName,
        d.Name AS DepartmentName,
        sp.Name AS SpecializationName
      FROM dbo.DoctorProfiles dp
      JOIN dbo.Users u ON u.Id = dp.UserId
      LEFT JOIN dbo.Departments d ON d.Id = dp.DepartmentId
      LEFT JOIN dbo.Specializations sp ON sp.Id = dp.SpecializationId
      WHERE dp.HospitalId = @HospitalId
        AND u.IsActive = 1
        AND dp.ApprovalStatus IN ('approved', 'pending')
      ORDER BY u.FirstName, u.LastName
    `);

  return result.recordset;
};

const getRooms = async ({ hospitalId }) => {
  const pool = await getPool();
  const result = await pool.request()
    .input('HospitalId', sql.BigInt, hospitalId)
    .query(`
      SELECT
        r.Id,
        r.HospitalId,
        r.DepartmentId,
        r.RoomNumber,
        r.RoomName,
        r.Floor,
        r.Notes,
        ISNULL(r.IsActive, 1) AS IsActive,
        d.Name AS DepartmentName
      FROM dbo.OpdRooms r
      LEFT JOIN dbo.Departments d ON d.Id = r.DepartmentId
      WHERE r.HospitalId = @HospitalId
        AND ISNULL(r.IsActive, 1) = 1
      ORDER BY TRY_CONVERT(INT, r.RoomNumber), r.RoomNumber, r.RoomName
    `);

  return result.recordset;
};

const getLocations = async ({ hospitalId, locationKind = null, departmentId = null, search = '' }) => {
  const pool = await getPool();
  const masterState = await getScheduleMasterState(pool);
  if (!masterState.hasHospitalLocations) {
    return [];
  }

  const result = await pool.request()
    .input('HospitalId', sql.BigInt, hospitalId)
    .input('LocationKind', sql.NVarChar(30), locationKind || null)
    .input('DepartmentId', sql.BigInt, departmentId || null)
    .input('Search', sql.NVarChar, search ? `%${search.trim()}%` : null)
    .query(`
      SELECT
        hl.Id,
        hl.HospitalId,
        hl.DepartmentId,
        hl.LocationKind,
        hl.Code,
        hl.Name,
        hl.Floor,
        hl.Notes,
        hl.IsActive,
        d.Name AS DepartmentName
      FROM dbo.HospitalLocations hl
      LEFT JOIN dbo.Departments d ON d.Id = hl.DepartmentId
      WHERE hl.HospitalId = @HospitalId
        AND hl.IsActive = 1
        AND (@LocationKind IS NULL OR hl.LocationKind = @LocationKind)
        AND (@DepartmentId IS NULL OR hl.DepartmentId = @DepartmentId OR hl.DepartmentId IS NULL)
        AND (
          @Search IS NULL
          OR hl.Code LIKE @Search
          OR hl.Name LIKE @Search
          OR d.Name LIKE @Search
        )
      ORDER BY hl.LocationKind, hl.Name, hl.Code
    `);

  return result.recordset;
};

const getShiftTemplates = async ({ hospitalId, category = null, activityTypeId = null, doctorId = null }) => {
  const pool = await getPool();
  const masterState = await getScheduleMasterState(pool);
  if (!masterState.hasShiftTemplates) {
    return [];
  }

  const result = await pool.request()
    .input('HospitalId', sql.BigInt, hospitalId)
    .input('Category', sql.NVarChar(30), category || null)
    .input('ActivityTypeId', sql.BigInt, activityTypeId || null)
    .input('DoctorId', sql.BigInt, doctorId || null)
    .query(`
      SELECT
        st.Id,
        st.HospitalId,
        st.Name,
        st.Category,
        st.ActivityTypeId,
        CONVERT(VARCHAR(5), st.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), st.EndTime, 108) AS EndTime,
        st.SlotDurationMins,
        st.DefaultMaxSlots,
        st.LocationKind,
        st.OpdRoomId,
        st.HospitalLocationId,
        st.Notes,
        st.IsActive,
        atp.Code AS ActivityCode,
        atp.Name AS ActivityName,
        r.RoomNumber,
        r.RoomName,
        hl.Code AS LocationCode,
        hl.Name AS LocationName
      FROM dbo.ShiftTemplates st
      LEFT JOIN dbo.DoctorScheduleActivityTypes atp ON atp.Id = st.ActivityTypeId
      LEFT JOIN dbo.OpdRooms r ON r.Id = st.OpdRoomId
      LEFT JOIN dbo.HospitalLocations hl ON hl.Id = st.HospitalLocationId
      WHERE st.HospitalId = @HospitalId
        AND st.IsActive = 1
        AND (@Category IS NULL OR st.Category = @Category)
        AND (@ActivityTypeId IS NULL OR st.ActivityTypeId = @ActivityTypeId)
      ORDER BY st.Category, st.Name, st.StartTime
    `);

  return result.recordset;
};

const getWeeklyTemplates = async ({ hospitalId, doctorId = null }) => {
  const pool = await getPool();
  const masterState = await getScheduleMasterState(pool);
  if (!masterState.hasWeeklyTemplates) {
    return [];
  }

  const result = await pool.request()
    .input('HospitalId', sql.BigInt, hospitalId)
    .input('DoctorId', sql.BigInt, doctorId || null)
    .query(`
      SELECT
        wt.Id,
        wt.HospitalId,
        wt.DoctorId,
        wt.DepartmentId,
        wt.SpecializationId,
        wt.DayOfWeek,
        wt.Category,
        wt.ActivityTypeId,
        wt.ShiftTemplateId,
        wt.Title,
        CONVERT(VARCHAR(5), wt.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), wt.EndTime, 108) AS EndTime,
        wt.LocationKind,
        wt.OpdRoomId,
        wt.HospitalLocationId,
        wt.SlotDurationMins,
        wt.MaxSlots,
        wt.BookingEnabled,
        wt.Notes,
        wt.IsActive,
        atp.Code AS ActivityCode,
        atp.Name AS ActivityName,
        st.Name AS ShiftTemplateName,
        u.FirstName + ' ' + u.LastName AS DoctorName,
        hl.Code AS LocationCode,
        hl.Name AS LocationName,
        r.RoomNumber,
        r.RoomName
      FROM dbo.DoctorWeeklyScheduleTemplates wt
      JOIN dbo.DoctorProfiles dp ON dp.Id = wt.DoctorId
      JOIN dbo.Users u ON u.Id = dp.UserId
      LEFT JOIN dbo.DoctorScheduleActivityTypes atp ON atp.Id = wt.ActivityTypeId
      LEFT JOIN dbo.ShiftTemplates st ON st.Id = wt.ShiftTemplateId
      LEFT JOIN dbo.HospitalLocations hl ON hl.Id = wt.HospitalLocationId
      LEFT JOIN dbo.OpdRooms r ON r.Id = wt.OpdRoomId
      WHERE wt.HospitalId = @HospitalId
        AND wt.IsActive = 1
        AND (@DoctorId IS NULL OR wt.DoctorId = @DoctorId)
      ORDER BY wt.DoctorId, wt.DayOfWeek, wt.StartTime
    `);

  return result.recordset;
};

const saveWeeklyTemplate = async ({ hospitalId, userId, body }) => {
  const pool = await getPool();
  const masterState = await getScheduleMasterState(pool);
  if (!masterState.hasWeeklyTemplates) {
    throw new AppError(
      'Weekly schedule template tables are missing. Please run schedule_master_support_updates.sql in MS SQL Server first.',
      400
    );
  }

  const doctorId = Number(body.DoctorId);
  const dayOfWeek = Number(body.DayOfWeek);
  const category = String(body.Category || 'other').toLowerCase();
  const shiftTemplateId = Number(body.ShiftTemplateId) || null;
  const hospitalLocationId = Number(body.HospitalLocationId) || null;
  const activityTypeId = Number(body.ActivityTypeId) || null;
  const startTime = normalizeTime(body.StartTime);
  const endTime = normalizeTime(body.EndTime);

  if (!doctorId || !Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    throw new AppError('Doctor and weekday are required for the weekly template', 400);
  }

  const shiftTemplate = await getShiftTemplateById(pool, { hospitalId, shiftTemplateId });
  const hospitalLocation = await getHospitalLocationById(pool, { hospitalId, locationId: hospitalLocationId });

  const resolvedStartTime = startTime || normalizeTime(shiftTemplate?.StartTime);
  const resolvedEndTime = endTime || normalizeTime(shiftTemplate?.EndTime);
  if (!resolvedStartTime || !resolvedEndTime || toMinutes(resolvedEndTime) <= toMinutes(resolvedStartTime)) {
    throw new AppError('A valid weekly template time range is required', 400);
  }

  const result = await pool.request()
    .input('HospitalId', sql.BigInt, hospitalId)
    .input('DoctorId', sql.BigInt, doctorId)
    .input('DepartmentId', sql.BigInt, Number(body.DepartmentId) || null)
    .input('SpecializationId', sql.Int, Number(body.SpecializationId) || null)
    .input('DayOfWeek', sql.TinyInt, dayOfWeek)
    .input('Category', sql.NVarChar(30), category)
    .input('ActivityTypeId', sql.BigInt, activityTypeId || Number(shiftTemplate?.ActivityTypeId) || null)
    .input('ShiftTemplateId', sql.BigInt, shiftTemplateId)
    .input('Title', sql.NVarChar(150), body.Title || shiftTemplate?.Name || null)
    .input('StartTime', sql.Time, toSqlTimeValue(resolvedStartTime))
    .input('EndTime', sql.Time, toSqlTimeValue(resolvedEndTime))
    .input('LocationKind', sql.NVarChar(30), body.LocationKind || shiftTemplate?.LocationKind || (category === 'opd' ? 'opd_room' : 'general'))
    .input('OpdRoomId', sql.BigInt, Number(body.OpdRoomId) || Number(shiftTemplate?.OpdRoomId) || null)
    .input('HospitalLocationId', sql.BigInt, hospitalLocationId || Number(shiftTemplate?.HospitalLocationId) || null)
    .input('SlotDurationMins', sql.SmallInt, Number(body.SlotDurationMins) || Number(shiftTemplate?.SlotDurationMins) || null)
    .input('MaxSlots', sql.SmallInt, Number(body.MaxSlots) || Number(shiftTemplate?.DefaultMaxSlots) || null)
    .input('BookingEnabled', sql.Bit, body.BookingEnabled !== undefined ? (body.BookingEnabled ? 1 : 0) : (category === 'opd' ? 1 : 0))
    .input('Notes', sql.NVarChar(500), body.Notes || shiftTemplate?.Notes || hospitalLocation?.Notes || null)
    .input('CreatedBy', sql.BigInt, userId)
    .input('UpdatedBy', sql.BigInt, userId)
    .query(`
      MERGE dbo.DoctorWeeklyScheduleTemplates AS target
      USING (
        SELECT
          @HospitalId AS HospitalId,
          @DoctorId AS DoctorId,
          @DayOfWeek AS DayOfWeek,
          @Category AS Category
      ) AS source
      ON target.HospitalId = source.HospitalId
         AND target.DoctorId = source.DoctorId
         AND target.DayOfWeek = source.DayOfWeek
         AND target.Category = source.Category
         AND target.IsActive = 1
      WHEN MATCHED THEN
        UPDATE SET
          target.DepartmentId = @DepartmentId,
          target.SpecializationId = @SpecializationId,
          target.ActivityTypeId = @ActivityTypeId,
          target.ShiftTemplateId = @ShiftTemplateId,
          target.Title = @Title,
          target.StartTime = @StartTime,
          target.EndTime = @EndTime,
          target.LocationKind = @LocationKind,
          target.OpdRoomId = @OpdRoomId,
          target.HospitalLocationId = @HospitalLocationId,
          target.SlotDurationMins = @SlotDurationMins,
          target.MaxSlots = @MaxSlots,
          target.BookingEnabled = @BookingEnabled,
          target.Notes = @Notes,
          target.UpdatedBy = @UpdatedBy,
          target.UpdatedAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (
          HospitalId, DoctorId, DepartmentId, SpecializationId, DayOfWeek, Category, ActivityTypeId,
          ShiftTemplateId, Title, StartTime, EndTime, LocationKind, OpdRoomId, HospitalLocationId,
          SlotDurationMins, MaxSlots, BookingEnabled, Notes, IsActive, CreatedBy, UpdatedBy
        )
        VALUES (
          @HospitalId, @DoctorId, @DepartmentId, @SpecializationId, @DayOfWeek, @Category, @ActivityTypeId,
          @ShiftTemplateId, @Title, @StartTime, @EndTime, @LocationKind, @OpdRoomId, @HospitalLocationId,
          @SlotDurationMins, @MaxSlots, @BookingEnabled, @Notes, 1, @CreatedBy, @UpdatedBy
        );
    `);

  return result.rowsAffected;
};

const deleteWeeklyTemplate = async ({ hospitalId, doctorId, dayOfWeek, category }) => {
  const pool = await getPool();
  const masterState = await getScheduleMasterState(pool);
  if (!masterState.hasWeeklyTemplates) return false;

  await pool.request()
    .input('HospitalId', sql.BigInt, hospitalId)
    .input('DoctorId', sql.BigInt, doctorId)
    .input('DayOfWeek', sql.TinyInt, dayOfWeek)
    .input('Category', sql.NVarChar(30), category)
    .query(`
      UPDATE dbo.DoctorWeeklyScheduleTemplates
      SET IsActive = 0,
          UpdatedAt = SYSUTCDATETIME()
      WHERE HospitalId = @HospitalId
        AND DoctorId = @DoctorId
        AND DayOfWeek = @DayOfWeek
        AND Category = @Category
        AND IsActive = 1
    `);

  return true;
};

const listDoctorSchedules = async ({
  hospitalId,
  doctorId = null,
  departmentId = null,
  specializationId = null,
  activityTypeId = null,
  search = '',
  view = 'month',
  cursorDate = null,
  startDate = null,
  endDate = null,
}) => {
  const pool = await getPool();
  await ensureActivityTypeSeedData(pool);
  const masterState = await getScheduleMasterState(pool);

  const range = startDate && endDate
    ? { view, cursorDate: normalizeDate(cursorDate || startDate), rangeStart: normalizeDate(startDate), rangeEnd: normalizeDate(endDate) }
    : getDateRange({ view, cursorDate });

  const result = await pool.request()
    .input('HospitalId', sql.BigInt, hospitalId)
    .input('DoctorId', sql.BigInt, doctorId)
    .input('DepartmentId', sql.BigInt, departmentId)
    .input('SpecializationId', sql.BigInt, specializationId)
    .input('ActivityTypeId', sql.BigInt, activityTypeId)
    .input('Search', sql.NVarChar, search ? `%${search.trim()}%` : null)
    .input('RangeStart', sql.Date, range.rangeStart)
    .input('RangeEnd', sql.Date, range.rangeEnd)
    .query(`
      SELECT
        a.Id,
        a.HospitalId,
        a.DoctorId,
        a.DepartmentId,
        a.SpecializationId,
        a.ActivityTypeId,
        ${masterState.hasAssignmentHospitalLocationId ? 'a.HospitalLocationId,' : 'CAST(NULL AS BIGINT) AS HospitalLocationId,'}
        ${masterState.hasAssignmentShiftTemplateId ? 'a.ShiftTemplateId,' : 'CAST(NULL AS BIGINT) AS ShiftTemplateId,'}
        a.SeriesId,
        a.SeriesLabel,
        a.AssignmentDate,
        CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), a.EndTime, 108) AS EndTime,
        a.Title,
        a.LocationKind,
        a.OpdRoomId,
        a.LocationLabel,
        a.SlotDurationMins,
        a.MaxSlots,
        a.BookingEnabled,
        a.Status,
        a.Notes,
        a.CreatedAt,
        a.UpdatedAt,
        atp.Code AS ActivityCode,
        atp.Name AS ActivityName,
        atp.Category AS ActivityCategory,
        atp.ColorToken,
        atp.AllowsOpdSlots,
        u.FirstName + ' ' + u.LastName AS DoctorName,
        d.Name AS DepartmentName,
        sp.Name AS SpecializationName,
        r.RoomNumber,
        r.RoomName,
        ${masterState.hasHospitalLocations && masterState.hasAssignmentHospitalLocationId ? 'hl.Code AS HospitalLocationCode,' : "CAST(NULL AS NVARCHAR(30)) AS HospitalLocationCode,"}
        ${masterState.hasHospitalLocations && masterState.hasAssignmentHospitalLocationId ? 'hl.Name AS HospitalLocationName,' : "CAST(NULL AS NVARCHAR(120)) AS HospitalLocationName,"}
        ${masterState.hasShiftTemplates && masterState.hasAssignmentShiftTemplateId ? 'st.Name AS ShiftTemplateName,' : "CAST(NULL AS NVARCHAR(120)) AS ShiftTemplateName,"}
        (SELECT COUNT(*) FROM dbo.OpdSlotSessions sess WHERE sess.AssignmentId = a.Id AND sess.Status <> 'Cancelled') AS PublishedSessionCount,
        (SELECT COUNT(*) FROM dbo.AppointmentSlots slots WHERE slots.AssignmentId = a.Id) AS GeneratedSlotCount
      FROM dbo.DoctorScheduleAssignments a
      JOIN dbo.DoctorScheduleActivityTypes atp ON atp.Id = a.ActivityTypeId
      JOIN dbo.DoctorProfiles dp ON dp.Id = a.DoctorId
      JOIN dbo.Users u ON u.Id = dp.UserId
      LEFT JOIN dbo.Departments d ON d.Id = a.DepartmentId
      LEFT JOIN dbo.Specializations sp ON sp.Id = a.SpecializationId
      LEFT JOIN dbo.OpdRooms r ON r.Id = a.OpdRoomId
      ${masterState.hasHospitalLocations && masterState.hasAssignmentHospitalLocationId ? 'LEFT JOIN dbo.HospitalLocations hl ON hl.Id = a.HospitalLocationId' : ''}
      ${masterState.hasShiftTemplates && masterState.hasAssignmentShiftTemplateId ? 'LEFT JOIN dbo.ShiftTemplates st ON st.Id = a.ShiftTemplateId' : ''}
      WHERE a.HospitalId = @HospitalId
        AND a.AssignmentDate BETWEEN @RangeStart AND @RangeEnd
        AND (@DoctorId IS NULL OR a.DoctorId = @DoctorId)
        AND (@DepartmentId IS NULL OR a.DepartmentId = @DepartmentId)
        AND (@SpecializationId IS NULL OR a.SpecializationId = @SpecializationId)
        AND (@ActivityTypeId IS NULL OR a.ActivityTypeId = @ActivityTypeId)
        AND (
          @Search IS NULL
          OR u.FirstName LIKE @Search
          OR u.LastName LIKE @Search
          OR CONCAT(u.FirstName, ' ', u.LastName) LIKE @Search
          OR d.Name LIKE @Search
          OR sp.Name LIKE @Search
          OR atp.Name LIKE @Search
          OR a.Title LIKE @Search
          OR a.LocationLabel LIKE @Search
        )
      ORDER BY a.AssignmentDate, a.StartTime, u.FirstName, u.LastName
    `);

  return {
    ...range,
    assignments: result.recordset,
  };
};

const getDoctorScheduleById = async ({ hospitalId, id, pool: existingPool = null, masterState = null }) => {
  const pool = existingPool || await getPool();
  await ensureActivityTypeSeedData(pool);
  const rows = await getDoctorSchedulesByIds(pool, hospitalId, [id], masterState);
  return rows[0] || null;
};

const createDoctorSchedule = async ({ hospitalId, userId, body }) => {
  const pool = await getPool();
  await ensureActivityTypeSeedData(pool);
  const masterState = await getScheduleMasterState(pool);

  const doctorId = Number(body.DoctorId);
  const shiftTemplateId =
    masterState.hasShiftTemplates && Number(body.ShiftTemplateId) > 0 ? Number(body.ShiftTemplateId) : null;
  const requestedHospitalLocationId =
    masterState.hasHospitalLocations && masterState.hasAssignmentHospitalLocationId && Number(body.HospitalLocationId) > 0
      ? Number(body.HospitalLocationId)
      : null;
  const shiftTemplate = await getShiftTemplateById(pool, { hospitalId, shiftTemplateId });
  const hospitalLocation =
    (await getHospitalLocationById(pool, { hospitalId, locationId: requestedHospitalLocationId })) ||
    (shiftTemplate?.HospitalLocationId
      ? await getHospitalLocationById(pool, { hospitalId, locationId: shiftTemplate.HospitalLocationId })
      : null);
  const activityTypeId = Number(body.ActivityTypeId);
  const assignmentDate = normalizeDate(body.AssignmentDate);
  const startTime = normalizeTime(body.StartTime || shiftTemplate?.StartTime);
  const endTime = normalizeTime(body.EndTime || shiftTemplate?.EndTime);

  if (!doctorId || !activityTypeId || !assignmentDate || !startTime || !endTime) {
    throw new AppError('Doctor, activity type, date, start time, and end time are required', 400);
  }
  if (toMinutes(endTime) <= toMinutes(startTime)) {
    throw new AppError('End time must be after start time', 400);
  }

  const doctor = await getDoctorProfile(pool, { doctorId, hospitalId });
  if (!doctor) {
    throw new AppError('Doctor not found', 404);
  }

  const activityType = await getActivityTypeById(pool, activityTypeId);
  if (!activityType) {
    throw new AppError('Activity type not found', 404);
  }

  const finalLocationKind =
    body.LocationKind || shiftTemplate?.LocationKind || (activityType.AllowsOpdSlots ? 'opd_room' : 'general');
  const finalOpdRoomId = Number(body.OpdRoomId) || Number(shiftTemplate?.OpdRoomId) || null;
  const finalHospitalLocationId =
    masterState.hasHospitalLocations && masterState.hasAssignmentHospitalLocationId
      ? requestedHospitalLocationId || Number(shiftTemplate?.HospitalLocationId) || null
      : null;
  const finalLocationLabel =
    (body.LocationLabel !== undefined ? String(body.LocationLabel || '').trim() : '') ||
    buildLocationLabel(hospitalLocation) ||
    null;
  const finalSlotDurationMins = Number(body.SlotDurationMins) || Number(shiftTemplate?.SlotDurationMins) || null;
  const finalMaxSlots = Number(body.MaxSlots) || Number(shiftTemplate?.DefaultMaxSlots) || null;
  const finalTitle = body.Title || shiftTemplate?.Name || activityType.Name;
  const finalNotes =
    (body.Notes !== undefined ? String(body.Notes || '').trim() : '') ||
    shiftTemplate?.Notes ||
    null;

  const repeatDates = enumerateRepeatDates({
    assignmentDate,
    repeatEnabled: body.RepeatEnabled,
    repeatFrequency: body.RepeatFrequency,
    repeatUntil: body.RepeatUntil,
    repeatDays: body.RepeatDays,
  });

  const seriesId = repeatDates.length > 1 ? randomUUID() : null;
  const createdIds = [];

  for (const date of repeatDates) {
    const conflict = await findAssignmentConflict(pool, {
      doctorId,
      assignmentDate: date,
      startTime,
      endTime,
    });
    if (conflict) {
      throw new AppError(
        `Dr. ${doctor.FirstName} ${doctor.LastName} already has ${conflict.ActivityTypeName} from ${conflict.StartTime} to ${conflict.EndTime} on ${date}`,
        409
      );
    }

    const request = pool.request()
      .input('HospitalId', sql.BigInt, hospitalId)
      .input('DoctorId', sql.BigInt, doctorId)
      .input('DepartmentId', sql.BigInt, Number(body.DepartmentId) || doctor.DepartmentId || null)
      .input('SpecializationId', sql.Int, Number(body.SpecializationId) || doctor.SpecializationId || null)
      .input('ActivityTypeId', sql.BigInt, activityTypeId)
      .input('ShiftTemplateId', sql.BigInt, shiftTemplateId)
      .input('HospitalLocationId', sql.BigInt, finalHospitalLocationId)
      .input('SeriesId', sql.UniqueIdentifier, seriesId)
      .input('SeriesLabel', sql.NVarChar(120), body.SeriesLabel || null)
      .input('AssignmentDate', sql.Date, date)
      .input('StartTime', sql.Time, toSqlTimeValue(startTime))
      .input('EndTime', sql.Time, toSqlTimeValue(endTime))
      .input('Title', sql.NVarChar(150), finalTitle)
      .input('LocationKind', sql.NVarChar(30), finalLocationKind)
      .input('OpdRoomId', sql.BigInt, finalOpdRoomId)
      .input('LocationLabel', sql.NVarChar(160), finalLocationLabel)
      .input('SlotDurationMins', sql.SmallInt, finalSlotDurationMins)
      .input('MaxSlots', sql.SmallInt, finalMaxSlots)
      .input('BookingEnabled', sql.Bit, body.BookingEnabled !== undefined ? (body.BookingEnabled ? 1 : 0) : (activityType.AllowsOpdSlots ? 1 : 0))
      .input('Status', sql.NVarChar(20), 'Active')
      .input('Notes', sql.NVarChar(500), finalNotes)
      .input('CreatedBy', sql.BigInt, userId)
      .input('UpdatedBy', sql.BigInt, userId);

    const insertResult = await request.query(`
        INSERT INTO dbo.DoctorScheduleAssignments
          (HospitalId, DoctorId, DepartmentId, SpecializationId, ActivityTypeId,
           ${masterState.hasAssignmentShiftTemplateId ? 'ShiftTemplateId,' : ''}
           ${masterState.hasAssignmentHospitalLocationId ? 'HospitalLocationId,' : ''}
           SeriesId, SeriesLabel,
           AssignmentDate, StartTime, EndTime, Title, LocationKind, OpdRoomId, LocationLabel,
           SlotDurationMins, MaxSlots, BookingEnabled, Status, Notes, CreatedBy, UpdatedBy)
        OUTPUT INSERTED.Id
        VALUES
          (@HospitalId, @DoctorId, @DepartmentId, @SpecializationId, @ActivityTypeId,
           ${masterState.hasAssignmentShiftTemplateId ? '@ShiftTemplateId,' : ''}
           ${masterState.hasAssignmentHospitalLocationId ? '@HospitalLocationId,' : ''}
           @SeriesId, @SeriesLabel,
           @AssignmentDate, @StartTime, @EndTime, @Title, @LocationKind, @OpdRoomId, @LocationLabel,
           @SlotDurationMins, @MaxSlots, @BookingEnabled, @Status, @Notes, @CreatedBy, @UpdatedBy)
      `);

    const createdId = insertResult.recordset[0]?.Id;
    if (createdId) {
      createdIds.push(createdId);
    }
  }

  return getDoctorSchedulesByIds(pool, hospitalId, createdIds, masterState);
};

const updateDoctorSchedule = async ({ hospitalId, userId, id, body }) => {
  const pool = await getPool();
  await ensureActivityTypeSeedData(pool);
  const masterState = await getScheduleMasterState(pool);

  const existing = await getDoctorScheduleById({ hospitalId, id });
  if (!existing) {
    throw new AppError('Schedule assignment not found', 404);
  }

  const shiftTemplateId =
    masterState.hasShiftTemplates && Number(body.ShiftTemplateId || existing.ShiftTemplateId) > 0
      ? Number(body.ShiftTemplateId || existing.ShiftTemplateId)
      : null;
  const shiftTemplate = await getShiftTemplateById(pool, { hospitalId, shiftTemplateId });
  const requestedHospitalLocationId =
    masterState.hasHospitalLocations && masterState.hasAssignmentHospitalLocationId && Number(body.HospitalLocationId || existing.HospitalLocationId) > 0
      ? Number(body.HospitalLocationId || existing.HospitalLocationId)
      : null;
  const hospitalLocation =
    (await getHospitalLocationById(pool, { hospitalId, locationId: requestedHospitalLocationId })) ||
    (shiftTemplate?.HospitalLocationId
      ? await getHospitalLocationById(pool, { hospitalId, locationId: shiftTemplate.HospitalLocationId })
      : null);

  const activityTypeId = Number(body.ActivityTypeId || existing.ActivityTypeId);
  const activityType = await getActivityTypeById(pool, activityTypeId);
  if (!activityType) {
    throw new AppError('Activity type not found', 404);
  }

  const nextDate = normalizeDate(body.AssignmentDate || existing.AssignmentDate);
  const nextStart = normalizeTime(body.StartTime || shiftTemplate?.StartTime || existing.StartTimeText || existing.StartTime);
  const nextEnd = normalizeTime(body.EndTime || shiftTemplate?.EndTime || existing.EndTimeText || existing.EndTime);

  if (!nextDate || !nextStart || !nextEnd) {
    throw new AppError('Date, start time, and end time are required', 400);
  }
  if (toMinutes(nextEnd) <= toMinutes(nextStart)) {
    throw new AppError('End time must be after start time', 400);
  }

  const conflict = await findAssignmentConflict(pool, {
    doctorId: Number(body.DoctorId || existing.DoctorId),
    assignmentDate: nextDate,
    startTime: nextStart,
    endTime: nextEnd,
    excludeAssignmentId: id,
  });
  if (conflict) {
    throw new AppError(
      `${conflict.ActivityTypeName} already exists from ${conflict.StartTime} to ${conflict.EndTime} on ${nextDate}`,
      409
    );
  }

  const slotSessionCount = await pool.request()
    .input('AssignmentId', sql.BigInt, id)
    .query(`
      SELECT COUNT(*) AS Total
      FROM dbo.OpdSlotSessions
      WHERE AssignmentId = @AssignmentId
        AND Status <> 'Cancelled'
    `);

  if (Number(slotSessionCount.recordset[0]?.Total || 0) > 0) {
    const originalStart = normalizeTime(existing.StartTimeText || existing.StartTime);
    const originalEnd = normalizeTime(existing.EndTimeText || existing.EndTime);
    if (nextDate !== normalizeDate(existing.AssignmentDate) || nextStart !== originalStart || nextEnd !== originalEnd) {
      throw new AppError('This schedule already has published OPD slot sessions. Cancel those slot sessions before changing date or time.', 409);
    }
  }

  const finalLocationKind =
    body.LocationKind || shiftTemplate?.LocationKind || existing.LocationKind || (activityType.AllowsOpdSlots ? 'opd_room' : 'general');
  const finalOpdRoomId = Number(body.OpdRoomId || shiftTemplate?.OpdRoomId || existing.OpdRoomId) || null;
  const finalHospitalLocationId =
    masterState.hasHospitalLocations && masterState.hasAssignmentHospitalLocationId
      ? requestedHospitalLocationId || Number(shiftTemplate?.HospitalLocationId) || null
      : null;
  const finalLocationLabel =
    (body.LocationLabel !== undefined ? String(body.LocationLabel || '').trim() : '') ||
    buildLocationLabel(hospitalLocation) ||
    existing.LocationLabel ||
    null;
  const finalTitle = body.Title || shiftTemplate?.Name || existing.Title || activityType.Name;
  const finalNotes =
    (body.Notes !== undefined ? String(body.Notes || '').trim() : '') ||
    shiftTemplate?.Notes ||
    existing.Notes ||
    null;

  const request = pool.request()
    .input('Id', sql.BigInt, id)
    .input('HospitalId', sql.BigInt, hospitalId)
    .input('DoctorId', sql.BigInt, Number(body.DoctorId || existing.DoctorId))
    .input('DepartmentId', sql.BigInt, Number(body.DepartmentId || existing.DepartmentId) || null)
    .input('SpecializationId', sql.Int, Number(body.SpecializationId || existing.SpecializationId) || null)
    .input('ActivityTypeId', sql.BigInt, activityTypeId)
    .input('ShiftTemplateId', sql.BigInt, shiftTemplateId)
    .input('HospitalLocationId', sql.BigInt, finalHospitalLocationId)
    .input('AssignmentDate', sql.Date, nextDate)
    .input('StartTime', sql.Time, toSqlTimeValue(nextStart))
    .input('EndTime', sql.Time, toSqlTimeValue(nextEnd))
    .input('Title', sql.NVarChar(150), finalTitle)
    .input('LocationKind', sql.NVarChar(30), finalLocationKind)
    .input('OpdRoomId', sql.BigInt, finalOpdRoomId)
    .input('LocationLabel', sql.NVarChar(160), finalLocationLabel)
    .input('SlotDurationMins', sql.SmallInt, Number(body.SlotDurationMins || shiftTemplate?.SlotDurationMins || existing.SlotDurationMins) || null)
    .input('MaxSlots', sql.SmallInt, Number(body.MaxSlots || shiftTemplate?.DefaultMaxSlots || existing.MaxSlots) || null)
    .input('BookingEnabled', sql.Bit, body.BookingEnabled !== undefined ? (body.BookingEnabled ? 1 : 0) : existing.BookingEnabled)
    .input('Status', sql.NVarChar(20), body.Status || existing.Status || 'Active')
    .input('Notes', sql.NVarChar(500), finalNotes)
    .input('UpdatedBy', sql.BigInt, userId);

  await request.query(`
      UPDATE dbo.DoctorScheduleAssignments
      SET DoctorId = @DoctorId,
          DepartmentId = @DepartmentId,
          SpecializationId = @SpecializationId,
          ActivityTypeId = @ActivityTypeId,
          ${masterState.hasAssignmentShiftTemplateId ? 'ShiftTemplateId = @ShiftTemplateId,' : ''}
          ${masterState.hasAssignmentHospitalLocationId ? 'HospitalLocationId = @HospitalLocationId,' : ''}
          AssignmentDate = @AssignmentDate,
          StartTime = @StartTime,
          EndTime = @EndTime,
          Title = @Title,
          LocationKind = @LocationKind,
          OpdRoomId = @OpdRoomId,
          LocationLabel = @LocationLabel,
          SlotDurationMins = @SlotDurationMins,
          MaxSlots = @MaxSlots,
          BookingEnabled = @BookingEnabled,
          Status = @Status,
          Notes = @Notes,
          UpdatedBy = @UpdatedBy,
          UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @Id
        AND HospitalId = @HospitalId
    `);

  return getDoctorScheduleById({ hospitalId, id });
};

const deleteDoctorSchedule = async ({ hospitalId, userId, id }) => {
  const pool = await getPool();
  await ensureActivityTypeSeedData(pool);

  const existing = await getDoctorScheduleById({ hospitalId, id });
  if (!existing) {
    throw new AppError('Schedule assignment not found', 404);
  }

  await pool.request()
    .input('Id', sql.BigInt, id)
    .input('HospitalId', sql.BigInt, hospitalId)
    .input('UpdatedBy', sql.BigInt, userId)
    .query(`
      UPDATE dbo.DoctorScheduleAssignments
      SET Status = 'Cancelled',
          UpdatedBy = @UpdatedBy,
          UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @Id
        AND HospitalId = @HospitalId
    `);

  await pool.request()
    .input('AssignmentId', sql.BigInt, id)
    .input('UpdatedBy', sql.BigInt, userId)
    .query(`
      UPDATE dbo.OpdSlotSessions
      SET Status = 'Cancelled',
          UpdatedBy = @UpdatedBy,
          UpdatedAt = SYSUTCDATETIME()
      WHERE AssignmentId = @AssignmentId
        AND Status <> 'Cancelled'
    `);

  return true;
};

const getDayOverview = async ({ hospitalId, doctorId, date }) => {
  const pool = await getPool();
  await ensureActivityTypeSeedData(pool);
  const masterState = await getScheduleMasterState(pool);

  const doctor = await getDoctorProfile(pool, { doctorId, hospitalId });
  if (!doctor) {
    throw new AppError('Doctor not found', 404);
  }

  const day = normalizeDate(date);
  if (!day) {
    throw new AppError('Date is required', 400);
  }

  const [assignmentsResult, sessionsResult] = await Promise.all([
    pool.request()
      .input('HospitalId', sql.BigInt, hospitalId)
      .input('DoctorId', sql.BigInt, doctorId)
      .input('AssignmentDate', sql.Date, day)
      .query(`
        SELECT
          a.Id,
          a.AssignmentDate,
          CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
          CONVERT(VARCHAR(5), a.EndTime, 108) AS EndTime,
          ${masterState.hasAssignmentHospitalLocationId ? 'a.HospitalLocationId,' : 'CAST(NULL AS BIGINT) AS HospitalLocationId,'}
          ${masterState.hasAssignmentShiftTemplateId ? 'a.ShiftTemplateId,' : 'CAST(NULL AS BIGINT) AS ShiftTemplateId,'}
          a.Title,
          a.LocationKind,
          a.LocationLabel,
          a.OpdRoomId,
          a.SlotDurationMins,
          a.MaxSlots,
          a.BookingEnabled,
          a.Status,
          a.Notes,
          atp.Id AS ActivityTypeId,
          atp.Code AS ActivityCode,
          atp.Name AS ActivityName,
          atp.Category AS ActivityCategory,
          atp.ColorToken,
          atp.AllowsOpdSlots,
          r.RoomNumber,
          r.RoomName,
          ${masterState.hasHospitalLocations && masterState.hasAssignmentHospitalLocationId ? 'hl.Code AS HospitalLocationCode,' : "CAST(NULL AS NVARCHAR(30)) AS HospitalLocationCode,"}
          ${masterState.hasHospitalLocations && masterState.hasAssignmentHospitalLocationId ? 'hl.Name AS HospitalLocationName,' : "CAST(NULL AS NVARCHAR(120)) AS HospitalLocationName,"}
          ${masterState.hasShiftTemplates && masterState.hasAssignmentShiftTemplateId ? 'st.Name AS ShiftTemplateName' : "CAST(NULL AS NVARCHAR(120)) AS ShiftTemplateName"}
        FROM dbo.DoctorScheduleAssignments a
        JOIN dbo.DoctorScheduleActivityTypes atp ON atp.Id = a.ActivityTypeId
        LEFT JOIN dbo.OpdRooms r ON r.Id = a.OpdRoomId
        ${masterState.hasHospitalLocations && masterState.hasAssignmentHospitalLocationId ? 'LEFT JOIN dbo.HospitalLocations hl ON hl.Id = a.HospitalLocationId' : ''}
        ${masterState.hasShiftTemplates && masterState.hasAssignmentShiftTemplateId ? 'LEFT JOIN dbo.ShiftTemplates st ON st.Id = a.ShiftTemplateId' : ''}
        WHERE a.HospitalId = @HospitalId
          AND a.DoctorId = @DoctorId
          AND a.AssignmentDate = @AssignmentDate
          AND a.Status IN ('Active', 'Published')
        ORDER BY a.StartTime
      `),
    pool.request()
      .input('DoctorId', sql.BigInt, doctorId)
      .input('SessionDate', sql.Date, day)
      .query(`
        SELECT
          s.Id,
          s.AssignmentId,
          CONVERT(VARCHAR(5), s.StartTime, 108) AS StartTime,
          CONVERT(VARCHAR(5), s.EndTime, 108) AS EndTime,
          s.SlotDurationMins,
          s.TotalSlots,
          s.PublishedSlotsCount,
          s.Status,
          s.RoomLabel,
          s.Notes
        FROM dbo.OpdSlotSessions s
        WHERE s.DoctorId = @DoctorId
          AND s.SessionDate = @SessionDate
          AND s.Status <> 'Cancelled'
        ORDER BY s.StartTime
      `),
  ]);

  return {
    date: day,
    doctor: {
      Id: doctor.Id,
      DoctorName: `${doctor.FirstName} ${doctor.LastName}`.trim(),
    },
    assignments: assignmentsResult.recordset,
    sessions: sessionsResult.recordset,
  };
};

const buildSlotTimes = ({ startTime, endTime, slotDurationMins, selectedTimes, totalSlots }) => {
  const manualTimes = Array.isArray(selectedTimes)
    ? [...new Set(selectedTimes.map((time) => normalizeTime(time)).filter(Boolean))].sort()
    : [];

  if (manualTimes.length) {
    return manualTimes;
  }

  const duration = Number(slotDurationMins) || 15;
  const startMinutes = toMinutes(startTime);
  const endMinutes = toMinutes(endTime);
  const times = [];

  for (let current = startMinutes; current < endMinutes; current += duration) {
    const hours = String(Math.floor(current / 60)).padStart(2, '0');
    const minutes = String(current % 60).padStart(2, '0');
    times.push(`${hours}:${minutes}`);
    if (totalSlots && times.length >= Number(totalSlots)) {
      break;
    }
  }

  return times;
};

const createOpdSlotSession = async ({ hospitalId, userId, body }) => {
  const pool = await getPool();
  await ensureActivityTypeSeedData(pool);

  const assignmentId = Number(body.AssignmentId);
  const doctorId = Number(body.DoctorId);
  const sessionDate = normalizeDate(body.SessionDate);
  const startTime = normalizeTime(body.StartTime);
  const endTime = normalizeTime(body.EndTime);
  const slotDurationMins = Number(body.SlotDurationMins) || 15;

  if (!assignmentId || !doctorId || !sessionDate || !startTime || !endTime) {
    throw new AppError('Assignment, doctor, date, start time, and end time are required', 400);
  }
  if (toMinutes(endTime) <= toMinutes(startTime)) {
    throw new AppError('End time must be after start time', 400);
  }

  const assignment = await getDoctorScheduleById({ hospitalId, id: assignmentId });
  if (!assignment || Number(assignment.DoctorId) !== doctorId) {
    throw new AppError('Assigned OPD window not found', 404);
  }
  if (normalizeDate(assignment.AssignmentDate) !== sessionDate) {
    throw new AppError('Slots can only be created for the selected assignment date', 400);
  }
  if (!assignment.AllowsOpdSlots || !assignment.BookingEnabled) {
    throw new AppError('This assignment is not open for OPD slot publishing', 409);
  }
  if (
    toMinutes(startTime) < toMinutes(assignment.StartTimeText || assignment.StartTime) ||
    toMinutes(endTime) > toMinutes(assignment.EndTimeText || assignment.EndTime)
  ) {
    throw new AppError('Slots must stay within the assigned OPD period', 409);
  }

  const slotTimes = buildSlotTimes({
    startTime,
    endTime,
    slotDurationMins,
    selectedTimes: body.SelectedTimes,
    totalSlots: body.TotalSlots,
  });

  if (!slotTimes.length) {
    throw new AppError('No slot times could be generated from the selected range', 400);
  }

  const totalSlots = slotTimes.length;
  const sessionDates = enumerateRepeatDates({
    assignmentDate: sessionDate,
    repeatEnabled: body.RepeatEnabled,
    repeatFrequency: body.RepeatFrequency,
    repeatUntil: body.RepeatUntil,
    repeatDays: [new Date(`${sessionDate}T00:00:00`).getDay()],
  });
  const batchKey = randomUUID();

  for (const currentDate of sessionDates) {
    let assignmentForDate = assignment;
    if (currentDate !== sessionDate) {
      const assignmentLookup = await pool.request()
        .input('HospitalId', sql.BigInt, hospitalId)
        .input('DoctorId', sql.BigInt, doctorId)
        .input('AssignmentDate', sql.Date, currentDate)
        .input('SeriesId', sql.UniqueIdentifier, assignment.SeriesId || null)
        .input('ActivityTypeId', sql.BigInt, assignment.ActivityTypeId)
        .input('StartTime', sql.Time, toSqlTimeValue(assignment.StartTimeText || assignment.StartTime))
        .input('EndTime', sql.Time, toSqlTimeValue(assignment.EndTimeText || assignment.EndTime))
        .query(`
          SELECT TOP 1 a.Id
          FROM dbo.DoctorScheduleAssignments a
          WHERE a.HospitalId = @HospitalId
            AND a.DoctorId = @DoctorId
            AND a.AssignmentDate = @AssignmentDate
            AND a.Status IN ('Active', 'Published')
            AND (
              (@SeriesId IS NOT NULL AND a.SeriesId = @SeriesId)
              OR (
                a.ActivityTypeId = @ActivityTypeId
                AND a.StartTime = @StartTime
                AND a.EndTime = @EndTime
              )
            )
          ORDER BY a.StartTime
        `);

      const nextAssignmentId = assignmentLookup.recordset[0]?.Id;
      if (!nextAssignmentId) {
        throw new AppError(`No matching OPD assignment found on ${currentDate} for repeat publishing`, 409);
      }
      assignmentForDate = await getDoctorScheduleById({ hospitalId, id: nextAssignmentId });
    }

    const sessionInsert = await pool.request()
      .input('HospitalId', sql.BigInt, hospitalId)
      .input('AssignmentId', sql.BigInt, assignmentForDate.Id)
      .input('DoctorId', sql.BigInt, doctorId)
      .input('SessionDate', sql.Date, currentDate)
      .input('StartTime', sql.Time, toSqlTimeValue(startTime))
      .input('EndTime', sql.Time, toSqlTimeValue(endTime))
      .input('SlotDurationMins', sql.SmallInt, slotDurationMins)
      .input('TotalSlots', sql.SmallInt, totalSlots)
      .input('PublishedSlotsCount', sql.SmallInt, totalSlots)
      .input('BatchKey', sql.UniqueIdentifier, batchKey)
      .input('Status', sql.NVarChar(20), 'Published')
      .input('OpdRoomId', sql.BigInt, Number(body.OpdRoomId || assignmentForDate.OpdRoomId) || null)
      .input('RoomLabel', sql.NVarChar(120), body.RoomLabel || assignmentForDate.RoomNumber || null)
      .input('Notes', sql.NVarChar(500), body.Notes || null)
      .input('CreatedBy', sql.BigInt, userId)
      .input('UpdatedBy', sql.BigInt, userId)
      .query(`
        INSERT INTO dbo.OpdSlotSessions
          (HospitalId, AssignmentId, DoctorId, SessionDate, StartTime, EndTime, SlotDurationMins,
           TotalSlots, PublishedSlotsCount, BatchKey, Status, OpdRoomId, RoomLabel, Notes, CreatedBy, UpdatedBy)
        OUTPUT INSERTED.Id
        VALUES
          (@HospitalId, @AssignmentId, @DoctorId, @SessionDate, @StartTime, @EndTime, @SlotDurationMins,
           @TotalSlots, @PublishedSlotsCount, @BatchKey, @Status, @OpdRoomId, @RoomLabel, @Notes, @CreatedBy, @UpdatedBy)
      `);

    const slotSessionId = sessionInsert.recordset[0]?.Id;

    for (const time of slotTimes) {
      const slotEndMinutes = toMinutes(time) + slotDurationMins;
      const slotEnd = `${String(Math.floor(slotEndMinutes / 60)).padStart(2, '0')}:${String(slotEndMinutes % 60).padStart(2, '0')}`;

      await pool.request()
        .input('HospitalId', sql.BigInt, hospitalId)
        .input('DoctorId', sql.BigInt, doctorId)
        .input('ScheduleId', sql.BigInt, null)
        .input('AssignmentId', sql.BigInt, assignmentForDate.Id)
        .input('SlotSessionId', sql.BigInt, slotSessionId)
        .input('OpdRoomId', sql.BigInt, Number(body.OpdRoomId || assignmentForDate.OpdRoomId) || null)
        .input('SlotDate', sql.Date, currentDate)
        .input('StartTime', sql.Time, toSqlTimeValue(time))
        .input('EndTime', sql.Time, toSqlTimeValue(slotEnd))
        .input('VisitType', sql.NVarChar(20), 'opd')
        .input('Status', sql.NVarChar(20), 'Available')
        .input('AppointmentId', sql.BigInt, null)
        .input('TokenNumber', sql.SmallInt, null)
        .input('IsWalkIn', sql.Bit, 0)
        .input('BlockedReason', sql.NVarChar(200), null)
        .query(`
          IF NOT EXISTS (
            SELECT 1
            FROM dbo.AppointmentSlots
            WHERE DoctorId = @DoctorId
              AND SlotDate = @SlotDate
              AND CONVERT(VARCHAR(5), StartTime, 108) = CONVERT(VARCHAR(5), @StartTime, 108)
          )
          BEGIN
            INSERT INTO dbo.AppointmentSlots
              (HospitalId, DoctorId, ScheduleId, AssignmentId, SlotSessionId, OpdRoomId, SlotDate,
               StartTime, EndTime, VisitType, Status, AppointmentId, TokenNumber, IsWalkIn, BlockedReason, CreatedAt, UpdatedAt)
            VALUES
              (@HospitalId, @DoctorId, @ScheduleId, @AssignmentId, @SlotSessionId, @OpdRoomId, @SlotDate,
               @StartTime, @EndTime, @VisitType, @Status, @AppointmentId, @TokenNumber, @IsWalkIn, @BlockedReason, SYSUTCDATETIME(), SYSUTCDATETIME())
          END
          ELSE
          BEGIN
            RAISERROR ('One or more selected OPD slots already exist for this doctor/date.', 16, 1)
          END
        `);
    }
  }

  return getDayOverview({ hospitalId, doctorId, date: sessionDate });
};

const getMySchedule = async ({ userId, hospitalId, view = 'month', cursorDate = null }) => {
  const pool = await getPool();
  await ensureActivityTypeSeedData(pool);

  const doctorProfileResult = await pool.request()
    .input('UserId', sql.BigInt, userId)
    .query(`
      SELECT TOP 1
        dp.Id,
        dp.HospitalId
      FROM dbo.DoctorProfiles dp
      WHERE dp.UserId = @UserId
      ORDER BY dp.Id DESC
    `);

  const doctorProfile = doctorProfileResult.recordset[0];
  if (!doctorProfile) {
    return {
      assignments: [],
      activityTypes: [],
      ...getDateRange({ view, cursorDate }),
    };
  }

  const scheduleResult = await listDoctorSchedules({
    hospitalId: doctorProfile.HospitalId || hospitalId,
    doctorId: doctorProfile.Id,
    view,
    cursorDate,
  });

  return {
    ...scheduleResult,
    activityTypes: await getActivityTypes(),
  };
};

module.exports = {
  DEFAULT_ACTIVITY_TYPES,
  normalizeDate,
  normalizeTime,
  toMinutes,
  getDateRange,
  enumerateRepeatDates,
  getSchemaState,
  ensureAdvancedScheduling,
  ensureActivityTypeSeedData,
  getDoctorProfile,
  getActivityTypeById,
  findAssignmentConflict,
  getActivityTypes,
  getDoctorsList,
  getRooms,
  getLocations,
  getShiftTemplates,
  getWeeklyTemplates,
  saveWeeklyTemplate,
  deleteWeeklyTemplate,
  listDoctorSchedules,
  getDoctorScheduleById,
  createDoctorSchedule,
  updateDoctorSchedule,
  deleteDoctorSchedule,
  getDayOverview,
  createOpdSlotSession,
  getMySchedule,
  randomUUID,
  getPool,
  sql,
};
