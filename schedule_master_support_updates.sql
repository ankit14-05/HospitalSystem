USE [HospitalDB];
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

/* =========================================================
   SCHEDULE MASTER SUPPORT
   - Structured locations for ward / OT / other duties
   - Reusable shift templates
   - Persistent doctor weekly schedule templates
   - Optional links back into DoctorScheduleAssignments
   Run after doctor_schedule_v2_updates.sql
   ========================================================= */

IF OBJECT_ID(N'dbo.HospitalLocations', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.HospitalLocations (
        Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        HospitalId BIGINT NOT NULL,
        DepartmentId BIGINT NULL,
        LocationKind NVARCHAR(30) NOT NULL,
        Code NVARCHAR(30) NULL,
        Name NVARCHAR(120) NOT NULL,
        Floor NVARCHAR(40) NULL,
        Notes NVARCHAR(500) NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_HospitalLocations_IsActive DEFAULT ((1)),
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_HospitalLocations_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_HospitalLocations_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CreatedBy BIGINT NULL,
        UpdatedBy BIGINT NULL
    );
END
GO

IF OBJECT_ID(N'dbo.ShiftTemplates', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ShiftTemplates (
        Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        HospitalId BIGINT NOT NULL,
        Name NVARCHAR(120) NOT NULL,
        Category NVARCHAR(30) NOT NULL,
        ActivityTypeId BIGINT NULL,
        StartTime TIME(0) NOT NULL,
        EndTime TIME(0) NOT NULL,
        SlotDurationMins SMALLINT NULL,
        DefaultMaxSlots SMALLINT NULL,
        LocationKind NVARCHAR(30) NOT NULL CONSTRAINT DF_ShiftTemplates_LocationKind DEFAULT ('general'),
        OpdRoomId BIGINT NULL,
        HospitalLocationId BIGINT NULL,
        Notes NVARCHAR(500) NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_ShiftTemplates_IsActive DEFAULT ((1)),
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ShiftTemplates_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ShiftTemplates_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CreatedBy BIGINT NULL,
        UpdatedBy BIGINT NULL
    );
END
GO

IF OBJECT_ID(N'dbo.DoctorWeeklyScheduleTemplates', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DoctorWeeklyScheduleTemplates (
        Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        HospitalId BIGINT NOT NULL,
        DoctorId BIGINT NOT NULL,
        DepartmentId BIGINT NULL,
        SpecializationId INT NULL,
        DayOfWeek TINYINT NOT NULL,
        Category NVARCHAR(30) NOT NULL,
        ActivityTypeId BIGINT NULL,
        ShiftTemplateId BIGINT NULL,
        Title NVARCHAR(150) NULL,
        StartTime TIME(0) NOT NULL,
        EndTime TIME(0) NOT NULL,
        LocationKind NVARCHAR(30) NOT NULL CONSTRAINT DF_DoctorWeeklyScheduleTemplates_LocationKind DEFAULT ('general'),
        OpdRoomId BIGINT NULL,
        HospitalLocationId BIGINT NULL,
        SlotDurationMins SMALLINT NULL,
        MaxSlots SMALLINT NULL,
        BookingEnabled BIT NOT NULL CONSTRAINT DF_DoctorWeeklyScheduleTemplates_BookingEnabled DEFAULT ((0)),
        Notes NVARCHAR(500) NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_DoctorWeeklyScheduleTemplates_IsActive DEFAULT ((1)),
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_DoctorWeeklyScheduleTemplates_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_DoctorWeeklyScheduleTemplates_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CreatedBy BIGINT NULL,
        UpdatedBy BIGINT NULL
    );
END
GO

IF OBJECT_ID(N'dbo.DoctorScheduleAssignments', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.DoctorScheduleAssignments', 'HospitalLocationId') IS NULL
    BEGIN
        ALTER TABLE dbo.DoctorScheduleAssignments ADD HospitalLocationId BIGINT NULL;
    END;

    IF COL_LENGTH('dbo.DoctorScheduleAssignments', 'ShiftTemplateId') IS NULL
    BEGIN
        ALTER TABLE dbo.DoctorScheduleAssignments ADD ShiftTemplateId BIGINT NULL;
    END;
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_HospitalLocations_LocationKind'
)
BEGIN
    ALTER TABLE dbo.HospitalLocations WITH CHECK
    ADD CONSTRAINT CK_HospitalLocations_LocationKind
    CHECK (LocationKind IN ('ward', 'ot', 'general', 'meeting', 'lab', 'other'));
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_ShiftTemplates_Category'
)
BEGIN
    ALTER TABLE dbo.ShiftTemplates WITH CHECK
    ADD CONSTRAINT CK_ShiftTemplates_Category
    CHECK (Category IN ('opd', 'ward', 'ot', 'other'));
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_ShiftTemplates_LocationKind'
)
BEGIN
    ALTER TABLE dbo.ShiftTemplates WITH CHECK
    ADD CONSTRAINT CK_ShiftTemplates_LocationKind
    CHECK (LocationKind IN ('opd_room', 'ward', 'ot', 'general', 'meeting', 'lab', 'other'));
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_ShiftTemplates_Times'
)
BEGIN
    ALTER TABLE dbo.ShiftTemplates WITH CHECK
    ADD CONSTRAINT CK_ShiftTemplates_Times
    CHECK (EndTime > StartTime);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_DoctorWeeklyScheduleTemplates_DayOfWeek'
)
BEGIN
    ALTER TABLE dbo.DoctorWeeklyScheduleTemplates WITH CHECK
    ADD CONSTRAINT CK_DoctorWeeklyScheduleTemplates_DayOfWeek
    CHECK (DayOfWeek BETWEEN 0 AND 6);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_DoctorWeeklyScheduleTemplates_Category'
)
BEGIN
    ALTER TABLE dbo.DoctorWeeklyScheduleTemplates WITH CHECK
    ADD CONSTRAINT CK_DoctorWeeklyScheduleTemplates_Category
    CHECK (Category IN ('opd', 'ward', 'ot', 'other'));
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_DoctorWeeklyScheduleTemplates_LocationKind'
)
BEGIN
    ALTER TABLE dbo.DoctorWeeklyScheduleTemplates WITH CHECK
    ADD CONSTRAINT CK_DoctorWeeklyScheduleTemplates_LocationKind
    CHECK (LocationKind IN ('opd_room', 'ward', 'ot', 'general', 'meeting', 'lab', 'other'));
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_DoctorWeeklyScheduleTemplates_Times'
)
BEGIN
    ALTER TABLE dbo.DoctorWeeklyScheduleTemplates WITH CHECK
    ADD CONSTRAINT CK_DoctorWeeklyScheduleTemplates_Times
    CHECK (EndTime > StartTime);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_HospitalLocations_Hospital'
)
BEGIN
    ALTER TABLE dbo.HospitalLocations WITH CHECK
    ADD CONSTRAINT FK_HospitalLocations_Hospital
    FOREIGN KEY (HospitalId) REFERENCES dbo.HospitalSetup(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_HospitalLocations_Department'
)
BEGIN
    ALTER TABLE dbo.HospitalLocations WITH CHECK
    ADD CONSTRAINT FK_HospitalLocations_Department
    FOREIGN KEY (DepartmentId) REFERENCES dbo.Departments(Id);
