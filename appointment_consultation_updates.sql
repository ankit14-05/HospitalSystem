USE [HospitalDB];
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

/* ---------------------------------------------------------
   1. Extend Appointments for quick consultation lookups
   --------------------------------------------------------- */

IF COL_LENGTH('dbo.Appointments', 'PrimaryDiagnosis') IS NULL
BEGIN
    ALTER TABLE dbo.Appointments ADD PrimaryDiagnosis NVARCHAR(MAX) NULL;
END
GO

IF COL_LENGTH('dbo.Appointments', 'FollowUpDate') IS NULL
BEGIN
    ALTER TABLE dbo.Appointments ADD FollowUpDate DATE NULL;
END
GO

IF COL_LENGTH('dbo.Appointments', 'FollowUpNotes') IS NULL
BEGIN
    ALTER TABLE dbo.Appointments ADD FollowUpNotes NVARCHAR(MAX) NULL;
END
GO

/* ---------------------------------------------------------
   2. Create AppointmentConsultations table
   --------------------------------------------------------- */

IF OBJECT_ID(N'dbo.AppointmentConsultations', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AppointmentConsultations (
        Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        HospitalId BIGINT NOT NULL,
        AppointmentId BIGINT NOT NULL,
        PatientId BIGINT NOT NULL,
        DoctorId BIGINT NOT NULL,
        PrimaryDiagnosis NVARCHAR(MAX) NULL,
        ConsultationNotes NVARCHAR(MAX) NULL,
        FollowUpDate DATE NULL,
        FollowUpNotes NVARCHAR(MAX) NULL,
        VitalsJson NVARCHAR(MAX) NULL,
        CompletedAt DATETIME2(0) NULL,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_AppointmentConsultations_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_AppointmentConsultations_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CreatedBy BIGINT NULL,
        UpdatedBy BIGINT NULL
    );
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.AppointmentConsultations')
      AND name = N'UX_AppointmentConsultations_AppointmentId'
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_AppointmentConsultations_AppointmentId
    ON dbo.AppointmentConsultations (AppointmentId);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.AppointmentConsultations')
      AND name = N'IX_AppointmentConsultations_DoctorCompleted'
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_AppointmentConsultations_DoctorCompleted
    ON dbo.AppointmentConsultations (DoctorId, CompletedAt DESC);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.AppointmentConsultations')
      AND name = N'IX_AppointmentConsultations_PatientCompleted'
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_AppointmentConsultations_PatientCompleted
    ON dbo.AppointmentConsultations (PatientId, CompletedAt DESC);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.AppointmentConsultations')
      AND name = N'CK_AppointmentConsultations_VitalsJson'
)
BEGIN
    ALTER TABLE dbo.AppointmentConsultations WITH CHECK
    ADD CONSTRAINT CK_AppointmentConsultations_VitalsJson
    CHECK (VitalsJson IS NULL OR ISJSON(VitalsJson) = 1);
END
GO

ALTER TABLE dbo.AppointmentConsultations CHECK CONSTRAINT CK_AppointmentConsultations_VitalsJson;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_AppointmentConsultations_Appointments'
)
BEGIN
    ALTER TABLE dbo.AppointmentConsultations WITH CHECK
    ADD CONSTRAINT FK_AppointmentConsultations_Appointments
    FOREIGN KEY (AppointmentId) REFERENCES dbo.Appointments(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_AppointmentConsultations_Patients'
)
BEGIN
    ALTER TABLE dbo.AppointmentConsultations WITH CHECK
    ADD CONSTRAINT FK_AppointmentConsultations_Patients
    FOREIGN KEY (PatientId) REFERENCES dbo.PatientProfiles(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_AppointmentConsultations_Doctors'
)
BEGIN
    ALTER TABLE dbo.AppointmentConsultations WITH CHECK
    ADD CONSTRAINT FK_AppointmentConsultations_Doctors
    FOREIGN KEY (DoctorId) REFERENCES dbo.DoctorProfiles(Id);
END
GO

/* ---------------------------------------------------------
   3. Backfill consultation table from completed appointments
   --------------------------------------------------------- */

INSERT INTO dbo.AppointmentConsultations
(
    HospitalId,
    AppointmentId,
    PatientId,
    DoctorId,
    PrimaryDiagnosis,
    ConsultationNotes,
    FollowUpDate,
    FollowUpNotes,
    CompletedAt,
    CreatedAt,
    UpdatedAt
)
SELECT
    a.HospitalId,
    a.Id,
    a.PatientId,
    a.DoctorId,
    a.PrimaryDiagnosis,
    a.Notes,
    a.FollowUpDate,
    a.FollowUpNotes,
    a.UpdatedAt,
    ISNULL(a.CreatedAt, SYSUTCDATETIME()),
    ISNULL(a.UpdatedAt, SYSUTCDATETIME())
FROM dbo.Appointments a
WHERE a.Status = 'Completed'
  AND NOT EXISTS (
      SELECT 1
      FROM dbo.AppointmentConsultations ac
      WHERE ac.AppointmentId = a.Id
  )
  AND (
      a.Notes IS NOT NULL
      OR a.PrimaryDiagnosis IS NOT NULL
      OR a.FollowUpDate IS NOT NULL
      OR a.FollowUpNotes IS NOT NULL
  );
GO

/* ---------------------------------------------------------
   4. Verification
   --------------------------------------------------------- */

SELECT
    name AS ColumnName
FROM sys.columns
WHERE object_id = OBJECT_ID(N'dbo.Appointments')
  AND name IN ('PrimaryDiagnosis', 'FollowUpDate', 'FollowUpNotes')
ORDER BY name;
GO

SELECT
    OBJECT_ID(N'dbo.AppointmentConsultations', N'U') AS AppointmentConsultationsTableId;
GO

SELECT TOP 10
    Id,
    AppointmentId,
    PatientId,
    DoctorId,
    PrimaryDiagnosis,
    FollowUpDate,
    CompletedAt
FROM dbo.AppointmentConsultations
ORDER BY Id DESC;
GO
