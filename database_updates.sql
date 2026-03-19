USE [Hospital_Database]
GO

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

IF OBJECT_ID(N'[dbo].[Notifications]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[Notifications](
    [Id] [bigint] IDENTITY(1,1) NOT NULL PRIMARY KEY CLUSTERED,
    [HospitalId] [bigint] NOT NULL,
    [UserId] [bigint] NOT NULL,
    [NotifType] [nvarchar](30) NOT NULL,
    [Title] [nvarchar](255) NOT NULL,
    [Body] [nvarchar](max) NULL,
    [Link] [nvarchar](500) NULL,
    [DataJson] [nvarchar](max) NULL,
    [IsRead] [bit] NOT NULL CONSTRAINT [DF_Notifications_IsRead] DEFAULT ((0)),
    [ReadAt] [datetime2](0) NULL,
    [CreatedAt] [datetime2](0) NOT NULL CONSTRAINT [DF_Notifications_CreatedAt] DEFAULT (sysutcdatetime())
  );
END
GO

IF COL_LENGTH('dbo.Notifications', 'Type') IS NOT NULL AND COL_LENGTH('dbo.Notifications', 'NotifType') IS NULL
BEGIN
  EXEC sp_rename 'dbo.Notifications.Type', 'NotifType', 'COLUMN';
END
GO

IF COL_LENGTH('dbo.Notifications', 'Message') IS NOT NULL AND COL_LENGTH('dbo.Notifications', 'Body') IS NULL
BEGIN
  EXEC sp_rename 'dbo.Notifications.Message', 'Body', 'COLUMN';
END
GO

IF COL_LENGTH('dbo.Notifications', 'NotifType') IS NULL
BEGIN
  ALTER TABLE dbo.Notifications ADD NotifType nvarchar(30) NULL;
END
GO

IF COL_LENGTH('dbo.Notifications', 'Body') IS NULL
BEGIN
  ALTER TABLE dbo.Notifications ADD Body nvarchar(max) NULL;
END
GO

IF COL_LENGTH('dbo.Notifications', 'Link') IS NULL
BEGIN
  ALTER TABLE dbo.Notifications ADD Link nvarchar(500) NULL;
END
GO

IF COL_LENGTH('dbo.Notifications', 'DataJson') IS NULL
BEGIN
  ALTER TABLE dbo.Notifications ADD DataJson nvarchar(max) NULL;
END
GO

IF COL_LENGTH('dbo.Notifications', 'IsRead') IS NULL
BEGIN
  ALTER TABLE dbo.Notifications ADD IsRead bit NOT NULL CONSTRAINT [DF_Notifications_IsRead_Tmp] DEFAULT ((0));
END
GO

IF COL_LENGTH('dbo.Notifications', 'ReadAt') IS NULL
BEGIN
  ALTER TABLE dbo.Notifications ADD ReadAt datetime2(0) NULL;
END
GO

IF COL_LENGTH('dbo.Notifications', 'CreatedAt') IS NULL
BEGIN
  ALTER TABLE dbo.Notifications ADD CreatedAt datetime2(0) NOT NULL CONSTRAINT [DF_Notifications_CreatedAt_Tmp] DEFAULT (sysutcdatetime());
END
GO

IF EXISTS (
  SELECT 1
  FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.Notifications')
    AND name = 'NotifType'
    AND is_nullable = 1
)
BEGIN
  UPDATE dbo.Notifications
  SET NotifType = ISNULL(NotifType, 'system')
  WHERE NotifType IS NULL;

  ALTER TABLE dbo.Notifications ALTER COLUMN NotifType nvarchar(30) NOT NULL;
END
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = N'IX_Notif_User'
    AND object_id = OBJECT_ID(N'dbo.Notifications')
)
BEGIN
  CREATE NONCLUSTERED INDEX [IX_Notif_User] ON [dbo].[Notifications]
  (
    [UserId] ASC,
    [IsRead] ASC,
    [CreatedAt] DESC
  );
END
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID(N'dbo.Notifications')
    AND name = N'CK_Notif_Json'
)
BEGIN
  ALTER TABLE [dbo].[Notifications] WITH CHECK ADD CONSTRAINT [CK_Notif_Json]
  CHECK (([DataJson] IS NULL OR isjson([DataJson])=(1)));
END
GO

ALTER TABLE [dbo].[Notifications] CHECK CONSTRAINT [CK_Notif_Json];
GO

IF OBJECT_ID(N'[dbo].[Roles]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[Roles](
    [Id] [int] IDENTITY(1,1) NOT NULL PRIMARY KEY CLUSTERED,
    [RoleName] [nvarchar](100) NOT NULL UNIQUE,
    [IsActive] [bit] NOT NULL DEFAULT ((1)),
    [SortOrder] [int] NOT NULL DEFAULT ((0))
  );
END
GO

MERGE dbo.Roles AS target
USING (
  VALUES
    ('Nurse', 1),
    ('Receptionist', 2),
    ('Pharmacist', 3),
    ('Lab Technician', 4),
    ('Ward Boy', 5),
    ('Housekeeping', 6),
    ('Security', 7),
    ('Admin Staff', 8),
    ('OPD Manager', 9)
) AS source(RoleName, SortOrder)
ON target.RoleName = source.RoleName
WHEN MATCHED THEN
  UPDATE SET target.IsActive = 1, target.SortOrder = source.SortOrder
WHEN NOT MATCHED THEN
  INSERT (RoleName, IsActive, SortOrder)
  VALUES (source.RoleName, 1, source.SortOrder);
GO
