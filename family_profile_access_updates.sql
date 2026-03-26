USE [HospitalDB];
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

/* =========================================================
   FAMILY LOGIN / PROFILE SWITCHING SUPPORT
   - One login account in dbo.Users
   - Multiple patient profiles accessible under same login
   - Shared email/phone stays only on dbo.Users
   - Family members can exist in dbo.PatientProfiles without
     separate login credentials
   ========================================================= */

IF OBJECT_ID(N'dbo.PatientProfileAccess', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PatientProfileAccess (
        Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        HospitalId BIGINT NOT NULL,
        UserId BIGINT NOT NULL,
        PatientId BIGINT NOT NULL,
        AccessRole NVARCHAR(20) NOT NULL
            CONSTRAINT DF_PatientProfileAccess_AccessRole DEFAULT ('owner'),
        RelationshipToUser NVARCHAR(30) NOT NULL
            CONSTRAINT DF_PatientProfileAccess_Relationship DEFAULT ('Self'),
        IsPrimaryProfile BIT NOT NULL
            CONSTRAINT DF_PatientProfileAccess_IsPrimaryProfile DEFAULT ((0)),
        CanBookAppointments BIT NOT NULL
            CONSTRAINT DF_PatientProfileAccess_CanBookAppointments DEFAULT ((1)),
        CanViewReports BIT NOT NULL
            CONSTRAINT DF_PatientProfileAccess_CanViewReports DEFAULT ((1)),
        CanViewPrescriptions BIT NOT NULL
            CONSTRAINT DF_PatientProfileAccess_CanViewPrescriptions DEFAULT ((1)),
        CanManageBilling BIT NOT NULL
            CONSTRAINT DF_PatientProfileAccess_CanManageBilling DEFAULT ((1)),
        CanUpdateProfile BIT NOT NULL
            CONSTRAINT DF_PatientProfileAccess_CanUpdateProfile DEFAULT ((1)),
        Status NVARCHAR(20) NOT NULL
            CONSTRAINT DF_PatientProfileAccess_Status DEFAULT ('Active'),
        Notes NVARCHAR(500) NULL,
        LastUsedAt DATETIME2(0) NULL,
        CreatedAt DATETIME2(0) NOT NULL
            CONSTRAINT DF_PatientProfileAccess_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2(0) NOT NULL
            CONSTRAINT DF_PatientProfileAccess_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CreatedBy BIGINT NULL,
        UpdatedBy BIGINT NULL
    );
END
GO

IF COL_LENGTH('dbo.AuthSessions', 'ActivePatientId') IS NULL
BEGIN
    ALTER TABLE dbo.AuthSessions ADD ActivePatientId BIGINT NULL;
END
GO

IF COL_LENGTH('dbo.AuthSessions', 'ActiveProfileSetAt') IS NULL
BEGIN
    ALTER TABLE dbo.AuthSessions ADD ActiveProfileSetAt DATETIME2(0) NULL;
END
GO

IF OBJECT_ID(N'dbo.PatientProfileSwitchAudit', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PatientProfileSwitchAudit (
        Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        HospitalId BIGINT NOT NULL,
        SessionId BIGINT NULL,
        UserId BIGINT NOT NULL,
        FromPatientId BIGINT NULL,
        ToPatientId BIGINT NOT NULL,
        SwitchSource NVARCHAR(20) NOT NULL
            CONSTRAINT DF_PatientProfileSwitchAudit_Source DEFAULT ('ui'),
        IpAddress NVARCHAR(50) NULL,
        UserAgent NVARCHAR(300) NULL,
        SwitchedAt DATETIME2(0) NOT NULL
            CONSTRAINT DF_PatientProfileSwitchAudit_SwitchedAt DEFAULT (SYSUTCDATETIME())
    );
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_PatientProfileAccess_AccessRole'
)
BEGIN
    ALTER TABLE dbo.PatientProfileAccess WITH CHECK
    ADD CONSTRAINT CK_PatientProfileAccess_AccessRole
    CHECK (AccessRole IN ('owner', 'guardian', 'delegate'));
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_PatientProfileAccess_Relationship'
)
BEGIN
    ALTER TABLE dbo.PatientProfileAccess WITH CHECK
    ADD CONSTRAINT CK_PatientProfileAccess_Relationship
    CHECK (RelationshipToUser IN (
        'Self',
        'Spouse',
        'Child',
        'Parent',
        'Sibling',
        'Grandparent',
        'Grandchild',
        'InLaw',
        'Other'
    ));
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_PatientProfileAccess_Status'
)
BEGIN
    ALTER TABLE dbo.PatientProfileAccess WITH CHECK
    ADD CONSTRAINT CK_PatientProfileAccess_Status
    CHECK (Status IN ('Active', 'Revoked'));
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_PatientProfileSwitchAudit_Source'
)
BEGIN
    ALTER TABLE dbo.PatientProfileSwitchAudit WITH CHECK
    ADD CONSTRAINT CK_PatientProfileSwitchAudit_Source
    CHECK (SwitchSource IN ('ui', 'login', 'token_refresh', 'admin'));
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_PatientProfileAccess_Hospital'
)
BEGIN
    ALTER TABLE dbo.PatientProfileAccess WITH CHECK
    ADD CONSTRAINT FK_PatientProfileAccess_Hospital
    FOREIGN KEY (HospitalId) REFERENCES dbo.HospitalSetup(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_PatientProfileAccess_User'
)
BEGIN
    ALTER TABLE dbo.PatientProfileAccess WITH CHECK
    ADD CONSTRAINT FK_PatientProfileAccess_User
    FOREIGN KEY (UserId) REFERENCES dbo.Users(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_PatientProfileAccess_Patient'
)
BEGIN
    ALTER TABLE dbo.PatientProfileAccess WITH CHECK
    ADD CONSTRAINT FK_PatientProfileAccess_Patient
    FOREIGN KEY (PatientId) REFERENCES dbo.PatientProfiles(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_PatientProfileAccess_CreatedBy'
)
BEGIN
    ALTER TABLE dbo.PatientProfileAccess WITH CHECK
    ADD CONSTRAINT FK_PatientProfileAccess_CreatedBy
    FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_PatientProfileAccess_UpdatedBy'
)
BEGIN
    ALTER TABLE dbo.PatientProfileAccess WITH CHECK
    ADD CONSTRAINT FK_PatientProfileAccess_UpdatedBy
    FOREIGN KEY (UpdatedBy) REFERENCES dbo.Users(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_AuthSessions_ActivePatient'
)
BEGIN
    ALTER TABLE dbo.AuthSessions WITH CHECK
    ADD CONSTRAINT FK_AuthSessions_ActivePatient
    FOREIGN KEY (ActivePatientId) REFERENCES dbo.PatientProfiles(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_PatientProfileSwitchAudit_Session'
)
BEGIN
    ALTER TABLE dbo.PatientProfileSwitchAudit WITH CHECK
    ADD CONSTRAINT FK_PatientProfileSwitchAudit_Session
    FOREIGN KEY (SessionId) REFERENCES dbo.AuthSessions(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_PatientProfileSwitchAudit_User'
)
BEGIN
    ALTER TABLE dbo.PatientProfileSwitchAudit WITH CHECK
    ADD CONSTRAINT FK_PatientProfileSwitchAudit_User
    FOREIGN KEY (UserId) REFERENCES dbo.Users(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_PatientProfileSwitchAudit_FromPatient'
)
BEGIN
    ALTER TABLE dbo.PatientProfileSwitchAudit WITH CHECK
    ADD CONSTRAINT FK_PatientProfileSwitchAudit_FromPatient
    FOREIGN KEY (FromPatientId) REFERENCES dbo.PatientProfiles(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_PatientProfileSwitchAudit_ToPatient'
)
BEGIN
    ALTER TABLE dbo.PatientProfileSwitchAudit WITH CHECK
    ADD CONSTRAINT FK_PatientProfileSwitchAudit_ToPatient
    FOREIGN KEY (ToPatientId) REFERENCES dbo.PatientProfiles(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'UX_PatientProfileAccess_UserPatient'
      AND object_id = OBJECT_ID(N'dbo.PatientProfileAccess')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_PatientProfileAccess_UserPatient
    ON dbo.PatientProfileAccess (UserId, PatientId);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'UX_PatientProfileAccess_UserPrimary'
      AND object_id = OBJECT_ID(N'dbo.PatientProfileAccess')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_PatientProfileAccess_UserPrimary
    ON dbo.PatientProfileAccess (UserId)
    WHERE IsPrimaryProfile = 1 AND Status = 'Active';
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_PatientProfileAccess_Patient'
      AND object_id = OBJECT_ID(N'dbo.PatientProfileAccess')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_PatientProfileAccess_Patient
    ON dbo.PatientProfileAccess (PatientId, Status, UserId);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_PatientProfileAccess_HospitalUser'
      AND object_id = OBJECT_ID(N'dbo.PatientProfileAccess')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_PatientProfileAccess_HospitalUser
    ON dbo.PatientProfileAccess (HospitalId, UserId, Status);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_AuthSessions_ActivePatient'
      AND object_id = OBJECT_ID(N'dbo.AuthSessions')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_AuthSessions_ActivePatient
    ON dbo.AuthSessions (UserId, ActivePatientId, IsActive);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_PatientProfileSwitchAudit_UserDate'
      AND object_id = OBJECT_ID(N'dbo.PatientProfileSwitchAudit')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_PatientProfileSwitchAudit_UserDate
    ON dbo.PatientProfileSwitchAudit (UserId, SwitchedAt DESC);
END
GO

/* =========================================================
   Backfill existing one-user-one-patient accounts into the
   new access model as owner/self/primary.
   ========================================================= */
INSERT INTO dbo.PatientProfileAccess
(
    HospitalId,
    UserId,
    PatientId,
    AccessRole,
    RelationshipToUser,
    IsPrimaryProfile,
    CanBookAppointments,
    CanViewReports,
    CanViewPrescriptions,
    CanManageBilling,
    CanUpdateProfile,
    Status,
    CreatedAt,
    UpdatedAt,
    CreatedBy,
    UpdatedBy
)
SELECT
    p.HospitalId,
    p.UserId,
    p.Id,
    'owner',
    'Self',
    1,
    1,
    1,
    1,
    1,
    1,
    'Active',
    ISNULL(p.CreatedAt, SYSUTCDATETIME()),
    ISNULL(p.UpdatedAt, SYSUTCDATETIME()),
    p.UserId,
    p.UserId
FROM dbo.PatientProfiles p
WHERE p.UserId IS NOT NULL
  AND p.DeletedAt IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM dbo.PatientProfileAccess x
      WHERE x.UserId = p.UserId
        AND x.PatientId = p.Id
  );
