-- ============================================================
-- EMR & LAB MODULE — Schema Additions
-- Database: Hospital_Database
-- Run AFTER the main database.sql
-- ============================================================

USE [HospitalDB]
GO

-- ============================================================
-- 1. EXTEND LabOrders with booking-specific columns
--    (These columns are required by the LabBookingPage frontend)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.LabOrders') AND name = 'PlaceType')
    ALTER TABLE [dbo].[LabOrders] ADD [PlaceType] [nvarchar](20) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.LabOrders') AND name = 'RoomNo')
    ALTER TABLE [dbo].[LabOrders] ADD [RoomNo] [nvarchar](30) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.LabOrders') AND name = 'ExternalLabName')
    ALTER TABLE [dbo].[LabOrders] ADD [ExternalLabName] [nvarchar](200) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.LabOrders') AND name = 'Criteria')
    ALTER TABLE [dbo].[LabOrders] ADD [Criteria] [nvarchar](200) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.LabOrders') AND name = 'AdditionalDetails')
    ALTER TABLE [dbo].[LabOrders] ADD [AdditionalDetails] [nvarchar](max) NULL;
GO

-- ============================================================
-- 2. EMRMedicalHistory — chronic conditions & past illnesses
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.EMRMedicalHistory') AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[EMRMedicalHistory] (
        [Id]            [bigint] IDENTITY(1,1) NOT NULL,
        [PatientId]     [bigint] NOT NULL,
        [HospitalId]    [bigint] NOT NULL,
        [ConditionName] [nvarchar](200) NOT NULL,
        [ICD10Code]     [nvarchar](20) NULL,
        [DiagnosedDate] [date] NULL,
        [Status]        [nvarchar](20) NOT NULL DEFAULT 'Active',  -- Active | Resolved | Chronic
        [Notes]         [nvarchar](max) NULL,
        [EnteredBy]     [bigint] NULL,
        [CreatedAt]     [datetime2](0) NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt]     [datetime2](0) NOT NULL DEFAULT GETUTCDATE(),
        [DeletedAt]     [datetime2](0) NULL,
        CONSTRAINT [PK_EMRMedicalHistory] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_EMRMedHistory_Patient] FOREIGN KEY ([PatientId])
            REFERENCES [dbo].[PatientProfiles] ([Id]),
        CONSTRAINT [FK_EMRMedHistory_EnteredBy] FOREIGN KEY ([EnteredBy])
            REFERENCES [dbo].[Users] ([Id]),
        CONSTRAINT [CK_EMRMedHistory_Status] CHECK ([Status] IN ('Active','Resolved','Chronic'))
    );
    CREATE INDEX [IX_EMRMedicalHistory_PatientId] ON [dbo].[EMRMedicalHistory] ([PatientId]);
END
GO

-- ============================================================
-- 3. EMRDiagnoses — per-visit diagnoses for a patient
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.EMRDiagnoses') AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[EMRDiagnoses] (
        [Id]            [bigint] IDENTITY(1,1) NOT NULL,
        [PatientId]     [bigint] NOT NULL,
        [HospitalId]    [bigint] NOT NULL,
        [DoctorId]      [bigint] NULL,
        [AppointmentId] [bigint] NULL,
        [ICD10Code]     [nvarchar](20) NULL,
        [DiagnosisName] [nvarchar](300) NOT NULL,
        [DiagnosisType] [nvarchar](20) NOT NULL DEFAULT 'Primary',  -- Primary | Secondary | Differential
        [Severity]      [nvarchar](20) NULL,    -- Mild | Moderate | Severe
        [DiagnosedDate] [date] NOT NULL,
        [Status]        [nvarchar](30) NOT NULL DEFAULT 'Active',   -- Active | Resolved | Chronic | Under Observation
        [Notes]         [nvarchar](max) NULL,
        [CreatedAt]     [datetime2](0) NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt]     [datetime2](0) NOT NULL DEFAULT GETUTCDATE(),
        [DeletedAt]     [datetime2](0) NULL,
        CONSTRAINT [PK_EMRDiagnoses] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_EMRDiagnoses_Patient]     FOREIGN KEY ([PatientId])     REFERENCES [dbo].[PatientProfiles] ([Id]),
        CONSTRAINT [FK_EMRDiagnoses_Doctor]      FOREIGN KEY ([DoctorId])      REFERENCES [dbo].[Users] ([Id]),
        CONSTRAINT [FK_EMRDiagnoses_Appointment] FOREIGN KEY ([AppointmentId]) REFERENCES [dbo].[Appointments] ([Id]),
        CONSTRAINT [CK_EMRDiagnoses_Type]        CHECK ([DiagnosisType] IN ('Primary','Secondary','Differential'))
    );
    CREATE INDEX [IX_EMRDiagnoses_PatientId]     ON [dbo].[EMRDiagnoses] ([PatientId]);
    CREATE INDEX [IX_EMRDiagnoses_AppointmentId] ON [dbo].[EMRDiagnoses] ([AppointmentId]);
