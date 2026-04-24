const { query, withTransaction, sql } = require('../config/database');
const notifService = require('./notificationService');
const AppError = require('../utils/AppError');
const path = require('path');
const fs = require('fs');
const { PDFDocument, rgb, StandardFonts, PageSizes, degrees } = require('pdf-lib');

// ─────────────────────────────────────────────────────────────
// Helper – generate a unique order number: LAB-YYYYMMDD-XXXXXX
// ─────────────────────────────────────────────────────────────
function generateOrderNumber() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `LAB-${datePart}-${rand}`;
}

// ─────────────────────────────────────────────────────────────
// Helper – generate sequential sample ID: #smp-dd/mm/yyyy-XXX
// ─────────────────────────────────────────────────────────────
async function generateSampleId() {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();
  const datePart = `${day}/${month}/${year}`;
  const prefix = `#smp-${datePart}-`;

  const res = await query(`
    SELECT COUNT(*) as count 
    FROM dbo.LabOrders 
    WHERE SampleId LIKE @prefix + '%'
  `, {
    prefix: { type: sql.NVarChar(30), value: prefix }
  });

  const nextSeq = (res.recordset[0].count + 1).toString().padStart(3, '0');
  return `${prefix}${nextSeq}`;
}

// ─────────────────────────────────────────────────────────────
// TESTS CATALOGUE
// ─────────────────────────────────────────────────────────────
async function getLabTests({ search, category, active = true } = {}) {
  let q = `
    SELECT Id, Name, ShortName, Category, Unit,
           NormalRangeMale, NormalRangeFemale, NormalRangeChild,
           Price, TurnaroundHrs, RequiresFasting, SampleType,
           Instructions, IsActive
    FROM dbo.LabTests
    WHERE 1=1
  `;
  const params = {};

  if (active !== undefined) {
    q += ` AND IsActive = @active`;
    params.active = { type: sql.Bit, value: active ? 1 : 0 };
  }
  if (category) {
    q += ` AND Category = @category`;
    params.category = { type: sql.NVarChar(100), value: category };
  }
  if (search) {
    q += ` AND (Name LIKE @search OR ShortName LIKE @search OR Category LIKE @search)`;
    params.search = { type: sql.NVarChar(200), value: `%${search}%` };
  }

  q += ` ORDER BY Category, Name`;
  const result = await query(q, params);
  return result.recordset;
}

// ─────────────────────────────────────────────────────────────
// CREATE LAB ORDER
// ─────────────────────────────────────────────────────────────
async function createLabOrder({
  hospitalId,
  patientId,
  orderedBy,       // userId of the ordering doctor
  appointmentId,
  notes,
  tests = [],      // [{ testId, priority, placeType, roomNo, externalLabName, criteria, additionalDetails }]
  requestedByRole = null,
}) {
  const result = await withTransaction(async (transaction) => {
    const orderNumber = generateOrderNumber();

    // The new schema requires Priority on the Order as well, we'll use highest or first
    const globalPriority = tests.length > 0 && tests.some(t => t.priority === 'STAT') ? 'STAT' 
                         : tests.some(t => t.priority === 'Urgent') ? 'Urgent' 
                         : 'Routine';

    // 1. Insert ONE Parent Order (doctor prescribed in consultation flow)
    const orderQ = `
      INSERT INTO dbo.LabOrders
        (HospitalId, PatientId, OrderedBy, AppointmentId, OrderNumber, OrderDate,
         Status, Priority, Notes, CreatedAt, UpdatedAt, CreatedBy, RejectionReason)
      OUTPUT INSERTED.Id
      VALUES
        (@hospitalId, @patientId, @orderedBy, @appointmentId, @orderNumber, GETUTCDATE(),
         'Pending', @priority, @notes, GETUTCDATE(), GETUTCDATE(), @orderedBy, @requestedByRole)
    `;

    const txRequest = transaction.request();
    txRequest.input('hospitalId',        sql.BigInt,         hospitalId);
    txRequest.input('patientId',         sql.BigInt,         patientId);
    txRequest.input('orderedBy',         sql.BigInt,         orderedBy || null);
    txRequest.input('appointmentId',     sql.BigInt,         appointmentId || null);
    txRequest.input('orderNumber',       sql.NVarChar(30),   orderNumber);
    txRequest.input('priority',          sql.NVarChar(20),   globalPriority);
    txRequest.input('notes',             sql.NVarChar(sql.MAX), notes || null);
    txRequest.input('requestedByRole',   sql.NVarChar(100), requestedByRole || null);

    const orderResult = await txRequest.query(orderQ);
    const labOrderId = orderResult.recordset[0].Id;

    // 2. Insert mapped Order Items
    for (const t of tests) {
      let resolvedLabId = null;
      let resolvedRoomId = null;
      let resolvedLabType = t.placeType || 'Indoor'; // 'Indoor' or 'Outside'

      // Resolve String RoomNo to LabId and RoomId
      if (resolvedLabType === 'Indoor' && t.roomNo) {
        const roomReq = transaction.request();
        roomReq.input('roomNo', sql.NVarChar(30), t.roomNo);
        const rmRes = await roomReq.query('SELECT Id, LabId FROM dbo.LabRooms WHERE RoomNo = @roomNo');
        if (rmRes.recordset.length > 0) {
           resolvedRoomId = rmRes.recordset[0].Id;
           resolvedLabId = rmRes.recordset[0].LabId;
        }
      }

      const itemQ = `
        INSERT INTO dbo.LabOrderItems
          (LabOrderId, TestId, Priority, LabId, LabType, RoomId, ExternalLabName, Criteria, AdditionalDetails, Status)
        VALUES (@labOrderId, @testId, @itemPriority, @labId, @labType, @roomId, @extLab, @criteria, @addDetails, 'Pending')
      `;
      const itemReq = transaction.request();
      itemReq.input('labOrderId',  sql.BigInt, labOrderId);
      itemReq.input('testId',      sql.BigInt, t.testId);
      itemReq.input('itemPriority',sql.NVarChar(20), t.priority || 'Routine');
      itemReq.input('labId',       sql.BigInt, resolvedLabId);
      itemReq.input('labType',     sql.NVarChar(20), resolvedLabType);
      itemReq.input('roomId',      sql.BigInt, resolvedRoomId);
      itemReq.input('extLab',      sql.NVarChar(200), t.externalLabName || null);
      itemReq.input('criteria',    sql.NVarChar(200), t.criteria || null);
      itemReq.input('addDetails',  sql.NVarChar(sql.MAX), t.additionalDetails || null);
      
      await itemReq.query(itemQ);
    }

    return [{ labOrderId, orderNumber }];
  });

  return result;
}