END
GO

IF OBJECT_ID(N'dbo.DoctorScheduleActivityTypes', N'U') IS NOT NULL
    AND NOT EXISTS (
        SELECT 1
        FROM sys.foreign_keys
        WHERE name = N'FK_ShiftTemplates_ActivityType'
    )
BEGIN
    ALTER TABLE dbo.ShiftTemplates WITH CHECK
    ADD CONSTRAINT FK_ShiftTemplates_ActivityType
    FOREIGN KEY (ActivityTypeId) REFERENCES dbo.DoctorScheduleActivityTypes(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_ShiftTemplates_Hospital'
)
BEGIN
    ALTER TABLE dbo.ShiftTemplates WITH CHECK
    ADD CONSTRAINT FK_ShiftTemplates_Hospital
    FOREIGN KEY (HospitalId) REFERENCES dbo.HospitalSetup(Id);
END
GO

IF OBJECT_ID(N'dbo.OpdRooms', N'U') IS NOT NULL
    AND NOT EXISTS (
        SELECT 1
        FROM sys.foreign_keys
        WHERE name = N'FK_ShiftTemplates_OpdRoom'
    )
BEGIN
    ALTER TABLE dbo.ShiftTemplates WITH CHECK
    ADD CONSTRAINT FK_ShiftTemplates_OpdRoom
    FOREIGN KEY (OpdRoomId) REFERENCES dbo.OpdRooms(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_ShiftTemplates_HospitalLocation'
)
BEGIN
    ALTER TABLE dbo.ShiftTemplates WITH CHECK
    ADD CONSTRAINT FK_ShiftTemplates_HospitalLocation
    FOREIGN KEY (HospitalLocationId) REFERENCES dbo.HospitalLocations(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_DoctorWeeklyScheduleTemplates_Hospital'
)
BEGIN
    ALTER TABLE dbo.DoctorWeeklyScheduleTemplates WITH CHECK
    ADD CONSTRAINT FK_DoctorWeeklyScheduleTemplates_Hospital
    FOREIGN KEY (HospitalId) REFERENCES dbo.HospitalSetup(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_DoctorWeeklyScheduleTemplates_Doctor'
)
BEGIN
    ALTER TABLE dbo.DoctorWeeklyScheduleTemplates WITH CHECK
    ADD CONSTRAINT FK_DoctorWeeklyScheduleTemplates_Doctor
    FOREIGN KEY (DoctorId) REFERENCES dbo.DoctorProfiles(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_DoctorWeeklyScheduleTemplates_Department'
)
BEGIN
    ALTER TABLE dbo.DoctorWeeklyScheduleTemplates WITH CHECK
    ADD CONSTRAINT FK_DoctorWeeklyScheduleTemplates_Department
    FOREIGN KEY (DepartmentId) REFERENCES dbo.Departments(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_DoctorWeeklyScheduleTemplates_Specialization'
)
BEGIN
    ALTER TABLE dbo.DoctorWeeklyScheduleTemplates WITH CHECK
    ADD CONSTRAINT FK_DoctorWeeklyScheduleTemplates_Specialization
    FOREIGN KEY (SpecializationId) REFERENCES dbo.Specializations(Id);