END
GO

-- ============================================================
-- 4. EMRClinicalNotes — SOAP / free-text doctor notes
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.EMRClinicalNotes') AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[EMRClinicalNotes] (
        [Id]            [bigint] IDENTITY(1,1) NOT NULL,
        [PatientId]     [bigint] NOT NULL,
        [HospitalId]    [bigint] NOT NULL,
        [DoctorId]      [bigint] NULL,
        [AppointmentId] [bigint] NULL,
        [NoteType]      [nvarchar](20) NOT NULL DEFAULT 'General',  -- SOAP | General | Referral | Discharge
        [Subjective]    [nvarchar](max) NULL,   -- Patient complaints (SOAP-S)
        [Objective]     [nvarchar](max) NULL,   -- Clinical observations (SOAP-O)
        [Assessment]    [nvarchar](max) NULL,   -- Diagnosis assessment (SOAP-A)
        [Plan]          [nvarchar](max) NULL,   -- Treatment plan (SOAP-P)
        [FreeText]      [nvarchar](max) NULL,   -- Used for General / Referral notes
        [CreatedAt]     [datetime2](0) NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt]     [datetime2](0) NOT NULL DEFAULT GETUTCDATE(),
        [DeletedAt]     [datetime2](0) NULL,
        CONSTRAINT [PK_EMRClinicalNotes] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_EMRClinicalNotes_Patient]     FOREIGN KEY ([PatientId])     REFERENCES [dbo].[PatientProfiles] ([Id]),
        CONSTRAINT [FK_EMRClinicalNotes_Doctor]      FOREIGN KEY ([DoctorId])      REFERENCES [dbo].[Users] ([Id]),
        CONSTRAINT [FK_EMRClinicalNotes_Appointment] FOREIGN KEY ([AppointmentId]) REFERENCES [dbo].[Appointments] ([Id]),
        CONSTRAINT [CK_EMRNote_Type] CHECK ([NoteType] IN ('SOAP','General','Referral','Discharge'))
    );
    CREATE INDEX [IX_EMRClinicalNotes_PatientId]     ON [dbo].[EMRClinicalNotes] ([PatientId]);
    CREATE INDEX [IX_EMRClinicalNotes_AppointmentId] ON [dbo].[EMRClinicalNotes] ([AppointmentId]);
END
GO

-- ============================================================
-- 5. EMRAllergies — structured allergy records per patient
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.EMRAllergies') AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[EMRAllergies] (
        [Id]           [bigint] IDENTITY(1,1) NOT NULL,
        [PatientId]    [bigint] NOT NULL,
        [HospitalId]   [bigint] NOT NULL,
        [AllergenName] [nvarchar](200) NOT NULL,
        [AllergyType]  [nvarchar](30) NOT NULL DEFAULT 'Drug',    -- Drug | Food | Environmental | Other
        [Severity]     [nvarchar](30) NOT NULL DEFAULT 'Mild',    -- Mild | Moderate | Severe | Life-threatening
        [Reaction]     [nvarchar](500) NULL,
        [OnsetDate]    [date] NULL,
        [IsActive]     [bit] NOT NULL DEFAULT 1,
        [Notes]        [nvarchar](max) NULL,
        [EnteredBy]    [bigint] NULL,
        [CreatedAt]    [datetime2](0) NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt]    [datetime2](0) NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [PK_EMRAllergies] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_EMRAllergies_Patient]   FOREIGN KEY ([PatientId])  REFERENCES [dbo].[PatientProfiles] ([Id]),
        CONSTRAINT [FK_EMRAllergies_EnteredBy] FOREIGN KEY ([EnteredBy])  REFERENCES [dbo].[Users] ([Id]),
        CONSTRAINT [CK_EMRAllergy_Type]     CHECK ([AllergyType] IN ('Drug','Food','Environmental','Other')),
        CONSTRAINT [CK_EMRAllergy_Severity] CHECK ([Severity] IN ('Mild','Moderate','Severe','Life-threatening'))
    );
    CREATE INDEX [IX_EMRAllergies_PatientId] ON [dbo].[EMRAllergies] ([PatientId]);
