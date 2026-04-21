/*
  Lab Module Database Design (SQL Server)
  Supports screens:
  - Book Lab Test
  - Sample Tracking
  - Lab Report View
  - Media attachments (video/pdf/audio/image)
*/

IF DB_ID('HMS_LabOps') IS NULL
BEGIN
  CREATE DATABASE HMS_LabOps;
END
GO

USE HMS_LabOps;
GO

/* =========================
   Core Master Tables
   ========================= */

CREATE TABLE dbo.LabDepartments (
  Id                BIGINT IDENTITY(1,1) PRIMARY KEY,
  HospitalId        BIGINT NOT NULL,
  Name              NVARCHAR(120) NOT NULL,
  Code              NVARCHAR(30)  NULL,
  IsActive          BIT NOT NULL DEFAULT(1),
  CreatedAt         DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt         DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE dbo.LabTests (
  Id                BIGINT IDENTITY(1,1) PRIMARY KEY,
  HospitalId        BIGINT NOT NULL,
  DepartmentId      BIGINT NULL,
  TestCode          NVARCHAR(40)  NOT NULL,
  TestName          NVARCHAR(180) NOT NULL,
  Category          NVARCHAR(80)  NULL,
  SpecimenType      NVARCHAR(60)  NULL, -- Blood/Urine/Swab/etc
  MethodName        NVARCHAR(120) NULL,
  TurnaroundMins    INT NULL,
  Price             DECIMAL(10,2) NOT NULL DEFAULT(0),
  IsActive          BIT NOT NULL DEFAULT(1),
  CreatedAt         DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt         DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_LabTests_Hosp_TestCode UNIQUE (HospitalId, TestCode),
  CONSTRAINT FK_LabTests_Department FOREIGN KEY (DepartmentId) REFERENCES dbo.LabDepartments(Id)
);
GO

CREATE TABLE dbo.LabTestReferenceRanges (
  Id                BIGINT IDENTITY(1,1) PRIMARY KEY,
  LabTestId         BIGINT NOT NULL,
  Gender            NVARCHAR(20) NULL,   -- Male/Female/Any
  AgeMinYears       DECIMAL(5,2) NULL,
  AgeMaxYears       DECIMAL(5,2) NULL,
  Unit              NVARCHAR(30) NULL,
  RefLow            DECIMAL(18,4) NULL,
  RefHigh           DECIMAL(18,4) NULL,
  TextRange         NVARCHAR(200) NULL,
  CreatedAt         DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_RefRange_Test FOREIGN KEY (LabTestId) REFERENCES dbo.LabTests(Id)
);
GO

/* =========================
   Booking / Orders
   ========================= */

CREATE TABLE dbo.LabOrders (
  Id                BIGINT IDENTITY(1,1) PRIMARY KEY,
  HospitalId        BIGINT NOT NULL,
  OrderNo           NVARCHAR(40) NOT NULL,
  PatientId         BIGINT NOT NULL,       -- from HMS main DB
  PatientUHID       NVARCHAR(30) NULL,
  PatientName       NVARCHAR(220) NULL,
  OrderedByUserId   BIGINT NULL,           -- doctor/staff who placed order
  OrderedAt         DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  Priority          NVARCHAR(20) NOT NULL DEFAULT('Normal'), -- Normal/Urgent/Stat
  Status            NVARCHAR(30) NOT NULL DEFAULT('Booked'),
  Notes             NVARCHAR(1000) NULL,
  TotalAmount       DECIMAL(10,2) NOT NULL DEFAULT(0),
  PaidAmount        DECIMAL(10,2) NOT NULL DEFAULT(0),
  PaymentStatus     NVARCHAR(20) NOT NULL DEFAULT('Pending'),
  CreatedBy         BIGINT NULL,
  UpdatedBy         BIGINT NULL,
  UpdatedAt         DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_LabOrders_Hosp_OrderNo UNIQUE (HospitalId, OrderNo),
  CONSTRAINT CK_LabOrders_Status CHECK (Status IN ('Draft','Booked','SampleCollected','InProcessing','PartiallyReported','Completed','Cancelled')),
  CONSTRAINT CK_LabOrders_PaymentStatus CHECK (PaymentStatus IN ('Pending','Partial','Paid','Refunded'))
);
GO

CREATE TABLE dbo.LabOrderItems (
  Id                BIGINT IDENTITY(1,1) PRIMARY KEY,
  LabOrderId        BIGINT NOT NULL,
  LabTestId         BIGINT NOT NULL,
  ItemStatus        NVARCHAR(30) NOT NULL DEFAULT('Booked'),
  SpecimenType      NVARCHAR(60) NULL,
  ScheduledSlotAt   DATETIME2(0) NULL,
  CollectedAt       DATETIME2(0) NULL,
  Price             DECIMAL(10,2) NOT NULL DEFAULT(0),
  DiscountAmount    DECIMAL(10,2) NOT NULL DEFAULT(0),
  NetAmount         AS (Price - DiscountAmount) PERSISTED,
  Remarks           NVARCHAR(1000) NULL,
  CreatedAt         DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt         DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_LabOrderItems_Order FOREIGN KEY (LabOrderId) REFERENCES dbo.LabOrders(Id),
  CONSTRAINT FK_LabOrderItems_Test FOREIGN KEY (LabTestId) REFERENCES dbo.LabTests(Id),
  CONSTRAINT CK_LabOrderItems_Status CHECK (ItemStatus IN ('Booked','SampleCollected','InProcessing','Reported','Validated','Cancelled'))
);
GO

/* =========================
   Slot / Sample Tracking
   ========================= */

CREATE TABLE dbo.LabCollectionSlots (
  Id                BIGINT IDENTITY(1,1) PRIMARY KEY,
  HospitalId        BIGINT NOT NULL,
  SlotDate          DATE NOT NULL,
  StartTime         TIME(0) NOT NULL,
  EndTime           TIME(0) NOT NULL,
  Capacity          INT NOT NULL DEFAULT(30),
  BookedCount       INT NOT NULL DEFAULT(0),
  IsActive          BIT NOT NULL DEFAULT(1),
  CreatedAt         DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_LabCollectionSlots UNIQUE (HospitalId, SlotDate, StartTime, EndTime)
);
GO

CREATE TABLE dbo.LabSamples (
  Id                BIGINT IDENTITY(1,1) PRIMARY KEY,
  HospitalId        BIGINT NOT NULL,
  LabOrderItemId    BIGINT NOT NULL,
  SampleNo          NVARCHAR(50) NOT NULL,
  Barcode           NVARCHAR(120) NULL,
  SampleStatus      NVARCHAR(30) NOT NULL DEFAULT('Collected'),
  CollectedByUserId BIGINT NULL,
  CollectedAt       DATETIME2(0) NULL,
  ReceivedByUserId  BIGINT NULL,
  ReceivedAt        DATETIME2(0) NULL,
  ProcessingStartAt DATETIME2(0) NULL,
  ProcessingEndAt   DATETIME2(0) NULL,
  RejectedReason    NVARCHAR(500) NULL,
  Remarks           NVARCHAR(1000) NULL,
  CreatedAt         DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt         DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_LabSamples_Hosp_SampleNo UNIQUE (HospitalId, SampleNo),
  CONSTRAINT FK_LabSamples_OrderItem FOREIGN KEY (LabOrderItemId) REFERENCES dbo.LabOrderItems(Id),
  CONSTRAINT CK_LabSamples_Status CHECK (SampleStatus IN ('Collected','Received','Processing','Completed','Rejected'))
);
GO

CREATE TABLE dbo.LabSampleStatusHistory (
  Id                BIGINT IDENTITY(1,1) PRIMARY KEY,
  LabSampleId       BIGINT NOT NULL,
  FromStatus        NVARCHAR(30) NULL,
  ToStatus          NVARCHAR(30) NOT NULL,
  ChangedByUserId   BIGINT NULL,
  ChangedAt         DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  Note              NVARCHAR(500) NULL,
  CONSTRAINT FK_LabSampleHistory_Sample FOREIGN KEY (LabSampleId) REFERENCES dbo.LabSamples(Id)
);
GO

/* =========================
   Reports / Results
   ========================= */

CREATE TABLE dbo.LabReports (
  Id                BIGINT IDENTITY(1,1) PRIMARY KEY,
  HospitalId        BIGINT NOT NULL,
  ReportNo          NVARCHAR(50) NOT NULL,
  LabOrderId        BIGINT NOT NULL,
  ReportStatus      NVARCHAR(20) NOT NULL DEFAULT('Draft'),
  FinalizedAt       DATETIME2(0) NULL,
  FinalizedByUserId BIGINT NULL,
  ApprovedAt        DATETIME2(0) NULL,
  ApprovedByUserId  BIGINT NULL,
  Summary           NVARCHAR(MAX) NULL,
  Impression        NVARCHAR(MAX) NULL,
  DoctorNotes       NVARCHAR(MAX) NULL,
  CreatedAt         DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt         DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_LabReports_Hosp_ReportNo UNIQUE (HospitalId, ReportNo),
  CONSTRAINT FK_LabReports_Order FOREIGN KEY (LabOrderId) REFERENCES dbo.LabOrders(Id),
  CONSTRAINT CK_LabReports_Status CHECK (ReportStatus IN ('Draft','UnderReview','Final','Amended'))
);
GO

CREATE TABLE dbo.LabReportResults (
  Id                BIGINT IDENTITY(1,1) PRIMARY KEY,
  LabReportId       BIGINT NOT NULL,
  LabOrderItemId    BIGINT NOT NULL,
  LabTestId         BIGINT NOT NULL,
  ParameterName     NVARCHAR(160) NOT NULL,
  ResultValue       NVARCHAR(160) NULL,
  ResultNumeric     DECIMAL(18,4) NULL,
  Unit              NVARCHAR(30) NULL,
  RefRangeText      NVARCHAR(200) NULL,
  Flag              NVARCHAR(20) NULL,  -- Normal/High/Low/Critical
  IsAbnormal        BIT NOT NULL DEFAULT(0),
  ObservedAt        DATETIME2(0) NULL,
  VerifiedByUserId  BIGINT NULL,
  VerifiedAt        DATETIME2(0) NULL,
  CreatedAt         DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt         DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_LabReportResults_Report FOREIGN KEY (LabReportId) REFERENCES dbo.LabReports(Id),
  CONSTRAINT FK_LabReportResults_OrderItem FOREIGN KEY (LabOrderItemId) REFERENCES dbo.LabOrderItems(Id),
  CONSTRAINT FK_LabReportResults_Test FOREIGN KEY (LabTestId) REFERENCES dbo.LabTests(Id)
);
GO

/* =========================
   Media Attachments (video/pdf/audio/image)
   ========================= */

CREATE TABLE dbo.LabMediaFiles (
  Id                BIGINT IDENTITY(1,1) PRIMARY KEY,
  HospitalId        BIGINT NOT NULL,
  EntityType        NVARCHAR(30) NOT NULL,  -- LabOrder/LabOrderItem/LabSample/LabReport/LabReportResult
  EntityId          BIGINT NOT NULL,
  MediaType         NVARCHAR(20) NOT NULL,  -- pdf/video/audio/image
  FileName          NVARCHAR(260) NOT NULL,
  FileExt           NVARCHAR(20)  NULL,
  MimeType          NVARCHAR(120) NULL,
  FileSizeBytes     BIGINT NULL,
  StorageProvider   NVARCHAR(30) NOT NULL DEFAULT('local'), -- local/s3/azure/gcs
  StoragePath       NVARCHAR(700) NOT NULL, -- disk path or object key
  ThumbPath         NVARCHAR(700) NULL,
  DurationSeconds   INT NULL,               -- for audio/video
  IsPrimary         BIT NOT NULL DEFAULT(0),
  UploadedByUserId  BIGINT NULL,
  UploadedAt        DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  IsDeleted         BIT NOT NULL DEFAULT(0),
  DeletedAt         DATETIME2(0) NULL,
  DeletedByUserId   BIGINT NULL,
  CONSTRAINT CK_LabMedia_EntityType CHECK (EntityType IN ('LabOrder','LabOrderItem','LabSample','LabReport','LabReportResult')),
  CONSTRAINT CK_LabMedia_MediaType CHECK (MediaType IN ('pdf','video','audio','image'))
);
GO

/* =========================
   Audits / Notes
   ========================= */

CREATE TABLE dbo.LabOrderAuditLogs (
  Id                BIGINT IDENTITY(1,1) PRIMARY KEY,
  HospitalId        BIGINT NOT NULL,
  LabOrderId        BIGINT NULL,
  LabOrderItemId    BIGINT NULL,
  EventType         NVARCHAR(50) NOT NULL, -- Created/Updated/StatusChanged/etc
  EventSource       NVARCHAR(30) NULL,     -- UI/API/System
  OldValueJson      NVARCHAR(MAX) NULL,
  NewValueJson      NVARCHAR(MAX) NULL,
  Note              NVARCHAR(1000) NULL,
  TriggeredByUserId BIGINT NULL,
  TriggeredAt       DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_LabAudit_Order FOREIGN KEY (LabOrderId) REFERENCES dbo.LabOrders(Id),
  CONSTRAINT FK_LabAudit_Item FOREIGN KEY (LabOrderItemId) REFERENCES dbo.LabOrderItems(Id)
);
GO

/* =========================
   Useful Indexes
   ========================= */

CREATE INDEX IX_LabOrders_Hospital_Status_OrderedAt
  ON dbo.LabOrders (HospitalId, Status, OrderedAt DESC);
GO

CREATE INDEX IX_LabOrders_Patient
  ON dbo.LabOrders (HospitalId, PatientId, OrderedAt DESC);
GO

CREATE INDEX IX_LabOrderItems_Order_Status
  ON dbo.LabOrderItems (LabOrderId, ItemStatus);
GO

CREATE INDEX IX_LabSamples_Status
  ON dbo.LabSamples (HospitalId, SampleStatus, UpdatedAt DESC);
GO

CREATE INDEX IX_LabReports_Order_Status
  ON dbo.LabReports (LabOrderId, ReportStatus, UpdatedAt DESC);
GO

CREATE INDEX IX_LabMedia_Entity
  ON dbo.LabMediaFiles (HospitalId, EntityType, EntityId, MediaType, UploadedAt DESC);
GO

/* =========================
   Views for your screens
   ========================= */

CREATE VIEW dbo.V_LabBookingSummary
AS
SELECT
  o.Id AS LabOrderId,
  o.HospitalId,
  o.OrderNo,
  o.PatientId,
  o.PatientUHID,
  o.PatientName,
  o.OrderedAt,
  o.Priority,
  o.Status,
  o.TotalAmount,
  o.PaidAmount,
  o.PaymentStatus,
  COUNT(oi.Id) AS TotalTests,
  SUM(CASE WHEN oi.ItemStatus IN ('Reported','Validated') THEN 1 ELSE 0 END) AS CompletedTests
FROM dbo.LabOrders o
LEFT JOIN dbo.LabOrderItems oi ON oi.LabOrderId = o.Id
GROUP BY
  o.Id, o.HospitalId, o.OrderNo, o.PatientId, o.PatientUHID, o.PatientName,
  o.OrderedAt, o.Priority, o.Status, o.TotalAmount, o.PaidAmount, o.PaymentStatus;
GO

CREATE VIEW dbo.V_LabSampleTrackingBoard
AS
SELECT
  s.Id AS LabSampleId,
  s.HospitalId,
  s.SampleNo,
  s.Barcode,
  s.SampleStatus,
  s.CollectedAt,
  s.ReceivedAt,
  s.ProcessingStartAt,
  s.ProcessingEndAt,
  o.Id AS LabOrderId,
  o.OrderNo,
  o.PatientId,
  o.PatientUHID,
  o.PatientName,
  t.TestCode,
  t.TestName,
  oi.ItemStatus
FROM dbo.LabSamples s
JOIN dbo.LabOrderItems oi ON oi.Id = s.LabOrderItemId
JOIN dbo.LabOrders o ON o.Id = oi.LabOrderId
JOIN dbo.LabTests t ON t.Id = oi.LabTestId;
GO

CREATE VIEW dbo.V_LabReportViewer
AS
SELECT
  r.Id AS LabReportId,
  r.HospitalId,
  r.ReportNo,
  r.ReportStatus,
  r.FinalizedAt,
  r.ApprovedAt,
  o.Id AS LabOrderId,
  o.OrderNo,
  o.PatientId,
  o.PatientUHID,
  o.PatientName,
  rr.Id AS ResultId,
  rr.ParameterName,
  rr.ResultValue,
  rr.ResultNumeric,
  rr.Unit,
  rr.RefRangeText,
  rr.Flag,
  rr.IsAbnormal
FROM dbo.LabReports r
JOIN dbo.LabOrders o ON o.Id = r.LabOrderId
LEFT JOIN dbo.LabReportResults rr ON rr.LabReportId = r.Id;
GO

/* Media view for "View PDF / Audio / Video" actions */
CREATE VIEW dbo.V_LabMediaByEntity
AS
SELECT
  m.Id,
  m.HospitalId,
  m.EntityType,
  m.EntityId,
  m.MediaType,
  m.FileName,
  m.MimeType,
  m.StorageProvider,
  m.StoragePath,
  m.ThumbPath,
  m.DurationSeconds,
  m.UploadedAt
FROM dbo.LabMediaFiles m
WHERE m.IsDeleted = 0;
GO