GO

/* =========================================================
   Backfill active session profile from the user's direct
   patient profile where available.
   ========================================================= */
UPDATE s
SET
    s.ActivePatientId = p.Id,
    s.ActiveProfileSetAt = ISNULL(s.ActiveProfileSetAt, s.CreatedAt)
FROM dbo.AuthSessions s
JOIN dbo.PatientProfiles p
  ON p.UserId = s.UserId
 AND p.DeletedAt IS NULL
WHERE s.ActivePatientId IS NULL;
GO

/* =========================================================
   Read model for login/profile switch screen
   ========================================================= */
CREATE OR ALTER VIEW dbo.V_UserPatientProfiles
AS
SELECT
    pa.Id AS AccessId,
    pa.HospitalId,
    pa.UserId,
    pa.PatientId,
    pa.AccessRole,
    pa.RelationshipToUser,
    pa.IsPrimaryProfile,
    pa.CanBookAppointments,
    pa.CanViewReports,
    pa.CanViewPrescriptions,
    pa.CanManageBilling,
    pa.CanUpdateProfile,
    pa.Status,
    pa.LastUsedAt,
    p.UHID,
    p.FirstName,
    p.LastName,
    p.Gender,
    p.DateOfBirth,
    p.Phone,
    p.Email,
    p.BloodGroup,
    p.PhotoUrl,
    p.EmergencyName,
    p.EmergencyRelation,
    p.EmergencyPhone
FROM dbo.PatientProfileAccess pa
JOIN dbo.PatientProfiles p
  ON p.Id = pa.PatientId
WHERE pa.Status = 'Active'
  AND p.DeletedAt IS NULL;
GO

SELECT
    OBJECT_ID(N'dbo.PatientProfileAccess', N'U') AS PatientProfileAccessTableId,
    OBJECT_ID(N'dbo.PatientProfileSwitchAudit', N'U') AS PatientProfileSwitchAuditTableId,
    COL_LENGTH('dbo.AuthSessions', 'ActivePatientId') AS AuthSessionsHasActivePatientId,
    COL_LENGTH('dbo.AuthSessions', 'ActiveProfileSetAt') AS AuthSessionsHasActiveProfileSetAt;
GO

SELECT TOP 20
    UserId,
    PatientId,
    AccessRole,
    RelationshipToUser,
    IsPrimaryProfile,
    Status
FROM dbo.PatientProfileAccess
ORDER BY UserId, PatientId;
GO