END
GO

IF OBJECT_ID(N'dbo.DoctorScheduleActivityTypes', N'U') IS NOT NULL
    AND NOT EXISTS (
        SELECT 1
        FROM sys.foreign_keys
        WHERE name = N'FK_DoctorWeeklyScheduleTemplates_ActivityType'
    )
BEGIN
    ALTER TABLE dbo.DoctorWeeklyScheduleTemplates WITH CHECK
    ADD CONSTRAINT FK_DoctorWeeklyScheduleTemplates_ActivityType
    FOREIGN KEY (ActivityTypeId) REFERENCES dbo.DoctorScheduleActivityTypes(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_DoctorWeeklyScheduleTemplates_ShiftTemplate'
)
BEGIN
    ALTER TABLE dbo.DoctorWeeklyScheduleTemplates WITH CHECK
    ADD CONSTRAINT FK_DoctorWeeklyScheduleTemplates_ShiftTemplate
    FOREIGN KEY (ShiftTemplateId) REFERENCES dbo.ShiftTemplates(Id);
END
GO

IF OBJECT_ID(N'dbo.OpdRooms', N'U') IS NOT NULL
    AND NOT EXISTS (
        SELECT 1
        FROM sys.foreign_keys
        WHERE name = N'FK_DoctorWeeklyScheduleTemplates_OpdRoom'
    )
BEGIN
    ALTER TABLE dbo.DoctorWeeklyScheduleTemplates WITH CHECK
    ADD CONSTRAINT FK_DoctorWeeklyScheduleTemplates_OpdRoom
    FOREIGN KEY (OpdRoomId) REFERENCES dbo.OpdRooms(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_DoctorWeeklyScheduleTemplates_HospitalLocation'
)
BEGIN
    ALTER TABLE dbo.DoctorWeeklyScheduleTemplates WITH CHECK
    ADD CONSTRAINT FK_DoctorWeeklyScheduleTemplates_HospitalLocation
    FOREIGN KEY (HospitalLocationId) REFERENCES dbo.HospitalLocations(Id);
END
GO

