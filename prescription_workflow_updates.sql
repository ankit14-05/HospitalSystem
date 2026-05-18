USE [HospitalDB];
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

/* -------------------------------------------------------------------------- */
/* 1) Prescriptions table extensions for audit-safe digital workflow          */
/* -------------------------------------------------------------------------- */

IF COL_LENGTH('dbo.Prescriptions', 'VersionNo') IS NULL
BEGIN
  ALTER TABLE dbo.Prescriptions
  ADD VersionNo INT NOT NULL CONSTRAINT DF_Prescriptions_VersionNo DEFAULT ((1));
END
GO

IF COL_LENGTH('dbo.Prescriptions', 'ParentPrescriptionId') IS NULL
BEGIN
  ALTER TABLE dbo.Prescriptions
  ADD ParentPrescriptionId BIGINT NULL;
END
GO

IF COL_LENGTH('dbo.Prescriptions', 'IsFinalized') IS NULL
BEGIN
  ALTER TABLE dbo.Prescriptions
  ADD IsFinalized BIT NOT NULL CONSTRAINT DF_Prescriptions_IsFinalized DEFAULT ((1));
END
GO

IF COL_LENGTH('dbo.Prescriptions', 'FinalizedAt') IS NULL
BEGIN
  ALTER TABLE dbo.Prescriptions
  ADD FinalizedAt DATETIME2(0) NULL;
END
GO

IF COL_LENGTH('dbo.Prescriptions', 'FinalizedBy') IS NULL
BEGIN
  ALTER TABLE dbo.Prescriptions
  ADD FinalizedBy BIGINT NULL;
END
GO

IF COL_LENGTH('dbo.Prescriptions', 'PayloadJson') IS NULL
BEGIN
  ALTER TABLE dbo.Prescriptions
  ADD PayloadJson NVARCHAR(MAX) NULL;
END
GO

IF COL_LENGTH('dbo.Prescriptions', 'ArchivedPdfPath') IS NULL
BEGIN
  ALTER TABLE dbo.Prescriptions
  ADD ArchivedPdfPath NVARCHAR(1000) NULL;
END
GO

IF COL_LENGTH('dbo.Prescriptions', 'ArchivedPdfAt') IS NULL
BEGIN
  ALTER TABLE dbo.Prescriptions
  ADD ArchivedPdfAt DATETIME2(0) NULL;
END
GO

IF COL_LENGTH('dbo.Prescriptions', 'ArchivedPdfBy') IS NULL
BEGIN
  ALTER TABLE dbo.Prescriptions
  ADD ArchivedPdfBy BIGINT NULL;
END
GO

/* -------------------------------------------------------------------------- */
/* 2) Backfill existing data                                                  */
/* -------------------------------------------------------------------------- */

UPDATE dbo.Prescriptions
SET VersionNo = ISNULL(VersionNo, 1)
WHERE VersionNo IS NULL;
GO

UPDATE dbo.Prescriptions
SET IsFinalized = 1,
    FinalizedAt = ISNULL(FinalizedAt, CreatedAt)
WHERE IsFinalized IS NULL OR IsFinalized = 0;
GO

/* -------------------------------------------------------------------------- */
/* 3) Constraints / FKs                                                       */
/* -------------------------------------------------------------------------- */

IF NOT EXISTS (
  SELECT 1
  FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID(N'dbo.Prescriptions')
    AND name = N'CK_Prescriptions_VersionNo'
)
BEGIN
  ALTER TABLE dbo.Prescriptions WITH CHECK
  ADD CONSTRAINT CK_Prescriptions_VersionNo CHECK (VersionNo >= 1);
END
GO

ALTER TABLE dbo.Prescriptions CHECK CONSTRAINT CK_Prescriptions_VersionNo;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID(N'dbo.Prescriptions')
    AND name = N'CK_Prescriptions_PayloadJson'
)
BEGIN
  ALTER TABLE dbo.Prescriptions WITH CHECK
  ADD CONSTRAINT CK_Prescriptions_PayloadJson
  CHECK (PayloadJson IS NULL OR ISJSON(PayloadJson) = 1);
END
GO

ALTER TABLE dbo.Prescriptions CHECK CONSTRAINT CK_Prescriptions_PayloadJson;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.foreign_keys
  WHERE name = N'FK_Prescriptions_ParentPrescription'
)
BEGIN
  ALTER TABLE dbo.Prescriptions WITH CHECK
  ADD CONSTRAINT FK_Prescriptions_ParentPrescription
  FOREIGN KEY (ParentPrescriptionId) REFERENCES dbo.Prescriptions(Id);
END
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.foreign_keys
  WHERE name = N'FK_Prescriptions_FinalizedBy'
)
BEGIN
  ALTER TABLE dbo.Prescriptions WITH CHECK
  ADD CONSTRAINT FK_Prescriptions_FinalizedBy
  FOREIGN KEY (FinalizedBy) REFERENCES dbo.Users(Id);
