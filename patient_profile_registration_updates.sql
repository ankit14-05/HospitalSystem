USE [HospitalDB];
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

/* =========================================================
   LINKED PATIENT PROFILE REGISTRATION + PAYMENT TRACKING
   Run this after family_profile_access_updates.sql
   ========================================================= */

IF OBJECT_ID(N'dbo.PatientProfileRegistrations', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PatientProfileRegistrations (
        Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        HospitalId BIGINT NOT NULL,
        OwnerUserId BIGINT NOT NULL,
        PatientId BIGINT NOT NULL,
        RegistrationMode NVARCHAR(20) NOT NULL
            CONSTRAINT DF_PatientProfileRegistrations_Mode DEFAULT ('family_profile'),
        RelationshipToUser NVARCHAR(30) NULL,
        RegistrationStatus NVARCHAR(20) NOT NULL
            CONSTRAINT DF_PatientProfileRegistrations_Status DEFAULT ('Completed'),
        RegistrationFee DECIMAL(10,2) NOT NULL
            CONSTRAINT DF_PatientProfileRegistrations_Fee DEFAULT ((0)),
        CurrencyCode NVARCHAR(10) NOT NULL
            CONSTRAINT DF_PatientProfileRegistrations_Currency DEFAULT ('INR'),
        PaymentMethod NVARCHAR(20) NULL,
        PaymentStatus NVARCHAR(20) NOT NULL
            CONSTRAINT DF_PatientProfileRegistrations_PaymentStatus DEFAULT ('Pending'),
        PaymentReference NVARCHAR(120) NULL,
        PaymentPayloadJson NVARCHAR(MAX) NULL,
        RegistrationPayloadJson NVARCHAR(MAX) NULL,
        PaidAt DATETIME2(0) NULL,
        CreatedAt DATETIME2(0) NOT NULL
            CONSTRAINT DF_PatientProfileRegistrations_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2(0) NOT NULL
            CONSTRAINT DF_PatientProfileRegistrations_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CreatedBy BIGINT NULL,
        UpdatedBy BIGINT NULL
    );
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_PatientProfileRegistrations_Hospital'
)
BEGIN
    ALTER TABLE dbo.PatientProfileRegistrations WITH CHECK
    ADD CONSTRAINT FK_PatientProfileRegistrations_Hospital
    FOREIGN KEY (HospitalId) REFERENCES dbo.HospitalSetup(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_PatientProfileRegistrations_OwnerUser'
)
BEGIN
    ALTER TABLE dbo.PatientProfileRegistrations WITH CHECK
    ADD CONSTRAINT FK_PatientProfileRegistrations_OwnerUser
    FOREIGN KEY (OwnerUserId) REFERENCES dbo.Users(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_PatientProfileRegistrations_Patient'
)
BEGIN
    ALTER TABLE dbo.PatientProfileRegistrations WITH CHECK
    ADD CONSTRAINT FK_PatientProfileRegistrations_Patient
    FOREIGN KEY (PatientId) REFERENCES dbo.PatientProfiles(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_PatientProfileRegistrations_CreatedBy'
)
BEGIN
    ALTER TABLE dbo.PatientProfileRegistrations WITH CHECK
    ADD CONSTRAINT FK_PatientProfileRegistrations_CreatedBy
    FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_PatientProfileRegistrations_UpdatedBy'
)
BEGIN
    ALTER TABLE dbo.PatientProfileRegistrations WITH CHECK
    ADD CONSTRAINT FK_PatientProfileRegistrations_UpdatedBy
    FOREIGN KEY (UpdatedBy) REFERENCES dbo.Users(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_PatientProfileRegistrations_Mode'
)
BEGIN
    ALTER TABLE dbo.PatientProfileRegistrations WITH CHECK
    ADD CONSTRAINT CK_PatientProfileRegistrations_Mode
    CHECK (RegistrationMode IN ('self_signup', 'family_profile'));
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_PatientProfileRegistrations_Status'
)
BEGIN
    ALTER TABLE dbo.PatientProfileRegistrations WITH CHECK
    ADD CONSTRAINT CK_PatientProfileRegistrations_Status
    CHECK (RegistrationStatus IN ('Started', 'Completed', 'Cancelled'));
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_PatientProfileRegistrations_PaymentStatus'
)
BEGIN
    ALTER TABLE dbo.PatientProfileRegistrations WITH CHECK
    ADD CONSTRAINT CK_PatientProfileRegistrations_PaymentStatus
    CHECK (PaymentStatus IN ('Pending', 'Paid', 'Failed', 'Waived'));
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_PatientProfileRegistrations_PaymentMethod'
)
BEGIN
    ALTER TABLE dbo.PatientProfileRegistrations WITH CHECK
    ADD CONSTRAINT CK_PatientProfileRegistrations_PaymentMethod
    CHECK (PaymentMethod IS NULL OR PaymentMethod IN ('Card', 'UPI', 'NetBanking', 'Cash', 'PayLater', 'Insurance', 'Other'));
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_PatientProfileRegistrations_Fee'
)
BEGIN
    ALTER TABLE dbo.PatientProfileRegistrations WITH CHECK
    ADD CONSTRAINT CK_PatientProfileRegistrations_Fee
    CHECK (RegistrationFee >= 0);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_PatientProfileRegistrations_PaymentJson'
)
BEGIN
    ALTER TABLE dbo.PatientProfileRegistrations WITH CHECK
    ADD CONSTRAINT CK_PatientProfileRegistrations_PaymentJson
    CHECK (PaymentPayloadJson IS NULL OR ISJSON(PaymentPayloadJson) = 1);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_PatientProfileRegistrations_RegistrationJson'
)
BEGIN
    ALTER TABLE dbo.PatientProfileRegistrations WITH CHECK
    ADD CONSTRAINT CK_PatientProfileRegistrations_RegistrationJson
    CHECK (RegistrationPayloadJson IS NULL OR ISJSON(RegistrationPayloadJson) = 1);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'UX_PatientProfileRegistrations_Patient'
      AND object_id = OBJECT_ID(N'dbo.PatientProfileRegistrations')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_PatientProfileRegistrations_Patient
    ON dbo.PatientProfileRegistrations (PatientId);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_PatientProfileRegistrations_Owner'
      AND object_id = OBJECT_ID(N'dbo.PatientProfileRegistrations')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_PatientProfileRegistrations_Owner
    ON dbo.PatientProfileRegistrations (OwnerUserId, CreatedAt DESC);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_PatientProfileRegistrations_HospitalStatus'
      AND object_id = OBJECT_ID(N'dbo.PatientProfileRegistrations')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_PatientProfileRegistrations_HospitalStatus
    ON dbo.PatientProfileRegistrations (HospitalId, PaymentStatus, CreatedAt DESC);
END
GO

SELECT
    OBJECT_ID(N'dbo.PatientProfileRegistrations', N'U') AS PatientProfileRegistrationsTableId,
    COL_LENGTH('dbo.PatientProfileRegistrations', 'PaymentPayloadJson') AS HasPaymentPayloadJson,
    COL_LENGTH('dbo.PatientProfileRegistrations', 'RegistrationPayloadJson') AS HasRegistrationPayloadJson;
GO