// ─────────────────────────────────────────────────────────────
// GET ORDERS (list — role-filtered)
// ─────────────────────────────────────────────────────────────
async function getLabOrders({ hospitalId, patientId, orderedBy, status, priority, allowedRooms, date, page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  const params = {};
  let where = `WHERE 1=1`;
  
  if (hospitalId) {
    where += ` AND lo.HospitalId = @hospitalId`;
    params.hospitalId = { type: sql.BigInt, value: hospitalId };
  }

  if (patientId) {
    where += ` AND lo.PatientId = @patientId`;
    params.patientId = { type: sql.BigInt, value: patientId };
  }
  if (orderedBy) {
    where += ` AND (
      lo.OrderedBy = @orderedBy
      OR EXISTS (
        SELECT 1 FROM dbo.DoctorProfiles dp
        WHERE dp.Id = lo.OrderedBy AND dp.UserId = @orderedBy
      )
    )`;
    params.orderedBy = { type: sql.BigInt, value: orderedBy };
  }
  if (status) {
    where += ` AND lo.Status = @status`;
    params.status = { type: sql.NVarChar(20), value: status };
  }
  if (priority) {
    where += ` AND lo.Priority = @priority`;
    params.priority = { type: sql.NVarChar(20), value: priority };
  }
  if (date) {
    where += ` AND CAST(lo.OrderDate AS DATE) = @date`;
    params.date = { type: sql.Date, value: date };
  }
  if (allowedRooms !== undefined) {
    if (allowedRooms.length === 0) {
      where += ` AND 1=0`; // Assigned to no rooms, see nothing.
    } else {
      const roomParams = [];
      allowedRooms.forEach((r, i) => {
        const key = `room_${i}`;
        roomParams.push(`@${key}`);
        params[key] = { type: sql.BigInt, value: r };
      });
      where += ` AND EXISTS (SELECT 1 FROM dbo.LabOrderItems lit WHERE lit.LabOrderId = lo.Id AND lit.RoomId IN (${roomParams.join(',')}))`;
    }
  }

  params.limit  = { type: sql.Int, value: limit };
  params.offset = { type: sql.Int, value: offset };

  const q = `
    SELECT
      lo.Id, lo.OrderNumber, lo.OrderDate, lo.Status, lo.Priority, lo.SampleId,
      li.LabType AS PlaceType, rm.RoomNo, li.ExternalLabName, li.Criteria, lt.Name AS TestName,
      li.AdditionalDetails, lo.Notes, lo.CreatedAt, lo.ReportedAt,
      p.UHID, p.FirstName + ' ' + p.LastName AS PatientName, p.Phone AS PatientPhone,
      COALESCE(u.FirstName + ' ' + u.LastName, du.FirstName + ' ' + du.LastName) AS DoctorName,
      COUNT(*) OVER() AS TotalCount,
      (SELECT COUNT(*) FROM dbo.LabOrderItems lit WHERE lit.LabOrderId = lo.Id) AS TestCount
    FROM dbo.LabOrders lo
    JOIN dbo.PatientProfiles p ON p.Id = lo.PatientId
    LEFT JOIN dbo.Users u       ON u.Id = lo.OrderedBy
    LEFT JOIN dbo.DoctorProfiles dp ON dp.Id = lo.OrderedBy
    LEFT JOIN dbo.Users du      ON du.Id = dp.UserId
    OUTER APPLY (
        SELECT TOP 1 * FROM dbo.LabOrderItems l_item WHERE l_item.LabOrderId = lo.Id
    ) li
    LEFT JOIN dbo.LabRooms rm ON rm.Id = li.RoomId
    LEFT JOIN dbo.LabTests lt ON lt.Id = li.TestId
    ${where}
    ORDER BY lo.OrderDate DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `;

  const result = await query(q, params);
  const total  = result.recordset[0]?.TotalCount ?? 0;
  return { orders: result.recordset, total, page, limit };
}

// ─────────────────────────────────────────────────────────────
// GET SINGLE ORDER WITH ITEMS
// ─────────────────────────────────────────────────────────────
async function getLabOrderById(orderId, hospitalId) {
  const orderQ = `
    SELECT
      lo.*, lo.RejectionReason,
      p.UHID, p.FirstName + ' ' + p.LastName AS PatientName,
      p.DateOfBirth, p.Gender, p.Phone AS PatientPhone,
      COALESCE(u.FirstName + ' ' + u.LastName, du.FirstName + ' ' + du.LastName) AS DoctorName
    FROM dbo.LabOrders lo
    JOIN dbo.PatientProfiles p ON p.Id = lo.PatientId
    LEFT JOIN dbo.Users u       ON u.Id = lo.OrderedBy
    LEFT JOIN dbo.DoctorProfiles dp ON dp.Id = lo.OrderedBy
    LEFT JOIN dbo.Users du      ON du.Id = dp.UserId
    WHERE lo.Id = @orderId AND lo.HospitalId = @hospitalId
  `;
  const orderRes = await query(orderQ, {
    orderId:    { type: sql.BigInt, value: orderId },
    hospitalId: { type: sql.BigInt, value: hospitalId },
  });
  if (!orderRes.recordset.length) return null;

  const itemsQ = `
    SELECT
      li.Id, li.TestId, li.Status,
      li.ResultValue, li.ResultUnit, li.NormalRange,
      li.IsAbnormal, li.Remarks,
      lt.Name AS TestName, lt.ShortName, lt.Category,
      lt.Unit, lt.SampleType, lt.TurnaroundHrs
    FROM dbo.LabOrderItems li
    JOIN dbo.LabTests lt ON lt.Id = li.TestId
    WHERE li.LabOrderId = @orderId
    ORDER BY lt.Category, lt.Name
  `;
  const itemsRes = await query(itemsQ, {
    orderId: { type: sql.BigInt, value: orderId },
  });

  const attachments = await getLabAttachments(orderId);

  return { ...orderRes.recordset[0], items: itemsRes.recordset, attachments };
}

// ─────────────────────────────────────────────────────────────
// UPDATE ORDER STATUS
// ─────────────────────────────────────────────────────────────
async function updateOrderStatus(orderId, hospitalId, status, updatedBy, providedSampleId = null) {
  const extraFields = {};
  const params = {
    status:     { type: sql.NVarChar(20), value: status },
    orderId:    { type: sql.BigInt,       value: orderId },
    hospitalId: { type: sql.BigInt,       value: hospitalId },
    updatedBy:  { type: sql.BigInt,       value: updatedBy },
  };

  if (status === 'Processing' || status === 'Collecting') {
    // Generate SampleId if not already present
    const checkQ = `SELECT SampleId FROM dbo.LabOrders WHERE Id = @orderId`;
    const checkRes = await query(checkQ, { orderId: { type: sql.BigInt, value: orderId } });
    
    if (!checkRes.recordset[0]?.SampleId) {
       const finalSampleId = providedSampleId || await generateSampleId();
       params.sampleId = { type: sql.NVarChar(50), value: finalSampleId };
       extraFields.sampleId = `, SampleId = @sampleId, CollectedAt = GETUTCDATE(), CollectedBy = @updatedBy`;
    }
  } else if (status === 'Completed' || status === 'Pending Approval') {
    // When lab tech "completes" an upload, it goes to Pending Approval first
    extraFields.reportedAt = `, ReportedAt = GETUTCDATE(), ReportedBy = @updatedBy`;
    // Override the status to 'Pending Approval'
    params.status = { type: sql.NVarChar(20), value: 'Pending Approval' };
  }

  const setClauses = `Status = @status, UpdatedAt = GETUTCDATE()${extraFields.sampleId || ''}${extraFields.reportedAt || ''}`;

  const q = `
    UPDATE dbo.LabOrders
    SET ${setClauses}
    WHERE Id = @orderId AND HospitalId = @hospitalId
  `;
  const result = await query(q, params);
  return result.rowsAffected[0] > 0;
}

// ─────────────────────────────────────────────────────────────
// GET PENDING APPROVAL ORDERS (for Lab Incharge)
// ─────────────────────────────────────────────────────────────
async function getPendingApprovalOrders(hospitalId) {
  const res = await query(`
    SELECT
      lo.Id, lo.OrderNumber, lo.Status, lo.Priority, lo.RejectionReason,
      lo.OrderDate, lo.ReportedAt, lo.SampleId,
      pp.FirstName + ' ' + pp.LastName AS PatientName,
      pp.UHID,
      u_tech.FirstName + ' ' + u_tech.LastName AS UploadedByName,
      lo.ReportedBy AS UploadedById,
      STRING_AGG(lt.Name, ', ') AS TestNames
    FROM dbo.LabOrders lo
    LEFT JOIN dbo.PatientProfiles pp ON pp.Id = lo.PatientId
    LEFT JOIN dbo.Users u_tech ON u_tech.Id = lo.ReportedBy
    LEFT JOIN dbo.LabOrderItems li ON li.LabOrderId = lo.Id
    LEFT JOIN dbo.LabTests lt ON lt.Id = li.TestId
    WHERE lo.Status = 'Pending Approval'
      AND lo.HospitalId = @hospitalId
    GROUP BY
      lo.Id, lo.OrderNumber, lo.Status, lo.Priority, lo.RejectionReason,
      lo.OrderDate, lo.ReportedAt, lo.SampleId,
      pp.FirstName, pp.LastName, pp.UHID,
      u_tech.FirstName, u_tech.LastName, lo.ReportedBy
    ORDER BY lo.ReportedAt ASC
  `, {
    hospitalId: { type: sql.BigInt, value: hospitalId }
  });
  return res.recordset;
}

async function getCompletedApprovalOrders(hospitalId) {
  const res = await query(`
    SELECT TOP 100
      lo.Id, lo.OrderNumber, lo.Status, lo.Priority, lo.RejectionReason,
      lo.OrderDate, lo.ReportedAt, lo.VerifiedAt, lo.SampleId,
      pp.FirstName + ' ' + pp.LastName AS PatientName,
      pp.UHID,
      u_ver.FirstName + ' ' + u_ver.LastName AS VerifiedByName,
      lo.VerifiedBy AS VerifiedById,
      STRING_AGG(lt.Name, ', ') AS TestNames
    FROM dbo.LabOrders lo
    LEFT JOIN dbo.PatientProfiles pp ON pp.Id = lo.PatientId
    LEFT JOIN dbo.Users u_ver ON u_ver.Id = lo.VerifiedBy
    LEFT JOIN dbo.LabOrderItems li ON li.LabOrderId = lo.Id
    LEFT JOIN dbo.LabTests lt ON lt.Id = li.TestId
    WHERE lo.Status IN ('Completed', 'Rejected')
      AND lo.HospitalId = @hospitalId
    GROUP BY
      lo.Id, lo.OrderNumber, lo.Status, lo.Priority, lo.RejectionReason,
      lo.OrderDate, lo.ReportedAt, lo.VerifiedAt, lo.SampleId,
      pp.FirstName, pp.LastName, pp.UHID,
      u_ver.FirstName, u_ver.LastName, lo.VerifiedBy
    ORDER BY lo.VerifiedAt DESC
  `, {
    hospitalId: { type: sql.BigInt, value: hospitalId }
  });
  return res.recordset;
}

// ─────────────────────────────────────────────────────────────
// REJECT LAB TEST — move back to Processing + add reason
// ─────────────────────────────────────────────────────────────
async function rejectLabTest(orderId, reason, rejectedByUserId, hospitalId) {
  // 1. Verify the order exists and is in 'Pending Approval' state
  const orderRes = await query(`
    SELECT Id FROM dbo.LabOrders 
    WHERE Id = @orderId AND Status = 'Pending Approval' 
      AND HospitalId = @hospitalId
  `, { 
    orderId: { type: sql.BigInt, value: orderId },
    hospitalId: { type: sql.BigInt, value: hospitalId }
  });

  if (!orderRes.recordset.length) {
    throw new Error('Order not found or not in Pending Approval state.');
  }

  // 2. Update status back to Processing and set RejectionReason
  await query(`
    UPDATE dbo.LabOrders
    SET Status = 'Processing',
        RejectionReason = @reason,
        UpdatedAt = GETDATE()
    WHERE Id = @orderId
  `, {
    orderId: { type: sql.BigInt, value: orderId },
    reason: { type: sql.NVarChar(sql.MAX), value: reason }
  });

  // We also update the items to Processing
  await query(`
    UPDATE dbo.LabOrderItems
    SET Status = 'Processing', UpdatedAt = GETDATE()
    WHERE LabOrderId = @orderId
  `, { orderId: { type: sql.BigInt, value: orderId } });

  return { success: true, message: 'Order rejected and sent back to technician.' };
}

// ─────────────────────────────────────────────────────────────
// APPROVE LAB TEST — stamp PDF + mark Completed
// ─────────────────────────────────────────────────────────────
async function approveLabTest(orderId, approvedByUserId, approvedByName, hospitalId) {
  // 1. Verify the order exists and is in 'Pending Approval' state
  const orderRes = await query(`
    SELECT lo.Id, lo.OrderNumber, lo.HospitalId,
           pp.FirstName + ' ' + pp.LastName AS PatientName
    FROM dbo.LabOrders lo
    LEFT JOIN dbo.PatientProfiles pp ON pp.Id = lo.PatientId
    WHERE lo.Id = @orderId AND lo.Status = 'Pending Approval'
  `, { orderId: { type: sql.BigInt, value: orderId } });

  if (!orderRes.recordset.length) {
    throw new Error('Order not found or not in Pending Approval state.');
  }

  const order = orderRes.recordset[0];

  // 2. Fetch the latest PDF attachment for this order
  const attachRes = await query(`
    SELECT Id, FilePath, FileName, FileType
    FROM dbo.LabOrderAttachments
    WHERE LabOrderId = @orderId
    ORDER BY UploadedAt DESC
  `, { orderId: { type: sql.BigInt, value: orderId } });

  let stampedFilePath = null;

  if (attachRes.recordset.length > 0) {
    for (const attachment of attachRes.recordset) {
      const isPdf = attachment.FileName.toLowerCase().endsWith('.pdf') || attachment.FileType === 'application/pdf';
      const isImage = /\.(jpg|jpeg|png)$/i.test(attachment.FileName);

    if (isPdf || isImage) {
      try {
        const backendRoot = path.resolve(__dirname, '../..'); // Points to 'backend' folder
        const safeAttachmentPath = attachment.FilePath.replace(/^\//, '');
        const absPath = path.join(backendRoot, safeAttachmentPath);

        if (fs.existsSync(absPath)) {
          let pdfDoc;
          const fileBytes = fs.readFileSync(absPath);

          if (isPdf) {
            pdfDoc = await PDFDocument.load(fileBytes);
          } else {
            // It's an image, create a new PDF and embed the image
            pdfDoc = await PDFDocument.create();
            const page = pdfDoc.addPage(PageSizes.A4);
            const { width, height } = page.getSize();
            
            let embeddedImg;
            if (attachment.FileName.toLowerCase().endsWith('.png')) {
              embeddedImg = await pdfDoc.embedPng(fileBytes);
            } else {
              embeddedImg = await pdfDoc.embedJpg(fileBytes);
            }

            // Scale to fit page while maintaining aspect ratio
            const dims = embeddedImg.scaleToFit(width - 100, height - 200);
            page.drawImage(embeddedImg, {
              x: (width - dims.width) / 2,
              y: height - dims.height - 50,
              width: dims.width,
              height: dims.height
            });
            
            page.drawText('Original Lab Result (Image)', {
              x: 50, y: height - 40, size: 10, color: rgb(0.5, 0.5, 0.5)
            });
          }

          const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
          const pages = pdfDoc.getPages();
          const lastPage = pages[pages.length -1];
          const { width, height } = lastPage.getSize();

          const now = new Date();
          const approvedAt = now.toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short', hour12: true });
          const sigText1 = `Digitally Approved by: ${approvedByName}`;
          const sigText2 = `Order: ${order.OrderNumber}  |  Approved On: ${approvedAt}`;
          const sigText3 = 'MediCore HMS — Verified Result';

          // Draw a signature box at the bottom-right
          // Fetch signature settings for this incharge
          let sigPref = 'Corner';
          let sigImgPath = null;
          let sigDesignation = null;
          
          try {
            const sigSettings = await getSignatureSettings(approvedByUserId);
            sigPref = sigSettings.SignaturePreference || 'Corner';
            sigImgPath = sigSettings.SignatureImagePath;
            sigDesignation = sigSettings.SignatureText;
          } catch (sigSetErr) {
            console.warn('[approveLabTest] Could not fetch signature settings, defaulting to Corner Stamp.');
          }

          if (sigPref === 'NewPage') {
            // Choice C: Dedicated Signature Page
            const newPage = pdfDoc.addPage(PageSizes.A4);
            const { width, height } = newPage.getSize();

            // Draw Hospital Title/Header
            newPage.drawText('OFFICIAL LABORATORY REPORT VERIFICATION', { 
              x: 50, y: height - 80, size: 18, font, color: rgb(0.059, 0.580, 0.533) 
            });
            newPage.drawLine({
              start: { x: 50, y: height - 90 },
              end: { x: width - 50, y: height - 90 },
              thickness: 1.5,
              color: rgb(0.8, 0.8, 0.8)
            });

            // Summary info
            newPage.drawText(`Lab Order ID: ${order.OrderNumber}`, { x: 50, y: height - 130, size: 12, font });
            newPage.drawText(`Patient: ${order.PatientName}`, { x: 50, y: height - 150, size: 12, font });

            // Signature area in the middle-bottom
            const boxW = 350;
            const boxH = 180;
            const boxX = (width - boxW) / 2;
            const boxY = height / 2 - 100;

            newPage.drawRectangle({
              x: boxX, y: boxY, width: boxW, height: boxH,
              borderColor: rgb(0.059, 0.580, 0.533),
              borderWidth: 1,
              color: rgb(0.98, 0.98, 0.98)
            });

            // Verification text
            newPage.drawText('DIGITALLY VERIFIED AND APPROVED', {
              x: boxX + 60, y: boxY + 140, size: 14, font, color: rgb(0.059, 0.580, 0.533)
            });

            // Handle Signature Image if it exists
            if (sigImgPath) {
              try {
                const backendRoot = path.resolve(__dirname, '../..');
                const safeSigPath = sigImgPath.replace(/^\//, ''); // Strip leading slash so path.join works
                const imgAbsPath = path.join(backendRoot, safeSigPath);
                
                if (fs.existsSync(imgAbsPath)) {
                  const imgBytes = fs.readFileSync(imgAbsPath);
                  let embeddedImg;
                  if (imgAbsPath.toLowerCase().endsWith('.png')) {
                    embeddedImg = await pdfDoc.embedPng(imgBytes);
                  } else {
                    embeddedImg = await pdfDoc.embedJpg(imgBytes);
                  }
                  
                  const dims = embeddedImg.scale(0.4);
                  newPage.drawImage(embeddedImg, {
                    x: boxX + (boxW - dims.width) / 2,
                    y: boxY + 50,
                    width: dims.width,
                    height: dims.height
                  });
                } else {
                  console.warn(`[approveLabTest] Signature image not found at ${imgAbsPath}, falling back to text.`);
                  throw new Error("File not found");
                }
              } catch (imgErr) {
                console.error('[approveLabTest] Error embedding signature image:', imgErr.message);
                // Fallback to text name signature
                newPage.drawText(approvedByName, {
                  x: boxX + (boxW - (approvedByName.length * 7)) / 2,
                  y: boxY + 80,
                  size: 16,
                  font,
                  color: rgb(0,0,0)
                });
              }
            } else {
              // Fallback to text name signature
              newPage.drawText(approvedByName, {
                x: boxX + (boxW - (approvedByName.length * 7)) / 2,
                y: boxY + 80,
                size: 16,
                font,
                color: rgb(0,0,0)
              });
            }

            if (sigDesignation) {
              newPage.drawText(sigDesignation, {
                x: boxX + (boxW - (sigDesignation.length * 5)) / 2,
                y: boxY + 60,
                size: 10,
                font,
                color: rgb(0.4, 0.4, 0.4)
              });
            }

            const now = new Date();
            const approvedAt = now.toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short', hour12: true });
            newPage.drawText(`Verification Time: ${approvedAt}`, {
              x: boxX + 70, y: boxY + 20, size: 9, font, color: rgb(0.5, 0.5, 0.5)
            });

          } else {
            // Original Choice: Corner Stamp on existing last page (Rotation Agnostic)
            let angleVal = lastPage.getRotation().angle || 0;
            let angle = ((angleVal % 360) + 360) % 360; 

            const vPageW = (angle === 90 || angle === 270) ? height : width;
            const vPageH = (angle === 90 || angle === 270) ? width : height;

            const toPhysical = (vx, vy) => {
              if (angle === 0) return [vx, vy];
              if (angle === 90) return [width - vy, vx];
              if (angle === 180) return [width - vx, height - vy];
              if (angle === 270) return [vy, height - vx];
            };

            const boxW = 290;
            const boxH = 65;
            const padR = 20;
            const padB = 30;

            const vx = vPageW - padR - boxW;
            const vy = padB;
            const [unrotX, unrotY] = toPhysical(vx, vy);
            const stampRotation = degrees(angle);

            lastPage.drawRectangle({
              x: unrotX, y: unrotY, width: boxW, height: boxH,
              rotate: stampRotation,
              borderColor: rgb(0.059, 0.580, 0.533),
              borderWidth: 1.5,
              color: rgb(0.937, 0.988, 0.984),
              opacity: 0.95
            });
            
            // Render Signature Image if exists
            let imageDrawn = false;
            let dims = { width: 0, height: 0 };
            
            if (sigImgPath) {
              try {
                const backendRoot = path.resolve(__dirname, '../..');
                const safeSigPath = sigImgPath.replace(/^\//, ''); 
                const imgAbsPath = path.join(backendRoot, safeSigPath);
                
                if (fs.existsSync(imgAbsPath)) {
                  const imgBytes = fs.readFileSync(imgAbsPath);
                  let embeddedImg;
                  if (imgAbsPath.toLowerCase().endsWith('.png')) {
                    embeddedImg = await pdfDoc.embedPng(imgBytes);
                  } else {
                    embeddedImg = await pdfDoc.embedJpg(imgBytes);
                  }
                  
                  // Corner stamp image scaled very small
                  dims = embeddedImg.scale(0.12);
                  const imgVx = vx + 10;
                  const imgVy = vy + 36;
                  const [imgUx, imgUy] = toPhysical(imgVx, imgVy);
                  
                  lastPage.drawImage(embeddedImg, {
                    x: imgUx, y: imgUy,
                    width: dims.width, height: dims.height,
                    rotate: stampRotation
                  });
                  imageDrawn = true;
                  
                  // Shift the "Digitally Approved by" text to the right of the image
                  const txtVx = vx + 20 + dims.width;
                  const txtVy = vy + 44;
                  const [txtUx, txtUy] = toPhysical(txtVx, txtVy);
                  
                  lastPage.drawText(`Approved by: ${approvedByName}`, {
                    x: txtUx, y: txtUy,
                    size: 9, font, color: rgb(0.059, 0.435, 0.400),
                    rotate: stampRotation
                  });
                }
              } catch (err) {
                 console.error('[approveLabTest Corner] Error embedding signature image:', err.message);
              }
            }
            
            if (!imageDrawn) {
              const txtVx = vx + 10;
              const txtVy = vy + 44;
              const [txtUx, txtUy] = toPhysical(txtVx, txtVy);
              
              lastPage.drawText(`Digitally Approved by: ${approvedByName}`, {
                x: txtUx, y: txtUy,
                size: 10, font, color: rgb(0.059, 0.435, 0.400),
                rotate: stampRotation
              });
            }

            const dtVx = vx + 10;
            const dtVy = vy + 20;
            const [dtUx, dtUy] = toPhysical(dtVx, dtVy);
            
            lastPage.drawText(`Order: ${order.OrderNumber}  |  Approved On: ${new Date().toLocaleString()}`, {
              x: dtUx, y: dtUy,
              size: 7.5, font, color: rgb(0.37, 0.37, 0.37),
              rotate: stampRotation
            });
            
            const hlVx = vx + 10;
            const hlVy = vy + 8;
            const [hlUx, hlUy] = toPhysical(hlVx, hlVy);

            lastPage.drawText('MediCore HMS — Verified Result', {
              x: hlUx, y: hlUy,
              size: 7.5, font, color: rgb(0.059, 0.580, 0.533),
              rotate: stampRotation
            });
          }

          const modifiedPdfBytes = await pdfDoc.save();
          
          // If it was an image, we should probably save as .pdf now
          let targetPath = absPath;
          if (isImage) {
            targetPath = absPath.replace(/\.(jpg|jpeg|png)$/i, '.pdf');
            fs.writeFileSync(targetPath, modifiedPdfBytes);
            // Update database with new PDF path if needed, or just return it
            stampedFilePath = attachment.FilePath.replace(/\.(jpg|jpeg|png)$/i, '.pdf');
            
            const newFileName = attachment.FileName.replace(/\.(jpg|jpeg|png)$/i, '.pdf');
            await query(`UPDATE dbo.LabOrderAttachments SET FilePath = @newPath, FileType = 'application/pdf', FileName = @newName WHERE Id = @attachId`, {
              newPath: { type: sql.NVarChar(sql.MAX), value: stampedFilePath },
              newName: { type: sql.NVarChar(255), value: newFileName },
              attachId: { type: sql.BigInt, value: attachment.Id }
            });
          } else {
            fs.writeFileSync(absPath, modifiedPdfBytes);
            stampedFilePath = attachment.FilePath;
          }
        } else {
          console.error('[approveLabTest] File not found at:', absPath);
        }
      } catch (pdfErr) {
        console.error('[approveLabTest] PDF processing failed:', pdfErr.message);
        throw new Error('Digital signature processing failed: ' + pdfErr.message);
      }
    }
    }
  }

  // 3. Mark order as Completed with VerifiedAt and VerifiedBy
  await query(`
    UPDATE dbo.LabOrders
    SET Status = 'Completed',
        VerifiedBy = @approvedBy,
        VerifiedAt = GETUTCDATE(),
        UpdatedAt = GETUTCDATE()
    WHERE Id = @orderId
  `, {
    orderId: { type: sql.BigInt, value: orderId },
    approvedBy: { type: sql.BigInt, value: approvedByUserId }
  });

  return {
    success: true,
    orderNumber: order.OrderNumber,
    patientName: order.PatientName,
    stampedFile: stampedFilePath
  };
}

// ─────────────────────────────────────────────────────────────
// ENTER / UPDATE TEST RESULT
// ─────────────────────────────────────────────────────────────
async function enterTestResult(orderId, itemId, { resultValue, resultUnit, normalRange, isAbnormal, remarks }, enteredBy) {
  const q = `
    UPDATE dbo.LabOrderItems
    SET ResultValue = @resultValue,
        ResultUnit  = @resultUnit,
        NormalRange = @normalRange,
        IsAbnormal  = @isAbnormal,
        Remarks     = @remarks,
        Status      = 'Completed'
    WHERE Id = @itemId AND LabOrderId = @orderId
  `;
  const result = await query(q, {
    resultValue: { type: sql.NVarChar(500), value: resultValue },
    resultUnit:  { type: sql.NVarChar(50),  value: resultUnit  || null },
    normalRange: { type: sql.NVarChar(100), value: normalRange || null },
    isAbnormal:  { type: sql.Bit,           value: isAbnormal  ?? null },
    remarks:     { type: sql.NVarChar(sql.MAX), value: remarks || null },
    itemId:      { type: sql.BigInt,        value: itemId },
    orderId:     { type: sql.BigInt,        value: orderId },
  });

  // Auto-complete parent order if all items are done
  if (result.rowsAffected[0] > 0) {
    await query(`
      UPDATE dbo.LabOrders
      SET Status = 'Completed', ReportedAt = GETUTCDATE(), ReportedBy = @enteredBy, UpdatedAt = GETUTCDATE()
      WHERE Id = @orderId
        AND Status <> 'Cancelled'
        AND NOT EXISTS (
          SELECT 1 FROM dbo.LabOrderItems
          WHERE LabOrderId = @orderId AND Status <> 'Completed'
        )
    `, {
      orderId:    { type: sql.BigInt, value: orderId },
      enteredBy:  { type: sql.BigInt, value: enteredBy },
    });
  }

  return result.rowsAffected[0] > 0;
}

// ─────────────────────────────────────────────────────────────
// GET RESULTS FOR A PATIENT (used by EMR lab reports tab)
// ─────────────────────────────────────────────────────────────
async function getPatientLabResults(patientId, hospitalId, { page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  const q = `
    SELECT
      lo.Id AS OrderId, lo.OrderNumber, lo.OrderDate, lo.Priority, lo.Status, lo.VerifiedAt AS CompletedAt,
      li.LabType AS PlaceType, rm.RoomNo, li.ExternalLabName, lo.SampleId,
      pp.FirstName + ' ' + pp.LastName AS PatientName, pp.UHID AS PatientUHID,
      u.FirstName + ' ' + u.LastName AS DoctorName,
      li.Id AS ItemId, lt.Name AS TestName, lt.Category,
      li.ResultValue, li.ResultUnit, li.NormalRange, li.IsAbnormal, li.Remarks, li.Status AS ItemStatus,
      COUNT(*) OVER() AS TotalCount
    FROM dbo.LabOrders lo
    JOIN dbo.LabOrderItems li     ON li.LabOrderId = lo.Id
    JOIN dbo.LabTests lt          ON lt.Id = li.TestId
    LEFT JOIN dbo.Users u         ON u.Id = lo.OrderedBy
    LEFT JOIN dbo.PatientProfiles pp ON pp.Id = lo.PatientId
    LEFT JOIN dbo.LabRooms rm     ON rm.Id = li.RoomId
    WHERE lo.PatientId = @patientId
      AND (@hospitalId IS NULL OR lo.HospitalId = @hospitalId)
    ORDER BY lo.OrderDate DESC, lt.Category, lt.Name
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `;
  const result = await query(q, {
    patientId:  { type: sql.BigInt, value: patientId },
    hospitalId: { type: sql.BigInt, value: hospitalId || null },
    offset:     { type: sql.Int,    value: offset },
    limit:      { type: sql.Int,    value: limit },
  });
  const total = result.recordset[0]?.TotalCount ?? 0;
  return { results: result.recordset, total, page, limit };
}

// ─────────────────────────────────────────────────────────────
// ATTACHMENTS
// ─────────────────────────────────────────────────────────────
async function addLabAttachment({ labOrderId, fileName, filePath, fileType, fileSize, uploadedBy }) {
  const result = await query(`
    INSERT INTO dbo.LabOrderAttachments (LabOrderId, FileName, FilePath, FileType, FileSize, UploadedBy)
    VALUES (@labOrderId, @fileName, @filePath, @fileType, @fileSize, @uploadedBy)
  `, {
    labOrderId: { type: sql.BigInt,       value: labOrderId },
    fileName:   { type: sql.NVarChar(255), value: fileName },
    filePath:   { type: sql.NVarChar(500), value: filePath },
    fileType:   { type: sql.NVarChar(100), value: fileType },
    fileSize:   { type: sql.BigInt,       value: fileSize },
    uploadedBy: { type: sql.BigInt,       value: uploadedBy },
  });
  return result.rowsAffected[0] > 0;
}

async function removeLabAttachment(attachmentId) {
  const result = await query(`
    DELETE FROM dbo.LabOrderAttachments WHERE Id = @attachmentId
  `, {
    attachmentId: { type: sql.BigInt, value: attachmentId }
  });
  return result.rowsAffected[0] > 0;
}

async function getLabAttachments(labOrderId) {
  const res = await query(`
    SELECT Id, FileName, FilePath, FileType, FileSize, UploadedAt
    FROM dbo.LabOrderAttachments
    WHERE LabOrderId = @labOrderId
    ORDER BY UploadedAt DESC
  `, {
    labOrderId: { type: sql.BigInt, value: labOrderId }
  });
  return res.recordset;
}

async function getAvailableLabRooms(hospitalId) {
  const res = await query(`
    SELECT lr.Id, lr.RoomNo, lr.LabId, l.Name AS LabName, l.Type AS LabType,
           CASE WHEN EXISTS(SELECT 1 FROM dbo.LabAutofillRules ar WHERE ar.RoomId = lr.Id AND ar.IsActive = 1) 
           THEN 'Alloted' ELSE 'Not-Alloted' END AS Status
    FROM dbo.LabRooms lr
    LEFT JOIN dbo.Labs l ON l.Id = lr.LabId
    WHERE lr.IsActive = 1
      AND (@hospitalId IS NULL OR lr.HospitalId = @hospitalId OR lr.HospitalId IS NULL)
    ORDER BY l.Name, lr.RoomNo
  `, {
    hospitalId: { type: sql.BigInt, value: hospitalId || null },
  });
  return res.recordset;
}

async function getNurseBookableOrders({ hospitalId, search = '' } = {}) {
  const q = `
    SELECT TOP 200
      lo.Id, lo.OrderNumber, lo.OrderDate, lo.Priority, lo.Status,
      lo.PatientId, lo.AppointmentId,
      p.UHID, p.FirstName + ' ' + p.LastName AS PatientName, p.Phone AS PatientPhone,
      COALESCE(
        'Dr. ' + adu.FirstName + ' ' + adu.LastName,
        CASE WHEN u.Role = 'doctor' THEN 'Dr. ' + u.FirstName + ' ' + u.LastName END,
        u.FirstName + ' ' + u.LastName
      ) AS DoctorName,
      COALESCE(sp.Name, '') AS DoctorSpecialization,
      CASE WHEN EXISTS (
        SELECT 1 FROM dbo.LabOrderItems li WHERE li.LabOrderId = lo.Id AND li.RoomId IS NOT NULL
      ) THEN 1 ELSE 0 END AS IsAlreadyBooked,
      (SELECT COUNT(*) FROM dbo.LabOrderItems li WHERE li.LabOrderId = lo.Id) AS TestCount,
      (
        SELECT li.Id AS ItemId, li.TestId, lt.Name AS TestName, lt.Category,
               li.RoomId, lt.TurnaroundHrs
        FROM dbo.LabOrderItems li
        JOIN dbo.LabTests lt ON lt.Id = li.TestId
        WHERE li.LabOrderId = lo.Id
        FOR JSON PATH
      ) AS ItemsJson
    FROM dbo.LabOrders lo
    JOIN dbo.PatientProfiles p ON p.Id = lo.PatientId
    LEFT JOIN dbo.Users u ON u.Id = lo.OrderedBy
    LEFT JOIN dbo.Appointments a ON a.Id = lo.AppointmentId
    LEFT JOIN dbo.DoctorProfiles adp ON adp.Id = a.DoctorId
    LEFT JOIN dbo.Users adu ON adu.Id = adp.UserId
    LEFT JOIN dbo.Specializations sp ON sp.Id = adp.SpecializationId
    WHERE lo.HospitalId = @hospitalId
      AND lo.Status = 'Pending'
      AND lo.OrderedBy IS NOT NULL
      AND (@search = '' OR
          lo.OrderNumber LIKE '%' + @search + '%' OR
          p.UHID LIKE '%' + @search + '%' OR
          (p.FirstName + ' ' + p.LastName) LIKE '%' + @search + '%')
    ORDER BY lo.OrderDate DESC
  `;
  const res = await query(q, {
    hospitalId: { type: sql.BigInt, value: hospitalId },
    search: { type: sql.NVarChar(150), value: (search || '').trim() },
  });
  return res.recordset.map((row) => ({
    ...row,
    Items: row.ItemsJson ? JSON.parse(row.ItemsJson) : [],
  }));
}

async function nurseBookOrder({ hospitalId, orderId, itemBookings = [], slotAt = null, nurseUserId, note = null }) {
  return withTransaction(async (transaction) => {
    const check = await new sql.Request(transaction)
      .input('orderId', sql.BigInt, orderId)
      .input('hospitalId', sql.BigInt, hospitalId)
      .query(`
        SELECT lo.Id, lo.PatientId, lo.OrderNumber, lo.Status
        FROM dbo.LabOrders lo
        WHERE lo.Id = @orderId AND lo.HospitalId = @hospitalId
      `);
    if (!check.recordset.length) throw new AppError('Lab order not found', 404);
    if (check.recordset[0].Status !== 'Pending') {
      throw new AppError('Only pending doctor-prescribed orders can be booked by nurse', 409);
    }

    if (!Array.isArray(itemBookings) || !itemBookings.length) {
      throw new AppError('At least one test booking is required', 422);
    }

    for (const booking of itemBookings) {
      const itemId = Number(booking?.itemId);
      const roomId = Number(booking?.roomId);
      if (!itemId || !roomId) throw new AppError('Each test item must include room', 422);

      const roomCheck = await new sql.Request(transaction)
        .input('roomId', sql.BigInt, roomId)
        .input('hospitalId', sql.BigInt, hospitalId)
        .query(`
          SELECT Id, LabId
          FROM dbo.LabRooms
          WHERE Id = @roomId AND IsActive = 1
            AND (HospitalId = @hospitalId OR HospitalId IS NULL)
        `);
      if (!roomCheck.recordset.length) {
        throw new AppError('Selected lab room is invalid for this hospital', 422);
      }

      await new sql.Request(transaction)
        .input('itemId', sql.BigInt, itemId)
        .input('orderId', sql.BigInt, orderId)
        .input('roomId', sql.BigInt, roomId)
        .input('labId', sql.BigInt, roomCheck.recordset[0].LabId || null)
        .input('note', sql.NVarChar(500), note || null)
        .query(`
          UPDATE dbo.LabOrderItems
          SET RoomId = @roomId,
              LabId = @labId,
              AdditionalDetails = COALESCE(@note, AdditionalDetails),
              Status = 'Collecting',
              UpdatedAt = GETUTCDATE()
          WHERE Id = @itemId AND LabOrderId = @orderId
        `);
    }

    await new sql.Request(transaction)
      .input('orderId', sql.BigInt, orderId)
      .input('nurseUserId', sql.BigInt, nurseUserId)
      .query(`
        UPDATE dbo.LabOrders
        SET Status = 'Collecting',
            UpdatedAt = GETUTCDATE(),
            Notes = COALESCE(Notes + CHAR(10), '') + CONCAT('Nurse booking confirmed by user ', @nurseUserId)
        WHERE Id = @orderId
      `);

    return check.recordset[0];
  });
}

async function labDecisionOnBookedOrder({ orderId, hospitalId, decision, reason = null, actedByUserId }) {
  const orderRes = await query(`
    SELECT lo.Id, lo.PatientId, lo.OrderNumber, lo.Status, lo.OrderedBy
    FROM dbo.LabOrders lo
    WHERE lo.Id = @orderId AND lo.HospitalId = @hospitalId
  `, {
    orderId: { type: sql.BigInt, value: orderId },
    hospitalId: { type: sql.BigInt, value: hospitalId },
  });

  if (!orderRes.recordset.length) throw new AppError('Order not found', 404);
  const order = orderRes.recordset[0];

  if (!['Collecting', 'Processing', 'Pending'].includes(order.Status)) {
    throw new AppError('Order is not in a decision-ready stage', 409);
  }

  if (decision === 'accept') {
    await query(`
      UPDATE dbo.LabOrders
      SET Status = 'Processing',
          RejectionReason = NULL,
          UpdatedAt = GETUTCDATE()
      WHERE Id = @orderId
    `, { orderId: { type: sql.BigInt, value: orderId } });

    await notifService.createNotification({
      hospitalId,
      userId: order.OrderedBy,
      notifType: 'system',
      title: 'Lab accepted booking',
      body: `Lab has accepted booking for ${order.OrderNumber}.`,
      link: '/lab/orders',
      dataJson: { orderId, decision: 'accept' },
    });
    return { success: true, status: 'Processing' };
  }

  await query(`
    UPDATE dbo.LabOrders
    SET Status = 'Cancelled',
        RejectionReason = @reason,
        UpdatedAt = GETUTCDATE()
    WHERE Id = @orderId
  `, {
    orderId: { type: sql.BigInt, value: orderId },
    reason: { type: sql.NVarChar(1000), value: reason || 'No slots available in hospital lab.' },
  });

  await query(`
    UPDATE dbo.LabOrderItems
    SET Status = 'Cancelled', UpdatedAt = GETUTCDATE()
    WHERE LabOrderId = @orderId
  `, { orderId: { type: sql.BigInt, value: orderId } });

  // Notify doctor/nurse path + patient fallback
  await notifService.createBulkNotifications([
    {
      hospitalId,
      userId: order.OrderedBy,
      notifType: 'alert',
      title: 'Lab rejected booking (slots full)',
      body: `${order.OrderNumber} rejected by lab. Patient can use outside lab and upload report.`,
      link: '/lab/orders',
      dataJson: { orderId, decision: 'reject', reason },
    },
  ]);

  return { success: true, status: 'Cancelled' };
}

async function assignTechnicianToRoom({ userId, roomId, assignedBy, assignmentType = 'Shift Duty', notes = null, status = 'Active', hospitalId = null }) {
  // 1. Get Technician Profile Id & Name
  const techRes = await query(`
    SELECT tp.Id, tp.RoomId, u.FirstName + ' ' + u.LastName AS Name 
    FROM dbo.LabTechnicianProfiles tp
    JOIN dbo.Users u ON u.Id = tp.UserId
    WHERE tp.UserId = @userId
  `, {
    userId: { type: sql.BigInt, value: userId }
  });
  if (techRes.recordset.length === 0) {
    throw new AppError('Technician profile not found', 404);
  }
  const techId = techRes.recordset[0].Id;
  const currentRoomId = Number(techRes.recordset[0].RoomId) || null;
  const techName = techRes.recordset[0].Name;

  if (status === 'Active' && currentRoomId && currentRoomId === Number(roomId)) {
    throw new AppError('This technician is already assigned to that room', 409);
  }

  // 2. Prevent multiple pending requests
  if (status === 'Pending') {
    const pendingRes = await query(`SELECT Id FROM dbo.LabTechnicianRoomAssignments WHERE TechnicianId = @techId AND Status = 'Pending'`, {
      techId: { type: sql.BigInt, value: techId }
    });
    if (pendingRes.recordset.length > 0) {
      throw new AppError('A transfer request is already pending approval', 409);
    }
  }

  // 3. If status is Active, update Profile's current room and retire old ones
  if (status === 'Active') {
    await query(`UPDATE dbo.LabTechnicianProfiles SET RoomId = @roomId WHERE Id = @techId`, {
      roomId: { type: sql.BigInt, value: roomId },
      techId: { type: sql.BigInt, value: techId }
    });

    await query(`UPDATE dbo.LabTechnicianRoomAssignments SET Status = 'Historical' WHERE TechnicianId = @techId AND Status = 'Active'`, {
      techId: { type: sql.BigInt, value: techId }
    });
  }

  // 3. Create assignment record (Active or Pending)
  const assignRes = await query(`
    INSERT INTO dbo.LabTechnicianRoomAssignments (TechnicianId, RoomId, AssignedBy, Status, AssignmentType, Notes)
    OUTPUT INSERTED.Id
    VALUES (@techId, @roomId, @assignedBy, @status, @assignmentType, @notes)
  `, {
    techId: { type: sql.BigInt, value: techId },
    roomId: { type: sql.BigInt, value: roomId },
    assignedBy: { type: sql.BigInt, value: assignedBy },
    status: { type: sql.NVarChar(20), value: status },
    assignmentType: { type: sql.NVarChar(30), value: assignmentType },
    notes: { type: sql.NVarChar(sql.MAX), value: notes }
  });

  const assignmentId = assignRes.recordset[0].Id;

  // 4. If Pending, notify admins
  if (status === 'Pending') {
    const roomRes = await query(`SELECT RoomNo FROM dbo.LabRooms WHERE Id = @roomId`, { roomId: { type: sql.BigInt, value: roomId } });
    const roomNo = roomRes.recordset[0]?.RoomNo || 'Unknown';
    
    await notifService.notifyAdminOfTransferRequest({
      hospitalId,
      technicianName: techName,
      roomNo,
      assignmentId
    });
  }

  return { success: true, assignmentId };
}

async function approveRoomAssignment(assignmentId, adminId) {
  return await withTransaction(async (transaction) => {
    // 1. Get assignment details
    const res = await new sql.Request(transaction)
      .input('id', sql.BigInt, assignmentId)
      .query(`SELECT TechnicianId, RoomId FROM dbo.LabTechnicianRoomAssignments WHERE Id = @id AND Status = 'Pending'`);
    
    if (res.recordset.length === 0) throw new Error('Pending assignment not found');
    const { TechnicianId, RoomId } = res.recordset[0];

    // 2. Mark previous as historical
    await new sql.Request(transaction)
      .input('tid', sql.BigInt, TechnicianId)
      .query(`UPDATE dbo.LabTechnicianRoomAssignments SET Status = 'Historical' WHERE TechnicianId = @tid AND Status = 'Active'`);

    // 3. Activate new one
    await new sql.Request(transaction)
      .input('id', sql.BigInt, assignmentId)
      .input('adminId', sql.BigInt, adminId)
      .query(`UPDATE dbo.LabTechnicianRoomAssignments SET Status = 'Active', AssignedBy = @adminId, AssignedAt = SYSUTCDATETIME() WHERE Id = @id`);

    // 4. Update Profile
    await new sql.Request(transaction)
      .input('rid', sql.BigInt, RoomId)
      .input('tid', sql.BigInt, TechnicianId)
      .query(`UPDATE dbo.LabTechnicianProfiles SET RoomId = @rid WHERE Id = @tid`);

    return true;
  });
}

async function rejectRoomAssignment(assignmentId, adminId) {
  await query(`UPDATE dbo.LabTechnicianRoomAssignments SET Status = 'Rejected', AssignedBy = @adminId, AssignedAt = SYSUTCDATETIME() WHERE Id = @id AND Status = 'Pending'`, {
    id: { type: sql.BigInt, value: assignmentId },
    adminId: { type: sql.BigInt, value: adminId }
  });
  return true;
}

async function getPendingAssignments(hospitalId) {
  // Simple version: return all pending assignments globally or by some lab filter if needed
  const res = await query(`
    SELECT 
      tra.Id, tra.AssignedAt, tra.AssignmentType, tra.Notes,
      u.FirstName + ' ' + u.LastName AS TechnicianName,
      lr.RoomNo,
      l.Name AS LabName,
      l.Type AS RoomType
    FROM dbo.LabTechnicianRoomAssignments tra
    JOIN dbo.LabTechnicianProfiles tp ON tp.Id = tra.TechnicianId
    JOIN dbo.Users u ON u.Id = tp.UserId
    JOIN dbo.LabRooms lr ON lr.Id = tra.RoomId
    LEFT JOIN dbo.Labs l ON l.Id = lr.LabId
    WHERE tra.Status = 'Pending'
    ORDER BY tra.AssignedAt ASC
  `);
  return res.recordset;
}

async function getTechnicianAssignment(userId) {
  const res = await query(`
    SELECT lt.RoomId, lr.RoomNo, lr.LabId, l.Name AS LabName, l.Type AS LabType
    FROM dbo.LabTechnicianProfiles lt
    LEFT JOIN dbo.LabRooms lr ON lt.RoomId = lr.Id
    LEFT JOIN dbo.Labs l ON l.Id = lr.LabId
    WHERE lt.UserId = @userId
  `, {
    userId: { type: sql.BigInt, value: userId }
  });
  return res.recordset[0] || null;
}

async function getLabTechnicians(hospitalId) {
  const res = await query(`
    SELECT
      u.Id AS UserId,
      u.Username,
      u.FirstName,
      u.LastName,
      u.Email,
      u.Phone,
      u.IsActive,
      tp.Id AS TechnicianProfileId,
      tp.RoomId,
      lr.RoomNo,
      lr.LabId,
      l.Name AS LabName,
      l.Type AS LabType
    FROM dbo.Users u
    JOIN dbo.LabTechnicianProfiles tp ON tp.UserId = u.Id
    LEFT JOIN dbo.LabRooms lr ON lr.Id = tp.RoomId
    LEFT JOIN dbo.Labs l ON l.Id = lr.LabId
    WHERE u.DeletedAt IS NULL
      AND (@hospitalId IS NULL OR u.HospitalId = @hospitalId)
      AND LOWER(REPLACE(u.Role, ' ', '_')) IN ('labtech', 'lab_technician', 'lab_assistant')
    ORDER BY u.IsActive DESC, u.FirstName, u.LastName
  `, {
    hospitalId: { type: sql.BigInt, value: hospitalId || null }
  });
  return res.recordset;
}

async function addLabRoom({ labId, roomNo }) {
  const res = await query(`
    INSERT INTO dbo.LabRooms (LabId, RoomNo, IsActive)
    OUTPUT INSERTED.Id
    VALUES (@labId, @roomNo, 1)
  `, {
    labId: { type: sql.BigInt, value: labId },
    roomNo: { type: sql.NVarChar(30), value: roomNo }
  });
  return res.recordset[0];
}

async function removeLabRoom(roomId) {
  const res = await query(`UPDATE dbo.LabRooms SET IsActive = 0 WHERE Id = @roomId`, {
    roomId: { type: sql.BigInt, value: roomId }
  });
  return res.rowsAffected[0] > 0;
}

async function getTransferHistory(userId) {
  const res = await query(`
    SELECT 
      tra.Id,
      tra.AssignedAt,
      tra.AssignmentType,
      tra.Notes,
      tra.Status,
      lr.RoomNo,
      u.FirstName + ' ' + u.LastName AS AssignedByAdmin
    FROM dbo.LabTechnicianRoomAssignments tra
    JOIN dbo.LabTechnicianProfiles tp ON tp.Id = tra.TechnicianId
    JOIN dbo.LabRooms lr ON lr.Id = tra.RoomId
    JOIN dbo.Users u ON u.Id = tra.AssignedBy
    WHERE tp.UserId = @userId
    ORDER BY tra.AssignedAt DESC
  `, {
    userId: { type: sql.BigInt, value: userId }
  });
  return res.recordset;
}
async function getLabs() {
  const res = await query(`SELECT Id, Name, Type FROM dbo.Labs ORDER BY Name`);
  return res.recordset;
}

async function getLabAutofillRules() {
  const res = await query(`
    SELECT a.Id, a.TestCategory, a.Place, a.RoomId, a.LabId, r.RoomNo, l.Name AS LabName
    FROM dbo.LabAutofillRules a
    LEFT JOIN dbo.LabRooms r ON r.Id = a.RoomId
    LEFT JOIN dbo.Labs l ON l.Id = a.LabId
    WHERE a.IsActive = 1
    ORDER BY a.TestCategory
  `);
  return res.recordset;
}

async function addLabAutofillRule({ testCategory, place, roomId, labId, createdBy }) {
  // Multiple tests can now map to the same room

  const check = await query(`SELECT Id FROM dbo.LabAutofillRules WHERE TestCategory = @testCategory`, {
    testCategory: { type: sql.NVarChar(100), value: testCategory }
  });
  
  const ruleParams = {
    testCategory: { type: sql.NVarChar(100), value: testCategory },
    place: { type: sql.NVarChar(20), value: place },
    roomId: { type: sql.BigInt, value: roomId || null },
    labId: { type: sql.BigInt, value: labId || null },
    createdBy: { type: sql.BigInt, value: createdBy }
  };

  if (check.recordset.length > 0) {
    const res = await query(`
      UPDATE dbo.LabAutofillRules 
      SET Place = @place, RoomId = @roomId, LabId = @labId, IsActive = 1
      WHERE TestCategory = @testCategory
    `, ruleParams);
    return res.rowsAffected[0] > 0;
  } else {
    const res = await query(`
      INSERT INTO dbo.LabAutofillRules (TestCategory, Place, RoomId, LabId, CreatedBy, IsActive)
      VALUES (@testCategory, @place, @roomId, @labId, @createdBy, 1)
    `, ruleParams);
    return res.rowsAffected[0] > 0;
  }
}

async function addLabTest({ name, createdBy }) {
  const res = await query(`
    INSERT INTO dbo.LabTests (Name, Category, RequiresFasting, IsActive, CreatedAt, UpdatedAt, CreatedBy)
    VALUES (@name, @name, 0, 1, SYSUTCDATETIME(), SYSUTCDATETIME(), @createdBy)
  `, {
    name: { type: sql.NVarChar(255), value: name },
    createdBy: { type: sql.BigInt, value: createdBy }
  });
  return res.rowsAffected[0] > 0;
}

async function removeLabTest(id) {
  const res = await query(`UPDATE dbo.LabTests SET IsActive = 0, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id`, {
    id: { type: sql.BigInt, value: id }
  });
  return res.rowsAffected[0] > 0;
}

async function removeLabAutofillRule(id) {
  const res = await query(`DELETE FROM dbo.LabAutofillRules WHERE Id = @id`, {
    id: { type: sql.BigInt, value: id }
  });
  return res.rowsAffected[0] > 0;
}

// ─────────────────────────────────────────────────────────────
// SIGNATURE SETTINGS (Lab Incharge Profile)
// ─────────────────────────────────────────────────────────────
async function getSignatureSettings(userId) {
  const res = await query(`
    SELECT * FROM dbo.LabInchargeProfiles WHERE UserId = @userId
  `, { userId: { type: sql.BigInt, value: userId } });
  
  if (res.recordset.length > 0) return res.recordset[0];
  
  // Default settings
  return {
    UserId: userId,
    SignaturePreference: 'NewPage',
    SignatureText: null,
    SignatureImagePath: null
  };
}

async function updateSignatureSettings({ userId, signatureText, signaturePreference, signatureImagePath }) {
  const check = await query(`SELECT Id FROM dbo.LabInchargeProfiles WHERE UserId = @userId`, {
    userId: { type: sql.BigInt, value: userId }
  });
  
  if (check.recordset.length > 0) {
    await query(`
      UPDATE dbo.LabInchargeProfiles
      SET SignatureText = @text,
          SignaturePreference = @pref,
          SignatureImagePath = ISNULL(@img, SignatureImagePath),
          UpdatedAt = GETDATE()
      WHERE UserId = @userId
    `, {
      userId: { type: sql.BigInt, value: userId },
      text: { type: sql.NVarChar(200), value: signatureText || null },
      pref: { type: sql.NVarChar(20), value: signaturePreference || 'NewPage' },
      img:  { type: sql.NVarChar(sql.MAX), value: signatureImagePath || null }
    });
  } else {
    await query(`
      INSERT INTO dbo.LabInchargeProfiles (UserId, SignatureText, SignaturePreference, SignatureImagePath)
      VALUES (@userId, @text, @pref, @img)
    `, {
      userId: { type: sql.BigInt, value: userId },
      text: { type: sql.NVarChar(200), value: signatureText || null },
      pref: { type: sql.NVarChar(20), value: signaturePreference || 'NewPage' },
      img:  { type: sql.NVarChar(sql.MAX), value: signatureImagePath || null }
    });
  }
  return true;
}

module.exports = {
  getLabTests,
  createLabOrder,
  getLabOrders,
  getLabOrderById,
  updateOrderStatus,
  enterTestResult,
  getPatientLabResults,
  generateSampleId,
  addLabAttachment,
  removeLabAttachment,
  getLabAttachments,
  getAvailableLabRooms,
  assignTechnicianToRoom,
  getTechnicianAssignment,
  getLabTechnicians,
  addLabRoom,
  removeLabRoom,
  getTransferHistory,
  approveRoomAssignment,
  rejectRoomAssignment,
  getPendingAssignments,
  getLabs,
  getNurseBookableOrders,
  nurseBookOrder,
  labDecisionOnBookedOrder,
  getLabAutofillRules,
  addLabAutofillRule,
  removeLabAutofillRule,
  addLabTest,
  removeLabTest,
  getPendingApprovalOrders,
  getCompletedApprovalOrders,
  approveLabTest,
  rejectLabTest,
  getSignatureSettings,
  updateSignatureSettings,
};
