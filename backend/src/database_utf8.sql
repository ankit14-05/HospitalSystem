USE [HospitalDB]
GO
/****** Object:  User [hms_user]    Script Date: 17-03-2026 22:01:35 ******/
CREATE USER [hms_user] FOR LOGIN [hms_user] WITH DEFAULT_SCHEMA=[dbo]
GO
ALTER ROLE [db_datareader] ADD MEMBER [hms_user]
GO
ALTER ROLE [db_datawriter] ADD MEMBER [hms_user]
GO
/****** Object:  Table [dbo].[Users]    Script Date: 17-03-2026 22:01:35 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Users](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[UniqueId] [uniqueidentifier] NOT NULL,
	[HospitalId] [bigint] NOT NULL,
	[Username] [nvarchar](80) NOT NULL,
	[Email] [nvarchar](255) NULL,
	[Phone] [nvarchar](20) NULL,
	[PhoneCountryCode] [nvarchar](10) NOT NULL,
	[AltPhone] [nvarchar](20) NULL,
	[PasswordHash] [nvarchar](max) NOT NULL,
	[PasswordSalt] [nvarchar](100) NULL,
	[Role] [nvarchar](30) NOT NULL,
	[DepartmentId] [bigint] NULL,
	[IsActive] [bit] NOT NULL,
	[IsEmailVerified] [bit] NOT NULL,
	[IsPhoneVerified] [bit] NOT NULL,
	[Is2FaEnabled] [bit] NOT NULL,
	[TwoFaSecret] [nvarchar](max) NULL,
	[MustChangePassword] [bit] NOT NULL,
	[LastLoginAt] [datetime2](0) NULL,
	[LastLoginIp] [nvarchar](50) NULL,
	[LastLoginDevice] [nvarchar](500) NULL,
	[FailedLoginCount] [smallint] NOT NULL,
	[LockedUntil] [datetime2](0) NULL,
	[LoginCount] [int] NOT NULL,
	[PasswordChangedAt] [datetime2](0) NOT NULL,
	[PasswordExpiresAt] [datetime2](0) NULL,
	[FirstName] [nvarchar](100) NOT NULL,
	[LastName] [nvarchar](100) NOT NULL,
	[Gender] [nvarchar](20) NULL,
	[DateOfBirth] [date] NULL,
	[ProfilePhotoUrl] [nvarchar](500) NULL,
	[EmployeeId] [nvarchar](60) NULL,
	[Designation] [nvarchar](150) NULL,
	[NotifyEmail] [bit] NOT NULL,
	[NotifySms] [bit] NOT NULL,
	[NotifyPush] [bit] NOT NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
	[CreatedBy] [bigint] NULL,
	[UpdatedBy] [bigint] NULL,
	[DeletedAt] [datetime2](0) NULL,
	[DeletedBy] [bigint] NULL,
	[DeletedReason] [nvarchar](500) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[Username] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[UniqueId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[DoctorProfiles]    Script Date: 17-03-2026 22:01:35 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DoctorProfiles](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[UserId] [bigint] NOT NULL,
	[HospitalId] [bigint] NOT NULL,
	[DepartmentId] [bigint] NULL,
	[SpecializationId] [int] NULL,
	[QualificationId] [int] NULL,
	[MedicalCouncilId] [int] NULL,
	[Aadhaar] [nvarchar](12) NULL,
	[PAN] [nvarchar](10) NULL,
	[BloodGroup] [nvarchar](5) NULL,
	[Nationality] [nvarchar](80) NOT NULL,
	[AltPhone] [nvarchar](20) NULL,
	[LicenseNumber] [nvarchar](100) NULL,
	[LicenseExpiry] [date] NULL,
	[ExperienceYears] [smallint] NULL,
	[ConsultationFee] [decimal](10, 2) NULL,
	[FollowUpFee] [decimal](10, 2) NULL,
	[EmergencyFee] [decimal](10, 2) NULL,
	[LanguagesSpoken] [nvarchar](300) NULL,
	[AvailableDays] [nvarchar](100) NULL,
	[AvailableFrom] [time](0) NULL,
	[AvailableTo] [time](0) NULL,
	[MaxDailyPatients] [smallint] NULL,
	[Bio] [nvarchar](max) NULL,
	[Awards] [nvarchar](max) NULL,
	[Publications] [nvarchar](max) NULL,
	[IsAvailable] [bit] NOT NULL,
	[Street1] [nvarchar](255) NULL,
	[Street2] [nvarchar](255) NULL,
	[City] [nvarchar](100) NULL,
	[DistrictId] [int] NULL,
	[StateId] [int] NULL,
	[CountryId] [int] NULL,
	[PincodeId] [int] NULL,
	[PincodeText] [nvarchar](20) NULL,
	[ApprovalStatus] [nvarchar](20) NOT NULL,
	[ApprovedBy] [bigint] NULL,
	[ApprovedAt] [datetime2](0) NULL,
	[RejectionReason] [nvarchar](1000) NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
	[CreatedBy] [bigint] NULL,
	[UpdatedBy] [bigint] NULL,
	[PassportNo] [nvarchar](30) NULL,
	[VoterId] [nvarchar](30) NULL,
	[AbhaNumber] [nvarchar](30) NULL,
	[DoctorId] [nvarchar](30) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[UserId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Departments]    Script Date: 17-03-2026 22:01:35 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Departments](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[HospitalId] [bigint] NOT NULL,
	[Name] [nvarchar](150) NOT NULL,
	[Code] [nvarchar](20) NULL,
	[HeadDoctorId] [bigint] NULL,
	[Description] [nvarchar](1000) NULL,
	[FloorNo] [nvarchar](20) NULL,
	[RoomRange] [nvarchar](50) NULL,
	[PhoneExt] [nvarchar](20) NULL,
	[IsActive] [bit] NOT NULL,
	[Status] [nvarchar](20) NOT NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
	[CreatedBy] [bigint] NOT NULL,
	[UpdatedBy] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_Dept_HospName] UNIQUE NONCLUSTERED 
(
	[HospitalId] ASC,
	[Name] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Specializations]    Script Date: 17-03-2026 22:01:35 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Specializations](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](150) NOT NULL,
	[DepartmentHint] [nvarchar](150) NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
	[CreatedBy] [bigint] NULL,
	[UpdatedBy] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[Name] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Qualifications]    Script Date: 17-03-2026 22:01:35 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Qualifications](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Code] [nvarchar](30) NOT NULL,
	[FullName] [nvarchar](200) NOT NULL,
	[Category] [nvarchar](80) NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
	[CreatedBy] [bigint] NULL,
	[UpdatedBy] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[Code] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  View [dbo].[V_Doctors]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   VIEW [dbo].[V_Doctors] AS
SELECT
    u.Id, u.HospitalId, u.Username, u.Email,
    u.FirstName, u.LastName, u.IsActive,
    dp.ExperienceYears, dp.ConsultationFee,
    dp.LicenseNumber, dp.LicenseExpiry, dp.ApprovalStatus,
    dep.Name  AS DepartmentName,
    sp.Name   AS Specialization,
    q.Code    AS Qualification
FROM dbo.Users u
JOIN dbo.DoctorProfiles dp ON dp.UserId = u.Id
LEFT JOIN dbo.Departments dep ON dep.Id = dp.DepartmentId
LEFT JOIN dbo.Specializations sp ON sp.Id = dp.SpecializationId
LEFT JOIN dbo.Qualifications q ON q.Id = dp.QualificationId
WHERE u.Role = 'doctor' AND u.DeletedAt IS NULL;
GO
/****** Object:  Table [dbo].[States]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[States](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[CountryId] [int] NOT NULL,
	[Name] [nvarchar](120) NOT NULL,
	[Code] [nvarchar](20) NULL,
	[IsActive] [bit] NOT NULL,
	[IsCustom] [bit] NOT NULL,
	[SortOrder] [smallint] NOT NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
	[CreatedBy] [bigint] NULL,
	[UpdatedBy] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_States_CountryName] UNIQUE NONCLUSTERED 
(
	[CountryId] ASC,
	[Name] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Districts]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Districts](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[StateId] [int] NOT NULL,
	[Name] [nvarchar](120) NOT NULL,
	[Headquarter] [nvarchar](120) NULL,
	[IsActive] [bit] NOT NULL,
	[IsCustom] [bit] NOT NULL,
	[CustomNote] [nvarchar](500) NULL,
	[SortOrder] [smallint] NOT NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
	[CreatedBy] [bigint] NULL,
	[UpdatedBy] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_Districts_StateName] UNIQUE NONCLUSTERED 
(
	[StateId] ASC,
	[Name] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PatientProfiles]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PatientProfiles](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[UserId] [bigint] NULL,
	[HospitalId] [bigint] NOT NULL,
	[UHID] [nvarchar](30) NOT NULL,
	[FirstName] [nvarchar](100) NOT NULL,
	[LastName] [nvarchar](100) NOT NULL,
	[Gender] [nvarchar](20) NULL,
	[DateOfBirth] [date] NULL,
	[AgeYears] [smallint] NULL,
	[BloodGroup] [nvarchar](5) NULL,
	[Nationality] [nvarchar](80) NULL,
	[MaritalStatus] [nvarchar](20) NULL,
	[Occupation] [nvarchar](150) NULL,
	[Religion] [nvarchar](80) NULL,
	[MotherTongue] [nvarchar](80) NULL,
	[PhotoUrl] [nvarchar](500) NULL,
	[Phone] [nvarchar](20) NULL,
	[PhoneCountryCode] [nvarchar](10) NOT NULL,
	[AltPhone] [nvarchar](20) NULL,
	[Email] [nvarchar](255) NULL,
	[Aadhaar] [nvarchar](12) NULL,
	[PAN] [nvarchar](10) NULL,
	[PassportNo] [nvarchar](30) NULL,
	[VoterId] [nvarchar](30) NULL,
	[AbhaNumber] [nvarchar](30) NULL,
	[Street1] [nvarchar](255) NULL,
	[Street2] [nvarchar](255) NULL,
	[City] [nvarchar](100) NULL,
	[DistrictId] [int] NULL,
	[StateId] [int] NULL,
	[CountryId] [int] NULL,
	[PincodeId] [int] NULL,
	[PincodeText] [nvarchar](20) NULL,
	[EmergencyName] [nvarchar](200) NULL,
	[EmergencyRelation] [nvarchar](80) NULL,
	[EmergencyPhone] [nvarchar](20) NULL,
	[InsuranceProvider] [nvarchar](200) NULL,
	[InsurancePolicyNo] [nvarchar](100) NULL,
	[InsuranceValidUntil] [date] NULL,
	[KnownAllergies] [nvarchar](max) NULL,
	[ChronicConditions] [nvarchar](max) NULL,
	[CurrentMedications] [nvarchar](max) NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
	[CreatedBy] [bigint] NULL,
	[UpdatedBy] [bigint] NULL,
	[DeletedAt] [datetime2](0) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[UserId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[UHID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  View [dbo].[V_Patients]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   VIEW [dbo].[V_Patients] AS
SELECT
    p.Id, p.HospitalId, p.UHID,
    p.FirstName, p.LastName, p.Gender,
    p.DateOfBirth,
    DATEDIFF(YEAR, p.DateOfBirth, GETDATE()) -
        CASE WHEN DATEADD(YEAR, DATEDIFF(YEAR, p.DateOfBirth, GETDATE()), p.DateOfBirth) > GETDATE() THEN 1 ELSE 0 END AS Age,
    p.BloodGroup, p.Phone, p.Email,
    d.Name  AS DistrictName,
    s.Name  AS StateName,
    p.CreatedAt AS RegisteredAt
FROM dbo.PatientProfiles p
LEFT JOIN dbo.Districts d ON d.Id = p.DistrictId
LEFT JOIN dbo.States s    ON s.Id = p.StateId
WHERE p.DeletedAt IS NULL;
GO
/****** Object:  Table [dbo].[Countries]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Countries](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](100) NOT NULL,
	[Iso2] [char](2) NOT NULL,
	[Iso3] [char](3) NULL,
	[PhoneCode] [nvarchar](10) NULL,
	[CurrencyCode] [nvarchar](10) NULL,
	[CurrencyName] [nvarchar](60) NULL,
	[FlagEmoji] [nvarchar](10) NULL,
	[IsActive] [bit] NOT NULL,
	[SortOrder] [smallint] NOT NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
	[CreatedBy] [bigint] NULL,
	[UpdatedBy] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[Iso2] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Pincodes]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Pincodes](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[DistrictId] [int] NOT NULL,
	[Pincode] [nvarchar](20) NOT NULL,
	[AreaName] [nvarchar](150) NULL,
	[City] [nvarchar](100) NULL,
	[IsActive] [bit] NOT NULL,
	[IsCustom] [bit] NOT NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
	[CreatedBy] [bigint] NULL,
	[UpdatedBy] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_Pincodes_DistrictPin] UNIQUE NONCLUSTERED 
(
	[DistrictId] ASC,
	[Pincode] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  View [dbo].[V_DistrictSummary]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   VIEW [dbo].[V_DistrictSummary] AS
SELECT
    d.Id, d.Name AS District, d.IsCustom,
    s.Name AS State, c.Name AS Country,
    COUNT(p.Id) AS PincodeCount,
    d.IsActive
FROM dbo.Districts d
JOIN dbo.States s    ON s.Id = d.StateId
JOIN dbo.Countries c ON c.Id = s.CountryId
LEFT JOIN dbo.Pincodes p ON p.DistrictId = d.Id AND p.IsActive = 1
GROUP BY d.Id, d.Name, d.IsCustom, s.Name, c.Name, d.IsActive;
GO
/****** Object:  Table [dbo].[DoctorSchedules]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DoctorSchedules](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[HospitalId] [bigint] NOT NULL,
	[DoctorId] [bigint] NOT NULL,
	[OpdRoomId] [bigint] NULL,
	[DayOfWeek] [tinyint] NOT NULL,
	[StartTime] [time](7) NOT NULL,
	[EndTime] [time](7) NOT NULL,
	[SlotDurationMins] [smallint] NOT NULL,
	[MaxSlots] [smallint] NULL,
	[VisitType] [nvarchar](20) NOT NULL,
	[EffectiveFrom] [date] NOT NULL,
	[EffectiveTo] [date] NULL,
	[IsActive] [bit] NOT NULL,
	[Notes] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[CreatedBy] [bigint] NULL,
	[UpdatedBy] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[OpdRooms]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[OpdRooms](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[HospitalId] [bigint] NOT NULL,
	[DepartmentId] [bigint] NOT NULL,
	[RoomNumber] [nvarchar](20) NOT NULL,
	[RoomName] [nvarchar](100) NULL,
	[Floor] [nvarchar](20) NULL,
	[IsActive] [bit] NOT NULL,
	[Notes] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[CreatedBy] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  View [dbo].[V_DoctorScheduleSummary]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[V_DoctorScheduleSummary] AS
SELECT
    ds.Id,
    ds.HospitalId,
    ds.DoctorId,
    u.FirstName + ' ' + u.LastName        AS DoctorName,
    sp.Name                               AS Specialization,
    dep.Name                              AS DepartmentName,
    CASE ds.DayOfWeek
        WHEN 0 THEN 'Sunday'   WHEN 1 THEN 'Monday'
        WHEN 2 THEN 'Tuesday'  WHEN 3 THEN 'Wednesday'
        WHEN 4 THEN 'Thursday' WHEN 5 THEN 'Friday'
        WHEN 6 THEN 'Saturday'
    END                                   AS DayName,
    ds.DayOfWeek,
    ds.StartTime,
    ds.EndTime,
    ds.SlotDurationMins,
    ISNULL(ds.MaxSlots,
        DATEDIFF(MINUTE, ds.StartTime, ds.EndTime) / ds.SlotDurationMins
    )                                     AS ComputedMaxSlots,
    ds.VisitType,
    r.RoomNumber,
    ds.EffectiveFrom,
    ds.EffectiveTo,
    ds.IsActive
FROM dbo.DoctorSchedules ds
JOIN dbo.DoctorProfiles dp       ON dp.Id  = ds.DoctorId
JOIN dbo.Users u                 ON u.Id   = dp.UserId
LEFT JOIN dbo.Specializations sp ON sp.Id  = dp.SpecializationId
LEFT JOIN dbo.Departments dep    ON dep.Id = dp.DepartmentId
LEFT JOIN dbo.OpdRooms r         ON r.Id   = ds.OpdRoomId;
GO
/****** Object:  Table [dbo].[AppointmentSlots]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AppointmentSlots](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[HospitalId] [bigint] NOT NULL,
	[DoctorId] [bigint] NOT NULL,
	[ScheduleId] [bigint] NULL,
	[OpdRoomId] [bigint] NULL,
	[SlotDate] [date] NOT NULL,
	[StartTime] [time](7) NOT NULL,
	[EndTime] [time](7) NOT NULL,
	[VisitType] [nvarchar](20) NOT NULL,
	[Status] [nvarchar](20) NOT NULL,
	[AppointmentId] [bigint] NULL,
	[TokenNumber] [smallint] NULL,
	[IsWalkIn] [bit] NOT NULL,
	[BlockedReason] [nvarchar](200) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  View [dbo].[V_TodaySlotSummary]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
 
 
-- ─────────────────────────────────────────────────────────────
-- VIEW: V_TodaySlotSummary
-- ─────────────────────────────────────────────────────────────
CREATE VIEW [dbo].[V_TodaySlotSummary] AS
SELECT
    s.HospitalId,
    s.DoctorId,
    u.FirstName + ' ' + u.LastName AS DoctorName,
    dep.Name                       AS DepartmentName,
    CAST(GETUTCDATE() AS DATE)     AS SlotDate,
    COUNT(*)                       AS TotalSlots,
    SUM(CASE WHEN s.Status = 'available' THEN 1 ELSE 0 END) AS AvailableSlots,
    SUM(CASE WHEN s.Status = 'booked'    THEN 1 ELSE 0 END) AS BookedSlots,
    SUM(CASE WHEN s.Status = 'blocked'   THEN 1 ELSE 0 END) AS BlockedSlots
FROM dbo.AppointmentSlots s
JOIN dbo.DoctorProfiles dp     ON dp.Id  = s.DoctorId
JOIN dbo.Users u               ON u.Id   = dp.UserId
LEFT JOIN dbo.Departments dep  ON dep.Id = dp.DepartmentId
WHERE s.SlotDate = CAST(GETUTCDATE() AS DATE)
GROUP BY s.HospitalId, s.DoctorId, u.FirstName, u.LastName, dep.Name;
GO
/****** Object:  Table [dbo].[Admissions]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Admissions](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[HospitalId] [bigint] NOT NULL,
	[PatientId] [bigint] NOT NULL,
	[AdmittingDoctorId] [bigint] NULL,
	[WardId] [bigint] NULL,
	[BedId] [bigint] NULL,
	[AdmissionNo] [nvarchar](30) NOT NULL,
	[AdmissionDate] [datetime2](0) NOT NULL,
	[DischargeDate] [datetime2](0) NULL,
	[AdmissionType] [nvarchar](20) NOT NULL,
	[Status] [nvarchar](20) NOT NULL,
	[PrimaryDiagnosis] [nvarchar](max) NULL,
	[IcdCodeId] [bigint] NULL,
	[ReferredBy] [nvarchar](200) NULL,
	[IsMlcCase] [bit] NOT NULL,
	[MlcNumber] [nvarchar](50) NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
	[CreatedBy] [bigint] NULL,
	[UpdatedBy] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[AdmissionNo] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Appointments]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Appointments](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[HospitalId] [bigint] NOT NULL,
	[PatientId] [bigint] NOT NULL,
	[DoctorId] [bigint] NOT NULL,
	[DepartmentId] [bigint] NULL,
	[AppointmentNo] [nvarchar](30) NOT NULL,
	[AppointmentDate] [date] NOT NULL,
	[AppointmentTime] [time](0) NOT NULL,
	[EndTime] [time](0) NULL,
	[VisitType] [nvarchar](20) NOT NULL,
	[Status] [nvarchar](20) NOT NULL,
	[Priority] [nvarchar](20) NOT NULL,
	[Reason] [nvarchar](1000) NULL,
	[Notes] [nvarchar](max) NULL,
	[FollowUpOf] [bigint] NULL,
	[BookedByRole] [nvarchar](30) NULL,
	[BookedByUserId] [bigint] NULL,
	[CancelledBy] [bigint] NULL,
	[CancelledAt] [datetime2](0) NULL,
	[CancelReason] [nvarchar](500) NULL,
	[TokenNumber] [smallint] NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
	[CreatedBy] [bigint] NULL,
	[UpdatedBy] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[AppointmentNo] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AuditLogs]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AuditLogs](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[HospitalId] [bigint] NULL,
	[UserId] [bigint] NULL,
	[UserName] [nvarchar](200) NULL,
	[UserRole] [nvarchar](50) NULL,
	[Action] [nvarchar](30) NOT NULL,
	[TableName] [nvarchar](100) NULL,
	[RecordId] [bigint] NULL,
	[OldValuesJson] [nvarchar](max) NULL,
	[NewValuesJson] [nvarchar](max) NULL,
	[ChangedFields] [nvarchar](max) NULL,
	[Description] [nvarchar](1000) NULL,
	[Module] [nvarchar](80) NULL,
	[IpAddress] [nvarchar](50) NULL,
	[UserAgent] [nvarchar](500) NULL,
	[MachineName] [nvarchar](200) NULL,
	[SessionId] [bigint] NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AuthSessions]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AuthSessions](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[UserId] [bigint] NOT NULL,
	[TokenHash] [nvarchar](max) NOT NULL,
	[DeviceInfo] [nvarchar](500) NULL,
	[IpAddress] [nvarchar](50) NULL,
	[IsActive] [bit] NOT NULL,
	[ExpiresAt] [datetime2](0) NOT NULL,
	[RevokedAt] [datetime2](0) NULL,
	[RevokedReason] [nvarchar](100) NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Beds]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Beds](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[WardId] [bigint] NOT NULL,
	[BedNumber] [nvarchar](20) NOT NULL,
	[BedType] [nvarchar](50) NULL,
	[Status] [nvarchar](20) NOT NULL,
	[DailyRate] [decimal](10, 2) NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
	[CreatedBy] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_Bed_Ward] UNIQUE NONCLUSTERED 
(
	[WardId] ASC,
	[BedNumber] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[BillItems]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[BillItems](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[BillId] [bigint] NOT NULL,
	[ServiceId] [bigint] NULL,
	[Description] [nvarchar](255) NOT NULL,
	[Quantity] [decimal](8, 2) NOT NULL,
	[UnitPrice] [decimal](10, 2) NOT NULL,
	[DiscountPct] [decimal](5, 2) NOT NULL,
	[TaxPct] [decimal](5, 2) NOT NULL,
	[TotalPrice]  AS ((([Quantity]*[UnitPrice])*((1)-[DiscountPct]/(100)))*((1)+[TaxPct]/(100))),
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Bills]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Bills](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[HospitalId] [bigint] NOT NULL,
	[PatientId] [bigint] NOT NULL,
	[AdmissionId] [bigint] NULL,
	[AppointmentId] [bigint] NULL,
	[BillNumber] [nvarchar](30) NOT NULL,
	[BillDate] [date] NOT NULL,
	[BillType] [nvarchar](20) NOT NULL,
	[Subtotal] [decimal](12, 2) NOT NULL,
	[DiscountAmount] [decimal](12, 2) NOT NULL,
	[DiscountReason] [nvarchar](500) NULL,
	[TaxAmount] [decimal](12, 2) NOT NULL,
	[TotalAmount] [decimal](12, 2) NOT NULL,
	[PaidAmount] [decimal](12, 2) NOT NULL,
	[BalanceAmount]  AS ([TotalAmount]-[PaidAmount]),
	[PaymentStatus] [nvarchar](20) NOT NULL,
	[InsuranceClaimed] [bit] NOT NULL,
	[InsuranceAmount] [decimal](12, 2) NOT NULL,
	[Notes] [nvarchar](max) NULL,
	[GeneratedBy] [bigint] NULL,
	[ApprovedBy] [bigint] NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
	[CreatedBy] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[BillNumber] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[DoctorDocuments]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DoctorDocuments](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[DoctorId] [bigint] NOT NULL,
	[DocType] [nvarchar](30) NOT NULL,
	[FileUrl] [nvarchar](500) NOT NULL,
	[FileName] [nvarchar](255) NULL,
	[FileSizeKb] [int] NULL,
	[MimeType] [nvarchar](80) NULL,
	[IsVerified] [bit] NOT NULL,
	[VerifiedBy] [bigint] NULL,
	[VerifiedAt] [datetime2](0) NULL,
	[ExpiryDate] [date] NULL,
	[Notes] [nvarchar](1000) NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[CreatedBy] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[DoctorLeaves]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DoctorLeaves](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[HospitalId] [bigint] NOT NULL,
	[DoctorId] [bigint] NOT NULL,
	[LeaveDate] [date] NOT NULL,
	[LeaveType] [nvarchar](30) NOT NULL,
	[StartTime] [time](7) NULL,
	[EndTime] [time](7) NULL,
	[Reason] [nvarchar](500) NULL,
	[Status] [nvarchar](20) NOT NULL,
	[ApprovedBy] [bigint] NULL,
	[ApprovedAt] [datetime2](7) NULL,
	[RejectionReason] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[CreatedBy] [bigint] NULL,
	[EndDate] [date] NULL,
	[IsEmergency] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[DoctorScheduleBlocks]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DoctorScheduleBlocks](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[DoctorId] [bigint] NOT NULL,
	[HospitalId] [bigint] NOT NULL,
	[BlockType] [nvarchar](20) NOT NULL,
	[DayOfWeek] [tinyint] NOT NULL,
	[StartTime] [nvarchar](8) NOT NULL,
	[EndTime] [nvarchar](8) NOT NULL,
	[Title] [nvarchar](200) NULL,
	[Location] [nvarchar](200) NULL,
	[Notes] [nvarchar](max) NULL,
	[SlotDurationMins] [smallint] NULL,
	[MaxPatients] [smallint] NULL,
	[PatientCount] [smallint] NULL,
	[Recurrence] [nvarchar](20) NOT NULL,
	[EffectiveFrom] [date] NOT NULL,
	[EffectiveTo] [date] NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[CreatedBy] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[HospitalSetup]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[HospitalSetup](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[UniqueCode] [uniqueidentifier] NOT NULL,
	[Name] [nvarchar](300) NOT NULL,
	[ShortName] [nvarchar](100) NULL,
	[RegistrationNumber] [nvarchar](100) NULL,
	[GSTIN] [nvarchar](20) NULL,
	[PAN] [nvarchar](10) NULL,
	[TAN] [nvarchar](10) NULL,
	[Email] [nvarchar](255) NULL,
	[Phone] [nvarchar](20) NULL,
	[AltPhone] [nvarchar](20) NULL,
	[Website] [nvarchar](255) NULL,
	[Fax] [nvarchar](20) NULL,
	[EmergencyNumber] [nvarchar](20) NULL,
	[AmbulanceNumber] [nvarchar](20) NULL,
	[Street1] [nvarchar](255) NULL,
	[Street2] [nvarchar](255) NULL,
	[City] [nvarchar](100) NULL,
	[DistrictId] [int] NULL,
	[StateId] [int] NULL,
	[CountryId] [int] NULL,
	[PincodeId] [int] NULL,
	[PincodeText] [nvarchar](20) NULL,
	[Latitude] [decimal](10, 7) NULL,
	[Longitude] [decimal](10, 7) NULL,
	[LogoUrl] [nvarchar](500) NULL,
	[FaviconUrl] [nvarchar](500) NULL,
	[PrimaryColor] [nvarchar](10) NULL,
	[SecondaryColor] [nvarchar](10) NULL,
	[LetterheadUrl] [nvarchar](500) NULL,
	[Timezone] [nvarchar](80) NOT NULL,
	[CurrencyCode] [nvarchar](10) NOT NULL,
	[DateFormat] [nvarchar](30) NOT NULL,
	[TimeFormat] [nvarchar](10) NOT NULL,
	[FiscalYearStart] [nvarchar](5) NOT NULL,
	[Language] [nvarchar](20) NOT NULL,
	[BedCapacity] [int] NULL,
	[EstablishedYear] [smallint] NULL,
	[Accreditations] [nvarchar](500) NULL,
	[Specialities] [nvarchar](1000) NULL,
	[ModulesEnabled] [nvarchar](500) NULL,
	[LicenseKey] [nvarchar](255) NULL,
	[LicenseValidUntil] [date] NULL,
	[PlanType] [nvarchar](50) NOT NULL,
	[MaxUsers] [int] NOT NULL,
	[Status] [nvarchar](20) NOT NULL,
	[IsDemo] [bit] NOT NULL,
	[ActivatedAt] [datetime2](0) NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[CreatedBy] [bigint] NULL,
	[CreatedByName] [nvarchar](200) NULL,
	[CreatedByRole] [nvarchar](50) NULL,
	[CreatedByIp] [nvarchar](50) NULL,
	[CreatedByUserAgent] [nvarchar](500) NULL,
	[CreatedByMachine] [nvarchar](200) NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
	[UpdatedBy] [bigint] NULL,
	[UpdatedByName] [nvarchar](200) NULL,
	[UpdatedByIp] [nvarchar](50) NULL,
	[UpdatedByMachine] [nvarchar](200) NULL,
	[DeletedAt] [datetime2](0) NULL,
	[DeletedBy] [bigint] NULL,
	[DeletedByName] [nvarchar](200) NULL,
	[DeletedReason] [nvarchar](1000) NULL,
	[Version] [int] NOT NULL,
	[PreviousVersionJson] [nvarchar](max) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[LicenseKey] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[UniqueCode] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[RegistrationNumber] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[IcdCodes]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[IcdCodes](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[Code] [nvarchar](20) NOT NULL,
	[Description] [nvarchar](max) NOT NULL,
	[Category] [nvarchar](100) NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[Code] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[LabOrderItems]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LabOrderItems](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[LabOrderId] [bigint] NOT NULL,
	[TestId] [bigint] NOT NULL,
	[ResultValue] [nvarchar](500) NULL,
	[ResultUnit] [nvarchar](50) NULL,
	[NormalRange] [nvarchar](100) NULL,
	[IsAbnormal] [bit] NULL,
	[Remarks] [nvarchar](max) NULL,
	[Status] [nvarchar](20) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[LabOrders]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LabOrders](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[HospitalId] [bigint] NOT NULL,
	[PatientId] [bigint] NOT NULL,
	[OrderedBy] [bigint] NULL,
	[AppointmentId] [bigint] NULL,
	[AdmissionId] [bigint] NULL,
	[OrderNumber] [nvarchar](30) NOT NULL,
	[OrderDate] [datetime2](0) NOT NULL,
	[Status] [nvarchar](20) NOT NULL,
	[Priority] [nvarchar](20) NOT NULL,
	[Notes] [nvarchar](max) NULL,
	[CollectedAt] [datetime2](0) NULL,
	[CollectedBy] [bigint] NULL,
	[ReportedAt] [datetime2](0) NULL,
	[ReportedBy] [bigint] NULL,
	[VerifiedBy] [bigint] NULL,
	[VerifiedAt] [datetime2](0) NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
	[CreatedBy] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[OrderNumber] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[LabTests]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LabTests](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[ShortName] [nvarchar](50) NULL,
	[Category] [nvarchar](100) NULL,
	[Unit] [nvarchar](50) NULL,
	[NormalRangeMale] [nvarchar](100) NULL,
	[NormalRangeFemale] [nvarchar](100) NULL,
	[NormalRangeChild] [nvarchar](100) NULL,
	[Price] [decimal](10, 2) NULL,
	[TurnaroundHrs] [smallint] NULL,
	[RequiresFasting] [bit] NOT NULL,
	[SampleType] [nvarchar](80) NULL,
	[Instructions] [nvarchar](max) NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
	[CreatedBy] [bigint] NULL,
	[UpdatedBy] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[LookupCategories]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LookupCategories](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[CategoryKey] [nvarchar](80) NOT NULL,
	[Description] [nvarchar](200) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[CategoryKey] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[LookupValues]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LookupValues](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[CategoryKey] [nvarchar](80) NOT NULL,
	[ValueKey] [nvarchar](80) NOT NULL,
	[DisplayLabel] [nvarchar](150) NOT NULL,
	[SortOrder] [smallint] NOT NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_LookupValues] UNIQUE NONCLUSTERED 
(
	[CategoryKey] ASC,
	[ValueKey] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MedicalCouncils]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MedicalCouncils](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[ShortName] [nvarchar](50) NULL,
	[CountryId] [int] NULL,
	[StateId] [int] NULL,
	[WebsiteUrl] [nvarchar](255) NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
	[CreatedBy] [bigint] NULL,
	[UpdatedBy] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[Name] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Medicines]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Medicines](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[GenericName] [nvarchar](200) NULL,
	[BrandName] [nvarchar](200) NULL,
	[Category] [nvarchar](100) NULL,
	[DosageForm] [nvarchar](80) NULL,
	[Strength] [nvarchar](80) NULL,
	[Unit] [nvarchar](40) NULL,
	[Manufacturer] [nvarchar](200) NULL,
	[Composition] [nvarchar](max) NULL,
	[HsnCode] [nvarchar](20) NULL,
	[GstPercent] [decimal](5, 2) NOT NULL,
	[IsScheduleH] [bit] NOT NULL,
	[IsNarcotic] [bit] NOT NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
	[CreatedBy] [bigint] NULL,
	[UpdatedBy] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Notifications]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Notifications](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[HospitalId] [bigint] NULL,
	[UserId] [bigint] NOT NULL,
	[NotifType] [nvarchar](30) NOT NULL,
	[Title] [nvarchar](255) NOT NULL,
	[Body] [nvarchar](max) NULL,
	[DataJson] [nvarchar](max) NULL,
	[IsRead] [bit] NOT NULL,
	[ReadAt] [datetime2](0) NULL,
	[Link] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[OpdQueue]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[OpdQueue](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[HospitalId] [bigint] NOT NULL,
	[DoctorId] [bigint] NOT NULL,
	[AppointmentId] [bigint] NULL,
	[SlotId] [bigint] NULL,
	[QueueDate] [date] NOT NULL,
	[TokenNumber] [smallint] NOT NULL,
	[PatientId] [bigint] NULL,
	[PatientName] [nvarchar](200) NULL,
	[QueueStatus] [nvarchar](20) NOT NULL,
	[CalledAt] [datetime2](7) NULL,
	[ServedAt] [datetime2](7) NULL,
	[WaitMinutes] [smallint] NULL,
	[Priority] [nvarchar](20) NOT NULL,
	[Notes] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[OtpTokens]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[OtpTokens](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[UserId] [bigint] NULL,
	[Contact] [nvarchar](255) NOT NULL,
	[ContactType] [nvarchar](10) NOT NULL,
	[Purpose] [nvarchar](30) NOT NULL,
	[OtpHash] [nvarchar](max) NOT NULL,
	[Attempts] [smallint] NOT NULL,
	[MaxAttempts] [smallint] NOT NULL,
	[IsVerified] [bit] NOT NULL,
	[ExpiresAt] [datetime2](0) NOT NULL,
	[VerifiedAt] [datetime2](0) NULL,
	[IpAddress] [nvarchar](50) NULL,
	[UserAgent] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[OtpVerifications]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[OtpVerifications](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[UserId] [bigint] NOT NULL,
	[Contact] [nvarchar](255) NOT NULL,
	[ContactType] [nvarchar](10) NOT NULL,
	[OtpHash] [nvarchar](255) NOT NULL,
	[Purpose] [nvarchar](50) NOT NULL,
	[Attempts] [int] NOT NULL,
	[IpAddress] [nvarchar](45) NULL,
	[ExpiresAt] [datetime] NOT NULL,
	[VerifiedAt] [datetime] NULL,
	[UsedAt] [datetime] NULL,
	[CreatedAt] [datetime] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Payments]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Payments](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[BillId] [bigint] NOT NULL,
	[Amount] [decimal](12, 2) NOT NULL,
	[Method] [nvarchar](20) NOT NULL,
	[TransactionRef] [nvarchar](100) NULL,
	[PaidAt] [datetime2](0) NOT NULL,
	[ReceivedBy] [bigint] NULL,
	[Notes] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PharmacyInventory]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PharmacyInventory](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[HospitalId] [bigint] NOT NULL,
	[MedicineId] [bigint] NOT NULL,
	[BatchNumber] [nvarchar](80) NULL,
	[ExpiryDate] [date] NULL,
	[Quantity] [int] NOT NULL,
	[ReorderLevel] [int] NOT NULL,
	[PurchasePrice] [decimal](10, 2) NULL,
	[SalePrice] [decimal](10, 2) NULL,
	[RackLocation] [nvarchar](50) NULL,
	[Supplier] [nvarchar](200) NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
	[CreatedBy] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PrescriptionItems]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PrescriptionItems](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[PrescriptionId] [bigint] NOT NULL,
	[MedicineId] [bigint] NULL,
	[MedicineName] [nvarchar](200) NULL,
	[Dosage] [nvarchar](100) NULL,
	[Frequency] [nvarchar](100) NULL,
	[Duration] [nvarchar](80) NULL,
	[Quantity] [smallint] NULL,
	[Route] [nvarchar](60) NULL,
	[Instructions] [nvarchar](max) NULL,
	[IsDispensed] [bit] NOT NULL,
	[DispensedAt] [datetime2](0) NULL,
	[DispensedBy] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Prescriptions]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Prescriptions](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[HospitalId] [bigint] NOT NULL,
	[PatientId] [bigint] NOT NULL,
	[DoctorId] [bigint] NOT NULL,
	[AppointmentId] [bigint] NULL,
	[AdmissionId] [bigint] NULL,
	[RxNumber] [nvarchar](30) NOT NULL,
	[RxDate] [date] NOT NULL,
	[Status] [nvarchar](20) NOT NULL,
	[Diagnosis] [nvarchar](max) NULL,
	[Notes] [nvarchar](max) NULL,
	[ValidUntil] [date] NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
	[CreatedBy] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[RxNumber] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Services]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Services](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[HospitalId] [bigint] NOT NULL,
	[DepartmentId] [bigint] NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Code] [nvarchar](50) NULL,
	[Category] [nvarchar](100) NULL,
	[Price] [decimal](10, 2) NOT NULL,
	[GstPercent] [decimal](5, 2) NOT NULL,
	[Description] [nvarchar](max) NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
	[CreatedBy] [bigint] NOT NULL,
	[UpdatedBy] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SetupChangeLog]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SetupChangeLog](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[HospitalId] [bigint] NULL,
	[TableName] [nvarchar](100) NOT NULL,
	[RecordId] [bigint] NOT NULL,
	[Action] [nvarchar](20) NOT NULL,
	[OldValuesJson] [nvarchar](max) NULL,
	[NewValuesJson] [nvarchar](max) NULL,
	[ChangeReason] [nvarchar](500) NULL,
	[RequestedBy] [bigint] NULL,
	[RequestedAt] [datetime2](0) NOT NULL,
	[ApprovedBy] [bigint] NULL,
	[ApprovedAt] [datetime2](0) NULL,
	[IpAddress] [nvarchar](50) NULL,
	[MachineName] [nvarchar](200) NULL,
	[UserAgent] [nvarchar](500) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[StaffLeaves]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[StaffLeaves](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[HospitalId] [bigint] NOT NULL,
	[StaffId] [bigint] NOT NULL,
	[LeaveDate] [date] NOT NULL,
	[LeaveType] [nvarchar](30) NOT NULL,
	[StartTime] [time](7) NULL,
	[EndTime] [time](7) NULL,
	[Reason] [nvarchar](500) NULL,
	[Status] [nvarchar](20) NOT NULL,
	[ApprovedBy] [bigint] NULL,
	[ApprovedAt] [datetime2](7) NULL,
	[RejectionReason] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[CreatedBy] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[StaffProfiles]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[StaffProfiles](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[UserId] [bigint] NOT NULL,
	[HospitalId] [bigint] NOT NULL,
	[DepartmentId] [bigint] NULL,
	[EmployeeId] [nvarchar](60) NULL,
	[Designation] [nvarchar](150) NULL,
	[Shift] [nvarchar](20) NULL,
	[JoiningDate] [date] NULL,
	[ConfirmationDate] [date] NULL,
	[SalaryGrade] [nvarchar](20) NULL,
	[Aadhaar] [nvarchar](12) NULL,
	[PAN] [nvarchar](10) NULL,
	[BloodGroup] [nvarchar](5) NULL,
	[EmergencyContactName] [nvarchar](200) NULL,
	[EmergencyContactPhone] [nvarchar](20) NULL,
	[Street1] [nvarchar](255) NULL,
	[City] [nvarchar](100) NULL,
	[DistrictId] [int] NULL,
	[StateId] [int] NULL,
	[PincodeId] [int] NULL,
	[PincodeText] [nvarchar](20) NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
	[CreatedBy] [bigint] NULL,
	[UpdatedBy] [bigint] NULL,
	[Role] [nvarchar](50) NULL,
	[Qualification] [nvarchar](200) NULL,
	[ContractType] [nvarchar](30) NULL,
	[ReportingManager] [nvarchar](150) NULL,
	[WorkStartTime] [time](7) NULL,
	[WorkEndTime] [time](7) NULL,
	[WeeklyOff] [nvarchar](100) NULL,
	[Nationality] [nvarchar](80) NULL,
	[AltPhone] [nvarchar](20) NULL,
	[PassportNo] [nvarchar](30) NULL,
	[VoterId] [nvarchar](30) NULL,
	[AbhaNumber] [nvarchar](30) NULL,
	[Street2] [nvarchar](255) NULL,
	[CountryId] [int] NULL,
	[LanguagesSpoken] [nvarchar](300) NULL,
	[PreviousEmployer] [nvarchar](200) NULL,
	[ExperienceYears] [smallint] NULL,
	[BankAccountNo] [nvarchar](30) NULL,
	[IfscCode] [nvarchar](15) NULL,
	[KnownAllergies] [nvarchar](max) NULL,
	[BloodDonor] [nvarchar](10) NULL,
	[MaritalStatus] [nvarchar](20) NULL,
	[Religion] [nvarchar](80) NULL,
	[MotherTongue] [nvarchar](80) NULL,
	[EmergencyName] [nvarchar](200) NULL,
	[EmergencyRelation] [nvarchar](80) NULL,
	[EmergencyPhone] [nvarchar](20) NULL,
	[ApprovalStatus] [nvarchar](20) NOT NULL,
	[ApprovedBy] [bigint] NULL,
	[ApprovedAt] [datetime2](7) NULL,
	[RejectionReason] [nvarchar](1000) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[UserId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[StaffSchedules]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[StaffSchedules](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[HospitalId] [bigint] NOT NULL,
	[StaffId] [bigint] NOT NULL,
	[DayOfWeek] [tinyint] NOT NULL,
	[ShiftType] [nvarchar](20) NOT NULL,
	[StartTime] [time](7) NOT NULL,
	[EndTime] [time](7) NOT NULL,
	[BreakStartTime] [time](7) NULL,
	[BreakEndTime] [time](7) NULL,
	[EffectiveFrom] [date] NOT NULL,
	[EffectiveTo] [date] NULL,
	[IsActive] [bit] NOT NULL,
	[Notes] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[CreatedBy] [bigint] NULL,
	[UpdatedBy] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Wards]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Wards](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[HospitalId] [bigint] NOT NULL,
	[Name] [nvarchar](100) NOT NULL,
	[WardType] [nvarchar](30) NULL,
	[Floor] [nvarchar](20) NULL,
	[Capacity] [smallint] NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[CreatedBy] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Index [IX_Appts_DoctorDate]    Script Date: 17-03-2026 22:01:36 ******/