END
GO

-- ============================================================
-- 6. EMRMedicationHistory — historical medications per patient
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.EMRMedicationHistory') AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[EMRMedicationHistory] (
        [Id]            [bigint] IDENTITY(1,1) NOT NULL,
        [PatientId]     [bigint] NOT NULL,
        [HospitalId]    [bigint] NOT NULL,
        [MedicineName]  [nvarchar](200) NOT NULL,
        [GenericName]   [nvarchar](200) NULL,
        [Dosage]        [nvarchar](100) NULL,
        [Frequency]     [nvarchar](100) NULL,
        [Route]         [nvarchar](80) NULL,    -- Oral | IV | IM | Topical | etc.
        [StartDate]     [date] NULL,
        [EndDate]       [date] NULL,
        [PrescribedBy]  [bigint] NULL,
        [Reason]        [nvarchar](500) NULL,
        [Status]        [nvarchar](20) NOT NULL DEFAULT 'Active',  -- Active | Discontinued | Completed
        [Notes]         [nvarchar](max) NULL,
        [CreatedAt]     [datetime2](0) NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt]     [datetime2](0) NOT NULL DEFAULT GETUTCDATE(),
        [DeletedAt]     [datetime2](0) NULL,
        CONSTRAINT [PK_EMRMedicationHistory] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_EMRMedication_Patient]      FOREIGN KEY ([PatientId])    REFERENCES [dbo].[PatientProfiles] ([Id]),
        CONSTRAINT [FK_EMRMedication_PrescribedBy] FOREIGN KEY ([PrescribedBy]) REFERENCES [dbo].[Users] ([Id]),
        CONSTRAINT [CK_EMRMedication_Status] CHECK ([Status] IN ('Active','Discontinued','Completed'))
    );
    CREATE INDEX [IX_EMRMedicationHistory_PatientId] ON [dbo].[EMRMedicationHistory] ([PatientId]);
END
GO

-- ============================================================
-- 7. EMRDocuments — patient-uploaded files (scans, reports, etc.)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.EMRDocuments') AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[EMRDocuments] (
        [Id]             [bigint] IDENTITY(1,1) NOT NULL,
        [PatientId]      [bigint] NOT NULL,
        [HospitalId]     [bigint] NOT NULL,
        [UploaderUserId] [bigint] NULL,
        [DocumentType]   [nvarchar](50) NOT NULL DEFAULT 'Other', -- Lab Report | Prescription | Scan | X-Ray | Discharge Summary | Other
        [FileName]       [nvarchar](300) NOT NULL,
        [FilePath]       [nvarchar](1000) NOT NULL,
        [FileSize]       [bigint] NULL,
        [MimeType]       [nvarchar](100) NULL,
        [Description]    [nvarchar](500) NULL,
        [UploadedAt]     [datetime2](0) NOT NULL DEFAULT GETUTCDATE(),
        [IsActive]       [bit] NOT NULL DEFAULT 1,
        CONSTRAINT [PK_EMRDocuments] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_EMRDocuments_Patient]  FOREIGN KEY ([PatientId])      REFERENCES [dbo].[PatientProfiles] ([Id]),
        CONSTRAINT [FK_EMRDocuments_Uploader] FOREIGN KEY ([UploaderUserId]) REFERENCES [dbo].[Users] ([Id])
    );
    CREATE INDEX [IX_EMRDocuments_PatientId] ON [dbo].[EMRDocuments] ([PatientId]);
END
GO