IF OBJECT_ID(N'dbo.DoctorScheduleAssignments', N'U') IS NOT NULL
    AND COL_LENGTH('dbo.DoctorScheduleAssignments', 'HospitalLocationId') IS NOT NULL
    AND NOT EXISTS (
        SELECT 1
        FROM sys.foreign_keys
        WHERE name = N'FK_DoctorScheduleAssignments_HospitalLocation'
    )
BEGIN
    ALTER TABLE dbo.DoctorScheduleAssignments WITH CHECK
    ADD CONSTRAINT FK_DoctorScheduleAssignments_HospitalLocation
    FOREIGN KEY (HospitalLocationId) REFERENCES dbo.HospitalLocations(Id);
END
GO

IF OBJECT_ID(N'dbo.DoctorScheduleAssignments', N'U') IS NOT NULL
    AND COL_LENGTH('dbo.DoctorScheduleAssignments', 'ShiftTemplateId') IS NOT NULL
    AND NOT EXISTS (
        SELECT 1
        FROM sys.foreign_keys
        WHERE name = N'FK_DoctorScheduleAssignments_ShiftTemplate'
    )
BEGIN
    ALTER TABLE dbo.DoctorScheduleAssignments WITH CHECK
    ADD CONSTRAINT FK_DoctorScheduleAssignments_ShiftTemplate
    FOREIGN KEY (ShiftTemplateId) REFERENCES dbo.ShiftTemplates(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_HospitalLocations_HospitalKind'
      AND object_id = OBJECT_ID(N'dbo.HospitalLocations')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_HospitalLocations_HospitalKind
    ON dbo.HospitalLocations (HospitalId, LocationKind, DepartmentId, Name);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'UX_HospitalLocations_HospitalCode'
      AND object_id = OBJECT_ID(N'dbo.HospitalLocations')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_HospitalLocations_HospitalCode
    ON dbo.HospitalLocations (HospitalId, Code)
    WHERE Code IS NOT NULL;
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_ShiftTemplates_HospitalCategory'
      AND object_id = OBJECT_ID(N'dbo.ShiftTemplates')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_ShiftTemplates_HospitalCategory
    ON dbo.ShiftTemplates (HospitalId, Category, IsActive, Name);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'UX_DoctorWeeklyScheduleTemplates_DoctorDayCategory'
      AND object_id = OBJECT_ID(N'dbo.DoctorWeeklyScheduleTemplates')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_DoctorWeeklyScheduleTemplates_DoctorDayCategory
    ON dbo.DoctorWeeklyScheduleTemplates (HospitalId, DoctorId, DayOfWeek, Category)
    WHERE IsActive = 1;
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_DoctorWeeklyScheduleTemplates_Doctor'
      AND object_id = OBJECT_ID(N'dbo.DoctorWeeklyScheduleTemplates')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_DoctorWeeklyScheduleTemplates_Doctor
    ON dbo.DoctorWeeklyScheduleTemplates (DoctorId, DayOfWeek, IsActive);
END
GO

/* =========================================================
   Backfill non-OPD assignment locations into HospitalLocations
   ========================================================= */
IF OBJECT_ID(N'dbo.DoctorScheduleAssignments', N'U') IS NOT NULL
BEGIN
    INSERT INTO dbo.HospitalLocations
    (
        HospitalId,
        DepartmentId,
        LocationKind,
        Code,
        Name,
        Notes,
        IsActive
    )
    SELECT DISTINCT
        a.HospitalId,
        a.DepartmentId,
        CASE
            WHEN a.LocationKind IN ('ward', 'ot', 'general') THEN a.LocationKind
            ELSE 'other'
        END AS LocationKind,
        NULL,
        LEFT(a.LocationLabel, 120),
        'Migrated from existing doctor schedule assignments',
        1
    FROM dbo.DoctorScheduleAssignments a
    WHERE a.LocationLabel IS NOT NULL
      AND LTRIM(RTRIM(a.LocationLabel)) <> ''
      AND (a.OpdRoomId IS NULL OR a.LocationKind <> 'opd_room')
      AND NOT EXISTS (
          SELECT 1
          FROM dbo.HospitalLocations hl
          WHERE hl.HospitalId = a.HospitalId
            AND hl.Name = LEFT(a.LocationLabel, 120)
            AND hl.LocationKind = CASE
                WHEN a.LocationKind IN ('ward', 'ot', 'general') THEN a.LocationKind
                ELSE 'other'
            END
      );
END
GO

IF OBJECT_ID(N'dbo.DoctorScheduleAssignments', N'U') IS NOT NULL
   AND COL_LENGTH('dbo.DoctorScheduleAssignments', 'HospitalLocationId') IS NOT NULL
BEGIN
    UPDATE a
    SET a.HospitalLocationId = hl.Id
    FROM dbo.DoctorScheduleAssignments a
    JOIN dbo.HospitalLocations hl
      ON hl.HospitalId = a.HospitalId
     AND hl.Name = LEFT(a.LocationLabel, 120)
     AND hl.LocationKind = CASE
         WHEN a.LocationKind IN ('ward', 'ot', 'general') THEN a.LocationKind
         ELSE 'other'
     END
    WHERE a.HospitalLocationId IS NULL
      AND a.LocationLabel IS NOT NULL
      AND LTRIM(RTRIM(a.LocationLabel)) <> '';
END
GO

/* =========================================================
   Seed reusable shift templates per hospital
   ========================================================= */
IF OBJECT_ID(N'dbo.HospitalSetup', N'U') IS NOT NULL
BEGIN
    INSERT INTO dbo.ShiftTemplates
    (
        HospitalId,
        Name,
        Category,
        ActivityTypeId,
        StartTime,
        EndTime,
        SlotDurationMins,
        DefaultMaxSlots,
        LocationKind,
        Notes,
        IsActive
    )
    SELECT
        h.Id,
        seed.Name,
        seed.Category,
        atp.Id,
        seed.StartTime,
        seed.EndTime,
        seed.SlotDurationMins,
        seed.DefaultMaxSlots,
        seed.LocationKind,
        seed.Notes,
        1
    FROM dbo.HospitalSetup h
    CROSS APPLY (
        VALUES
            ('OPD Morning Session', 'opd', 'OPD_SESSION', CAST('09:00' AS TIME(0)), CAST('13:00' AS TIME(0)), 15, 16, 'opd_room', 'Standard morning OPD block'),
            ('OPD Evening Session', 'opd', 'OPD_SESSION', CAST('14:00' AS TIME(0)), CAST('18:00' AS TIME(0)), 15, 16, 'opd_room', 'Standard evening OPD block'),
            ('Ward Visit', 'ward', 'WARD_VISIT', CAST('11:00' AS TIME(0)), CAST('13:00' AS TIME(0)), NULL, NULL, 'ward', 'Routine ward visit'),
            ('Ward Round', 'ward', 'WARD_ROUND', CAST('08:00' AS TIME(0)), CAST('10:00' AS TIME(0)), NULL, NULL, 'ward', 'Morning ward round'),
            ('OT Block', 'ot', 'SURGERY', CAST('09:00' AS TIME(0)), CAST('13:00' AS TIME(0)), NULL, NULL, 'ot', 'Standard operation theatre block'),
            ('Other Duty', 'other', 'ADMIN_BLOCK', CAST('14:00' AS TIME(0)), CAST('17:00' AS TIME(0)), NULL, NULL, 'general', 'Meeting, teaching, or admin block')
    ) AS seed (Name, Category, ActivityCode, StartTime, EndTime, SlotDurationMins, DefaultMaxSlots, LocationKind, Notes)
    JOIN dbo.DoctorScheduleActivityTypes atp
      ON atp.Code = seed.ActivityCode
    WHERE NOT EXISTS (
        SELECT 1
        FROM dbo.ShiftTemplates existing
        WHERE existing.HospitalId = h.Id
          AND existing.Name = seed.Name
          AND existing.Category = seed.Category
    );
END
GO

SELECT
    OBJECT_ID(N'dbo.HospitalLocations', N'U') AS HospitalLocationsTableId,
    OBJECT_ID(N'dbo.ShiftTemplates', N'U') AS ShiftTemplatesTableId,
    OBJECT_ID(N'dbo.DoctorWeeklyScheduleTemplates', N'U') AS DoctorWeeklyScheduleTemplatesTableId,
    COL_LENGTH('dbo.DoctorScheduleAssignments', 'HospitalLocationId') AS HasAssignmentHospitalLocationId,
    COL_LENGTH('dbo.DoctorScheduleAssignments', 'ShiftTemplateId') AS HasAssignmentShiftTemplateId;
GO
