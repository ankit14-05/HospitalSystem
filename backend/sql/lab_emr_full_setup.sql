/*
  Full Lab + EMR Table Setup for HMS
  ----------------------------------
  Use this when:
  - Your main HMS database already has the core tables:
      dbo.Users
      dbo.PatientProfiles
      dbo.DoctorProfiles
      dbo.Appointments
      dbo.Admissions
  - But you have NOT yet created lab-related tables.

  Safe behavior:
  - Creates missing lab / EMR tables
  - Adds missing columns if some lab tables already exist
  - Creates helpful indexes
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    /* =========================================================
       Core lab masters
       ========================================================= */

    IF OBJECT_ID('dbo.LabTests', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.LabTests (
            Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            Name NVARCHAR(200) NOT NULL,
            ShortName NVARCHAR(50) NULL,
            Category NVARCHAR(100) NULL,
            Unit NVARCHAR(50) NULL,
            NormalRangeMale NVARCHAR(100) NULL,
            NormalRangeFemale NVARCHAR(100) NULL,
            NormalRangeChild NVARCHAR(100) NULL,
            Price DECIMAL(10,2) NULL,
            TurnaroundHrs SMALLINT NULL,
            RequiresFasting BIT NOT NULL
                CONSTRAINT DF_LabTests_RequiresFasting DEFAULT (0),
            SampleType NVARCHAR(80) NULL,
            Instructions NVARCHAR(MAX) NULL,
            IsActive BIT NOT NULL
                CONSTRAINT DF_LabTests_IsActive DEFAULT (1),
            CreatedAt DATETIME2(0) NOT NULL
                CONSTRAINT DF_LabTests_CreatedAt DEFAULT (SYSUTCDATETIME()),
            UpdatedAt DATETIME2(0) NOT NULL
                CONSTRAINT DF_LabTests_UpdatedAt DEFAULT (SYSUTCDATETIME()),
            CreatedBy BIGINT NULL,
            UpdatedBy BIGINT NULL
        );
    END;

    /* =========================================================
       Lab orders
       ========================================================= */

    IF OBJECT_ID('dbo.LabOrders', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.LabOrders (
            Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            HospitalId BIGINT NOT NULL,
            PatientId BIGINT NOT NULL,
            OrderedBy BIGINT NULL,
            AppointmentId BIGINT NULL,
            AdmissionId BIGINT NULL,
            OrderNumber NVARCHAR(30) NOT NULL,
            OrderDate DATETIME2(0) NOT NULL
                CONSTRAINT DF_LabOrders_OrderDate DEFAULT (SYSUTCDATETIME()),
            Status NVARCHAR(20) NOT NULL
                CONSTRAINT DF_LabOrders_Status DEFAULT ('Pending'),
            Priority NVARCHAR(20) NOT NULL
                CONSTRAINT DF_LabOrders_Priority DEFAULT ('Routine'),
            Notes NVARCHAR(MAX) NULL,
            CollectionLocationType NVARCHAR(20) NULL,
            CollectionLocationRef NVARCHAR(120) NULL,
            ClinicalIndication NVARCHAR(1000) NULL,
            DoctorInstructions NVARCHAR(MAX) NULL,
            WorkflowStage NVARCHAR(30) NOT NULL
                CONSTRAINT DF_LabOrders_WorkflowStage DEFAULT ('Ordered'),
            CollectedAt DATETIME2(0) NULL,
            CollectedBy BIGINT NULL,
            ReportedAt DATETIME2(0) NULL,
            ReportedBy BIGINT NULL,
            VerifiedBy BIGINT NULL,
            VerifiedAt DATETIME2(0) NULL,
            ReleasedToPatientAt DATETIME2(0) NULL,
            ReleasedToPatientBy BIGINT NULL,
            CreatedAt DATETIME2(0) NOT NULL
                CONSTRAINT DF_LabOrders_CreatedAt DEFAULT (SYSUTCDATETIME()),
            UpdatedAt DATETIME2(0) NOT NULL
                CONSTRAINT DF_LabOrders_UpdatedAt DEFAULT (SYSUTCDATETIME()),
            CreatedBy BIGINT NULL,
            UpdatedBy BIGINT NULL,
            CONSTRAINT UQ_LabOrders_OrderNumber UNIQUE (OrderNumber),
            CONSTRAINT FK_LabOrders_Patient
                FOREIGN KEY (PatientId) REFERENCES dbo.PatientProfiles(Id),
            CONSTRAINT FK_LabOrders_DoctorProfile
                FOREIGN KEY (OrderedBy) REFERENCES dbo.DoctorProfiles(Id),
            CONSTRAINT FK_LabOrders_Appointment
                FOREIGN KEY (AppointmentId) REFERENCES dbo.Appointments(Id),
            CONSTRAINT FK_LabOrders_Admission
                FOREIGN KEY (AdmissionId) REFERENCES dbo.Admissions(Id),
            CONSTRAINT FK_LabOrders_CollectedBy
                FOREIGN KEY (CollectedBy) REFERENCES dbo.Users(Id),
            CONSTRAINT FK_LabOrders_ReportedBy
                FOREIGN KEY (ReportedBy) REFERENCES dbo.Users(Id),
            CONSTRAINT FK_LabOrders_VerifiedBy
                FOREIGN KEY (VerifiedBy) REFERENCES dbo.Users(Id),
            CONSTRAINT FK_LabOrders_ReleasedBy
                FOREIGN KEY (ReleasedToPatientBy) REFERENCES dbo.Users(Id),
            CONSTRAINT CK_LabOrders_Status
                CHECK (Status IN ('Pending', 'SampleCollected', 'Processing', 'Completed', 'Cancelled', 'Rejected')),
            CONSTRAINT CK_LabOrders_Priority
                CHECK (Priority IN ('Routine', 'Urgent', 'STAT')),
            CONSTRAINT CK_LabOrders_CollectionLocationType
                CHECK (
                    CollectionLocationType IS NULL
                    OR CollectionLocationType IN ('Indoor', 'Outside', 'HomeCollection')
                ),
            CONSTRAINT CK_LabOrders_WorkflowStage
                CHECK (
                    WorkflowStage IN (
                        'Ordered',
                        'PendingCollection',
                        'SampleCollected',
                        'Processing',
                        'Completed',
                        'DoctorReview',
                        'Released'
                    )
                )
        );
    END;

    IF OBJECT_ID('dbo.LabOrderItems', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.LabOrderItems (
            Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            LabOrderId BIGINT NOT NULL,
            TestId BIGINT NOT NULL,
            ResultValue NVARCHAR(500) NULL,
            ResultUnit NVARCHAR(50) NULL,
            NormalRange NVARCHAR(100) NULL,
            IsAbnormal BIT NULL,
            Remarks NVARCHAR(MAX) NULL,
            Status NVARCHAR(20) NOT NULL
                CONSTRAINT DF_LabOrderItems_Status DEFAULT ('Pending'),
            CriteriaText NVARCHAR(500) NULL,
            AdditionalDetails NVARCHAR(1000) NULL,
            TechnicianNotes NVARCHAR(1000) NULL,
            DisplaySequence INT NOT NULL
                CONSTRAINT DF_LabOrderItems_DisplaySequence DEFAULT (1),
            CreatedAt DATETIME2(0) NOT NULL
                CONSTRAINT DF_LabOrderItems_CreatedAt DEFAULT (SYSUTCDATETIME()),
            UpdatedAt DATETIME2(0) NOT NULL
                CONSTRAINT DF_LabOrderItems_UpdatedAt DEFAULT (SYSUTCDATETIME()),
            CONSTRAINT FK_LabOrderItems_Order
                FOREIGN KEY (LabOrderId) REFERENCES dbo.LabOrders(Id),
            CONSTRAINT FK_LabOrderItems_Test
                FOREIGN KEY (TestId) REFERENCES dbo.LabTests(Id),
            CONSTRAINT CK_LabOrderItems_Status
                CHECK (Status IN ('Pending', 'SampleCollected', 'Processing', 'Completed', 'Rejected'))
        );
    END;

    /* =========================================================
       Add missing columns when partial lab tables already exist
       ========================================================= */

    IF COL_LENGTH('dbo.LabOrders', 'CollectionLocationType') IS NULL
        ALTER TABLE dbo.LabOrders ADD CollectionLocationType NVARCHAR(20) NULL;

    IF COL_LENGTH('dbo.LabOrders', 'CollectionLocationRef') IS NULL
        ALTER TABLE dbo.LabOrders ADD CollectionLocationRef NVARCHAR(120) NULL;

    IF COL_LENGTH('dbo.LabOrders', 'ClinicalIndication') IS NULL
        ALTER TABLE dbo.LabOrders ADD ClinicalIndication NVARCHAR(1000) NULL;

    IF COL_LENGTH('dbo.LabOrders', 'DoctorInstructions') IS NULL
        ALTER TABLE dbo.LabOrders ADD DoctorInstructions NVARCHAR(MAX) NULL;

    IF COL_LENGTH('dbo.LabOrders', 'WorkflowStage') IS NULL
        ALTER TABLE dbo.LabOrders ADD WorkflowStage NVARCHAR(30) NOT NULL
            CONSTRAINT DF_LabOrders_WorkflowStage_Alter DEFAULT ('Ordered') WITH VALUES;

    IF COL_LENGTH('dbo.LabOrders', 'ReleasedToPatientAt') IS NULL
        ALTER TABLE dbo.LabOrders ADD ReleasedToPatientAt DATETIME2(0) NULL;

    IF COL_LENGTH('dbo.LabOrders', 'ReleasedToPatientBy') IS NULL
        ALTER TABLE dbo.LabOrders ADD ReleasedToPatientBy BIGINT NULL;

    IF COL_LENGTH('dbo.LabOrders', 'UpdatedBy') IS NULL
        ALTER TABLE dbo.LabOrders ADD UpdatedBy BIGINT NULL;

    IF COL_LENGTH('dbo.LabOrderItems', 'CriteriaText') IS NULL
        ALTER TABLE dbo.LabOrderItems ADD CriteriaText NVARCHAR(500) NULL;

    IF COL_LENGTH('dbo.LabOrderItems', 'AdditionalDetails') IS NULL
        ALTER TABLE dbo.LabOrderItems ADD AdditionalDetails NVARCHAR(1000) NULL;

    IF COL_LENGTH('dbo.LabOrderItems', 'TechnicianNotes') IS NULL
        ALTER TABLE dbo.LabOrderItems ADD TechnicianNotes NVARCHAR(1000) NULL;

    IF COL_LENGTH('dbo.LabOrderItems', 'DisplaySequence') IS NULL
        ALTER TABLE dbo.LabOrderItems ADD DisplaySequence INT NOT NULL
            CONSTRAINT DF_LabOrderItems_DisplaySequence_Alter DEFAULT (1) WITH VALUES;

    IF COL_LENGTH('dbo.LabOrderItems', 'CreatedAt') IS NULL
        ALTER TABLE dbo.LabOrderItems ADD CreatedAt DATETIME2(0) NOT NULL
            CONSTRAINT DF_LabOrderItems_CreatedAt_Alter DEFAULT (SYSUTCDATETIME()) WITH VALUES;

    IF COL_LENGTH('dbo.LabOrderItems', 'UpdatedAt') IS NULL
        ALTER TABLE dbo.LabOrderItems ADD UpdatedAt DATETIME2(0) NOT NULL
            CONSTRAINT DF_LabOrderItems_UpdatedAt_Alter DEFAULT (SYSUTCDATETIME()) WITH VALUES;

    /* =========================================================
       Lab technician workflow tables
       ========================================================= */

    IF OBJECT_ID('dbo.LabSamples', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.LabSamples (
            Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            LabOrderItemId BIGINT NOT NULL,
            HospitalId BIGINT NOT NULL,
            SampleCode NVARCHAR(40) NOT NULL,
            BarcodeValue NVARCHAR(80) NULL,
            SpecimenType NVARCHAR(80) NULL,
            CollectionLocation NVARCHAR(120) NULL,
            CollectedAt DATETIME2(0) NULL,
            CollectedByUserId BIGINT NULL,
            ReceivedAtLabAt DATETIME2(0) NULL,
            ReceivedByUserId BIGINT NULL,
            ProcessingStartedAt DATETIME2(0) NULL,
            ProcessingCompletedAt DATETIME2(0) NULL,
            SampleStatus NVARCHAR(30) NOT NULL
                CONSTRAINT DF_LabSamples_Status DEFAULT ('Pending'),
            RejectedReason NVARCHAR(500) NULL,
            TechnicianNotes NVARCHAR(1000) NULL,
            CreatedAt DATETIME2(0) NOT NULL
                CONSTRAINT DF_LabSamples_CreatedAt DEFAULT (SYSUTCDATETIME()),
            UpdatedAt DATETIME2(0) NOT NULL
                CONSTRAINT DF_LabSamples_UpdatedAt DEFAULT (SYSUTCDATETIME()),
            CONSTRAINT UQ_LabSamples_SampleCode UNIQUE (SampleCode),
            CONSTRAINT FK_LabSamples_OrderItem
                FOREIGN KEY (LabOrderItemId) REFERENCES dbo.LabOrderItems(Id),
            CONSTRAINT FK_LabSamples_CollectedBy
                FOREIGN KEY (CollectedByUserId) REFERENCES dbo.Users(Id),
            CONSTRAINT FK_LabSamples_ReceivedBy
                FOREIGN KEY (ReceivedByUserId) REFERENCES dbo.Users(Id),
            CONSTRAINT CK_LabSamples_Status
                CHECK (SampleStatus IN ('Pending', 'Collected', 'Received', 'Processing', 'Completed', 'Rejected'))
        );
    END;

    IF OBJECT_ID('dbo.LabOrderStatusHistory', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.LabOrderStatusHistory (
            Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            LabOrderId BIGINT NOT NULL,
            LabOrderItemId BIGINT NULL,
            LabSampleId BIGINT NULL,
            Scope NVARCHAR(20) NOT NULL
                CONSTRAINT DF_LabOrderStatusHistory_Scope DEFAULT ('Order'),
            FromStatus NVARCHAR(30) NULL,
            ToStatus NVARCHAR(30) NOT NULL,
            ChangedByUserId BIGINT NULL,
            ChangedAt DATETIME2(0) NOT NULL
                CONSTRAINT DF_LabOrderStatusHistory_ChangedAt DEFAULT (SYSUTCDATETIME()),
            Note NVARCHAR(500) NULL,
            CONSTRAINT FK_LabOrderStatusHistory_Order
                FOREIGN KEY (LabOrderId) REFERENCES dbo.LabOrders(Id),
            CONSTRAINT FK_LabOrderStatusHistory_Item
                FOREIGN KEY (LabOrderItemId) REFERENCES dbo.LabOrderItems(Id),
            CONSTRAINT FK_LabOrderStatusHistory_Sample
                FOREIGN KEY (LabSampleId) REFERENCES dbo.LabSamples(Id),
            CONSTRAINT FK_LabOrderStatusHistory_User
                FOREIGN KEY (ChangedByUserId) REFERENCES dbo.Users(Id),
            CONSTRAINT CK_LabOrderStatusHistory_Scope
                CHECK (Scope IN ('Order', 'Item', 'Sample', 'Review'))
        );
    END;

    IF OBJECT_ID('dbo.LabResultAttachments', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.LabResultAttachments (
            Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            LabOrderId BIGINT NOT NULL,
            LabOrderItemId BIGINT NULL,
            FileCategory NVARCHAR(20) NOT NULL,
            FileName NVARCHAR(260) NOT NULL,
            StoragePath NVARCHAR(700) NOT NULL,
            ContentType NVARCHAR(120) NULL,
            FileSizeBytes BIGINT NULL,
            IsPrimary BIT NOT NULL
                CONSTRAINT DF_LabResultAttachments_IsPrimary DEFAULT (0),
            UploadedByUserId BIGINT NULL,
            UploadedAt DATETIME2(0) NOT NULL
                CONSTRAINT DF_LabResultAttachments_UploadedAt DEFAULT (SYSUTCDATETIME()),
            CONSTRAINT FK_LabResultAttachments_Order
                FOREIGN KEY (LabOrderId) REFERENCES dbo.LabOrders(Id),
            CONSTRAINT FK_LabResultAttachments_Item
                FOREIGN KEY (LabOrderItemId) REFERENCES dbo.LabOrderItems(Id),
            CONSTRAINT FK_LabResultAttachments_User
                FOREIGN KEY (UploadedByUserId) REFERENCES dbo.Users(Id),
            CONSTRAINT CK_LabResultAttachments_Category
                CHECK (FileCategory IN ('ReportPdf', 'Image', 'Audio', 'Video', 'Worksheet'))
        );
    END;

    /* =========================================================
       Doctor EMR review tables
       ========================================================= */

    IF OBJECT_ID('dbo.EmrEncounters', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.EmrEncounters (
            Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            HospitalId BIGINT NOT NULL,
            AppointmentId BIGINT NULL,
            PatientId BIGINT NOT NULL,
            DoctorId BIGINT NOT NULL,
            EncounterType NVARCHAR(30) NOT NULL
                CONSTRAINT DF_EmrEncounters_Type DEFAULT ('OPD'),
            EncounterDate DATETIME2(0) NOT NULL
                CONSTRAINT DF_EmrEncounters_Date DEFAULT (SYSUTCDATETIME()),
            ChiefComplaint NVARCHAR(500) NULL,
            ProvisionalDiagnosis NVARCHAR(1000) NULL,
            EncounterStatus NVARCHAR(20) NOT NULL
                CONSTRAINT DF_EmrEncounters_Status DEFAULT ('Open'),
            FollowUpAdvice NVARCHAR(1000) NULL,
            CreatedBy BIGINT NULL,
            UpdatedBy BIGINT NULL,
            CreatedAt DATETIME2(0) NOT NULL
                CONSTRAINT DF_EmrEncounters_CreatedAt DEFAULT (SYSUTCDATETIME()),
            UpdatedAt DATETIME2(0) NOT NULL
                CONSTRAINT DF_EmrEncounters_UpdatedAt DEFAULT (SYSUTCDATETIME()),
            CONSTRAINT FK_EmrEncounters_Appointment
                FOREIGN KEY (AppointmentId) REFERENCES dbo.Appointments(Id),
            CONSTRAINT FK_EmrEncounters_Patient
                FOREIGN KEY (PatientId) REFERENCES dbo.PatientProfiles(Id),
            CONSTRAINT FK_EmrEncounters_Doctor
                FOREIGN KEY (DoctorId) REFERENCES dbo.DoctorProfiles(Id),
            CONSTRAINT CK_EmrEncounters_Type
                CHECK (EncounterType IN ('OPD', 'IPD', 'Emergency', 'FollowUp', 'Teleconsult')),
            CONSTRAINT CK_EmrEncounters_Status
                CHECK (EncounterStatus IN ('Open', 'UnderReview', 'Closed'))
        );
    END;

    IF OBJECT_ID('dbo.EmrClinicalNotes', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.EmrClinicalNotes (
            Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            EncounterId BIGINT NOT NULL,
            NoteType NVARCHAR(30) NOT NULL
                CONSTRAINT DF_EmrClinicalNotes_Type DEFAULT ('Clinical'),
            NoteText NVARCHAR(MAX) NOT NULL,
            IsPatientVisible BIT NOT NULL
                CONSTRAINT DF_EmrClinicalNotes_IsPatientVisible DEFAULT (0),
            LinkedLabOrderId BIGINT NULL,
            RecordedByUserId BIGINT NULL,
            RecordedAt DATETIME2(0) NOT NULL
                CONSTRAINT DF_EmrClinicalNotes_RecordedAt DEFAULT (SYSUTCDATETIME()),
            CONSTRAINT FK_EmrClinicalNotes_Encounter
                FOREIGN KEY (EncounterId) REFERENCES dbo.EmrEncounters(Id),
            CONSTRAINT FK_EmrClinicalNotes_LabOrder
                FOREIGN KEY (LinkedLabOrderId) REFERENCES dbo.LabOrders(Id),
            CONSTRAINT FK_EmrClinicalNotes_User
                FOREIGN KEY (RecordedByUserId) REFERENCES dbo.Users(Id),
            CONSTRAINT CK_EmrClinicalNotes_Type
                CHECK (NoteType IN ('Clinical', 'Assessment', 'Plan', 'LabComment', 'FollowUp'))
        );
    END;

    IF OBJECT_ID('dbo.EmrDiagnosisRecords', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.EmrDiagnosisRecords (
            Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            EncounterId BIGINT NOT NULL,
            PatientId BIGINT NOT NULL,
            DiagnosisName NVARCHAR(255) NOT NULL,
            ICDCode NVARCHAR(20) NULL,
            DiagnosisType NVARCHAR(20) NOT NULL
                CONSTRAINT DF_EmrDiagnosisRecords_Type DEFAULT ('Provisional'),
            Severity NVARCHAR(20) NULL,
            IsPrimary BIT NOT NULL
                CONSTRAINT DF_EmrDiagnosisRecords_IsPrimary DEFAULT (0),
            RecordedByUserId BIGINT NULL,
            RecordedAt DATETIME2(0) NOT NULL
                CONSTRAINT DF_EmrDiagnosisRecords_RecordedAt DEFAULT (SYSUTCDATETIME()),
            CONSTRAINT FK_EmrDiagnosisRecords_Encounter
                FOREIGN KEY (EncounterId) REFERENCES dbo.EmrEncounters(Id),
            CONSTRAINT FK_EmrDiagnosisRecords_Patient
                FOREIGN KEY (PatientId) REFERENCES dbo.PatientProfiles(Id),
            CONSTRAINT FK_EmrDiagnosisRecords_User
                FOREIGN KEY (RecordedByUserId) REFERENCES dbo.Users(Id),
            CONSTRAINT CK_EmrDiagnosisRecords_Type
                CHECK (DiagnosisType IN ('Provisional', 'Confirmed', 'Differential'))
        );
    END;

    IF OBJECT_ID('dbo.EmrLabReportReviews', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.EmrLabReportReviews (
            Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            LabOrderId BIGINT NOT NULL,
            EncounterId BIGINT NULL,
            PatientId BIGINT NOT NULL,
            DoctorId BIGINT NOT NULL,
            ReviewStatus NVARCHAR(20) NOT NULL
                CONSTRAINT DF_EmrLabReportReviews_Status DEFAULT ('Pending'),
            ReviewSummary NVARCHAR(1000) NULL,
            DoctorInstructions NVARCHAR(1000) NULL,
            PatientVisibleNote NVARCHAR(1000) NULL,
            RequiresFollowUp BIT NOT NULL
                CONSTRAINT DF_EmrLabReportReviews_RequiresFollowUp DEFAULT (0),
            ReviewedAt DATETIME2(0) NULL,
            CreatedAt DATETIME2(0) NOT NULL
                CONSTRAINT DF_EmrLabReportReviews_CreatedAt DEFAULT (SYSUTCDATETIME()),
            UpdatedAt DATETIME2(0) NOT NULL
                CONSTRAINT DF_EmrLabReportReviews_UpdatedAt DEFAULT (SYSUTCDATETIME()),
            CONSTRAINT FK_EmrLabReportReviews_Order
                FOREIGN KEY (LabOrderId) REFERENCES dbo.LabOrders(Id),
            CONSTRAINT FK_EmrLabReportReviews_Encounter
                FOREIGN KEY (EncounterId) REFERENCES dbo.EmrEncounters(Id),
            CONSTRAINT FK_EmrLabReportReviews_Patient
                FOREIGN KEY (PatientId) REFERENCES dbo.PatientProfiles(Id),
            CONSTRAINT FK_EmrLabReportReviews_Doctor
                FOREIGN KEY (DoctorId) REFERENCES dbo.DoctorProfiles(Id),
            CONSTRAINT CK_EmrLabReportReviews_Status
                CHECK (ReviewStatus IN ('Pending', 'Reviewed', 'Acknowledged', 'FollowUpNeeded'))
        );
    END;

    /* =========================================================
       Indexes
       ========================================================= */

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LabOrders_PatientDate' AND object_id = OBJECT_ID('dbo.LabOrders'))
        CREATE INDEX IX_LabOrders_PatientDate ON dbo.LabOrders (PatientId, OrderDate DESC);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LabOrders_StatusDate' AND object_id = OBJECT_ID('dbo.LabOrders'))
        CREATE INDEX IX_LabOrders_StatusDate ON dbo.LabOrders (Status, OrderDate DESC);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LabOrderItems_Order' AND object_id = OBJECT_ID('dbo.LabOrderItems'))
        CREATE INDEX IX_LabOrderItems_Order ON dbo.LabOrderItems (LabOrderId, Status);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LabSamples_Status' AND object_id = OBJECT_ID('dbo.LabSamples'))
        CREATE INDEX IX_LabSamples_Status ON dbo.LabSamples (HospitalId, SampleStatus, UpdatedAt DESC);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LabResultAttachments_Order' AND object_id = OBJECT_ID('dbo.LabResultAttachments'))
        CREATE INDEX IX_LabResultAttachments_Order ON dbo.LabResultAttachments (LabOrderId, UploadedAt DESC);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EmrEncounters_PatientDate' AND object_id = OBJECT_ID('dbo.EmrEncounters'))
        CREATE INDEX IX_EmrEncounters_PatientDate ON dbo.EmrEncounters (PatientId, EncounterDate DESC);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EmrClinicalNotes_Encounter' AND object_id = OBJECT_ID('dbo.EmrClinicalNotes'))
        CREATE INDEX IX_EmrClinicalNotes_Encounter ON dbo.EmrClinicalNotes (EncounterId, RecordedAt DESC);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EmrDiagnosisRecords_Patient' AND object_id = OBJECT_ID('dbo.EmrDiagnosisRecords'))
        CREATE INDEX IX_EmrDiagnosisRecords_Patient ON dbo.EmrDiagnosisRecords (PatientId, RecordedAt DESC);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EmrLabReportReviews_Patient' AND object_id = OBJECT_ID('dbo.EmrLabReportReviews'))
        CREATE INDEX IX_EmrLabReportReviews_Patient ON dbo.EmrLabReportReviews (PatientId, ReviewStatus, ReviewedAt DESC);

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    THROW;
END CATCH;
