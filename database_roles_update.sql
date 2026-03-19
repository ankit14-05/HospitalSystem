USE [Hospital_Database]
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

IF EXISTS (
  SELECT 1
  FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID(N'dbo.Users')
    AND name = N'CK_Users_Role'
)
BEGIN
  ALTER TABLE dbo.Users DROP CONSTRAINT [CK_Users_Role];
END
GO

ALTER TABLE [dbo].[Users] WITH CHECK ADD CONSTRAINT [CK_Users_Role]
CHECK (
  [Role] IN (
    'superadmin',
    'admin',
    'doctor',
    'nurse',
    'receptionist',
    'pharmacist',
    'labtech',
    'lab_technician',
    'patient',
    'auditor',
    'ward_boy',
    'housekeeping',
    'security',
    'admin_staff',
    'opdmanager',
    'opd_manager'
  )
);
GO

ALTER TABLE [dbo].[Users] CHECK CONSTRAINT [CK_Users_Role];
GO
