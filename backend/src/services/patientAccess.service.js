const { getPool, sql } = require('../config/database');
const AppError = require('../utils/AppError');
const { registerLinkedPatientProfile } = require('./patientRegistration.service');

let schemaCache = null;
let schemaCacheAt = 0;
const SCHEMA_CACHE_MS = 5 * 60 * 1000;

const bool = (value) => Boolean(value);

const mapProfileRow = (row) => ({
  accessId: row.AccessId || null,
  patientId: row.PatientId,
  hospitalId: row.HospitalId,
  uhid: row.UHID || null,
  firstName: row.FirstName || '',
  lastName: row.LastName || '',
  fullName: row.FullName || `${row.FirstName || ''} ${row.LastName || ''}`.trim(),
  gender: row.Gender || null,
  dateOfBirth: row.DateOfBirth || null,
  ageYears: row.AgeYears ?? null,
  phone: row.Phone || null,
  email: row.Email || null,
  photoUrl: row.PhotoUrl || null,
  accessRole: row.AccessRole || 'owner',
  relationshipToUser: row.RelationshipToUser || 'Self',
  isPrimaryProfile: bool(row.IsPrimaryProfile),
  canBookAppointments: bool(row.CanBookAppointments ?? 1),
  canViewReports: bool(row.CanViewReports ?? 1),
  canViewPrescriptions: bool(row.CanViewPrescriptions ?? 1),
  canManageBilling: bool(row.CanManageBilling ?? 1),
  canUpdateProfile: bool(row.CanUpdateProfile ?? 1),
  status: row.Status || 'Active',
  isOwnedLogin: bool(row.IsOwnedLogin ?? 0),
  lastUsedAt: row.LastUsedAt || null,
});

const cleanText = (value) => {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
};

const getFamilySchemaState = async (poolArg = null, { force = false } = {}) => {
  const now = Date.now();
  if (!force && schemaCache && now - schemaCacheAt < SCHEMA_CACHE_MS) {
    return schemaCache;
  }

  const pool = poolArg || await getPool();
  const result = await pool.request().query(`
    SELECT
      CASE WHEN OBJECT_ID(N'dbo.PatientProfileAccess', N'U') IS NOT NULL THEN 1 ELSE 0 END AS HasAccessTable,
      CASE WHEN OBJECT_ID(N'dbo.PatientProfileSwitchAudit', N'U') IS NOT NULL THEN 1 ELSE 0 END AS HasSwitchAudit,
      CASE WHEN COL_LENGTH(N'dbo.AuthSessions', N'ActivePatientId') IS NOT NULL THEN 1 ELSE 0 END AS HasActivePatientId,
      CASE WHEN COL_LENGTH(N'dbo.AuthSessions', N'ActiveProfileSetAt') IS NOT NULL THEN 1 ELSE 0 END AS HasActiveProfileSetAt
  `);

  schemaCache = {
    hasAccessTable: bool(result.recordset[0]?.HasAccessTable),
    hasSwitchAudit: bool(result.recordset[0]?.HasSwitchAudit),
    hasActivePatientId: bool(result.recordset[0]?.HasActivePatientId),
    hasActiveProfileSetAt: bool(result.recordset[0]?.HasActiveProfileSetAt),
  };
  schemaCacheAt = now;
  return schemaCache;
};

