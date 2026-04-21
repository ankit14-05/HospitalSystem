/*
  Common Lab Test Seed Data
  -------------------------
  Run this after:
  1. selecting your HMS database in SSMS
  2. executing lab_emr_full_setup.sql
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF NOT EXISTS (SELECT 1 FROM dbo.LabTests WHERE Name = 'Complete Blood Count')
    BEGIN
        INSERT INTO dbo.LabTests
            (Name, ShortName, Category, Unit, NormalRangeMale, NormalRangeFemale, Price, TurnaroundHrs, RequiresFasting, SampleType, Instructions)
        VALUES
            ('Complete Blood Count', 'CBC', 'Hematology', 'Panel', 'Panel based', 'Panel based', 450.00, 2, 0, 'Blood', 'EDTA sample preferred. Includes hemoglobin, WBC, RBC, platelet count and indices.');
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.LabTests WHERE Name = 'HbA1c')
    BEGIN
        INSERT INTO dbo.LabTests
            (Name, ShortName, Category, Unit, NormalRangeMale, NormalRangeFemale, Price, TurnaroundHrs, RequiresFasting, SampleType, Instructions)
        VALUES
            ('HbA1c', 'HbA1c', 'Diabetology', '%', '< 5.7', '< 5.7', 700.00, 6, 0, 'Blood', 'Useful for long-term glucose control assessment.');
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.LabTests WHERE Name = 'Fasting Blood Sugar')
    BEGIN
        INSERT INTO dbo.LabTests
            (Name, ShortName, Category, Unit, NormalRangeMale, NormalRangeFemale, Price, TurnaroundHrs, RequiresFasting, SampleType, Instructions)
        VALUES
            ('Fasting Blood Sugar', 'FBS', 'Biochemistry', 'mg/dL', '70 - 99', '70 - 99', 250.00, 2, 1, 'Blood', 'Patient should fast for 8 to 10 hours before sample collection.');
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.LabTests WHERE Name = 'Post Prandial Blood Sugar')
    BEGIN
        INSERT INTO dbo.LabTests
            (Name, ShortName, Category, Unit, NormalRangeMale, NormalRangeFemale, Price, TurnaroundHrs, RequiresFasting, SampleType, Instructions)
        VALUES
            ('Post Prandial Blood Sugar', 'PPBS', 'Biochemistry', 'mg/dL', '< 140', '< 140', 250.00, 2, 0, 'Blood', 'Collect sample 2 hours after meal unless clinician has given different timing.');
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.LabTests WHERE Name = 'Lipid Profile')
    BEGIN
        INSERT INTO dbo.LabTests
            (Name, ShortName, Category, Unit, NormalRangeMale, NormalRangeFemale, Price, TurnaroundHrs, RequiresFasting, SampleType, Instructions)
        VALUES
            ('Lipid Profile', 'LIPID', 'Biochemistry', 'Panel', 'Panel based', 'Panel based', 900.00, 4, 1, 'Blood', 'Measures total cholesterol, triglycerides, HDL, LDL and VLDL.');
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.LabTests WHERE Name = 'Liver Function Test')
    BEGIN
        INSERT INTO dbo.LabTests
            (Name, ShortName, Category, Unit, NormalRangeMale, NormalRangeFemale, Price, TurnaroundHrs, RequiresFasting, SampleType, Instructions)
        VALUES
            ('Liver Function Test', 'LFT', 'Biochemistry', 'Panel', 'Panel based', 'Panel based', 950.00, 4, 0, 'Blood', 'Serum sample preferred. Includes bilirubin, AST, ALT, ALP and albumin.');
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.LabTests WHERE Name = 'Kidney Function Test')
    BEGIN
        INSERT INTO dbo.LabTests
            (Name, ShortName, Category, Unit, NormalRangeMale, NormalRangeFemale, Price, TurnaroundHrs, RequiresFasting, SampleType, Instructions)
        VALUES
            ('Kidney Function Test', 'KFT', 'Biochemistry', 'Panel', 'Panel based', 'Panel based', 950.00, 4, 0, 'Blood', 'Includes urea, creatinine and electrolyte markers where configured.');
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.LabTests WHERE Name = 'Thyroid Function Test')
    BEGIN
        INSERT INTO dbo.LabTests
            (Name, ShortName, Category, Unit, NormalRangeMale, NormalRangeFemale, Price, TurnaroundHrs, RequiresFasting, SampleType, Instructions)
        VALUES
            ('Thyroid Function Test', 'TFT', 'Endocrinology', 'Panel', 'Panel based', 'Panel based', 1100.00, 6, 0, 'Serum', 'Typical panel includes T3, T4 and TSH.');
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.LabTests WHERE Name = 'Urine Routine And Microscopy')
    BEGIN
        INSERT INTO dbo.LabTests
            (Name, ShortName, Category, Unit, NormalRangeMale, NormalRangeFemale, Price, TurnaroundHrs, RequiresFasting, SampleType, Instructions)
        VALUES
            ('Urine Routine And Microscopy', 'URINE RM', 'Pathology', 'Report', 'Within normal limits', 'Within normal limits', 300.00, 3, 0, 'Urine', 'Early morning midstream urine preferred when feasible.');
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.LabTests WHERE Name = 'Serum Creatinine')
    BEGIN
        INSERT INTO dbo.LabTests
            (Name, ShortName, Category, Unit, NormalRangeMale, NormalRangeFemale, Price, TurnaroundHrs, RequiresFasting, SampleType, Instructions)
        VALUES
            ('Serum Creatinine', 'CREAT', 'Biochemistry', 'mg/dL', '0.7 - 1.3', '0.6 - 1.1', 280.00, 2, 0, 'Blood', 'Useful for renal monitoring and medicine dose adjustment.');
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.LabTests WHERE Name = 'Vitamin D 25-OH')
    BEGIN
        INSERT INTO dbo.LabTests
            (Name, ShortName, Category, Unit, NormalRangeMale, NormalRangeFemale, Price, TurnaroundHrs, RequiresFasting, SampleType, Instructions)
        VALUES
            ('Vitamin D 25-OH', 'VIT D', 'Immunoassay', 'ng/mL', '30 - 100', '30 - 100', 1800.00, 12, 0, 'Serum', 'Use serum separator tube if available.');
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.LabTests WHERE Name = 'C-Reactive Protein')
    BEGIN
        INSERT INTO dbo.LabTests
            (Name, ShortName, Category, Unit, NormalRangeMale, NormalRangeFemale, Price, TurnaroundHrs, RequiresFasting, SampleType, Instructions)
        VALUES
            ('C-Reactive Protein', 'CRP', 'Immunology', 'mg/L', '< 5', '< 5', 600.00, 4, 0, 'Blood', 'Inflammatory marker useful for infection and follow-up assessment.');
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.LabTests WHERE Name = 'Erythrocyte Sedimentation Rate')
    BEGIN
        INSERT INTO dbo.LabTests
            (Name, ShortName, Category, Unit, NormalRangeMale, NormalRangeFemale, Price, TurnaroundHrs, RequiresFasting, SampleType, Instructions)
        VALUES
            ('Erythrocyte Sedimentation Rate', 'ESR', 'Hematology', 'mm/hr', '0 - 15', '0 - 20', 220.00, 2, 0, 'Blood', 'Common inflammatory marker. Collect in proper anticoagulant tube.');
    END;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    THROW;
END CATCH;
