/*
  HMS Main Lab Extension
  ----------------------
  Run this after backend/sql/lab_emr_full_setup.sql to enable:
  - lab incharge / lab head approvals
  - lab room management
  - lab autofill rules
  - technician room assignment flow
  - signature settings for approved reports
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    /* =========================================================
       Role master support
       ========================================================= */

    IF OBJECT_ID('dbo.Roles', 'U') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE RoleName = 'Lab Incharge')
    BEGIN
        DECLARE @NextSortOrder SMALLINT = CASE
            WHEN COL_LENGTH('dbo.Roles', 'SortOrder') IS NOT NULL
                THEN ISNULL((SELECT MAX(SortOrder) FROM dbo.Roles), 0) + 1
            ELSE 1
        END;

        IF COL_LENGTH('dbo.Roles', 'IsActive') IS NOT NULL
           AND COL_LENGTH('dbo.Roles', 'SortOrder') IS NOT NULL
        BEGIN
            INSERT INTO dbo.Roles (RoleName, IsActive, SortOrder)
            VALUES ('Lab Incharge', 1, @NextSortOrder);
        END
        ELSE IF COL_LENGTH('dbo.Roles', 'SortOrder') IS NOT NULL
        BEGIN
            INSERT INTO dbo.Roles (RoleName, SortOrder)
            VALUES ('Lab Incharge', @NextSortOrder);
        END
        ELSE IF COL_LENGTH('dbo.Roles', 'IsActive') IS NOT NULL
        BEGIN
            INSERT INTO dbo.Roles (RoleName, IsActive)
            VALUES ('Lab Incharge', 1);
        END
        ELSE
        BEGIN
            INSERT INTO dbo.Roles (RoleName)
            VALUES ('Lab Incharge');
        END
    END;

    /* =========================================================
       Extra lab order fields required by HMS-main style flow
       ========================================================= */

    IF COL_LENGTH('dbo.LabOrders', 'SampleId') IS NULL
        ALTER TABLE dbo.LabOrders ADD SampleId NVARCHAR(50) NULL;

    IF COL_LENGTH('dbo.LabOrders', 'RejectionReason') IS NULL
        ALTER TABLE dbo.LabOrders ADD RejectionReason NVARCHAR(1000) NULL;

    IF COL_LENGTH('dbo.LabOrderItems', 'RoomId') IS NULL
        ALTER TABLE dbo.LabOrderItems ADD RoomId BIGINT NULL;

    IF COL_LENGTH('dbo.LabOrderItems', 'LabId') IS NULL
        ALTER TABLE dbo.LabOrderItems ADD LabId BIGINT NULL;

    IF COL_LENGTH('dbo.LabOrderItems', 'LabType') IS NULL
        ALTER TABLE dbo.LabOrderItems ADD LabType NVARCHAR(20) NULL;

    /* =========================================================
       Lab masters
       ========================================================= */

    IF OBJECT_ID('dbo.Labs', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.Labs (
            Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            HospitalId BIGINT NULL,
            Name NVARCHAR(200) NOT NULL,
            Type NVARCHAR(50) NOT NULL
                CONSTRAINT DF_Labs_Type DEFAULT ('Internal'),
            Address NVARCHAR(500) NULL,
            ContactPhone NVARCHAR(30) NULL,
            IsActive BIT NOT NULL
                CONSTRAINT DF_Labs_IsActive DEFAULT (1),
            CreatedAt DATETIME2(0) NOT NULL
                CONSTRAINT DF_Labs_CreatedAt DEFAULT (SYSUTCDATETIME()),
            UpdatedAt DATETIME2(0) NOT NULL
                CONSTRAINT DF_Labs_UpdatedAt DEFAULT (SYSUTCDATETIME()),
            CreatedBy BIGINT NULL,
            UpdatedBy BIGINT NULL
        );
    END;

    IF OBJECT_ID('dbo.LabRooms', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.LabRooms (
            Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            HospitalId BIGINT NULL,
            LabId BIGINT NULL,
            RoomNo NVARCHAR(30) NOT NULL,
            RoomType NVARCHAR(100) NULL,
            IsActive BIT NOT NULL
                CONSTRAINT DF_LabRooms_IsActive DEFAULT (1),
            CreatedAt DATETIME2(0) NOT NULL
                CONSTRAINT DF_LabRooms_CreatedAt DEFAULT (SYSUTCDATETIME()),
            UpdatedAt DATETIME2(0) NOT NULL
                CONSTRAINT DF_LabRooms_UpdatedAt DEFAULT (SYSUTCDATETIME()),
            CreatedBy BIGINT NULL,
            UpdatedBy BIGINT NULL
        );
    END;

    IF OBJECT_ID('dbo.Labs', 'U') IS NOT NULL
    BEGIN
        IF COL_LENGTH('dbo.Labs', 'HospitalId') IS NULL
            ALTER TABLE dbo.Labs ADD HospitalId BIGINT NULL;

        IF COL_LENGTH('dbo.Labs', 'Type') IS NULL
            ALTER TABLE dbo.Labs ADD Type NVARCHAR(50) NULL;

        IF COL_LENGTH('dbo.Labs', 'Address') IS NULL
            ALTER TABLE dbo.Labs ADD Address NVARCHAR(500) NULL;

        IF COL_LENGTH('dbo.Labs', 'ContactPhone') IS NULL
            ALTER TABLE dbo.Labs ADD ContactPhone NVARCHAR(30) NULL;

        IF COL_LENGTH('dbo.Labs', 'IsActive') IS NULL
            ALTER TABLE dbo.Labs ADD IsActive BIT NULL;

        IF COL_LENGTH('dbo.Labs', 'CreatedAt') IS NULL
            ALTER TABLE dbo.Labs ADD CreatedAt DATETIME2(0) NULL;

        IF COL_LENGTH('dbo.Labs', 'UpdatedAt') IS NULL
            ALTER TABLE dbo.Labs ADD UpdatedAt DATETIME2(0) NULL;

        IF COL_LENGTH('dbo.Labs', 'CreatedBy') IS NULL
            ALTER TABLE dbo.Labs ADD CreatedBy BIGINT NULL;

        IF COL_LENGTH('dbo.Labs', 'UpdatedBy') IS NULL
            ALTER TABLE dbo.Labs ADD UpdatedBy BIGINT NULL;
    END;

    IF OBJECT_ID('dbo.LabRooms', 'U') IS NOT NULL
    BEGIN
        IF COL_LENGTH('dbo.LabRooms', 'HospitalId') IS NULL
            ALTER TABLE dbo.LabRooms ADD HospitalId BIGINT NULL;

        IF COL_LENGTH('dbo.LabRooms', 'LabId') IS NULL
            ALTER TABLE dbo.LabRooms ADD LabId BIGINT NULL;

        IF COL_LENGTH('dbo.LabRooms', 'RoomType') IS NULL
            ALTER TABLE dbo.LabRooms ADD RoomType NVARCHAR(100) NULL;

        IF COL_LENGTH('dbo.LabRooms', 'IsActive') IS NULL
            ALTER TABLE dbo.LabRooms ADD IsActive BIT NULL;

        IF COL_LENGTH('dbo.LabRooms', 'CreatedAt') IS NULL
            ALTER TABLE dbo.LabRooms ADD CreatedAt DATETIME2(0) NULL;

        IF COL_LENGTH('dbo.LabRooms', 'UpdatedAt') IS NULL
            ALTER TABLE dbo.LabRooms ADD UpdatedAt DATETIME2(0) NULL;

        IF COL_LENGTH('dbo.LabRooms', 'CreatedBy') IS NULL
            ALTER TABLE dbo.LabRooms ADD CreatedBy BIGINT NULL;

        IF COL_LENGTH('dbo.LabRooms', 'UpdatedBy') IS NULL
            ALTER TABLE dbo.LabRooms ADD UpdatedBy BIGINT NULL;
    END;

    IF OBJECT_ID('dbo.LabAutofillRules', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.LabAutofillRules (
            Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            TestCategory NVARCHAR(200) NOT NULL,
            Place NVARCHAR(20) NOT NULL,
            RoomId BIGINT NULL,
            LabId BIGINT NULL,
            CreatedBy BIGINT NULL,
            IsActive BIT NOT NULL
                CONSTRAINT DF_LabAutofillRules_IsActive DEFAULT (1),
            CreatedAt DATETIME2(0) NOT NULL
                CONSTRAINT DF_LabAutofillRules_CreatedAt DEFAULT (SYSUTCDATETIME()),
            UpdatedAt DATETIME2(0) NOT NULL
                CONSTRAINT DF_LabAutofillRules_UpdatedAt DEFAULT (SYSUTCDATETIME())
        );
    END;

    IF OBJECT_ID('dbo.LabAutofillRules', 'U') IS NOT NULL
    BEGIN
        IF COL_LENGTH('dbo.LabAutofillRules', 'Place') IS NULL
            ALTER TABLE dbo.LabAutofillRules ADD Place NVARCHAR(20) NULL;

        IF COL_LENGTH('dbo.LabAutofillRules', 'RoomId') IS NULL
            ALTER TABLE dbo.LabAutofillRules ADD RoomId BIGINT NULL;

        IF COL_LENGTH('dbo.LabAutofillRules', 'LabId') IS NULL
            ALTER TABLE dbo.LabAutofillRules ADD LabId BIGINT NULL;

        IF COL_LENGTH('dbo.LabAutofillRules', 'CreatedBy') IS NULL
            ALTER TABLE dbo.LabAutofillRules ADD CreatedBy BIGINT NULL;

        IF COL_LENGTH('dbo.LabAutofillRules', 'IsActive') IS NULL
            ALTER TABLE dbo.LabAutofillRules ADD IsActive BIT NULL;

        IF COL_LENGTH('dbo.LabAutofillRules', 'CreatedAt') IS NULL
            ALTER TABLE dbo.LabAutofillRules ADD CreatedAt DATETIME2(0) NULL;

        IF COL_LENGTH('dbo.LabAutofillRules', 'UpdatedAt') IS NULL
            ALTER TABLE dbo.LabAutofillRules ADD UpdatedAt DATETIME2(0) NULL;
    END;

    /* =========================================================
       Lab technician / incharge profiles
       ========================================================= */

    IF OBJECT_ID('dbo.LabTechnicianProfiles', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.LabTechnicianProfiles (
            Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            UserId BIGINT NOT NULL,
            RoomId BIGINT NULL,
            CreatedAt DATETIME2(0) NOT NULL
                CONSTRAINT DF_LabTechnicianProfiles_CreatedAt DEFAULT (SYSUTCDATETIME()),
            UpdatedAt DATETIME2(0) NOT NULL
                CONSTRAINT DF_LabTechnicianProfiles_UpdatedAt DEFAULT (SYSUTCDATETIME())
        );
    END;

    IF OBJECT_ID('dbo.LabTechnicianRoomAssignments', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.LabTechnicianRoomAssignments (
            Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            TechnicianId BIGINT NOT NULL,
            RoomId BIGINT NOT NULL,
            AssignedBy BIGINT NULL,
            Status NVARCHAR(20) NOT NULL
                CONSTRAINT DF_LabTechnicianRoomAssignments_Status DEFAULT ('Pending'),
            AssignmentType NVARCHAR(50) NOT NULL
                CONSTRAINT DF_LabTechnicianRoomAssignments_AssignmentType DEFAULT ('Formal Transfer'),
            Notes NVARCHAR(MAX) NULL,
            AssignedAt DATETIME2(0) NOT NULL
                CONSTRAINT DF_LabTechnicianRoomAssignments_AssignedAt DEFAULT (SYSUTCDATETIME()),
            CreatedAt DATETIME2(0) NOT NULL
                CONSTRAINT DF_LabTechnicianRoomAssignments_CreatedAt DEFAULT (SYSUTCDATETIME()),
            UpdatedAt DATETIME2(0) NOT NULL
                CONSTRAINT DF_LabTechnicianRoomAssignments_UpdatedAt DEFAULT (SYSUTCDATETIME())
        );
    END;

    IF OBJECT_ID('dbo.LabInchargeProfiles', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.LabInchargeProfiles (
            Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            UserId BIGINT NOT NULL,
            SignatureText NVARCHAR(200) NULL,
            SignaturePreference NVARCHAR(20) NOT NULL
                CONSTRAINT DF_LabInchargeProfiles_SignaturePreference DEFAULT ('NewPage'),
            SignatureImagePath NVARCHAR(1000) NULL,
            CreatedAt DATETIME2(0) NOT NULL
                CONSTRAINT DF_LabInchargeProfiles_CreatedAt DEFAULT (SYSUTCDATETIME()),
            UpdatedAt DATETIME2(0) NOT NULL
                CONSTRAINT DF_LabInchargeProfiles_UpdatedAt DEFAULT (SYSUTCDATETIME())
        );
    END;

    /* =========================================================
       Constraints
       ========================================================= */

    IF OBJECT_ID('dbo.LabRooms', 'U') IS NOT NULL
       AND OBJECT_ID('dbo.Labs', 'U') IS NOT NULL
       AND COL_LENGTH('dbo.LabRooms', 'LabId') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_LabRooms_Lab')
    BEGIN
        EXEC(N'
            ALTER TABLE dbo.LabRooms
            ADD CONSTRAINT FK_LabRooms_Lab
                FOREIGN KEY (LabId) REFERENCES dbo.Labs(Id);
        ');
    END;

    IF OBJECT_ID('dbo.LabAutofillRules', 'U') IS NOT NULL
       AND OBJECT_ID('dbo.LabRooms', 'U') IS NOT NULL
       AND COL_LENGTH('dbo.LabAutofillRules', 'RoomId') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_LabAutofillRules_Room')
    BEGIN
        EXEC(N'
            ALTER TABLE dbo.LabAutofillRules
            ADD CONSTRAINT FK_LabAutofillRules_Room
                FOREIGN KEY (RoomId) REFERENCES dbo.LabRooms(Id);
        ');
    END;

    IF OBJECT_ID('dbo.LabAutofillRules', 'U') IS NOT NULL
       AND OBJECT_ID('dbo.Labs', 'U') IS NOT NULL
       AND COL_LENGTH('dbo.LabAutofillRules', 'LabId') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_LabAutofillRules_Lab')
    BEGIN
        EXEC(N'
            ALTER TABLE dbo.LabAutofillRules
            ADD CONSTRAINT FK_LabAutofillRules_Lab
                FOREIGN KEY (LabId) REFERENCES dbo.Labs(Id);
        ');
    END;

    IF OBJECT_ID('dbo.LabTechnicianProfiles', 'U') IS NOT NULL
       AND OBJECT_ID('dbo.Users', 'U') IS NOT NULL
       AND COL_LENGTH('dbo.LabTechnicianProfiles', 'UserId') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_LabTechnicianProfiles_User')
    BEGIN
        EXEC(N'
            ALTER TABLE dbo.LabTechnicianProfiles
            ADD CONSTRAINT FK_LabTechnicianProfiles_User
                FOREIGN KEY (UserId) REFERENCES dbo.Users(Id);
        ');
    END;

    IF OBJECT_ID('dbo.LabTechnicianProfiles', 'U') IS NOT NULL
       AND OBJECT_ID('dbo.LabRooms', 'U') IS NOT NULL
       AND COL_LENGTH('dbo.LabTechnicianProfiles', 'RoomId') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_LabTechnicianProfiles_Room')
    BEGIN
        EXEC(N'
            ALTER TABLE dbo.LabTechnicianProfiles
            ADD CONSTRAINT FK_LabTechnicianProfiles_Room
                FOREIGN KEY (RoomId) REFERENCES dbo.LabRooms(Id);
        ');
    END;

    IF OBJECT_ID('dbo.LabTechnicianRoomAssignments', 'U') IS NOT NULL
       AND OBJECT_ID('dbo.LabTechnicianProfiles', 'U') IS NOT NULL
       AND COL_LENGTH('dbo.LabTechnicianRoomAssignments', 'TechnicianId') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_LabTechnicianRoomAssignments_Technician')
    BEGIN
        EXEC(N'
            ALTER TABLE dbo.LabTechnicianRoomAssignments
            ADD CONSTRAINT FK_LabTechnicianRoomAssignments_Technician
                FOREIGN KEY (TechnicianId) REFERENCES dbo.LabTechnicianProfiles(Id);
        ');
    END;

    IF OBJECT_ID('dbo.LabTechnicianRoomAssignments', 'U') IS NOT NULL
       AND OBJECT_ID('dbo.LabRooms', 'U') IS NOT NULL
       AND COL_LENGTH('dbo.LabTechnicianRoomAssignments', 'RoomId') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_LabTechnicianRoomAssignments_Room')
    BEGIN
        EXEC(N'
            ALTER TABLE dbo.LabTechnicianRoomAssignments
            ADD CONSTRAINT FK_LabTechnicianRoomAssignments_Room
                FOREIGN KEY (RoomId) REFERENCES dbo.LabRooms(Id);
        ');
    END;

    IF OBJECT_ID('dbo.LabTechnicianRoomAssignments', 'U') IS NOT NULL
       AND OBJECT_ID('dbo.Users', 'U') IS NOT NULL
       AND COL_LENGTH('dbo.LabTechnicianRoomAssignments', 'AssignedBy') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_LabTechnicianRoomAssignments_AssignedBy')
    BEGIN
        EXEC(N'
            ALTER TABLE dbo.LabTechnicianRoomAssignments
            ADD CONSTRAINT FK_LabTechnicianRoomAssignments_AssignedBy
                FOREIGN KEY (AssignedBy) REFERENCES dbo.Users(Id);
        ');
    END;

    IF OBJECT_ID('dbo.LabInchargeProfiles', 'U') IS NOT NULL
       AND OBJECT_ID('dbo.Users', 'U') IS NOT NULL
       AND COL_LENGTH('dbo.LabInchargeProfiles', 'UserId') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_LabInchargeProfiles_User')
    BEGIN
        EXEC(N'
            ALTER TABLE dbo.LabInchargeProfiles
            ADD CONSTRAINT FK_LabInchargeProfiles_User
                FOREIGN KEY (UserId) REFERENCES dbo.Users(Id);
        ');
    END;

    IF OBJECT_ID('dbo.LabOrderItems', 'U') IS NOT NULL
       AND OBJECT_ID('dbo.LabRooms', 'U') IS NOT NULL
       AND COL_LENGTH('dbo.LabOrderItems', 'RoomId') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_LabOrderItems_Room')
    BEGIN
        EXEC(N'
            ALTER TABLE dbo.LabOrderItems
            ADD CONSTRAINT FK_LabOrderItems_Room
                FOREIGN KEY (RoomId) REFERENCES dbo.LabRooms(Id);
        ');
    END;

    IF OBJECT_ID('dbo.LabOrderItems', 'U') IS NOT NULL
       AND OBJECT_ID('dbo.Labs', 'U') IS NOT NULL
       AND COL_LENGTH('dbo.LabOrderItems', 'LabId') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_LabOrderItems_Lab')
    BEGIN
        EXEC(N'
            ALTER TABLE dbo.LabOrderItems
            ADD CONSTRAINT FK_LabOrderItems_Lab
                FOREIGN KEY (LabId) REFERENCES dbo.Labs(Id);
        ');
    END;

    /* =========================================================
       Indexes / uniqueness
       ========================================================= */

    IF OBJECT_ID('dbo.Labs', 'U') IS NOT NULL
       AND COL_LENGTH('dbo.Labs', 'HospitalId') IS NOT NULL
       AND COL_LENGTH('dbo.Labs', 'IsActive') IS NOT NULL
       AND COL_LENGTH('dbo.Labs', 'Name') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Labs_Hospital_IsActive' AND object_id = OBJECT_ID('dbo.Labs'))
        EXEC(N'CREATE INDEX IX_Labs_Hospital_IsActive ON dbo.Labs (HospitalId, IsActive, Name);');

    IF OBJECT_ID('dbo.LabRooms', 'U') IS NOT NULL
       AND COL_LENGTH('dbo.LabRooms', 'HospitalId') IS NOT NULL
       AND COL_LENGTH('dbo.LabRooms', 'IsActive') IS NOT NULL
       AND COL_LENGTH('dbo.LabRooms', 'RoomNo') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LabRooms_Hospital_IsActive' AND object_id = OBJECT_ID('dbo.LabRooms'))
        EXEC(N'CREATE INDEX IX_LabRooms_Hospital_IsActive ON dbo.LabRooms (HospitalId, IsActive, RoomNo);');

    IF OBJECT_ID('dbo.LabAutofillRules', 'U') IS NOT NULL
       AND COL_LENGTH('dbo.LabAutofillRules', 'TestCategory') IS NOT NULL
       AND COL_LENGTH('dbo.LabAutofillRules', 'IsActive') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LabAutofillRules_TestCategory' AND object_id = OBJECT_ID('dbo.LabAutofillRules'))
        EXEC(N'CREATE INDEX IX_LabAutofillRules_TestCategory ON dbo.LabAutofillRules (TestCategory, IsActive);');

    IF OBJECT_ID('dbo.LabTechnicianProfiles', 'U') IS NOT NULL
       AND COL_LENGTH('dbo.LabTechnicianProfiles', 'UserId') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_LabTechnicianProfiles_UserId' AND object_id = OBJECT_ID('dbo.LabTechnicianProfiles'))
        EXEC(N'CREATE UNIQUE INDEX UQ_LabTechnicianProfiles_UserId ON dbo.LabTechnicianProfiles (UserId);');

    IF OBJECT_ID('dbo.LabTechnicianRoomAssignments', 'U') IS NOT NULL
       AND COL_LENGTH('dbo.LabTechnicianRoomAssignments', 'TechnicianId') IS NOT NULL
       AND COL_LENGTH('dbo.LabTechnicianRoomAssignments', 'Status') IS NOT NULL
       AND COL_LENGTH('dbo.LabTechnicianRoomAssignments', 'AssignedAt') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LabTechnicianRoomAssignments_Technician_Status' AND object_id = OBJECT_ID('dbo.LabTechnicianRoomAssignments'))
        EXEC(N'CREATE INDEX IX_LabTechnicianRoomAssignments_Technician_Status ON dbo.LabTechnicianRoomAssignments (TechnicianId, Status, AssignedAt DESC);');

    IF OBJECT_ID('dbo.LabInchargeProfiles', 'U') IS NOT NULL
       AND COL_LENGTH('dbo.LabInchargeProfiles', 'UserId') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_LabInchargeProfiles_UserId' AND object_id = OBJECT_ID('dbo.LabInchargeProfiles'))
        EXEC(N'CREATE UNIQUE INDEX UQ_LabInchargeProfiles_UserId ON dbo.LabInchargeProfiles (UserId);');

    IF OBJECT_ID('dbo.LabOrders', 'U') IS NOT NULL
       AND COL_LENGTH('dbo.LabOrders', 'SampleId') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LabOrders_SampleId' AND object_id = OBJECT_ID('dbo.LabOrders'))
        EXEC(N'CREATE INDEX IX_LabOrders_SampleId ON dbo.LabOrders (SampleId);');

    IF OBJECT_ID('dbo.LabOrderItems', 'U') IS NOT NULL
       AND COL_LENGTH('dbo.LabOrderItems', 'RoomId') IS NOT NULL
       AND COL_LENGTH('dbo.LabOrderItems', 'LabId') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LabOrderItems_Room_Lab' AND object_id = OBJECT_ID('dbo.LabOrderItems'))
        EXEC(N'CREATE INDEX IX_LabOrderItems_Room_Lab ON dbo.LabOrderItems (RoomId, LabId);');

    /* =========================================================
       Seeds
       ========================================================= */

    DECLARE @SeedTimestamp DATETIME2(0) = SYSUTCDATETIME();

    IF OBJECT_ID('dbo.Labs', 'U') IS NOT NULL
       AND COL_LENGTH('dbo.Labs', 'Name') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM dbo.Labs WHERE Name = 'Central Diagnostics')
    BEGIN
        DECLARE @InsertDefaultLabSql NVARCHAR(MAX) = N'INSERT INTO dbo.Labs (Name';
        DECLARE @InsertDefaultLabValues NVARCHAR(MAX) = N') VALUES (@Name';

        IF COL_LENGTH('dbo.Labs', 'HospitalId') IS NOT NULL
        BEGIN
            SET @InsertDefaultLabSql += N', HospitalId';
            SET @InsertDefaultLabValues += N', @HospitalId';
        END;

        IF COL_LENGTH('dbo.Labs', 'Type') IS NOT NULL
        BEGIN
            SET @InsertDefaultLabSql += N', Type';
            SET @InsertDefaultLabValues += N', @Type';
        END;

        IF COL_LENGTH('dbo.Labs', 'IsActive') IS NOT NULL
        BEGIN
            SET @InsertDefaultLabSql += N', IsActive';
            SET @InsertDefaultLabValues += N', @IsActive';
        END;

        IF COL_LENGTH('dbo.Labs', 'CreatedAt') IS NOT NULL
        BEGIN
            SET @InsertDefaultLabSql += N', CreatedAt';
            SET @InsertDefaultLabValues += N', @CreatedAt';
        END;

        IF COL_LENGTH('dbo.Labs', 'UpdatedAt') IS NOT NULL
        BEGIN
            SET @InsertDefaultLabSql += N', UpdatedAt';
            SET @InsertDefaultLabValues += N', @UpdatedAt';
        END;

        SET @InsertDefaultLabSql += @InsertDefaultLabValues + N');';

        EXEC sp_executesql
            @InsertDefaultLabSql,
            N'@Name NVARCHAR(200), @HospitalId BIGINT, @Type NVARCHAR(50), @IsActive BIT, @CreatedAt DATETIME2(0), @UpdatedAt DATETIME2(0)',
            @Name = N'Central Diagnostics',
            @HospitalId = NULL,
            @Type = N'Internal',
            @IsActive = 1,
            @CreatedAt = @SeedTimestamp,
            @UpdatedAt = @SeedTimestamp;
    END;

    IF OBJECT_ID('dbo.LabRooms', 'U') IS NOT NULL
       AND COL_LENGTH('dbo.LabRooms', 'RoomNo') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM dbo.LabRooms WHERE RoomNo = 'LAB-01')
    BEGIN
        DECLARE @DefaultLabId BIGINT = (SELECT TOP 1 Id FROM dbo.Labs ORDER BY Id);
        DECLARE @InsertDefaultLabRoomSql NVARCHAR(MAX) = N'INSERT INTO dbo.LabRooms (RoomNo';
        DECLARE @InsertDefaultLabRoomValues NVARCHAR(MAX) = N') VALUES (@RoomNo';

        IF COL_LENGTH('dbo.LabRooms', 'HospitalId') IS NOT NULL
        BEGIN
            SET @InsertDefaultLabRoomSql += N', HospitalId';
            SET @InsertDefaultLabRoomValues += N', @HospitalId';
        END;

        IF COL_LENGTH('dbo.LabRooms', 'LabId') IS NOT NULL
        BEGIN
            SET @InsertDefaultLabRoomSql += N', LabId';
            SET @InsertDefaultLabRoomValues += N', @LabId';
        END;

        IF COL_LENGTH('dbo.LabRooms', 'RoomType') IS NOT NULL
        BEGIN
            SET @InsertDefaultLabRoomSql += N', RoomType';
            SET @InsertDefaultLabRoomValues += N', @RoomType';
        END;

        IF COL_LENGTH('dbo.LabRooms', 'IsActive') IS NOT NULL
        BEGIN
            SET @InsertDefaultLabRoomSql += N', IsActive';
            SET @InsertDefaultLabRoomValues += N', @IsActive';
        END;

        IF COL_LENGTH('dbo.LabRooms', 'CreatedAt') IS NOT NULL
        BEGIN
            SET @InsertDefaultLabRoomSql += N', CreatedAt';
            SET @InsertDefaultLabRoomValues += N', @CreatedAt';
        END;

        IF COL_LENGTH('dbo.LabRooms', 'UpdatedAt') IS NOT NULL
        BEGIN
            SET @InsertDefaultLabRoomSql += N', UpdatedAt';
            SET @InsertDefaultLabRoomValues += N', @UpdatedAt';
        END;

        SET @InsertDefaultLabRoomSql += @InsertDefaultLabRoomValues + N');';

        EXEC sp_executesql
            @InsertDefaultLabRoomSql,
            N'@RoomNo NVARCHAR(30), @HospitalId BIGINT, @LabId BIGINT, @RoomType NVARCHAR(100), @IsActive BIT, @CreatedAt DATETIME2(0), @UpdatedAt DATETIME2(0)',
            @RoomNo = N'LAB-01',
            @HospitalId = NULL,
            @LabId = @DefaultLabId,
            @RoomType = N'Main Processing Room',
            @IsActive = 1,
            @CreatedAt = @SeedTimestamp,
            @UpdatedAt = @SeedTimestamp;
    END;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    THROW;
END CATCH;
GO