const listAccessiblePatientProfiles = async ({ userId, hospitalId = null, poolArg = null }) => {
  const pool = poolArg || await getPool();
  const schemaState = await getFamilySchemaState(pool);

  if (schemaState.hasAccessTable) {
    const result = await pool.request()
      .input('UserId', sql.BigInt, userId)
      .input('HospitalId', sql.BigInt, hospitalId || null)
      .query(`
        SELECT
          ppa.Id AS AccessId,
          ppa.PatientId,
          ppa.HospitalId,
          p.UHID,
          p.FirstName,
          p.LastName,
          CONCAT(p.FirstName, ' ', p.LastName) AS FullName,
          p.Gender,
          p.DateOfBirth,
          p.AgeYears,
          p.Phone,
          p.Email,
          p.PhotoUrl,
          ppa.AccessRole,
          ppa.RelationshipToUser,
          ppa.IsPrimaryProfile,
          ppa.CanBookAppointments,
          ppa.CanViewReports,
          ppa.CanViewPrescriptions,
          ppa.CanManageBilling,
          ppa.CanUpdateProfile,
          ppa.Status,
          ppa.LastUsedAt,
          CAST(CASE WHEN p.UserId = @UserId THEN 1 ELSE 0 END AS bit) AS IsOwnedLogin
        FROM dbo.PatientProfileAccess ppa
        JOIN dbo.PatientProfiles p ON p.Id = ppa.PatientId
        WHERE ppa.UserId = @UserId
          AND ppa.Status = 'Active'
          AND p.DeletedAt IS NULL
          AND (@HospitalId IS NULL OR ppa.HospitalId = @HospitalId)
        ORDER BY
          ppa.IsPrimaryProfile DESC,
          CASE WHEN p.UserId = @UserId THEN 1 ELSE 0 END DESC,
          p.FirstName ASC,
          p.LastName ASC,
          ppa.Id ASC
      `);

    const mappedProfiles = result.recordset.map(mapProfileRow);
    if (mappedProfiles.length) {
      return mappedProfiles;
    }
  }

  const legacyResult = await pool.request()
    .input('UserId', sql.BigInt, userId)
    .input('HospitalId', sql.BigInt, hospitalId || null)
    .query(`
      SELECT
        CAST(NULL AS BIGINT) AS AccessId,
        p.Id AS PatientId,
        p.HospitalId,
        p.UHID,
        p.FirstName,
        p.LastName,
        CONCAT(p.FirstName, ' ', p.LastName) AS FullName,
        p.Gender,
        p.DateOfBirth,
        p.AgeYears,
        p.Phone,
        p.Email,
        p.PhotoUrl,
        CAST('owner' AS NVARCHAR(20)) AS AccessRole,
        CAST('Self' AS NVARCHAR(30)) AS RelationshipToUser,
        CAST(1 AS bit) AS IsPrimaryProfile,
        CAST(1 AS bit) AS CanBookAppointments,
        CAST(1 AS bit) AS CanViewReports,
        CAST(1 AS bit) AS CanViewPrescriptions,
        CAST(1 AS bit) AS CanManageBilling,
        CAST(1 AS bit) AS CanUpdateProfile,
        CAST('Active' AS NVARCHAR(20)) AS Status,
        CAST(NULL AS DATETIME2(0)) AS LastUsedAt,
        CAST(1 AS bit) AS IsOwnedLogin
      FROM dbo.PatientProfiles p
      WHERE p.UserId = @UserId
        AND p.DeletedAt IS NULL
        AND (@HospitalId IS NULL OR p.HospitalId = @HospitalId)
      ORDER BY p.Id ASC
    `);

  return legacyResult.recordset.map(mapProfileRow);
};

const getSessionActivePatientId = async (pool, schemaState, sessionId, userId) => {
  if (!schemaState.hasActivePatientId || !sessionId) return null;

  const result = await pool.request()
    .input('SessionId', sql.BigInt, sessionId)
    .input('UserId', sql.BigInt, userId)
    .query(`
      SELECT ActivePatientId
      FROM dbo.AuthSessions
      WHERE Id = @SessionId
        AND UserId = @UserId
    `);

  return result.recordset[0]?.ActivePatientId || null;
};

const persistSessionActivePatientId = async (pool, schemaState, sessionId, userId, patientId) => {
  if (!schemaState.hasActivePatientId || !sessionId) return;

  const setProfileAt = schemaState.hasActiveProfileSetAt ? ', ActiveProfileSetAt = SYSUTCDATETIME()' : '';
  await pool.request()
    .input('SessionId', sql.BigInt, sessionId)
    .input('UserId', sql.BigInt, userId)
    .input('PatientId', sql.BigInt, patientId)
    .query(`
      UPDATE dbo.AuthSessions
      SET ActivePatientId = @PatientId
          ${setProfileAt}
      WHERE Id = @SessionId
        AND UserId = @UserId
    `);
};

const touchAccessLastUsed = async (pool, accessId) => {
  if (!accessId) return;

  await pool.request()
    .input('AccessId', sql.BigInt, accessId)
    .query(`
      UPDATE dbo.PatientProfileAccess
      SET LastUsedAt = SYSUTCDATETIME(),
          UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @AccessId
    `);
};