END
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.foreign_keys
  WHERE name = N'FK_Prescriptions_ArchivedPdfBy'
)
BEGIN
  ALTER TABLE dbo.Prescriptions WITH CHECK
  ADD CONSTRAINT FK_Prescriptions_ArchivedPdfBy
  FOREIGN KEY (ArchivedPdfBy) REFERENCES dbo.Users(Id);
END
GO

/* -------------------------------------------------------------------------- */
/* 4) Indexes for common lookups                                              */
/* -------------------------------------------------------------------------- */

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE object_id = OBJECT_ID(N'dbo.Prescriptions')
    AND name = N'IX_Prescriptions_AppointmentId'
)
BEGIN
  CREATE NONCLUSTERED INDEX IX_Prescriptions_AppointmentId
  ON dbo.Prescriptions (AppointmentId, CreatedAt DESC);
END
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE object_id = OBJECT_ID(N'dbo.Prescriptions')
    AND name = N'IX_Prescriptions_PatientId'
)
BEGIN
  CREATE NONCLUSTERED INDEX IX_Prescriptions_PatientId
  ON dbo.Prescriptions (PatientId, CreatedAt DESC);
END
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE object_id = OBJECT_ID(N'dbo.Prescriptions')
    AND name = N'IX_Prescriptions_DoctorId'
)
BEGIN
  CREATE NONCLUSTERED INDEX IX_Prescriptions_DoctorId
  ON dbo.Prescriptions (DoctorId, CreatedAt DESC);
END
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE object_id = OBJECT_ID(N'dbo.Prescriptions')
    AND name = N'IX_Prescriptions_VersionChain'
)
BEGIN
  CREATE NONCLUSTERED INDEX IX_Prescriptions_VersionChain
  ON dbo.Prescriptions (ParentPrescriptionId, VersionNo);
END
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE object_id = OBJECT_ID(N'dbo.Prescriptions')
    AND name = N'IX_Prescriptions_Finalized'
)
BEGIN
  CREATE NONCLUSTERED INDEX IX_Prescriptions_Finalized
  ON dbo.Prescriptions (IsFinalized, FinalizedAt DESC);
END
GO

/* -------------------------------------------------------------------------- */
/* 5) Doctor prescription signature settings                                  */
/* -------------------------------------------------------------------------- */

IF OBJECT_ID(N'dbo.DoctorPrescriptionSignatures', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.DoctorPrescriptionSignatures (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    UserId BIGINT NOT NULL,
    SignatureImagePath NVARCHAR(MAX) NULL,
    SignatureText NVARCHAR(200) NULL,
    SignaturePreference NVARCHAR(20) NOT NULL CONSTRAINT DF_DoctorPrescriptionSignatures_Preference DEFAULT ('Stamp'),
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_DoctorPrescriptionSignatures_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_DoctorPrescriptionSignatures_UpdatedAt DEFAULT (SYSUTCDATETIME())
  );
END
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE object_id = OBJECT_ID(N'dbo.DoctorPrescriptionSignatures')
    AND name = N'UQ_DoctorPrescriptionSignatures_UserId'
)
BEGIN
  CREATE UNIQUE NONCLUSTERED INDEX UQ_DoctorPrescriptionSignatures_UserId
  ON dbo.DoctorPrescriptionSignatures (UserId);
END
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID(N'dbo.DoctorPrescriptionSignatures')
    AND name = N'CK_DoctorPrescriptionSignatures_Preference'
)
BEGIN
  ALTER TABLE dbo.DoctorPrescriptionSignatures WITH CHECK
  ADD CONSTRAINT CK_DoctorPrescriptionSignatures_Preference
  CHECK (SignaturePreference IN ('Stamp', 'NewPage', 'TextOnly'));
END
GO

ALTER TABLE dbo.DoctorPrescriptionSignatures CHECK CONSTRAINT CK_DoctorPrescriptionSignatures_Preference;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.foreign_keys
  WHERE name = N'FK_DoctorPrescriptionSignatures_User'
)
BEGIN
  ALTER TABLE dbo.DoctorPrescriptionSignatures WITH CHECK
  ADD CONSTRAINT FK_DoctorPrescriptionSignatures_User
  FOREIGN KEY (UserId) REFERENCES dbo.Users(Id);
END
GO

/* -------------------------------------------------------------------------- */
/* 6) Verification snippets                                                   */
/* -------------------------------------------------------------------------- */

SELECT TOP 1
  Id,
  VersionNo,
  ParentPrescriptionId,
  IsFinalized,
  FinalizedAt,
  FinalizedBy,
  ArchivedPdfPath
FROM dbo.Prescriptions
ORDER BY Id DESC;
GO

SELECT TOP 1
  Id,
  UserId,
  SignaturePreference,
  SignatureText,
  SignatureImagePath
FROM dbo.DoctorPrescriptionSignatures
ORDER BY Id DESC;
GO