-- ============================================================
-- 8. SEED DATA — LabTests master catalogue
--    (Only inserts if the table is empty)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM [dbo].[LabTests])
BEGIN
    INSERT INTO [dbo].[LabTests]
        (Name, ShortName, Category, Unit, NormalRangeMale, NormalRangeFemale, NormalRangeChild, Price, TurnaroundHrs, RequiresFasting, SampleType, Instructions, IsActive, CreatedAt, UpdatedAt)
    VALUES
        ('Complete Blood Count (CBC)',      'CBC',    'Hematology',    'cells/µL', '4.5-5.5 million RBC', '4.0-5.0 million RBC', '3.8-5.2 million RBC', 250.00,  4,  0, 'Blood (EDTA)', NULL, 1, GETUTCDATE(), GETUTCDATE()),
        ('Lipid Panel',                     'LIPID',  'Biochemistry',  'mg/dL',    '<200 Total Chol',     '<200 Total Chol',     NULL,                   350.00,  6,  1, 'Blood (Serum)', '12-hour fasting required', 1, GETUTCDATE(), GETUTCDATE()),
        ('Blood Glucose (Fasting)',         'FBS',    'Biochemistry',  'mg/dL',    '70-100',              '70-100',              '70-100',               80.00,   2,  1, 'Blood (Serum)', '8-hour fasting required', 1, GETUTCDATE(), GETUTCDATE()),
        ('HbA1c',                           'HBA1C',  'Biochemistry',  '%',        '<5.7%',               '<5.7%',               NULL,                   300.00,  6,  0, 'Blood (EDTA)', NULL, 1, GETUTCDATE(), GETUTCDATE()),
        ('Thyroid Function Test (TFT)',     'TFT',    'Endocrinology', 'mIU/L',    '0.4-4.0 TSH',         '0.4-4.0 TSH',         NULL,                   450.00,  8,  0, 'Blood (Serum)', NULL, 1, GETUTCDATE(), GETUTCDATE()),
        ('Liver Function Test (LFT)',       'LFT',    'Biochemistry',  'U/L',      'ALT 7-56',            'ALT 7-45',            NULL,                   400.00,  6,  1, 'Blood (Serum)', '4-hour fasting preferred', 1, GETUTCDATE(), GETUTCDATE()),
        ('Urine Routine & Microscopy',      'URM',    'Urine',         'Various',  NULL,                  NULL,                  NULL,                   150.00,  3,  0, 'Urine (Midstream)', 'Midstream clean-catch specimen', 1, GETUTCDATE(), GETUTCDATE()),
        ('Serum Creatinine',                'SCr',    'Nephrology',    'mg/dL',    '0.74-1.35',           '0.59-1.04',           '0.3-0.7',              120.00,  4,  0, 'Blood (Serum)', NULL, 1, GETUTCDATE(), GETUTCDATE()),
        ('ECG / EKG',                       'ECG',    'Cardiology',    NULL,       NULL,                  NULL,                  NULL,                   200.00,  1,  0, 'N/A (Non-invasive)', NULL, 1, GETUTCDATE(), GETUTCDATE()),
        ('X-Ray Chest PA View',             'CXR',    'Radiology',     NULL,       NULL,                  NULL,                  NULL,                   350.00,  2,  0, 'N/A (Imaging)', NULL, 1, GETUTCDATE(), GETUTCDATE()),
        ('Blood Urea Nitrogen (BUN)',        'BUN',    'Nephrology',    'mg/dL',    '7-20',                '7-20',                '5-18',                 100.00,  4,  0, 'Blood (Serum)', NULL, 1, GETUTCDATE(), GETUTCDATE()),
        ('Serum Sodium',                    'Na+',    'Electrolytes',  'mEq/L',    '136-145',             '136-145',             '136-145',              90.00,   4,  0, 'Blood (Serum)', NULL, 1, GETUTCDATE(), GETUTCDATE()),
        ('Serum Potassium',                 'K+',     'Electrolytes',  'mEq/L',    '3.5-5.0',             '3.5-5.0',             '3.5-5.0',              90.00,   4,  0, 'Blood (Serum)', NULL, 1, GETUTCDATE(), GETUTCDATE()),
        ('C-Reactive Protein (CRP)',        'CRP',    'Immunology',    'mg/L',     '<10.0',               '<10.0',               '<10.0',                280.00,  6,  0, 'Blood (Serum)', NULL, 1, GETUTCDATE(), GETUTCDATE()),
        ('Dengue NS1 Antigen',              'DNG-NS1','Serology',      NULL,       'Negative',            'Negative',            'Negative',             500.00, 12,  0, 'Blood (Serum)', NULL, 1, GETUTCDATE(), GETUTCDATE());
END
GO

PRINT 'EMR & Lab schema applied successfully.';
GO