const resolveActivePatientContext = async ({
  userId,
  hospitalId = null,
  sessionId = null,
  preferredPatientId = null,
  poolArg = null,
  touchAccess = false,
}) => {
  const pool = poolArg || await getPool();
  const schemaState = await getFamilySchemaState(pool);
  const profiles = await listAccessiblePatientProfiles({ userId, hospitalId, poolArg: pool });

  if (!profiles.length) {
    return {
      familyAccessEnabled: schemaState.hasAccessTable,
      hasMultipleProfiles: false,
      profiles: [],
      activeProfile: null,
    };
  }

  const sessionActivePatientId = await getSessionActivePatientId(pool, schemaState, sessionId, userId);
  const preferredId = preferredPatientId || sessionActivePatientId;
  let activeProfile = profiles.find((profile) => profile.patientId === preferredId) || null;

  if (!activeProfile) {
    activeProfile =
      profiles.find((profile) => profile.isPrimaryProfile) ||
      profiles.find((profile) => profile.isOwnedLogin) ||
      profiles[0];
  }

  if (activeProfile) {
    await persistSessionActivePatientId(pool, schemaState, sessionId, userId, activeProfile.patientId);
    if (schemaState.hasAccessTable && touchAccess) {
      await touchAccessLastUsed(pool, activeProfile.accessId);
    }
  }

  return {
    familyAccessEnabled: schemaState.hasAccessTable,
    hasMultipleProfiles: profiles.length > 1,
    profiles,
    activeProfile,
  };
};

const requireActivePatientProfile = async (authUser, sessionId = null, poolArg = null) => {
  const context = await resolveActivePatientContext({
    userId: authUser.id || authUser.userId,
    hospitalId: authUser.hospitalId || null,
    sessionId,
    preferredPatientId: authUser.activePatientId || null,
    poolArg,
  });

  if (!context.activeProfile) {
    throw new AppError('Patient profile not found for this account', 404);
  }

  return context.activeProfile;
};

const switchActivePatientProfile = async ({
  authUser,
  sessionId,
    patientId,
    ipAddress = null,
    userAgent = null,
    switchSource = 'ui',
}) => {
  const userId = authUser.id || authUser.userId;
  const hospitalId = authUser.hospitalId || null;
  const pool = await getPool();
  const schemaState = await getFamilySchemaState(pool);

  const profiles = await listAccessiblePatientProfiles({ userId, hospitalId, poolArg: pool });
  const nextProfile = profiles.find((profile) => profile.patientId === patientId);

  if (!nextProfile) {
    throw new AppError('You do not have access to this patient profile', 403);
  }

  const previousPatientId = await getSessionActivePatientId(pool, schemaState, sessionId, userId);
  await persistSessionActivePatientId(pool, schemaState, sessionId, userId, nextProfile.patientId);

  if (schemaState.hasSwitchAudit && sessionId) {
    await pool.request()
      .input('HospitalId', sql.BigInt, hospitalId)
      .input('SessionId', sql.BigInt, sessionId)
      .input('UserId', sql.BigInt, userId)
      .input('FromPatientId', sql.BigInt, previousPatientId || null)
      .input('ToPatientId', sql.BigInt, nextProfile.patientId)
      .input('SwitchSource', sql.NVarChar(20), switchSource)
      .input('IpAddress', sql.NVarChar(50), ipAddress || null)
      .input('UserAgent', sql.NVarChar(300), userAgent || null)
      .query(`
        INSERT INTO dbo.PatientProfileSwitchAudit
          (HospitalId, SessionId, UserId, FromPatientId, ToPatientId, SwitchSource, IpAddress, UserAgent)
        VALUES
          (@HospitalId, @SessionId, @UserId, @FromPatientId, @ToPatientId, @SwitchSource, @IpAddress, @UserAgent)
      `);
  }

  if (schemaState.hasAccessTable) {
    await touchAccessLastUsed(pool, nextProfile.accessId);
  }

  return resolveActivePatientContext({
    userId,
    hospitalId,
    sessionId,
    preferredPatientId: nextProfile.patientId,
    poolArg: pool,
    touchAccess: true,
  });
};

const createFamilyMemberProfile = async ({ authUser, sessionId, payload = {} }) => {
  const schemaState = await getFamilySchemaState();

  if (!schemaState.hasAccessTable) {
    throw new AppError('Family profile access is not enabled yet. Run the family profile SQL update first.', 409);
  }

  const createdProfile = await registerLinkedPatientProfile({
    authUser,
    payload,
  });

  return switchActivePatientProfile({
    authUser,
    sessionId,
    patientId: createdProfile.patientProfileId,
    switchSource: 'ui',
  });
};

module.exports = {
  getFamilySchemaState,
  listAccessiblePatientProfiles,
  resolveActivePatientContext,
  requireActivePatientProfile,
  switchActivePatientProfile,
  createFamilyMemberProfile,
};
