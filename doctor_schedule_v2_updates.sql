USE [HospitalDB];
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

/* =========================================================
   ADVANCED DOCTOR SCHEDULING + OPD SLOT PUBLISHING
   - Admin owns doctor assignments (OPD, surgery, ward, etc.)
   - OPD manager publishes bookable slots only inside OPD windows
   - Doctors consume a month/year assignment calendar
   ========================================================= */

IF OBJECT_ID(N'dbo.DoctorScheduleActivityTypes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DoctorScheduleActivityTypes (
        Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Code NVARCHAR(40) NOT NULL,
        Name NVARCHAR(80) NOT NULL,
        Category NVARCHAR(30) NOT NULL,
        ColorToken NVARCHAR(30) NOT NULL,
        AllowsOpdSlots BIT NOT NULL CONSTRAINT DF_DoctorScheduleActivityTypes_AllowsOpdSlots DEFAULT ((0)),
        RequiresLocation BIT NOT NULL CONSTRAINT DF_DoctorScheduleActivityTypes_RequiresLocation DEFAULT ((0)),
        SortOrder SMALLINT NOT NULL CONSTRAINT DF_DoctorScheduleActivityTypes_SortOrder DEFAULT ((100)),
        IsActive BIT NOT NULL CONSTRAINT DF_DoctorScheduleActivityTypes_IsActive DEFAULT ((1)),
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_DoctorScheduleActivityTypes_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_DoctorScheduleActivityTypes_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CreatedBy BIGINT NULL,
        UpdatedBy BIGINT NULL
    );
END
GO

IF OBJECT_ID(N'dbo.DoctorScheduleAssignments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DoctorScheduleAssignments (
        Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        HospitalId BIGINT NOT NULL,
        DoctorId BIGINT NOT NULL,
        DepartmentId BIGINT NULL,
        SpecializationId INT NULL,
        ActivityTypeId BIGINT NOT NULL,
        SeriesId UNIQUEIDENTIFIER NULL,
        SeriesLabel NVARCHAR(120) NULL,
        AssignmentDate DATE NOT NULL,
        StartTime TIME(0) NOT NULL,
        EndTime TIME(0) NOT NULL,
        Title NVARCHAR(150) NULL,
        LocationKind NVARCHAR(30) NOT NULL CONSTRAINT DF_DoctorScheduleAssignments_LocationKind DEFAULT ('general'),
        OpdRoomId BIGINT NULL,
        LocationLabel NVARCHAR(160) NULL,
        SlotDurationMins SMALLINT NULL,
        MaxSlots SMALLINT NULL,
        BookingEnabled BIT NOT NULL CONSTRAINT DF_DoctorScheduleAssignments_BookingEnabled DEFAULT ((0)),
        Status NVARCHAR(20) NOT NULL CONSTRAINT DF_DoctorScheduleAssignments_Status DEFAULT ('Active'),
        Notes NVARCHAR(500) NULL,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_DoctorScheduleAssignments_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_DoctorScheduleAssignments_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CreatedBy BIGINT NULL,
        UpdatedBy BIGINT NULL
    );
END
GO

IF OBJECT_ID(N'dbo.OpdSlotSessions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.OpdSlotSessions (
        Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        HospitalId BIGINT NOT NULL,
        AssignmentId BIGINT NOT NULL,
        DoctorId BIGINT NOT NULL,
        SessionDate DATE NOT NULL,
        StartTime TIME(0) NOT NULL,
        EndTime TIME(0) NOT NULL,
        SlotDurationMins SMALLINT NOT NULL,
        TotalSlots SMALLINT NOT NULL,
        PublishedSlotsCount SMALLINT NOT NULL,
        BatchKey UNIQUEIDENTIFIER NULL,
        Status NVARCHAR(20) NOT NULL CONSTRAINT DF_OpdSlotSessions_Status DEFAULT ('Published'),
        OpdRoomId BIGINT NULL,
        RoomLabel NVARCHAR(120) NULL,
        Notes NVARCHAR(500) NULL,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_OpdSlotSessions_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_OpdSlotSessions_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CreatedBy BIGINT NULL,
        UpdatedBy BIGINT NULL
    );
END
GO