CREATE NONCLUSTERED INDEX [IX_Appts_DoctorDate] ON [dbo].[Appointments]
(
	[DoctorId] ASC,
	[AppointmentDate] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Appts_Patient]    Script Date: 17-03-2026 22:01:36 ******/
CREATE NONCLUSTERED INDEX [IX_Appts_Patient] ON [dbo].[Appointments]
(
	[PatientId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_AppointmentSlots_Appointment]    Script Date: 17-03-2026 22:01:36 ******/
CREATE NONCLUSTERED INDEX [IX_AppointmentSlots_Appointment] ON [dbo].[AppointmentSlots]
(
	[AppointmentId] ASC
)
WHERE ([AppointmentId] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_AppointmentSlots_Date]    Script Date: 17-03-2026 22:01:36 ******/
CREATE NONCLUSTERED INDEX [IX_AppointmentSlots_Date] ON [dbo].[AppointmentSlots]
(
	[HospitalId] ASC,
	[SlotDate] ASC,
	[Status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [UQ_AppointmentSlots_Slot]    Script Date: 17-03-2026 22:01:36 ******/
CREATE UNIQUE NONCLUSTERED INDEX [UQ_AppointmentSlots_Slot] ON [dbo].[AppointmentSlots]
(
	[DoctorId] ASC,
	[SlotDate] ASC,
	[StartTime] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_AuditLogs_Hospital]    Script Date: 17-03-2026 22:01:36 ******/
CREATE NONCLUSTERED INDEX [IX_AuditLogs_Hospital] ON [dbo].[AuditLogs]
(
	[HospitalId] ASC,
	[CreatedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_AuditLogs_Table]    Script Date: 17-03-2026 22:01:36 ******/
CREATE NONCLUSTERED INDEX [IX_AuditLogs_Table] ON [dbo].[AuditLogs]
(
	[TableName] ASC,
	[RecordId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_AuditLogs_User]    Script Date: 17-03-2026 22:01:36 ******/
CREATE NONCLUSTERED INDEX [IX_AuditLogs_User] ON [dbo].[AuditLogs]
(
	[UserId] ASC,
	[CreatedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_AuthSessions_User]    Script Date: 17-03-2026 22:01:36 ******/
CREATE NONCLUSTERED INDEX [IX_AuthSessions_User] ON [dbo].[AuthSessions]
(
	[UserId] ASC,
	[IsActive] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_DoctorLeaves_Doctor]    Script Date: 17-03-2026 22:01:36 ******/
CREATE NONCLUSTERED INDEX [IX_DoctorLeaves_Doctor] ON [dbo].[DoctorLeaves]
(
	[DoctorId] ASC,
	[LeaveDate] ASC,
	[Status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UQ_DoctorProfiles_DoctorId]    Script Date: 17-03-2026 22:01:36 ******/
CREATE UNIQUE NONCLUSTERED INDEX [UQ_DoctorProfiles_DoctorId] ON [dbo].[DoctorProfiles]
(
	[DoctorId] ASC
)
WHERE ([DoctorId] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_DoctorScheduleBlocks_Doctor_Day]    Script Date: 17-03-2026 22:01:36 ******/
CREATE NONCLUSTERED INDEX [IX_DoctorScheduleBlocks_Doctor_Day] ON [dbo].[DoctorScheduleBlocks]
(
	[DoctorId] ASC,
	[DayOfWeek] ASC
)
WHERE ([IsActive]=(1))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_DoctorScheduleBlocks_Hospital]    Script Date: 17-03-2026 22:01:36 ******/
CREATE NONCLUSTERED INDEX [IX_DoctorScheduleBlocks_Hospital] ON [dbo].[DoctorScheduleBlocks]
(
	[HospitalId] ASC,
	[DayOfWeek] ASC
)
WHERE ([IsActive]=(1))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_DoctorSchedules_Doctor]    Script Date: 17-03-2026 22:01:36 ******/
CREATE NONCLUSTERED INDEX [IX_DoctorSchedules_Doctor] ON [dbo].[DoctorSchedules]
(
	[DoctorId] ASC,
	[DayOfWeek] ASC,
	[IsActive] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_IcdCodes_Code]    Script Date: 17-03-2026 22:01:36 ******/
CREATE NONCLUSTERED INDEX [IX_IcdCodes_Code] ON [dbo].[IcdCodes]
(
	[Code] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Notif_User]    Script Date: 17-03-2026 22:01:36 ******/
CREATE NONCLUSTERED INDEX [IX_Notif_User] ON [dbo].[Notifications]
(
	[UserId] ASC,
	[IsRead] ASC,
	[CreatedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_OpdQueue_Date]    Script Date: 17-03-2026 22:01:36 ******/
CREATE NONCLUSTERED INDEX [IX_OpdQueue_Date] ON [dbo].[OpdQueue]
(
	[HospitalId] ASC,
	[QueueDate] ASC,
	[QueueStatus] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [UQ_OpdQueue_Token]    Script Date: 17-03-2026 22:01:36 ******/
CREATE UNIQUE NONCLUSTERED INDEX [UQ_OpdQueue_Token] ON [dbo].[OpdQueue]
(
	[DoctorId] ASC,
	[QueueDate] ASC,
	[TokenNumber] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UQ_OpdRooms_HospRoom]    Script Date: 17-03-2026 22:01:36 ******/
CREATE UNIQUE NONCLUSTERED INDEX [UQ_OpdRooms_HospRoom] ON [dbo].[OpdRooms]
(
	[HospitalId] ASC,
	[RoomNumber] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_OtpTokens_Contact]    Script Date: 17-03-2026 22:01:36 ******/
CREATE NONCLUSTERED INDEX [IX_OtpTokens_Contact] ON [dbo].[OtpTokens]
(
	[Contact] ASC,
	[Purpose] ASC,
	[IsVerified] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_OtpTokens_UserId]    Script Date: 17-03-2026 22:01:36 ******/
CREATE NONCLUSTERED INDEX [IX_OtpTokens_UserId] ON [dbo].[OtpTokens]
(
	[UserId] ASC,
	[Purpose] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_OtpVerifications_Contact_Purpose]    Script Date: 17-03-2026 22:01:36 ******/
CREATE NONCLUSTERED INDEX [IX_OtpVerifications_Contact_Purpose] ON [dbo].[OtpVerifications]
(
	[Contact] ASC,
	[Purpose] ASC
)
INCLUDE([OtpHash],[ExpiresAt],[UsedAt],[Attempts]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_OtpVerifications_UserId]    Script Date: 17-03-2026 22:01:36 ******/
CREATE NONCLUSTERED INDEX [IX_OtpVerifications_UserId] ON [dbo].[OtpVerifications]
(
	[UserId] ASC
)
INCLUDE([Purpose],[UsedAt],[ExpiresAt]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Patients_Aadhaar]    Script Date: 17-03-2026 22:01:36 ******/
CREATE NONCLUSTERED INDEX [IX_Patients_Aadhaar] ON [dbo].[PatientProfiles]
(
	[Aadhaar] ASC
)
WHERE ([Aadhaar] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Patients_Hospital]    Script Date: 17-03-2026 22:01:36 ******/
CREATE NONCLUSTERED INDEX [IX_Patients_Hospital] ON [dbo].[PatientProfiles]
(
	[HospitalId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Patients_Phone]    Script Date: 17-03-2026 22:01:36 ******/
CREATE NONCLUSTERED INDEX [IX_Patients_Phone] ON [dbo].[PatientProfiles]
(
	[Phone] ASC
)
WHERE ([Phone] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Patients_UHID]    Script Date: 17-03-2026 22:01:36 ******/
CREATE NONCLUSTERED INDEX [IX_Patients_UHID] ON [dbo].[PatientProfiles]
(
	[UHID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Pincodes_DistrictId]    Script Date: 17-03-2026 22:01:36 ******/
CREATE NONCLUSTERED INDEX [IX_Pincodes_DistrictId] ON [dbo].[Pincodes]
(
	[DistrictId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Pincodes_Pincode]    Script Date: 17-03-2026 22:01:36 ******/
CREATE NONCLUSTERED INDEX [IX_Pincodes_Pincode] ON [dbo].[Pincodes]
(
	[Pincode] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_SetupLog_Table]    Script Date: 17-03-2026 22:01:36 ******/
CREATE NONCLUSTERED INDEX [IX_SetupLog_Table] ON [dbo].[SetupChangeLog]
(
	[TableName] ASC,
	[RecordId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_StaffLeaves_Staff]    Script Date: 17-03-2026 22:01:36 ******/
CREATE NONCLUSTERED INDEX [IX_StaffLeaves_Staff] ON [dbo].[StaffLeaves]
(
	[StaffId] ASC,
	[LeaveDate] ASC,
	[Status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_StaffSchedules_Staff]    Script Date: 17-03-2026 22:01:36 ******/
CREATE NONCLUSTERED INDEX [IX_StaffSchedules_Staff] ON [dbo].[StaffSchedules]
(
	[StaffId] ASC,
	[DayOfWeek] ASC,
	[IsActive] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Users_HospitalId]    Script Date: 17-03-2026 22:01:36 ******/
CREATE NONCLUSTERED INDEX [IX_Users_HospitalId] ON [dbo].[Users]
(
	[HospitalId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Users_Role]    Script Date: 17-03-2026 22:01:36 ******/
CREATE NONCLUSTERED INDEX [IX_Users_Role] ON [dbo].[Users]
(
	[Role] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UQ_Users_Email]    Script Date: 17-03-2026 22:01:36 ******/
CREATE UNIQUE NONCLUSTERED INDEX [UQ_Users_Email] ON [dbo].[Users]
(
	[Email] ASC
)
WHERE ([Email] IS NOT NULL AND [DeletedAt] IS NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UQ_Users_Phone]    Script Date: 17-03-2026 22:01:36 ******/
CREATE UNIQUE NONCLUSTERED INDEX [UQ_Users_Phone] ON [dbo].[Users]
(
	[Phone] ASC
)
WHERE ([Phone] IS NOT NULL AND [DeletedAt] IS NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
ALTER TABLE [dbo].[Admissions] ADD  DEFAULT ('IPD') FOR [AdmissionType]
GO
ALTER TABLE [dbo].[Admissions] ADD  DEFAULT ('Active') FOR [Status]
GO
ALTER TABLE [dbo].[Admissions] ADD  DEFAULT ((0)) FOR [IsMlcCase]
GO
ALTER TABLE [dbo].[Admissions] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Admissions] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[Appointments] ADD  DEFAULT ('OPD') FOR [VisitType]
GO
ALTER TABLE [dbo].[Appointments] ADD  DEFAULT ('Scheduled') FOR [Status]
GO
ALTER TABLE [dbo].[Appointments] ADD  DEFAULT ('Normal') FOR [Priority]
GO
ALTER TABLE [dbo].[Appointments] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Appointments] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[AppointmentSlots] ADD  DEFAULT ('opd') FOR [VisitType]
GO
ALTER TABLE [dbo].[AppointmentSlots] ADD  DEFAULT ('available') FOR [Status]
GO
ALTER TABLE [dbo].[AppointmentSlots] ADD  DEFAULT ((0)) FOR [IsWalkIn]
GO
ALTER TABLE [dbo].[AppointmentSlots] ADD  DEFAULT (getutcdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[AppointmentSlots] ADD  DEFAULT (getutcdate()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[AuditLogs] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[AuthSessions] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[AuthSessions] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Beds] ADD  DEFAULT ('Available') FOR [Status]
GO
ALTER TABLE [dbo].[Beds] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Beds] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Beds] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[BillItems] ADD  DEFAULT ((1)) FOR [Quantity]
GO
ALTER TABLE [dbo].[BillItems] ADD  DEFAULT ((0)) FOR [DiscountPct]
GO
ALTER TABLE [dbo].[BillItems] ADD  DEFAULT ((0)) FOR [TaxPct]
GO
ALTER TABLE [dbo].[Bills] ADD  DEFAULT (CONVERT([date],getdate())) FOR [BillDate]
GO
ALTER TABLE [dbo].[Bills] ADD  DEFAULT ('OPD') FOR [BillType]
GO
ALTER TABLE [dbo].[Bills] ADD  DEFAULT ((0)) FOR [Subtotal]
GO
ALTER TABLE [dbo].[Bills] ADD  DEFAULT ((0)) FOR [DiscountAmount]
GO
ALTER TABLE [dbo].[Bills] ADD  DEFAULT ((0)) FOR [TaxAmount]
GO
ALTER TABLE [dbo].[Bills] ADD  DEFAULT ((0)) FOR [TotalAmount]
GO
ALTER TABLE [dbo].[Bills] ADD  DEFAULT ((0)) FOR [PaidAmount]
GO
ALTER TABLE [dbo].[Bills] ADD  DEFAULT ('Pending') FOR [PaymentStatus]
GO
ALTER TABLE [dbo].[Bills] ADD  DEFAULT ((0)) FOR [InsuranceClaimed]
GO
ALTER TABLE [dbo].[Bills] ADD  DEFAULT ((0)) FOR [InsuranceAmount]
GO
ALTER TABLE [dbo].[Bills] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Bills] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[Countries] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Countries] ADD  DEFAULT ((999)) FOR [SortOrder]
GO
ALTER TABLE [dbo].[Countries] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Countries] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[Departments] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Departments] ADD  DEFAULT ('active') FOR [Status]
GO
ALTER TABLE [dbo].[Departments] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Departments] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[Districts] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Districts] ADD  DEFAULT ((0)) FOR [IsCustom]
GO
ALTER TABLE [dbo].[Districts] ADD  DEFAULT ((999)) FOR [SortOrder]
GO
ALTER TABLE [dbo].[Districts] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Districts] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[DoctorDocuments] ADD  DEFAULT ((0)) FOR [IsVerified]
GO
ALTER TABLE [dbo].[DoctorDocuments] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[DoctorLeaves] ADD  DEFAULT ('full_day') FOR [LeaveType]
GO
ALTER TABLE [dbo].[DoctorLeaves] ADD  DEFAULT ('pending') FOR [Status]
GO
ALTER TABLE [dbo].[DoctorLeaves] ADD  DEFAULT (getutcdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[DoctorLeaves] ADD  DEFAULT (getutcdate()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[DoctorLeaves] ADD  DEFAULT ((0)) FOR [IsEmergency]
GO
ALTER TABLE [dbo].[DoctorProfiles] ADD  DEFAULT ('Indian') FOR [Nationality]
GO
ALTER TABLE [dbo].[DoctorProfiles] ADD  DEFAULT ((1)) FOR [IsAvailable]
GO
ALTER TABLE [dbo].[DoctorProfiles] ADD  DEFAULT ('pending') FOR [ApprovalStatus]
GO
ALTER TABLE [dbo].[DoctorProfiles] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[DoctorProfiles] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[DoctorScheduleBlocks] ADD  DEFAULT ('opd') FOR [BlockType]
GO
ALTER TABLE [dbo].[DoctorScheduleBlocks] ADD  DEFAULT ('weekly') FOR [Recurrence]
GO
ALTER TABLE [dbo].[DoctorScheduleBlocks] ADD  DEFAULT (CONVERT([date],getutcdate())) FOR [EffectiveFrom]
GO
ALTER TABLE [dbo].[DoctorScheduleBlocks] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[DoctorScheduleBlocks] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[DoctorScheduleBlocks] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[DoctorSchedules] ADD  DEFAULT ((15)) FOR [SlotDurationMins]
GO
ALTER TABLE [dbo].[DoctorSchedules] ADD  DEFAULT ('opd') FOR [VisitType]
GO
ALTER TABLE [dbo].[DoctorSchedules] ADD  DEFAULT (CONVERT([date],getutcdate())) FOR [EffectiveFrom]
GO
ALTER TABLE [dbo].[DoctorSchedules] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[DoctorSchedules] ADD  DEFAULT (getutcdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[DoctorSchedules] ADD  DEFAULT (getutcdate()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[HospitalSetup] ADD  DEFAULT (newid()) FOR [UniqueCode]
GO
ALTER TABLE [dbo].[HospitalSetup] ADD  DEFAULT ((1)) FOR [CountryId]
GO
ALTER TABLE [dbo].[HospitalSetup] ADD  DEFAULT ('#6d28d9') FOR [PrimaryColor]
GO
ALTER TABLE [dbo].[HospitalSetup] ADD  DEFAULT ('#1d4ed8') FOR [SecondaryColor]
GO
ALTER TABLE [dbo].[HospitalSetup] ADD  DEFAULT ('Asia/Kolkata') FOR [Timezone]
GO
ALTER TABLE [dbo].[HospitalSetup] ADD  DEFAULT ('INR') FOR [CurrencyCode]
GO
ALTER TABLE [dbo].[HospitalSetup] ADD  DEFAULT ('DD/MM/YYYY') FOR [DateFormat]
GO
ALTER TABLE [dbo].[HospitalSetup] ADD  DEFAULT ('12h') FOR [TimeFormat]
GO
ALTER TABLE [dbo].[HospitalSetup] ADD  DEFAULT ('04-01') FOR [FiscalYearStart]
GO
ALTER TABLE [dbo].[HospitalSetup] ADD  DEFAULT ('en') FOR [Language]
GO
ALTER TABLE [dbo].[HospitalSetup] ADD  DEFAULT ('standard') FOR [PlanType]
GO
ALTER TABLE [dbo].[HospitalSetup] ADD  DEFAULT ((50)) FOR [MaxUsers]
GO
ALTER TABLE [dbo].[HospitalSetup] ADD  DEFAULT ('active') FOR [Status]
GO
ALTER TABLE [dbo].[HospitalSetup] ADD  DEFAULT ((0)) FOR [IsDemo]
GO
ALTER TABLE [dbo].[HospitalSetup] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[HospitalSetup] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[HospitalSetup] ADD  DEFAULT ((1)) FOR [Version]
GO
ALTER TABLE [dbo].[IcdCodes] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[IcdCodes] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[LabOrderItems] ADD  DEFAULT ('Pending') FOR [Status]
GO
ALTER TABLE [dbo].[LabOrders] ADD  DEFAULT (sysutcdatetime()) FOR [OrderDate]
GO
ALTER TABLE [dbo].[LabOrders] ADD  DEFAULT ('Pending') FOR [Status]
GO
ALTER TABLE [dbo].[LabOrders] ADD  DEFAULT ('Routine') FOR [Priority]
GO
ALTER TABLE [dbo].[LabOrders] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[LabOrders] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[LabTests] ADD  DEFAULT ((0)) FOR [RequiresFasting]
GO
ALTER TABLE [dbo].[LabTests] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[LabTests] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[LabTests] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[LookupValues] ADD  DEFAULT ((999)) FOR [SortOrder]
GO
ALTER TABLE [dbo].[LookupValues] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[LookupValues] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[MedicalCouncils] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[MedicalCouncils] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[MedicalCouncils] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[Medicines] ADD  DEFAULT ((0)) FOR [GstPercent]
GO
ALTER TABLE [dbo].[Medicines] ADD  DEFAULT ((0)) FOR [IsScheduleH]
GO
ALTER TABLE [dbo].[Medicines] ADD  DEFAULT ((0)) FOR [IsNarcotic]
GO
ALTER TABLE [dbo].[Medicines] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Medicines] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Medicines] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[Notifications] ADD  DEFAULT ((0)) FOR [IsRead]
GO
ALTER TABLE [dbo].[Notifications] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[OpdQueue] ADD  DEFAULT (CONVERT([date],getutcdate())) FOR [QueueDate]
GO
ALTER TABLE [dbo].[OpdQueue] ADD  DEFAULT ('waiting') FOR [QueueStatus]
GO
ALTER TABLE [dbo].[OpdQueue] ADD  DEFAULT ('normal') FOR [Priority]
GO
ALTER TABLE [dbo].[OpdQueue] ADD  DEFAULT (getutcdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[OpdQueue] ADD  DEFAULT (getutcdate()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[OpdRooms] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[OpdRooms] ADD  DEFAULT (getutcdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[OpdRooms] ADD  DEFAULT (getutcdate()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[OtpTokens] ADD  DEFAULT ((0)) FOR [Attempts]
GO
ALTER TABLE [dbo].[OtpTokens] ADD  DEFAULT ((5)) FOR [MaxAttempts]
GO
ALTER TABLE [dbo].[OtpTokens] ADD  DEFAULT ((0)) FOR [IsVerified]
GO
ALTER TABLE [dbo].[OtpTokens] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[OtpVerifications] ADD  DEFAULT ('email') FOR [ContactType]
GO
ALTER TABLE [dbo].[OtpVerifications] ADD  DEFAULT ('password_reset') FOR [Purpose]
GO
ALTER TABLE [dbo].[OtpVerifications] ADD  DEFAULT ((0)) FOR [Attempts]
GO
ALTER TABLE [dbo].[OtpVerifications] ADD  DEFAULT (getutcdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[PatientProfiles] ADD  DEFAULT ('+91') FOR [PhoneCountryCode]
GO
ALTER TABLE [dbo].[PatientProfiles] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[PatientProfiles] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[Payments] ADD  DEFAULT (sysutcdatetime()) FOR [PaidAt]
GO
ALTER TABLE [dbo].[Payments] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[PharmacyInventory] ADD  DEFAULT ((0)) FOR [Quantity]
GO
ALTER TABLE [dbo].[PharmacyInventory] ADD  DEFAULT ((10)) FOR [ReorderLevel]
GO
ALTER TABLE [dbo].[PharmacyInventory] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[PharmacyInventory] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[Pincodes] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Pincodes] ADD  DEFAULT ((0)) FOR [IsCustom]
GO
ALTER TABLE [dbo].[Pincodes] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Pincodes] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[PrescriptionItems] ADD  DEFAULT ((0)) FOR [IsDispensed]
GO
ALTER TABLE [dbo].[Prescriptions] ADD  DEFAULT (CONVERT([date],getdate())) FOR [RxDate]
GO
ALTER TABLE [dbo].[Prescriptions] ADD  DEFAULT ('Active') FOR [Status]
GO
ALTER TABLE [dbo].[Prescriptions] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Prescriptions] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[Qualifications] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Qualifications] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Qualifications] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[Services] ADD  DEFAULT ((0)) FOR [Price]
GO
ALTER TABLE [dbo].[Services] ADD  DEFAULT ((0)) FOR [GstPercent]
GO
ALTER TABLE [dbo].[Services] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Services] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Services] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[SetupChangeLog] ADD  DEFAULT (sysutcdatetime()) FOR [RequestedAt]
GO
ALTER TABLE [dbo].[Specializations] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Specializations] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Specializations] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[StaffLeaves] ADD  DEFAULT ('full_day') FOR [LeaveType]
GO
ALTER TABLE [dbo].[StaffLeaves] ADD  DEFAULT ('pending') FOR [Status]
GO
ALTER TABLE [dbo].[StaffLeaves] ADD  DEFAULT (getutcdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[StaffLeaves] ADD  DEFAULT (getutcdate()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[StaffProfiles] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[StaffProfiles] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[StaffProfiles] ADD  DEFAULT ('pending') FOR [ApprovalStatus]
GO
ALTER TABLE [dbo].[StaffSchedules] ADD  DEFAULT ('morning') FOR [ShiftType]
GO
ALTER TABLE [dbo].[StaffSchedules] ADD  DEFAULT (CONVERT([date],getutcdate())) FOR [EffectiveFrom]
GO
ALTER TABLE [dbo].[StaffSchedules] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[StaffSchedules] ADD  DEFAULT (getutcdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[StaffSchedules] ADD  DEFAULT (getutcdate()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[States] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[States] ADD  DEFAULT ((0)) FOR [IsCustom]
GO
ALTER TABLE [dbo].[States] ADD  DEFAULT ((999)) FOR [SortOrder]
GO
ALTER TABLE [dbo].[States] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[States] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT (newid()) FOR [UniqueId]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT ('+91') FOR [PhoneCountryCode]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT ((0)) FOR [IsEmailVerified]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT ((0)) FOR [IsPhoneVerified]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT ((0)) FOR [Is2FaEnabled]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT ((0)) FOR [MustChangePassword]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT ((0)) FOR [FailedLoginCount]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT ((0)) FOR [LoginCount]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT (sysutcdatetime()) FOR [PasswordChangedAt]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT ((1)) FOR [NotifyEmail]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT ((1)) FOR [NotifySms]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT ((0)) FOR [NotifyPush]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[Wards] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Wards] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Admissions]  WITH CHECK ADD FOREIGN KEY([AdmittingDoctorId])
REFERENCES [dbo].[DoctorProfiles] ([Id])
GO
ALTER TABLE [dbo].[Admissions]  WITH CHECK ADD FOREIGN KEY([BedId])
REFERENCES [dbo].[Beds] ([Id])
GO
ALTER TABLE [dbo].[Admissions]  WITH CHECK ADD FOREIGN KEY([HospitalId])
REFERENCES [dbo].[HospitalSetup] ([Id])
GO
ALTER TABLE [dbo].[Admissions]  WITH CHECK ADD FOREIGN KEY([IcdCodeId])
REFERENCES [dbo].[IcdCodes] ([Id])
GO
ALTER TABLE [dbo].[Admissions]  WITH CHECK ADD FOREIGN KEY([PatientId])
REFERENCES [dbo].[PatientProfiles] ([Id])
GO
ALTER TABLE [dbo].[Admissions]  WITH CHECK ADD FOREIGN KEY([WardId])
REFERENCES [dbo].[Wards] ([Id])
GO
ALTER TABLE [dbo].[Appointments]  WITH CHECK ADD FOREIGN KEY([BookedByUserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[Appointments]  WITH CHECK ADD FOREIGN KEY([CancelledBy])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[Appointments]  WITH CHECK ADD FOREIGN KEY([DepartmentId])
REFERENCES [dbo].[Departments] ([Id])
GO
ALTER TABLE [dbo].[Appointments]  WITH CHECK ADD FOREIGN KEY([DoctorId])
REFERENCES [dbo].[DoctorProfiles] ([Id])
GO
ALTER TABLE [dbo].[Appointments]  WITH CHECK ADD FOREIGN KEY([FollowUpOf])
REFERENCES [dbo].[Appointments] ([Id])
GO
ALTER TABLE [dbo].[Appointments]  WITH CHECK ADD FOREIGN KEY([HospitalId])
REFERENCES [dbo].[HospitalSetup] ([Id])
GO
ALTER TABLE [dbo].[Appointments]  WITH CHECK ADD FOREIGN KEY([PatientId])
REFERENCES [dbo].[PatientProfiles] ([Id])
GO
ALTER TABLE [dbo].[AppointmentSlots]  WITH CHECK ADD FOREIGN KEY([AppointmentId])
REFERENCES [dbo].[Appointments] ([Id])
GO
ALTER TABLE [dbo].[AppointmentSlots]  WITH CHECK ADD FOREIGN KEY([DoctorId])
REFERENCES [dbo].[DoctorProfiles] ([Id])
GO
ALTER TABLE [dbo].[AppointmentSlots]  WITH CHECK ADD FOREIGN KEY([HospitalId])
REFERENCES [dbo].[HospitalSetup] ([Id])
GO
ALTER TABLE [dbo].[AppointmentSlots]  WITH CHECK ADD FOREIGN KEY([OpdRoomId])
REFERENCES [dbo].[OpdRooms] ([Id])
GO
ALTER TABLE [dbo].[AppointmentSlots]  WITH CHECK ADD FOREIGN KEY([ScheduleId])
REFERENCES [dbo].[DoctorSchedules] ([Id])
GO
ALTER TABLE [dbo].[AuditLogs]  WITH CHECK ADD FOREIGN KEY([HospitalId])
REFERENCES [dbo].[HospitalSetup] ([Id])
GO
ALTER TABLE [dbo].[AuthSessions]  WITH CHECK ADD FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[Beds]  WITH CHECK ADD FOREIGN KEY([WardId])
REFERENCES [dbo].[Wards] ([Id])
GO
ALTER TABLE [dbo].[BillItems]  WITH CHECK ADD FOREIGN KEY([BillId])
REFERENCES [dbo].[Bills] ([Id])
GO
ALTER TABLE [dbo].[BillItems]  WITH CHECK ADD FOREIGN KEY([ServiceId])
REFERENCES [dbo].[Services] ([Id])
GO
ALTER TABLE [dbo].[Bills]  WITH CHECK ADD FOREIGN KEY([AdmissionId])
REFERENCES [dbo].[Admissions] ([Id])
GO
ALTER TABLE [dbo].[Bills]  WITH CHECK ADD FOREIGN KEY([AppointmentId])
REFERENCES [dbo].[Appointments] ([Id])
GO
ALTER TABLE [dbo].[Bills]  WITH CHECK ADD FOREIGN KEY([ApprovedBy])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[Bills]  WITH CHECK ADD FOREIGN KEY([GeneratedBy])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[Bills]  WITH CHECK ADD FOREIGN KEY([HospitalId])
REFERENCES [dbo].[HospitalSetup] ([Id])
GO
ALTER TABLE [dbo].[Bills]  WITH CHECK ADD FOREIGN KEY([PatientId])
REFERENCES [dbo].[PatientProfiles] ([Id])
GO
ALTER TABLE [dbo].[Departments]  WITH CHECK ADD FOREIGN KEY([HospitalId])
REFERENCES [dbo].[HospitalSetup] ([Id])
GO
ALTER TABLE [dbo].[Districts]  WITH CHECK ADD FOREIGN KEY([StateId])
REFERENCES [dbo].[States] ([Id])
GO
ALTER TABLE [dbo].[DoctorDocuments]  WITH CHECK ADD FOREIGN KEY([DoctorId])
REFERENCES [dbo].[DoctorProfiles] ([Id])
GO
ALTER TABLE [dbo].[DoctorDocuments]  WITH CHECK ADD FOREIGN KEY([VerifiedBy])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[DoctorLeaves]  WITH CHECK ADD FOREIGN KEY([ApprovedBy])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[DoctorLeaves]  WITH CHECK ADD FOREIGN KEY([CreatedBy])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[DoctorLeaves]  WITH CHECK ADD FOREIGN KEY([DoctorId])
REFERENCES [dbo].[DoctorProfiles] ([Id])
GO
ALTER TABLE [dbo].[DoctorLeaves]  WITH CHECK ADD FOREIGN KEY([HospitalId])
REFERENCES [dbo].[HospitalSetup] ([Id])
GO
ALTER TABLE [dbo].[DoctorProfiles]  WITH CHECK ADD FOREIGN KEY([ApprovedBy])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[DoctorProfiles]  WITH CHECK ADD FOREIGN KEY([CountryId])
REFERENCES [dbo].[Countries] ([Id])
GO
ALTER TABLE [dbo].[DoctorProfiles]  WITH CHECK ADD FOREIGN KEY([DepartmentId])
REFERENCES [dbo].[Departments] ([Id])
GO
ALTER TABLE [dbo].[DoctorProfiles]  WITH CHECK ADD FOREIGN KEY([DistrictId])
REFERENCES [dbo].[Districts] ([Id])
GO
ALTER TABLE [dbo].[DoctorProfiles]  WITH CHECK ADD FOREIGN KEY([HospitalId])
REFERENCES [dbo].[HospitalSetup] ([Id])
GO
ALTER TABLE [dbo].[DoctorProfiles]  WITH CHECK ADD FOREIGN KEY([MedicalCouncilId])
REFERENCES [dbo].[MedicalCouncils] ([Id])
GO
ALTER TABLE [dbo].[DoctorProfiles]  WITH CHECK ADD FOREIGN KEY([PincodeId])
REFERENCES [dbo].[Pincodes] ([Id])
GO
ALTER TABLE [dbo].[DoctorProfiles]  WITH CHECK ADD FOREIGN KEY([QualificationId])
REFERENCES [dbo].[Qualifications] ([Id])
GO
ALTER TABLE [dbo].[DoctorProfiles]  WITH CHECK ADD FOREIGN KEY([SpecializationId])
REFERENCES [dbo].[Specializations] ([Id])
GO
ALTER TABLE [dbo].[DoctorProfiles]  WITH CHECK ADD FOREIGN KEY([StateId])
REFERENCES [dbo].[States] ([Id])
GO
ALTER TABLE [dbo].[DoctorProfiles]  WITH CHECK ADD FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[DoctorScheduleBlocks]  WITH CHECK ADD FOREIGN KEY([DoctorId])
REFERENCES [dbo].[DoctorProfiles] ([Id])
GO
ALTER TABLE [dbo].[DoctorSchedules]  WITH CHECK ADD FOREIGN KEY([CreatedBy])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[DoctorSchedules]  WITH CHECK ADD FOREIGN KEY([DoctorId])
REFERENCES [dbo].[DoctorProfiles] ([Id])
GO
ALTER TABLE [dbo].[DoctorSchedules]  WITH CHECK ADD FOREIGN KEY([HospitalId])
REFERENCES [dbo].[HospitalSetup] ([Id])
GO
ALTER TABLE [dbo].[DoctorSchedules]  WITH CHECK ADD FOREIGN KEY([OpdRoomId])
REFERENCES [dbo].[OpdRooms] ([Id])
GO
ALTER TABLE [dbo].[DoctorSchedules]  WITH CHECK ADD FOREIGN KEY([UpdatedBy])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[HospitalSetup]  WITH CHECK ADD FOREIGN KEY([CountryId])
REFERENCES [dbo].[Countries] ([Id])
GO
ALTER TABLE [dbo].[HospitalSetup]  WITH CHECK ADD FOREIGN KEY([DistrictId])
REFERENCES [dbo].[Districts] ([Id])
GO
ALTER TABLE [dbo].[HospitalSetup]  WITH CHECK ADD FOREIGN KEY([PincodeId])
REFERENCES [dbo].[Pincodes] ([Id])
GO
ALTER TABLE [dbo].[HospitalSetup]  WITH CHECK ADD FOREIGN KEY([StateId])
REFERENCES [dbo].[States] ([Id])
GO
ALTER TABLE [dbo].[LabOrderItems]  WITH CHECK ADD FOREIGN KEY([LabOrderId])
REFERENCES [dbo].[LabOrders] ([Id])
GO
ALTER TABLE [dbo].[LabOrderItems]  WITH CHECK ADD FOREIGN KEY([TestId])
REFERENCES [dbo].[LabTests] ([Id])
GO
ALTER TABLE [dbo].[LabOrders]  WITH CHECK ADD FOREIGN KEY([AdmissionId])
REFERENCES [dbo].[Admissions] ([Id])
GO
ALTER TABLE [dbo].[LabOrders]  WITH CHECK ADD FOREIGN KEY([AppointmentId])
REFERENCES [dbo].[Appointments] ([Id])
GO
ALTER TABLE [dbo].[LabOrders]  WITH CHECK ADD FOREIGN KEY([CollectedBy])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[LabOrders]  WITH CHECK ADD FOREIGN KEY([HospitalId])
REFERENCES [dbo].[HospitalSetup] ([Id])
GO
ALTER TABLE [dbo].[LabOrders]  WITH CHECK ADD FOREIGN KEY([OrderedBy])
REFERENCES [dbo].[DoctorProfiles] ([Id])
GO
ALTER TABLE [dbo].[LabOrders]  WITH CHECK ADD FOREIGN KEY([PatientId])
REFERENCES [dbo].[PatientProfiles] ([Id])
GO
ALTER TABLE [dbo].[LabOrders]  WITH CHECK ADD FOREIGN KEY([ReportedBy])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[LabOrders]  WITH CHECK ADD FOREIGN KEY([VerifiedBy])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[LookupValues]  WITH CHECK ADD FOREIGN KEY([CategoryKey])
REFERENCES [dbo].[LookupCategories] ([CategoryKey])
GO
ALTER TABLE [dbo].[MedicalCouncils]  WITH CHECK ADD FOREIGN KEY([CountryId])
REFERENCES [dbo].[Countries] ([Id])
GO
ALTER TABLE [dbo].[MedicalCouncils]  WITH CHECK ADD FOREIGN KEY([StateId])
REFERENCES [dbo].[States] ([Id])
GO
ALTER TABLE [dbo].[Notifications]  WITH CHECK ADD FOREIGN KEY([HospitalId])
REFERENCES [dbo].[HospitalSetup] ([Id])
GO
ALTER TABLE [dbo].[Notifications]  WITH CHECK ADD FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[OpdQueue]  WITH CHECK ADD FOREIGN KEY([AppointmentId])
REFERENCES [dbo].[Appointments] ([Id])
GO
ALTER TABLE [dbo].[OpdQueue]  WITH CHECK ADD FOREIGN KEY([DoctorId])
REFERENCES [dbo].[DoctorProfiles] ([Id])
GO
ALTER TABLE [dbo].[OpdQueue]  WITH CHECK ADD FOREIGN KEY([HospitalId])
REFERENCES [dbo].[HospitalSetup] ([Id])
GO
ALTER TABLE [dbo].[OpdQueue]  WITH CHECK ADD FOREIGN KEY([PatientId])
REFERENCES [dbo].[PatientProfiles] ([Id])
GO
ALTER TABLE [dbo].[OpdQueue]  WITH CHECK ADD FOREIGN KEY([SlotId])
REFERENCES [dbo].[AppointmentSlots] ([Id])
GO
ALTER TABLE [dbo].[OpdRooms]  WITH CHECK ADD FOREIGN KEY([CreatedBy])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[OpdRooms]  WITH CHECK ADD FOREIGN KEY([DepartmentId])
REFERENCES [dbo].[Departments] ([Id])
GO
ALTER TABLE [dbo].[OpdRooms]  WITH CHECK ADD FOREIGN KEY([HospitalId])
REFERENCES [dbo].[HospitalSetup] ([Id])
GO
ALTER TABLE [dbo].[OtpTokens]  WITH CHECK ADD FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[OtpVerifications]  WITH CHECK ADD  CONSTRAINT [FK_OtpVerifications_Users] FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[OtpVerifications] CHECK CONSTRAINT [FK_OtpVerifications_Users]
GO
ALTER TABLE [dbo].[PatientProfiles]  WITH CHECK ADD FOREIGN KEY([CountryId])
REFERENCES [dbo].[Countries] ([Id])
GO
ALTER TABLE [dbo].[PatientProfiles]  WITH CHECK ADD FOREIGN KEY([DistrictId])
REFERENCES [dbo].[Districts] ([Id])
GO
ALTER TABLE [dbo].[PatientProfiles]  WITH CHECK ADD FOREIGN KEY([HospitalId])
REFERENCES [dbo].[HospitalSetup] ([Id])
GO
ALTER TABLE [dbo].[PatientProfiles]  WITH CHECK ADD FOREIGN KEY([PincodeId])
REFERENCES [dbo].[Pincodes] ([Id])
GO
ALTER TABLE [dbo].[PatientProfiles]  WITH CHECK ADD FOREIGN KEY([StateId])
REFERENCES [dbo].[States] ([Id])
GO
ALTER TABLE [dbo].[PatientProfiles]  WITH CHECK ADD FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[Payments]  WITH CHECK ADD FOREIGN KEY([BillId])
REFERENCES [dbo].[Bills] ([Id])
GO
ALTER TABLE [dbo].[Payments]  WITH CHECK ADD FOREIGN KEY([ReceivedBy])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[PharmacyInventory]  WITH CHECK ADD FOREIGN KEY([HospitalId])
REFERENCES [dbo].[HospitalSetup] ([Id])
GO
ALTER TABLE [dbo].[PharmacyInventory]  WITH CHECK ADD FOREIGN KEY([MedicineId])
REFERENCES [dbo].[Medicines] ([Id])
GO
ALTER TABLE [dbo].[Pincodes]  WITH CHECK ADD FOREIGN KEY([DistrictId])
REFERENCES [dbo].[Districts] ([Id])
GO
ALTER TABLE [dbo].[PrescriptionItems]  WITH CHECK ADD FOREIGN KEY([DispensedBy])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[PrescriptionItems]  WITH CHECK ADD FOREIGN KEY([MedicineId])
REFERENCES [dbo].[Medicines] ([Id])
GO
ALTER TABLE [dbo].[PrescriptionItems]  WITH CHECK ADD FOREIGN KEY([PrescriptionId])
REFERENCES [dbo].[Prescriptions] ([Id])
GO
ALTER TABLE [dbo].[Prescriptions]  WITH CHECK ADD FOREIGN KEY([AdmissionId])
REFERENCES [dbo].[Admissions] ([Id])
GO
ALTER TABLE [dbo].[Prescriptions]  WITH CHECK ADD FOREIGN KEY([AppointmentId])
REFERENCES [dbo].[Appointments] ([Id])
GO
ALTER TABLE [dbo].[Prescriptions]  WITH CHECK ADD FOREIGN KEY([DoctorId])
REFERENCES [dbo].[DoctorProfiles] ([Id])
GO
ALTER TABLE [dbo].[Prescriptions]  WITH CHECK ADD FOREIGN KEY([HospitalId])
REFERENCES [dbo].[HospitalSetup] ([Id])
GO
ALTER TABLE [dbo].[Prescriptions]  WITH CHECK ADD FOREIGN KEY([PatientId])
REFERENCES [dbo].[PatientProfiles] ([Id])
GO
ALTER TABLE [dbo].[Services]  WITH CHECK ADD FOREIGN KEY([DepartmentId])
REFERENCES [dbo].[Departments] ([Id])
GO
ALTER TABLE [dbo].[Services]  WITH CHECK ADD FOREIGN KEY([HospitalId])
REFERENCES [dbo].[HospitalSetup] ([Id])
GO
ALTER TABLE [dbo].[SetupChangeLog]  WITH CHECK ADD FOREIGN KEY([ApprovedBy])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[SetupChangeLog]  WITH CHECK ADD FOREIGN KEY([HospitalId])
REFERENCES [dbo].[HospitalSetup] ([Id])
GO
ALTER TABLE [dbo].[SetupChangeLog]  WITH CHECK ADD FOREIGN KEY([RequestedBy])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[StaffLeaves]  WITH CHECK ADD FOREIGN KEY([ApprovedBy])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[StaffLeaves]  WITH CHECK ADD FOREIGN KEY([CreatedBy])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[StaffLeaves]  WITH CHECK ADD FOREIGN KEY([HospitalId])
REFERENCES [dbo].[HospitalSetup] ([Id])
GO
ALTER TABLE [dbo].[StaffLeaves]  WITH CHECK ADD FOREIGN KEY([StaffId])
REFERENCES [dbo].[StaffProfiles] ([Id])
GO
ALTER TABLE [dbo].[StaffProfiles]  WITH CHECK ADD FOREIGN KEY([DepartmentId])
REFERENCES [dbo].[Departments] ([Id])
GO
ALTER TABLE [dbo].[StaffProfiles]  WITH CHECK ADD FOREIGN KEY([DistrictId])
REFERENCES [dbo].[Districts] ([Id])
GO
ALTER TABLE [dbo].[StaffProfiles]  WITH CHECK ADD FOREIGN KEY([HospitalId])
REFERENCES [dbo].[HospitalSetup] ([Id])
GO
ALTER TABLE [dbo].[StaffProfiles]  WITH CHECK ADD FOREIGN KEY([PincodeId])
REFERENCES [dbo].[Pincodes] ([Id])
GO
ALTER TABLE [dbo].[StaffProfiles]  WITH CHECK ADD FOREIGN KEY([StateId])
REFERENCES [dbo].[States] ([Id])
GO
ALTER TABLE [dbo].[StaffProfiles]  WITH CHECK ADD FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[StaffSchedules]  WITH CHECK ADD FOREIGN KEY([CreatedBy])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[StaffSchedules]  WITH CHECK ADD FOREIGN KEY([HospitalId])
REFERENCES [dbo].[HospitalSetup] ([Id])
GO
ALTER TABLE [dbo].[StaffSchedules]  WITH CHECK ADD FOREIGN KEY([StaffId])
REFERENCES [dbo].[StaffProfiles] ([Id])
GO
ALTER TABLE [dbo].[StaffSchedules]  WITH CHECK ADD FOREIGN KEY([UpdatedBy])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[States]  WITH CHECK ADD FOREIGN KEY([CountryId])
REFERENCES [dbo].[Countries] ([Id])
GO
ALTER TABLE [dbo].[Users]  WITH CHECK ADD FOREIGN KEY([DepartmentId])
REFERENCES [dbo].[Departments] ([Id])
GO
ALTER TABLE [dbo].[Users]  WITH CHECK ADD FOREIGN KEY([HospitalId])
REFERENCES [dbo].[HospitalSetup] ([Id])
GO
ALTER TABLE [dbo].[Wards]  WITH CHECK ADD FOREIGN KEY([HospitalId])
REFERENCES [dbo].[HospitalSetup] ([Id])
GO
ALTER TABLE [dbo].[Admissions]  WITH CHECK ADD  CONSTRAINT [CK_Adm_Status] CHECK  (([Status]='Deceased' OR [Status]='LAMA' OR [Status]='Transferred' OR [Status]='Discharged' OR [Status]='Active'))
GO
ALTER TABLE [dbo].[Admissions] CHECK CONSTRAINT [CK_Adm_Status]
GO
ALTER TABLE [dbo].[Appointments]  WITH CHECK ADD  CONSTRAINT [CK_Appt_Date] CHECK  (([AppointmentDate]>=CONVERT([date],getdate())))
GO
ALTER TABLE [dbo].[Appointments] CHECK CONSTRAINT [CK_Appt_Date]
GO
ALTER TABLE [dbo].[Appointments]  WITH CHECK ADD  CONSTRAINT [CK_Appt_Priority] CHECK  (([Priority]='Emergency' OR [Priority]='High' OR [Priority]='Normal'))
GO
ALTER TABLE [dbo].[Appointments] CHECK CONSTRAINT [CK_Appt_Priority]
GO
ALTER TABLE [dbo].[Appointments]  WITH CHECK ADD  CONSTRAINT [CK_Appt_Status] CHECK  (([Status]='Rescheduled' OR [Status]='NoShow' OR [Status]='Completed' OR [Status]='Cancelled' OR [Status]='Confirmed' OR [Status]='Scheduled'))
GO
ALTER TABLE [dbo].[Appointments] CHECK CONSTRAINT [CK_Appt_Status]
GO
ALTER TABLE [dbo].[Appointments]  WITH CHECK ADD  CONSTRAINT [CK_Appt_VType] CHECK  (([VisitType]='DayCare' OR [VisitType]='Emergency' OR [VisitType]='IPD' OR [VisitType]='OPD'))
GO
ALTER TABLE [dbo].[Appointments] CHECK CONSTRAINT [CK_Appt_VType]
GO
ALTER TABLE [dbo].[AuditLogs]  WITH CHECK ADD  CONSTRAINT [CK_Audit_Action] CHECK  (([Action]='REJECT' OR [Action]='APPROVE' OR [Action]='PRINT' OR [Action]='EXPORT' OR [Action]='VIEW' OR [Action]='LOGOUT' OR [Action]='LOGIN' OR [Action]='DELETE' OR [Action]='UPDATE' OR [Action]='INSERT'))
GO
ALTER TABLE [dbo].[AuditLogs] CHECK CONSTRAINT [CK_Audit_Action]
GO
ALTER TABLE [dbo].[AuditLogs]  WITH CHECK ADD  CONSTRAINT [CK_Audit_NewJson] CHECK  (([NewValuesJson] IS NULL OR isjson([NewValuesJson])=(1)))
GO
ALTER TABLE [dbo].[AuditLogs] CHECK CONSTRAINT [CK_Audit_NewJson]
GO
ALTER TABLE [dbo].[AuditLogs]  WITH CHECK ADD  CONSTRAINT [CK_Audit_OldJson] CHECK  (([OldValuesJson] IS NULL OR isjson([OldValuesJson])=(1)))
GO
ALTER TABLE [dbo].[AuditLogs] CHECK CONSTRAINT [CK_Audit_OldJson]
GO
ALTER TABLE [dbo].[Beds]  WITH CHECK ADD  CONSTRAINT [CK_Bed_Rate] CHECK  (([DailyRate] IS NULL OR [DailyRate]>=(0)))
GO
ALTER TABLE [dbo].[Beds] CHECK CONSTRAINT [CK_Bed_Rate]
GO
ALTER TABLE [dbo].[Beds]  WITH CHECK ADD  CONSTRAINT [CK_Bed_Status] CHECK  (([Status]='Cleaning' OR [Status]='Maintenance' OR [Status]='Reserved' OR [Status]='Occupied' OR [Status]='Available'))
GO
ALTER TABLE [dbo].[Beds] CHECK CONSTRAINT [CK_Bed_Status]
GO
ALTER TABLE [dbo].[BillItems]  WITH CHECK ADD  CONSTRAINT [CK_BItem_Disc] CHECK  (([DiscountPct]>=(0) AND [DiscountPct]<=(100)))
GO
ALTER TABLE [dbo].[BillItems] CHECK CONSTRAINT [CK_BItem_Disc]
GO
ALTER TABLE [dbo].[BillItems]  WITH CHECK ADD  CONSTRAINT [CK_BItem_Qty] CHECK  (([Quantity]>(0)))
GO
ALTER TABLE [dbo].[BillItems] CHECK CONSTRAINT [CK_BItem_Qty]
GO
ALTER TABLE [dbo].[BillItems]  WITH CHECK ADD  CONSTRAINT [CK_BItem_Tax] CHECK  (([TaxPct]>=(0) AND [TaxPct]<=(100)))
GO
ALTER TABLE [dbo].[BillItems] CHECK CONSTRAINT [CK_BItem_Tax]
GO
ALTER TABLE [dbo].[BillItems]  WITH CHECK ADD  CONSTRAINT [CK_BItem_UP] CHECK  (([UnitPrice]>=(0)))
GO
ALTER TABLE [dbo].[BillItems] CHECK CONSTRAINT [CK_BItem_UP]
GO
ALTER TABLE [dbo].[Bills]  WITH CHECK ADD  CONSTRAINT [CK_Bill_Disc] CHECK  (([DiscountAmount]>=(0)))
GO
ALTER TABLE [dbo].[Bills] CHECK CONSTRAINT [CK_Bill_Disc]
GO
ALTER TABLE [dbo].[Bills]  WITH CHECK ADD  CONSTRAINT [CK_Bill_Paid] CHECK  (([PaidAmount]>=(0)))
GO
ALTER TABLE [dbo].[Bills] CHECK CONSTRAINT [CK_Bill_Paid]
GO
ALTER TABLE [dbo].[Bills]  WITH CHECK ADD  CONSTRAINT [CK_Bill_PaySt] CHECK  (([PaymentStatus]='Waived' OR [PaymentStatus]='Refunded' OR [PaymentStatus]='Partial' OR [PaymentStatus]='Paid' OR [PaymentStatus]='Pending'))
GO
ALTER TABLE [dbo].[Bills] CHECK CONSTRAINT [CK_Bill_PaySt]
GO
ALTER TABLE [dbo].[Bills]  WITH CHECK ADD  CONSTRAINT [CK_Bill_Sub] CHECK  (([Subtotal]>=(0)))
GO
ALTER TABLE [dbo].[Bills] CHECK CONSTRAINT [CK_Bill_Sub]
GO
ALTER TABLE [dbo].[Bills]  WITH CHECK ADD  CONSTRAINT [CK_Bill_Tax] CHECK  (([TaxAmount]>=(0)))
GO
ALTER TABLE [dbo].[Bills] CHECK CONSTRAINT [CK_Bill_Tax]
GO
ALTER TABLE [dbo].[Bills]  WITH CHECK ADD  CONSTRAINT [CK_Bill_Total] CHECK  (([TotalAmount]>=(0)))
GO
ALTER TABLE [dbo].[Bills] CHECK CONSTRAINT [CK_Bill_Total]
GO
ALTER TABLE [dbo].[Bills]  WITH CHECK ADD  CONSTRAINT [CK_Bill_Type] CHECK  (([BillType]='Package' OR [BillType]='Emergency' OR [BillType]='Lab' OR [BillType]='Pharmacy' OR [BillType]='IPD' OR [BillType]='OPD'))
GO
ALTER TABLE [dbo].[Bills] CHECK CONSTRAINT [CK_Bill_Type]
GO
ALTER TABLE [dbo].[Departments]  WITH CHECK ADD  CONSTRAINT [CK_Dept_Name] CHECK  ((len(ltrim(rtrim([Name])))>=(2)))
GO
ALTER TABLE [dbo].[Departments] CHECK CONSTRAINT [CK_Dept_Name]
GO
ALTER TABLE [dbo].[Departments]  WITH CHECK ADD  CONSTRAINT [CK_Dept_Status] CHECK  (([Status]='draft' OR [Status]='deprecated' OR [Status]='inactive' OR [Status]='active'))
GO
ALTER TABLE [dbo].[Departments] CHECK CONSTRAINT [CK_Dept_Status]
GO
ALTER TABLE [dbo].[DoctorDocuments]  WITH CHECK ADD  CONSTRAINT [CK_DocDoc_Size] CHECK  (([FileSizeKb] IS NULL OR [FileSizeKb]>(0)))
GO
ALTER TABLE [dbo].[DoctorDocuments] CHECK CONSTRAINT [CK_DocDoc_Size]
GO
ALTER TABLE [dbo].[DoctorDocuments]  WITH CHECK ADD  CONSTRAINT [CK_DocDoc_Type] CHECK  (([DocType]='other' OR [DocType]='insurance' OR [DocType]='registration_cert' OR [DocType]='experience_cert' OR [DocType]='id_proof' OR [DocType]='license' OR [DocType]='medical_degree'))
GO
ALTER TABLE [dbo].[DoctorDocuments] CHECK CONSTRAINT [CK_DocDoc_Type]
GO
ALTER TABLE [dbo].[DoctorProfiles]  WITH CHECK ADD  CONSTRAINT [CK_Doc_Aadhaar] CHECK  (([Aadhaar] IS NULL OR len([Aadhaar])=(12) AND NOT [Aadhaar] like '%[^0-9]%'))
GO
ALTER TABLE [dbo].[DoctorProfiles] CHECK CONSTRAINT [CK_Doc_Aadhaar]
GO
ALTER TABLE [dbo].[DoctorProfiles]  WITH CHECK ADD  CONSTRAINT [CK_Doc_ApprSt] CHECK  (([ApprovalStatus]='suspended' OR [ApprovalStatus]='rejected' OR [ApprovalStatus]='approved' OR [ApprovalStatus]='pending'))
GO
ALTER TABLE [dbo].[DoctorProfiles] CHECK CONSTRAINT [CK_Doc_ApprSt]
GO
ALTER TABLE [dbo].[DoctorProfiles]  WITH CHECK ADD  CONSTRAINT [CK_Doc_Blood] CHECK  (([BloodGroup] IS NULL OR ([BloodGroup]='O-' OR [BloodGroup]='O+' OR [BloodGroup]='AB-' OR [BloodGroup]='AB+' OR [BloodGroup]='B-' OR [BloodGroup]='B+' OR [BloodGroup]='A-' OR [BloodGroup]='A+')))
GO
ALTER TABLE [dbo].[DoctorProfiles] CHECK CONSTRAINT [CK_Doc_Blood]
GO
ALTER TABLE [dbo].[DoctorProfiles]  WITH CHECK ADD  CONSTRAINT [CK_Doc_Exp] CHECK  (([ExperienceYears] IS NULL OR [ExperienceYears]>=(0) AND [ExperienceYears]<=(60)))
GO
ALTER TABLE [dbo].[DoctorProfiles] CHECK CONSTRAINT [CK_Doc_Exp]
GO
ALTER TABLE [dbo].[DoctorProfiles]  WITH CHECK ADD  CONSTRAINT [CK_Doc_Fee] CHECK  (([ConsultationFee] IS NULL OR [ConsultationFee]>=(0)))
GO
ALTER TABLE [dbo].[DoctorProfiles] CHECK CONSTRAINT [CK_Doc_Fee]
GO
ALTER TABLE [dbo].[DoctorProfiles]  WITH CHECK ADD  CONSTRAINT [CK_Doc_LicExp] CHECK  (([LicenseExpiry] IS NULL OR [LicenseExpiry]>=CONVERT([date],getdate())))
GO
ALTER TABLE [dbo].[DoctorProfiles] CHECK CONSTRAINT [CK_Doc_LicExp]
GO
ALTER TABLE [dbo].[DoctorProfiles]  WITH CHECK ADD  CONSTRAINT [CK_Doc_MaxPat] CHECK  (([MaxDailyPatients] IS NULL OR [MaxDailyPatients]>(0)))
GO
ALTER TABLE [dbo].[DoctorProfiles] CHECK CONSTRAINT [CK_Doc_MaxPat]
GO
ALTER TABLE [dbo].[DoctorProfiles]  WITH CHECK ADD  CONSTRAINT [CK_Doc_PAN] CHECK  (([PAN] IS NULL OR [PAN] like '[A-Z][A-Z][A-Z][A-Z][A-Z][0-9][0-9][0-9][0-9][A-Z]'))
GO
ALTER TABLE [dbo].[DoctorProfiles] CHECK CONSTRAINT [CK_Doc_PAN]
GO
ALTER TABLE [dbo].[DoctorSchedules]  WITH CHECK ADD  CONSTRAINT [CK_DoctorSchedules_Day] CHECK  (([DayOfWeek]>=(0) AND [DayOfWeek]<=(6)))
GO
ALTER TABLE [dbo].[DoctorSchedules] CHECK CONSTRAINT [CK_DoctorSchedules_Day]
GO
ALTER TABLE [dbo].[DoctorSchedules]  WITH CHECK ADD  CONSTRAINT [CK_DoctorSchedules_Slot] CHECK  (([SlotDurationMins]>=(5) AND [SlotDurationMins]<=(120)))
GO
ALTER TABLE [dbo].[DoctorSchedules] CHECK CONSTRAINT [CK_DoctorSchedules_Slot]
GO
ALTER TABLE [dbo].[DoctorSchedules]  WITH CHECK ADD  CONSTRAINT [CK_DoctorSchedules_Times] CHECK  (([EndTime]>[StartTime]))
GO
ALTER TABLE [dbo].[DoctorSchedules] CHECK CONSTRAINT [CK_DoctorSchedules_Times]
GO
ALTER TABLE [dbo].[HospitalSetup]  WITH CHECK ADD  CONSTRAINT [CK_HospSetup_Beds] CHECK  (([BedCapacity] IS NULL OR [BedCapacity]>(0)))
GO
ALTER TABLE [dbo].[HospitalSetup] CHECK CONSTRAINT [CK_HospSetup_Beds]
GO
ALTER TABLE [dbo].[HospitalSetup]  WITH CHECK ADD  CONSTRAINT [CK_HospSetup_Email] CHECK  (([Email] IS NULL OR [Email] like '%@%.%'))
GO
ALTER TABLE [dbo].[HospitalSetup] CHECK CONSTRAINT [CK_HospSetup_Email]
GO
ALTER TABLE [dbo].[HospitalSetup]  WITH CHECK ADD  CONSTRAINT [CK_HospSetup_GSTIN] CHECK  (([GSTIN] IS NULL OR [GSTIN] like '[0-9][0-9][A-Z][A-Z][A-Z][A-Z][A-Z][0-9][0-9][0-9][0-9][Z][A-Z0-9]'))
GO
ALTER TABLE [dbo].[HospitalSetup] CHECK CONSTRAINT [CK_HospSetup_GSTIN]
GO
ALTER TABLE [dbo].[HospitalSetup]  WITH CHECK ADD  CONSTRAINT [CK_HospSetup_Lat] CHECK  (([Latitude] IS NULL OR [Latitude]>=(-90) AND [Latitude]<=(90)))
GO
ALTER TABLE [dbo].[HospitalSetup] CHECK CONSTRAINT [CK_HospSetup_Lat]
GO
ALTER TABLE [dbo].[HospitalSetup]  WITH CHECK ADD  CONSTRAINT [CK_HospSetup_Lon] CHECK  (([Longitude] IS NULL OR [Longitude]>=(-180) AND [Longitude]<=(180)))
GO
ALTER TABLE [dbo].[HospitalSetup] CHECK CONSTRAINT [CK_HospSetup_Lon]
GO
ALTER TABLE [dbo].[HospitalSetup]  WITH CHECK ADD  CONSTRAINT [CK_HospSetup_MaxUsers] CHECK  (([MaxUsers]>(0)))
GO
ALTER TABLE [dbo].[HospitalSetup] CHECK CONSTRAINT [CK_HospSetup_MaxUsers]
GO
ALTER TABLE [dbo].[HospitalSetup]  WITH CHECK ADD  CONSTRAINT [CK_HospSetup_Name] CHECK  ((len(ltrim(rtrim([Name])))>=(3)))
GO
ALTER TABLE [dbo].[HospitalSetup] CHECK CONSTRAINT [CK_HospSetup_Name]
GO
ALTER TABLE [dbo].[HospitalSetup]  WITH CHECK ADD  CONSTRAINT [CK_HospSetup_PAN] CHECK  (([PAN] IS NULL OR [PAN] like '[A-Z][A-Z][A-Z][A-Z][A-Z][0-9][0-9][0-9][0-9][A-Z]'))
GO
ALTER TABLE [dbo].[HospitalSetup] CHECK CONSTRAINT [CK_HospSetup_PAN]
GO
ALTER TABLE [dbo].[HospitalSetup]  WITH CHECK ADD  CONSTRAINT [CK_HospSetup_Plan] CHECK  (([PlanType]='enterprise' OR [PlanType]='standard' OR [PlanType]='basic'))
GO
ALTER TABLE [dbo].[HospitalSetup] CHECK CONSTRAINT [CK_HospSetup_Plan]
GO
ALTER TABLE [dbo].[HospitalSetup]  WITH CHECK ADD  CONSTRAINT [CK_HospSetup_PrevJson] CHECK  (([PreviousVersionJson] IS NULL OR isjson([PreviousVersionJson])=(1)))
GO
ALTER TABLE [dbo].[HospitalSetup] CHECK CONSTRAINT [CK_HospSetup_PrevJson]
GO
ALTER TABLE [dbo].[HospitalSetup]  WITH CHECK ADD  CONSTRAINT [CK_HospSetup_PrimaryColor] CHECK  (([PrimaryColor] IS NULL OR [PrimaryColor] like '#%'))
GO
ALTER TABLE [dbo].[HospitalSetup] CHECK CONSTRAINT [CK_HospSetup_PrimaryColor]
GO
ALTER TABLE [dbo].[HospitalSetup]  WITH CHECK ADD  CONSTRAINT [CK_HospSetup_Status] CHECK  (([Status]='draft' OR [Status]='deprecated' OR [Status]='inactive' OR [Status]='active'))
GO
ALTER TABLE [dbo].[HospitalSetup] CHECK CONSTRAINT [CK_HospSetup_Status]
GO
ALTER TABLE [dbo].[HospitalSetup]  WITH CHECK ADD  CONSTRAINT [CK_HospSetup_TimeFormat] CHECK  (([TimeFormat]='24h' OR [TimeFormat]='12h'))
GO
ALTER TABLE [dbo].[HospitalSetup] CHECK CONSTRAINT [CK_HospSetup_TimeFormat]
GO
ALTER TABLE [dbo].[HospitalSetup]  WITH CHECK ADD  CONSTRAINT [CK_HospSetup_Year] CHECK  (([EstablishedYear] IS NULL OR [EstablishedYear]>=(1800) AND [EstablishedYear]<=(2100)))
GO
ALTER TABLE [dbo].[HospitalSetup] CHECK CONSTRAINT [CK_HospSetup_Year]
GO
ALTER TABLE [dbo].[LabOrders]  WITH CHECK ADD  CONSTRAINT [CK_Lab_Priority] CHECK  (([Priority]='STAT' OR [Priority]='Urgent' OR [Priority]='Routine'))
GO
ALTER TABLE [dbo].[LabOrders] CHECK CONSTRAINT [CK_Lab_Priority]
GO
ALTER TABLE [dbo].[LabOrders]  WITH CHECK ADD  CONSTRAINT [CK_Lab_Status] CHECK  (([Status]='Rejected' OR [Status]='Cancelled' OR [Status]='Completed' OR [Status]='Processing' OR [Status]='SampleCollected' OR [Status]='Pending'))
GO
ALTER TABLE [dbo].[LabOrders] CHECK CONSTRAINT [CK_Lab_Status]
GO
ALTER TABLE [dbo].[LabTests]  WITH CHECK ADD  CONSTRAINT [CK_LabTest_Price] CHECK  (([Price] IS NULL OR [Price]>=(0)))
GO
ALTER TABLE [dbo].[LabTests] CHECK CONSTRAINT [CK_LabTest_Price]
GO
ALTER TABLE [dbo].[LabTests]  WITH CHECK ADD  CONSTRAINT [CK_LabTest_TAT] CHECK  (([TurnaroundHrs] IS NULL OR [TurnaroundHrs]>(0)))
GO
ALTER TABLE [dbo].[LabTests] CHECK CONSTRAINT [CK_LabTest_TAT]
GO
ALTER TABLE [dbo].[Medicines]  WITH CHECK ADD  CONSTRAINT [CK_Med_GST] CHECK  (([GstPercent]>=(0) AND [GstPercent]<=(100)))
GO
ALTER TABLE [dbo].[Medicines] CHECK CONSTRAINT [CK_Med_GST]
GO
ALTER TABLE [dbo].[Notifications]  WITH CHECK ADD  CONSTRAINT [CK_Notif_Json] CHECK  (([DataJson] IS NULL OR isjson([DataJson])=(1)))
GO
ALTER TABLE [dbo].[Notifications] CHECK CONSTRAINT [CK_Notif_Json]
GO
ALTER TABLE [dbo].[OpdQueue]  WITH CHECK ADD  CONSTRAINT [CK_OpdQueue_Status] CHECK  (([QueueStatus]='cancelled' OR [QueueStatus]='skipped' OR [QueueStatus]='served' OR [QueueStatus]='serving' OR [QueueStatus]='called' OR [QueueStatus]='waiting'))
GO
ALTER TABLE [dbo].[OpdQueue] CHECK CONSTRAINT [CK_OpdQueue_Status]
GO
ALTER TABLE [dbo].[OtpTokens]  WITH CHECK ADD  CONSTRAINT [CK_Otp_CType] CHECK  (([ContactType]='phone' OR [ContactType]='email'))
GO
ALTER TABLE [dbo].[OtpTokens] CHECK CONSTRAINT [CK_Otp_CType]
GO
ALTER TABLE [dbo].[PatientProfiles]  WITH CHECK ADD  CONSTRAINT [CK_Pat_Aadhaar] CHECK  (([Aadhaar] IS NULL OR len([Aadhaar])=(12) AND NOT [Aadhaar] like '%[^0-9]%'))
GO
ALTER TABLE [dbo].[PatientProfiles] CHECK CONSTRAINT [CK_Pat_Aadhaar]
GO
ALTER TABLE [dbo].[PatientProfiles]  WITH CHECK ADD  CONSTRAINT [CK_Pat_Age] CHECK  (([AgeYears] IS NULL OR [AgeYears]>=(0) AND [AgeYears]<=(150)))
GO
ALTER TABLE [dbo].[PatientProfiles] CHECK CONSTRAINT [CK_Pat_Age]
GO
ALTER TABLE [dbo].[PatientProfiles]  WITH CHECK ADD  CONSTRAINT [CK_Pat_Blood] CHECK  (([BloodGroup] IS NULL OR ([BloodGroup]='O-' OR [BloodGroup]='O+' OR [BloodGroup]='AB-' OR [BloodGroup]='AB+' OR [BloodGroup]='B-' OR [BloodGroup]='B+' OR [BloodGroup]='A-' OR [BloodGroup]='A+')))
GO
ALTER TABLE [dbo].[PatientProfiles] CHECK CONSTRAINT [CK_Pat_Blood]
GO
ALTER TABLE [dbo].[PatientProfiles]  WITH CHECK ADD  CONSTRAINT [CK_Pat_Email] CHECK  (([Email] IS NULL OR [Email] like '%@%.%'))
GO
ALTER TABLE [dbo].[PatientProfiles] CHECK CONSTRAINT [CK_Pat_Email]
GO
ALTER TABLE [dbo].[PatientProfiles]  WITH CHECK ADD  CONSTRAINT [CK_Pat_FName] CHECK  ((len(ltrim(rtrim([FirstName])))>=(1)))
GO
ALTER TABLE [dbo].[PatientProfiles] CHECK CONSTRAINT [CK_Pat_FName]
GO
ALTER TABLE [dbo].[PatientProfiles]  WITH CHECK ADD  CONSTRAINT [CK_Pat_Gender] CHECK  (([Gender] IS NULL OR ([Gender]='PreferNot' OR [Gender]='Other' OR [Gender]='Female' OR [Gender]='Male')))
GO
ALTER TABLE [dbo].[PatientProfiles] CHECK CONSTRAINT [CK_Pat_Gender]
GO
ALTER TABLE [dbo].[PatientProfiles]  WITH CHECK ADD  CONSTRAINT [CK_Pat_Marital] CHECK  (([MaritalStatus] IS NULL OR ([MaritalStatus]='Other' OR [MaritalStatus]='Widowed' OR [MaritalStatus]='Divorced' OR [MaritalStatus]='Married' OR [MaritalStatus]='Single')))
GO
ALTER TABLE [dbo].[PatientProfiles] CHECK CONSTRAINT [CK_Pat_Marital]
GO
ALTER TABLE [dbo].[PatientProfiles]  WITH CHECK ADD  CONSTRAINT [CK_Pat_PAN] CHECK  (([PAN] IS NULL OR [PAN] like '[A-Z][A-Z][A-Z][A-Z][A-Z][0-9][0-9][0-9][0-9][A-Z]'))
GO
ALTER TABLE [dbo].[PatientProfiles] CHECK CONSTRAINT [CK_Pat_PAN]
GO
ALTER TABLE [dbo].[Payments]  WITH CHECK ADD  CONSTRAINT [CK_Pay_Amt] CHECK  (([Amount]>(0)))
GO
ALTER TABLE [dbo].[Payments] CHECK CONSTRAINT [CK_Pay_Amt]
GO
ALTER TABLE [dbo].[Payments]  WITH CHECK ADD  CONSTRAINT [CK_Pay_Method] CHECK  (([Method]='RTGS' OR [Method]='NEFT' OR [Method]='Cheque' OR [Method]='Insurance' OR [Method]='NetBanking' OR [Method]='UPI' OR [Method]='Card' OR [Method]='Cash'))
GO
ALTER TABLE [dbo].[Payments] CHECK CONSTRAINT [CK_Pay_Method]
GO
ALTER TABLE [dbo].[PharmacyInventory]  WITH CHECK ADD  CONSTRAINT [CK_Pharm_Qty] CHECK  (([Quantity]>=(0)))
GO
ALTER TABLE [dbo].[PharmacyInventory] CHECK CONSTRAINT [CK_Pharm_Qty]
GO
ALTER TABLE [dbo].[PharmacyInventory]  WITH CHECK ADD  CONSTRAINT [CK_Pharm_Reorder] CHECK  (([ReorderLevel]>=(0)))
GO
ALTER TABLE [dbo].[PharmacyInventory] CHECK CONSTRAINT [CK_Pharm_Reorder]
GO
ALTER TABLE [dbo].[PrescriptionItems]  WITH CHECK ADD  CONSTRAINT [CK_RxItem_Qty] CHECK  (([Quantity] IS NULL OR [Quantity]>(0)))
GO
ALTER TABLE [dbo].[PrescriptionItems] CHECK CONSTRAINT [CK_RxItem_Qty]
GO
ALTER TABLE [dbo].[Prescriptions]  WITH CHECK ADD  CONSTRAINT [CK_Rx_Status] CHECK  (([Status]='Cancelled' OR [Status]='Expired' OR [Status]='Dispensed' OR [Status]='Active'))
GO
ALTER TABLE [dbo].[Prescriptions] CHECK CONSTRAINT [CK_Rx_Status]
GO
ALTER TABLE [dbo].[Services]  WITH CHECK ADD  CONSTRAINT [CK_Svc_GST] CHECK  (([GstPercent]>=(0) AND [GstPercent]<=(100)))
GO
ALTER TABLE [dbo].[Services] CHECK CONSTRAINT [CK_Svc_GST]
GO
ALTER TABLE [dbo].[Services]  WITH CHECK ADD  CONSTRAINT [CK_Svc_Price] CHECK  (([Price]>=(0)))
GO
ALTER TABLE [dbo].[Services] CHECK CONSTRAINT [CK_Svc_Price]
GO
ALTER TABLE [dbo].[SetupChangeLog]  WITH CHECK ADD  CONSTRAINT [CK_SCL_NewJson] CHECK  (([NewValuesJson] IS NULL OR isjson([NewValuesJson])=(1)))
GO
ALTER TABLE [dbo].[SetupChangeLog] CHECK CONSTRAINT [CK_SCL_NewJson]
GO
ALTER TABLE [dbo].[SetupChangeLog]  WITH CHECK ADD  CONSTRAINT [CK_SCL_OldJson] CHECK  (([OldValuesJson] IS NULL OR isjson([OldValuesJson])=(1)))
GO
ALTER TABLE [dbo].[SetupChangeLog] CHECK CONSTRAINT [CK_SCL_OldJson]
GO
ALTER TABLE [dbo].[StaffProfiles]  WITH CHECK ADD  CONSTRAINT [CK_Staff_Aadhaar] CHECK  (([Aadhaar] IS NULL OR len([Aadhaar])=(12) AND NOT [Aadhaar] like '%[^0-9]%'))
GO
ALTER TABLE [dbo].[StaffProfiles] CHECK CONSTRAINT [CK_Staff_Aadhaar]
GO
ALTER TABLE [dbo].[StaffProfiles]  WITH CHECK ADD  CONSTRAINT [CK_Staff_PAN] CHECK  (([PAN] IS NULL OR [PAN] like '[A-Z][A-Z][A-Z][A-Z][A-Z][0-9][0-9][0-9][0-9][A-Z]'))
GO
ALTER TABLE [dbo].[StaffProfiles] CHECK CONSTRAINT [CK_Staff_PAN]
GO
ALTER TABLE [dbo].[StaffProfiles]  WITH CHECK ADD  CONSTRAINT [CK_Staff_Shift] CHECK  (([Shift] IS NULL OR ([Shift]='Rotating' OR [Shift]='Night' OR [Shift]='Afternoon' OR [Shift]='Morning')))
GO
ALTER TABLE [dbo].[StaffProfiles] CHECK CONSTRAINT [CK_Staff_Shift]
GO
ALTER TABLE [dbo].[StaffSchedules]  WITH CHECK ADD  CONSTRAINT [CK_StaffSchedules_Day] CHECK  (([DayOfWeek]>=(0) AND [DayOfWeek]<=(6)))
GO
ALTER TABLE [dbo].[StaffSchedules] CHECK CONSTRAINT [CK_StaffSchedules_Day]
GO
ALTER TABLE [dbo].[StaffSchedules]  WITH CHECK ADD  CONSTRAINT [CK_StaffSchedules_Times] CHECK  (([EndTime]>[StartTime]))
GO
ALTER TABLE [dbo].[StaffSchedules] CHECK CONSTRAINT [CK_StaffSchedules_Times]
GO
ALTER TABLE [dbo].[Users]  WITH CHECK ADD  CONSTRAINT [CK_Users_DOB] CHECK  (([DateOfBirth] IS NULL OR [DateOfBirth]<CONVERT([date],getdate())))
GO
ALTER TABLE [dbo].[Users] CHECK CONSTRAINT [CK_Users_DOB]
GO
ALTER TABLE [dbo].[Users]  WITH CHECK ADD  CONSTRAINT [CK_Users_Email] CHECK  (([Email] IS NULL OR [Email] like '%@%.%'))
GO
ALTER TABLE [dbo].[Users] CHECK CONSTRAINT [CK_Users_Email]
GO
ALTER TABLE [dbo].[Users]  WITH CHECK ADD  CONSTRAINT [CK_Users_FailCount] CHECK  (([FailedLoginCount]>=(0)))
GO
ALTER TABLE [dbo].[Users] CHECK CONSTRAINT [CK_Users_FailCount]
GO
ALTER TABLE [dbo].[Users]  WITH CHECK ADD  CONSTRAINT [CK_Users_FName] CHECK  ((len(ltrim(rtrim([FirstName])))>=(1)))
GO
ALTER TABLE [dbo].[Users] CHECK CONSTRAINT [CK_Users_FName]
GO
ALTER TABLE [dbo].[Users]  WITH CHECK ADD  CONSTRAINT [CK_Users_Gender] CHECK  (([Gender] IS NULL OR ([Gender]='PreferNot' OR [Gender]='Other' OR [Gender]='Female' OR [Gender]='Male')))
GO
ALTER TABLE [dbo].[Users] CHECK CONSTRAINT [CK_Users_Gender]
GO
ALTER TABLE [dbo].[Users]  WITH CHECK ADD  CONSTRAINT [CK_Users_LName] CHECK  ((len(ltrim(rtrim([LastName])))>=(1)))
GO
ALTER TABLE [dbo].[Users] CHECK CONSTRAINT [CK_Users_LName]
GO
ALTER TABLE [dbo].[Users]  WITH CHECK ADD  CONSTRAINT [CK_Users_Role] CHECK  (([Role]='opd_manager' OR [Role]='opdmanager' OR [Role]='admin_staff' OR [Role]='security' OR [Role]='housekeeping' OR [Role]='ward_boy' OR [Role]='auditor' OR [Role]='patient' OR [Role]='lab_technician' OR [Role]='labtech' OR [Role]='pharmacist' OR [Role]='receptionist' OR [Role]='nurse' OR [Role]='doctor' OR [Role]='admin' OR [Role]='superadmin'))
GO
ALTER TABLE [dbo].[Users] CHECK CONSTRAINT [CK_Users_Role]
GO
ALTER TABLE [dbo].[Users]  WITH CHECK ADD  CONSTRAINT [CK_Users_Username] CHECK  ((len([Username])>=(3) AND NOT [Username] like '% %'))
GO
ALTER TABLE [dbo].[Users] CHECK CONSTRAINT [CK_Users_Username]
GO
ALTER TABLE [dbo].[Wards]  WITH CHECK ADD  CONSTRAINT [CK_Ward_Cap] CHECK  (([Capacity] IS NULL OR [Capacity]>(0)))
GO
ALTER TABLE [dbo].[Wards] CHECK CONSTRAINT [CK_Ward_Cap]
GO
ALTER TABLE [dbo].[Wards]  WITH CHECK ADD  CONSTRAINT [CK_Ward_Type] CHECK  (([WardType] IS NULL OR ([WardType]='Maternity' OR [WardType]='Emergency' OR [WardType]='HDU' OR [WardType]='CCU' OR [WardType]='PICU' OR [WardType]='NICU' OR [WardType]='ICU' OR [WardType]='Private' OR [WardType]='SemiPrivate' OR [WardType]='General')))
GO
ALTER TABLE [dbo].[Wards] CHECK CONSTRAINT [CK_Ward_Type]
GO
/****** Object:  StoredProcedure [dbo].[sp_GenerateDoctorSlots]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[sp_GenerateDoctorSlots]
    @HospitalId BIGINT,
    @FromDate   DATE,
    @ToDate     DATE
AS
BEGIN
    SET NOCOUNT ON;
 
    DECLARE @Cursor DATE = @FromDate;
 
    WHILE @Cursor <= @ToDate
    BEGIN
        -- DATEPART(dw) = 1(Sun)..7(Sat); subtract 1 → 0(Sun)..6(Sat)
        DECLARE @DOW TINYINT = CAST(DATEPART(dw, @Cursor) - 1 AS TINYINT);
 
        INSERT INTO dbo.AppointmentSlots
            (HospitalId, DoctorId, ScheduleId, OpdRoomId,
             SlotDate, StartTime, EndTime, VisitType, Status)
        SELECT
            ds.HospitalId,
            ds.DoctorId,
            ds.Id,
            ds.OpdRoomId,
            @Cursor,
            CAST(DATEADD(MINUTE,  n.Number      * ds.SlotDurationMins, ds.StartTime) AS TIME),
            CAST(DATEADD(MINUTE, (n.Number + 1) * ds.SlotDurationMins, ds.StartTime) AS TIME),
            ds.VisitType,
            CASE WHEN dl.Id IS NOT NULL THEN 'on_leave' ELSE 'available' END
        FROM dbo.DoctorSchedules ds
        CROSS JOIN (
            SELECT TOP 200 ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS Number
            FROM sys.all_objects
        ) n
        LEFT JOIN dbo.DoctorLeaves dl
            ON  dl.DoctorId  = ds.DoctorId
            AND dl.LeaveDate = @Cursor
            AND dl.Status    = 'approved'
            AND dl.LeaveType = 'full_day'
        WHERE
            ds.HospitalId = @HospitalId
            AND ds.DayOfWeek  = @DOW
            AND ds.IsActive   = 1
            AND @Cursor       >= ds.EffectiveFrom
            AND (ds.EffectiveTo IS NULL OR @Cursor <= ds.EffectiveTo)
            AND DATEADD(MINUTE, (n.Number + 1) * ds.SlotDurationMins, ds.StartTime) <= ds.EndTime
            AND NOT EXISTS (
                SELECT 1 FROM dbo.AppointmentSlots ex
                WHERE ex.DoctorId  = ds.DoctorId
                  AND ex.SlotDate  = @Cursor
                  AND ex.StartTime = CAST(DATEADD(MINUTE, n.Number * ds.SlotDurationMins, ds.StartTime) AS TIME)
            );
 
        SET @Cursor = DATEADD(DAY, 1, @Cursor);
    END;
END;
GO
/****** Object:  StoredProcedure [dbo].[usp_AddCustomDistrict]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   PROCEDURE [dbo].[usp_AddCustomDistrict]
    @StateId      INT,
    @Name         NVARCHAR(120),
    @Headquarter  NVARCHAR(120) = NULL,
    @CustomNote   NVARCHAR(500) = NULL,
    @CreatedBy    BIGINT,
    @NewId        INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        -- Edge case: blank name
        IF LEN(LTRIM(RTRIM(@Name))) < 2
            THROW 50001, 'District name must be at least 2 characters.', 1;

        -- Edge case: duplicate (case-insensitive)
        IF EXISTS (SELECT 1 FROM dbo.Districts WHERE StateId=@StateId AND LOWER(Name)=LOWER(LTRIM(RTRIM(@Name))))
            THROW 50002, 'District already exists in this state.', 1;

        INSERT INTO dbo.Districts (StateId, Name, Headquarter, IsCustom, CustomNote, CreatedBy)
        VALUES (@StateId, LTRIM(RTRIM(@Name)), @Headquarter, 1, @CustomNote, @CreatedBy);

        SET @NewId = SCOPE_IDENTITY();

        INSERT INTO dbo.SetupChangeLog (TableName, RecordId, Action, NewValuesJson, RequestedBy)
        VALUES ('Districts', @NewId, 'INSERT',
            (SELECT @NewId AS Id, @StateId AS StateId, @Name AS Name, 1 AS IsCustom FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
            @CreatedBy);

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO
/****** Object:  StoredProcedure [dbo].[usp_AddCustomPincode]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- SP: Add custom pincode
CREATE   PROCEDURE [dbo].[usp_AddCustomPincode]
    @DistrictId   INT,
    @Pincode      NVARCHAR(20),
    @AreaName     NVARCHAR(150) = NULL,
    @City         NVARCHAR(100) = NULL,
    @CreatedBy    BIGINT,
    @NewId        INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        IF LEN(LTRIM(RTRIM(@Pincode))) < 4
            THROW 50003, 'Pincode must be at least 4 characters.', 1;

        IF EXISTS (SELECT 1 FROM dbo.Pincodes WHERE DistrictId=@DistrictId AND Pincode=LTRIM(RTRIM(@Pincode)))
            THROW 50004, 'Pincode already exists in this district.', 1;

        INSERT INTO dbo.Pincodes (DistrictId, Pincode, AreaName, City, IsCustom, CreatedBy)
        VALUES (@DistrictId, LTRIM(RTRIM(@Pincode)), @AreaName, @City, 1, @CreatedBy);

        SET @NewId = SCOPE_IDENTITY();

        INSERT INTO dbo.SetupChangeLog (TableName, RecordId, Action, NewValuesJson, RequestedBy)
        VALUES ('Pincodes', @NewId, 'INSERT',
            (SELECT @NewId AS Id, @DistrictId AS DistrictId, @Pincode AS Pincode FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
            @CreatedBy);

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO
/****** Object:  Trigger [dbo].[TR_AuditLogs_Immutable]    Script Date: 17-03-2026 22:01:36 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- Prevent UPDATE/DELETE on audit log
CREATE   TRIGGER [dbo].[TR_AuditLogs_Immutable]
ON [dbo].[AuditLogs]
AFTER UPDATE, DELETE AS
BEGIN
    RAISERROR('Audit log records cannot be modified or deleted.', 16, 1);
    ROLLBACK TRANSACTION;
END;
GO
ALTER TABLE [dbo].[AuditLogs] ENABLE TRIGGER [TR_AuditLogs_Immutable]
GO
/****** Object:  Trigger [dbo].[TR_HospitalSetup_UpdatedAt]    Script Date: 17-03-2026 22:01:37 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   TRIGGER [dbo].[TR_HospitalSetup_UpdatedAt]
ON [dbo].[HospitalSetup]
AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.HospitalSetup
    SET    UpdatedAt = SYSUTCDATETIME()
    FROM   dbo.HospitalSetup h
    INNER JOIN inserted i ON h.Id = i.Id;
END;
GO
ALTER TABLE [dbo].[HospitalSetup] ENABLE TRIGGER [TR_HospitalSetup_UpdatedAt]
GO
/****** Object:  Trigger [dbo].[TR_PatientProfiles_UHID]    Script Date: 17-03-2026 22:01:37 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- Step 3: Recreate trigger with FULL column list matching register.routes.js inserts
CREATE   TRIGGER [dbo].[TR_PatientProfiles_UHID]
ON [dbo].[PatientProfiles]
INSTEAD OF INSERT AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.PatientProfiles (
        UserId, HospitalId, UHID,
        FirstName, LastName, Gender, DateOfBirth,
        BloodGroup, Phone, PhoneCountryCode, Email,
        Street1, City, DistrictId, StateId, CountryId, PincodeId, PincodeText,
        EmergencyName, EmergencyRelation, EmergencyPhone,
        KnownAllergies, ChronicConditions,
        MaritalStatus, Religion, Occupation,
        InsuranceProvider, InsurancePolicyNo, InsuranceValidUntil,
        Aadhaar, PAN, PassportNo, VoterId, AbhaNumber,
        Street2, AgeYears,
        CreatedBy
    )
    SELECT
        UserId, HospitalId,
        -- UHID format: HMS-YYYYMMDD-XXXXX (e.g. HMS-20250615-00042)
        'HMS-' + CONVERT(NVARCHAR(8), GETDATE(), 112) + '-'
          + RIGHT('00000' + CAST(NEXT VALUE FOR dbo.UHIDSequence AS NVARCHAR(5)), 5),
        FirstName, LastName, Gender, DateOfBirth,
        BloodGroup, Phone, PhoneCountryCode, Email,
        Street1, City, DistrictId, StateId, CountryId, PincodeId, PincodeText,
        EmergencyName, EmergencyRelation, EmergencyPhone,
        KnownAllergies, ChronicConditions,
        MaritalStatus, Religion, Occupation,
        InsuranceProvider, InsurancePolicyNo, InsuranceValidUntil,
        Aadhaar, PAN, PassportNo, VoterId, AbhaNumber,
        Street2, AgeYears,
        CreatedBy
    FROM inserted;
END;
GO
ALTER TABLE [dbo].[PatientProfiles] ENABLE TRIGGER [TR_PatientProfiles_UHID]
GO
/****** Object:  Trigger [dbo].[TR_Users_UpdatedAt]    Script Date: 17-03-2026 22:01:37 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   TRIGGER [dbo].[TR_Users_UpdatedAt]
ON [dbo].[Users] AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Users SET UpdatedAt = SYSUTCDATETIME()
    FROM dbo.Users u INNER JOIN inserted i ON u.Id = i.Id;
END;
GO
ALTER TABLE [dbo].[Users] ENABLE TRIGGER [TR_Users_UpdatedAt]
GO
USE [HospitalDB];
GO

SELECT ISNULL(MAX(TRY_CONVERT(BIGINT, RIGHT(UHID, 5))), 0) + 1 AS NextStart
FROM dbo.PatientProfiles
WHERE UHID LIKE 'HMS-%-%';
GO
USE [HospitalDB];
GO

IF OBJECT_ID('dbo.UHIDSequence', 'SO') IS NOT NULL
    DROP SEQUENCE dbo.UHIDSequence;
GO

CREATE SEQUENCE dbo.UHIDSequence
AS BIGINT
START WITH 1
INCREMENT BY 1;
GO
SELECT name, current_value, start_value, increment
FROM sys.sequences
WHERE name = 'UHIDSequence'
  AND schema_id = SCHEMA_ID('dbo');
GO