IF COL_LENGTH('dbo.AppointmentSlots', 'AssignmentId') IS NULL
BEGIN
    ALTER TABLE dbo.AppointmentSlots ADD AssignmentId BIGINT NULL;
END
GO

IF COL_LENGTH('dbo.AppointmentSlots', 'SlotSessionId') IS NULL
BEGIN
    ALTER TABLE dbo.AppointmentSlots ADD SlotSessionId BIGINT NULL;
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.key_constraints
    WHERE name = N'UQ_DoctorScheduleActivityTypes_Code'
)
BEGIN
    ALTER TABLE dbo.DoctorScheduleActivityTypes
    ADD CONSTRAINT UQ_DoctorScheduleActivityTypes_Code UNIQUE (Code);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_DoctorScheduleAssignments_Times'
)
BEGIN
    ALTER TABLE dbo.DoctorScheduleAssignments WITH CHECK
    ADD CONSTRAINT CK_DoctorScheduleAssignments_Times
    CHECK (EndTime > StartTime);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_DoctorScheduleAssignments_LocationKind'
)
BEGIN
    ALTER TABLE dbo.DoctorScheduleAssignments WITH CHECK
    ADD CONSTRAINT CK_DoctorScheduleAssignments_LocationKind
    CHECK (LocationKind IN ('opd_room', 'ward', 'ot', 'general', 'tele'));
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_DoctorScheduleAssignments_Status'
)
BEGIN
    ALTER TABLE dbo.DoctorScheduleAssignments WITH CHECK
    ADD CONSTRAINT CK_DoctorScheduleAssignments_Status
    CHECK (Status IN ('Active', 'Published', 'Cancelled'));
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_DoctorScheduleAssignments_SlotDuration'
)
BEGIN
    ALTER TABLE dbo.DoctorScheduleAssignments WITH CHECK
    ADD CONSTRAINT CK_DoctorScheduleAssignments_SlotDuration
    CHECK (SlotDurationMins IS NULL OR (SlotDurationMins BETWEEN 5 AND 120));
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_DoctorScheduleAssignments_MaxSlots'
)
BEGIN
    ALTER TABLE dbo.DoctorScheduleAssignments WITH CHECK
    ADD CONSTRAINT CK_DoctorScheduleAssignments_MaxSlots
    CHECK (MaxSlots IS NULL OR (MaxSlots BETWEEN 1 AND 200));
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_OpdSlotSessions_Times'
)
BEGIN
    ALTER TABLE dbo.OpdSlotSessions WITH CHECK
    ADD CONSTRAINT CK_OpdSlotSessions_Times
    CHECK (EndTime > StartTime);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_OpdSlotSessions_Status'
)
BEGIN
    ALTER TABLE dbo.OpdSlotSessions WITH CHECK
    ADD CONSTRAINT CK_OpdSlotSessions_Status
    CHECK (Status IN ('Draft', 'Published', 'Cancelled'));
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_OpdSlotSessions_SlotDuration'
)
BEGIN
    ALTER TABLE dbo.OpdSlotSessions WITH CHECK
    ADD CONSTRAINT CK_OpdSlotSessions_SlotDuration
    CHECK (SlotDurationMins BETWEEN 5 AND 120);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_OpdSlotSessions_TotalSlots'
)
BEGIN
    ALTER TABLE dbo.OpdSlotSessions WITH CHECK
    ADD CONSTRAINT CK_OpdSlotSessions_TotalSlots
    CHECK (TotalSlots > 0 AND PublishedSlotsCount >= 0);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_DoctorScheduleAssignments_Doctor'
)
BEGIN
    ALTER TABLE dbo.DoctorScheduleAssignments WITH CHECK
    ADD CONSTRAINT FK_DoctorScheduleAssignments_Doctor
    FOREIGN KEY (DoctorId) REFERENCES dbo.DoctorProfiles(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_DoctorScheduleAssignments_Department'
)
BEGIN
    ALTER TABLE dbo.DoctorScheduleAssignments WITH CHECK
    ADD CONSTRAINT FK_DoctorScheduleAssignments_Department
    FOREIGN KEY (DepartmentId) REFERENCES dbo.Departments(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_DoctorScheduleAssignments_Specialization'
)
BEGIN
    ALTER TABLE dbo.DoctorScheduleAssignments WITH CHECK
    ADD CONSTRAINT FK_DoctorScheduleAssignments_Specialization
    FOREIGN KEY (SpecializationId) REFERENCES dbo.Specializations(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_DoctorScheduleAssignments_ActivityType'
)
BEGIN
    ALTER TABLE dbo.DoctorScheduleAssignments WITH CHECK
    ADD CONSTRAINT FK_DoctorScheduleAssignments_ActivityType
    FOREIGN KEY (ActivityTypeId) REFERENCES dbo.DoctorScheduleActivityTypes(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_DoctorScheduleAssignments_OpdRoom'
)
BEGIN
    ALTER TABLE dbo.DoctorScheduleAssignments WITH CHECK
    ADD CONSTRAINT FK_DoctorScheduleAssignments_OpdRoom
    FOREIGN KEY (OpdRoomId) REFERENCES dbo.OpdRooms(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_OpdSlotSessions_Assignment'
)
BEGIN
    ALTER TABLE dbo.OpdSlotSessions WITH CHECK
    ADD CONSTRAINT FK_OpdSlotSessions_Assignment
    FOREIGN KEY (AssignmentId) REFERENCES dbo.DoctorScheduleAssignments(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_OpdSlotSessions_Doctor'
)
BEGIN
    ALTER TABLE dbo.OpdSlotSessions WITH CHECK
    ADD CONSTRAINT FK_OpdSlotSessions_Doctor
    FOREIGN KEY (DoctorId) REFERENCES dbo.DoctorProfiles(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_OpdSlotSessions_OpdRoom'
)
BEGIN
    ALTER TABLE dbo.OpdSlotSessions WITH CHECK
    ADD CONSTRAINT FK_OpdSlotSessions_OpdRoom
    FOREIGN KEY (OpdRoomId) REFERENCES dbo.OpdRooms(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_AppointmentSlots_Assignment'
)
BEGIN
    ALTER TABLE dbo.AppointmentSlots WITH CHECK
    ADD CONSTRAINT FK_AppointmentSlots_Assignment
    FOREIGN KEY (AssignmentId) REFERENCES dbo.DoctorScheduleAssignments(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_AppointmentSlots_SlotSession'
)
BEGIN
    ALTER TABLE dbo.AppointmentSlots WITH CHECK
    ADD CONSTRAINT FK_AppointmentSlots_SlotSession
    FOREIGN KEY (SlotSessionId) REFERENCES dbo.OpdSlotSessions(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_DoctorScheduleAssignments_HospitalDate'
      AND object_id = OBJECT_ID(N'dbo.DoctorScheduleAssignments')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_DoctorScheduleAssignments_HospitalDate
    ON dbo.DoctorScheduleAssignments (HospitalId, AssignmentDate, DoctorId);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_DoctorScheduleAssignments_DoctorDate'
      AND object_id = OBJECT_ID(N'dbo.DoctorScheduleAssignments')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_DoctorScheduleAssignments_DoctorDate
    ON dbo.DoctorScheduleAssignments (DoctorId, AssignmentDate, StartTime);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'UX_DoctorScheduleAssignments_DoctorDateTime_Active'
      AND object_id = OBJECT_ID(N'dbo.DoctorScheduleAssignments')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_DoctorScheduleAssignments_DoctorDateTime_Active
    ON dbo.DoctorScheduleAssignments (DoctorId, AssignmentDate, StartTime, EndTime)
    WHERE Status <> 'Cancelled';
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_OpdSlotSessions_DoctorDate'
      AND object_id = OBJECT_ID(N'dbo.OpdSlotSessions')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_OpdSlotSessions_DoctorDate
    ON dbo.OpdSlotSessions (DoctorId, SessionDate, StartTime);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'UX_OpdSlotSessions_AssignmentDateTime_Active'
      AND object_id = OBJECT_ID(N'dbo.OpdSlotSessions')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_OpdSlotSessions_AssignmentDateTime_Active
    ON dbo.OpdSlotSessions (AssignmentId, SessionDate, StartTime, EndTime)
    WHERE Status <> 'Cancelled';
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_AppointmentSlots_AssignmentId'
      AND object_id = OBJECT_ID(N'dbo.AppointmentSlots')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_AppointmentSlots_AssignmentId
    ON dbo.AppointmentSlots (AssignmentId, SlotDate, StartTime);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_AppointmentSlots_SlotSessionId'
      AND object_id = OBJECT_ID(N'dbo.AppointmentSlots')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_AppointmentSlots_SlotSessionId
    ON dbo.AppointmentSlots (SlotSessionId, SlotDate, StartTime);
END
GO

MERGE dbo.DoctorScheduleActivityTypes AS target
USING (
    VALUES
        ('OPD_SESSION', 'OPD Session', 'opd', 'teal', 1, 1, 1),
        ('CLINICAL_VISIT', 'Clinical Visit', 'opd', 'blue', 0, 1, 2),
        ('WARD_VISIT', 'Ward Visit', 'ward', 'blue', 0, 1, 3),
        ('WARD_ROUND', 'Ward Round', 'ward', 'sky', 0, 1, 4),
        ('SURGERY', 'Surgery', 'ot', 'indigo', 0, 1, 5),
        ('PROCEDURE', 'Procedure', 'ot', 'violet', 0, 1, 6),
        ('TELECONSULT', 'Teleconsult', 'opd', 'violet', 1, 0, 7),
        ('MEETING', 'Meeting', 'other', 'amber', 0, 0, 8),
        ('DOCTOR_DISCUSSION', 'Doctor Discussion', 'other', 'orange', 0, 0, 9),
        ('TEACHING', 'Teaching', 'other', 'purple', 0, 0, 10),
        ('ADMIN_BLOCK', 'Other Duty', 'other', 'slate', 0, 0, 11),
        ('LEAVE', 'Leave', 'other', 'rose', 0, 0, 12)
) AS source (Code, Name, Category, ColorToken, AllowsOpdSlots, RequiresLocation, SortOrder)
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
GO

/* =========================================================
   Backfill legacy weekly DoctorSchedules into concrete
   assignment rows for the next 365 days.
   This preserves the old admin OPD templates while shifting
   the active UI to a month/year assignment model.
   ========================================================= */

DECLARE @today DATE = CAST(GETUTCDATE() AS DATE);
DECLARE @horizon DATE = DATEADD(DAY, 365, @today);

;WITH LegacyDoctorSchedules AS (
    SELECT
        ds.Id AS LegacyId,
        ds.HospitalId,
        ds.DoctorId,
        dp.DepartmentId,
        dp.SpecializationId,
        ds.DayOfWeek,
        ds.StartTime,
        ds.EndTime,
        ds.SlotDurationMins,
        ds.MaxSlots,
        ds.OpdRoomId,
        ds.Notes,
        ds.CreatedAt,
        ds.UpdatedAt,
        ds.CreatedBy,
        ds.UpdatedBy,
        CASE
            WHEN LOWER(ds.VisitType) = 'teleconsult' THEN 'TELECONSULT'
            WHEN LOWER(ds.VisitType) = 'emergency' THEN 'CLINICAL_VISIT'
            ELSE 'OPD_SESSION'
        END AS ActivityCode,
        CASE
            WHEN LOWER(ds.VisitType) = 'teleconsult' THEN 'tele'
            ELSE 'opd_room'
        END AS LocationKind,
        CASE
            WHEN LOWER(ds.VisitType) = 'teleconsult' THEN 'Teleconsult Session'
            WHEN LOWER(ds.VisitType) = 'emergency' THEN 'Clinical Visit'
            ELSE 'OPD Session'
        END AS Title,
        CASE
            WHEN ds.EffectiveFrom > @today THEN ds.EffectiveFrom
            ELSE @today
        END AS RangeStart,
        CASE
            WHEN ds.EffectiveTo IS NULL THEN @horizon
            WHEN ds.EffectiveTo > @horizon THEN @horizon
            ELSE ds.EffectiveTo
        END AS RangeEnd
    FROM dbo.DoctorSchedules ds
    JOIN dbo.DoctorProfiles dp ON dp.Id = ds.DoctorId
    WHERE ds.IsActive = 1
      AND (
          ds.EffectiveTo IS NULL
          OR ds.EffectiveTo >= @today
      )
),
CandidateDates AS (
    SELECT
        LegacyId,
        RangeStart AS AssignmentDate
    FROM LegacyDoctorSchedules
    WHERE RangeStart <= RangeEnd

    UNION ALL

    SELECT
        cd.LegacyId,
        DATEADD(DAY, 1, cd.AssignmentDate)
    FROM CandidateDates cd
    JOIN LegacyDoctorSchedules ls
      ON ls.LegacyId = cd.LegacyId
    WHERE DATEADD(DAY, 1, cd.AssignmentDate) <= ls.RangeEnd
)
INSERT INTO dbo.DoctorScheduleAssignments
(
    HospitalId,
    DoctorId,
    DepartmentId,
    SpecializationId,
    ActivityTypeId,
    SeriesId,
    SeriesLabel,
    AssignmentDate,
    StartTime,
    EndTime,
    Title,
    LocationKind,
    OpdRoomId,
    LocationLabel,
    SlotDurationMins,
    MaxSlots,
    BookingEnabled,
    Status,
    Notes,
    CreatedAt,
    UpdatedAt,
    CreatedBy,
    UpdatedBy
)
SELECT
    ls.HospitalId,
    ls.DoctorId,
    ls.DepartmentId,
    ls.SpecializationId,
    atp.Id,
    NULL,
    'Migrated legacy weekly schedule',
    cd.AssignmentDate,
    CAST(ls.StartTime AS TIME(0)),
    CAST(ls.EndTime AS TIME(0)),
    ls.Title,
    ls.LocationKind,
    ls.OpdRoomId,
    NULL,
    ls.SlotDurationMins,
    ls.MaxSlots,
    CASE WHEN ls.ActivityCode IN ('OPD_SESSION', 'TELECONSULT') THEN 1 ELSE 0 END,
    'Active',
    ls.Notes,
    ISNULL(ls.CreatedAt, SYSUTCDATETIME()),
    ISNULL(ls.UpdatedAt, SYSUTCDATETIME()),
    ls.CreatedBy,
    ls.UpdatedBy
FROM CandidateDates cd
JOIN LegacyDoctorSchedules ls
  ON ls.LegacyId = cd.LegacyId
JOIN dbo.DoctorScheduleActivityTypes atp
  ON atp.Code = ls.ActivityCode
WHERE ((DATEDIFF(DAY, '19000107', cd.AssignmentDate) % 7 + 7) % 7) = ls.DayOfWeek
  AND NOT EXISTS (
      SELECT 1
      FROM dbo.DoctorScheduleAssignments existing
      WHERE existing.DoctorId = ls.DoctorId
        AND existing.AssignmentDate = cd.AssignmentDate
        AND existing.StartTime = CAST(ls.StartTime AS TIME(0))
        AND existing.EndTime = CAST(ls.EndTime AS TIME(0))
        AND existing.Status <> 'Cancelled'
  )
OPTION (MAXRECURSION 0);
GO

/* =========================================================
   Backfill existing appointment slots to the new assignment id
   when the slot clearly belongs to a migrated assignment window.
   ========================================================= */

UPDATE slots
SET slots.AssignmentId = assignMatch.Id
FROM dbo.AppointmentSlots slots
JOIN dbo.DoctorScheduleAssignments assignMatch
  ON assignMatch.HospitalId = slots.HospitalId
 AND assignMatch.DoctorId = slots.DoctorId
 AND assignMatch.AssignmentDate = slots.SlotDate
 AND assignMatch.StartTime <= slots.StartTime
 AND assignMatch.EndTime >= slots.EndTime
WHERE slots.AssignmentId IS NULL;
GO

SELECT
    OBJECT_ID(N'dbo.DoctorScheduleActivityTypes', N'U') AS ActivityTypesTableId,
    OBJECT_ID(N'dbo.DoctorScheduleAssignments', N'U') AS AssignmentsTableId,
    OBJECT_ID(N'dbo.OpdSlotSessions', N'U') AS SlotSessionsTableId;
GO

SELECT
    COUNT(*) AS ActivityTypeCount
FROM dbo.DoctorScheduleActivityTypes;
GO

SELECT TOP 10
    Id,
    DoctorId,
    AssignmentDate,
    StartTime,
    EndTime,
    Title,
    Status
FROM dbo.DoctorScheduleAssignments
ORDER BY AssignmentDate, StartTime;
GO
