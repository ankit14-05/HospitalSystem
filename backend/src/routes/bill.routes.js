// src/routes/bill.routes.js
// Tables: Bills, BillItems, Payments, Services, PatientProfiles,
//         Appointments, Admissions, Users, HospitalSetup
const router = require('express').Router();
const { authenticate: protect, authorize } = require('../middleware/auth.middleware');
const { getPool }                          = require('../config/database');
const { requireActivePatientProfile }      = require('../services/patientAccess.service');

router.use(protect);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/bills/my
// Patient: own bills | Receptionist/Admin: all bills (paginated)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/my', async (req, res, next) => {
  try {
    const pool   = await getPool();
    const role   = req.user.role;
    const limit  = Math.min(parseInt(req.query.limit)  || 20, 100);
    const page   = Math.max(parseInt(req.query.page)   || 1, 1);
    const offset = (page - 1) * limit;
    const status = req.query.status || null;   // optional filter: Pending|Paid|Partial

    let result;

    if (role === 'patient') {
      const activeProfile = await requireActivePatientProfile(req.user, req.sessionId, pool);
      const patientId = activeProfile.patientId;

      const req2 = pool.request()
        .input('PatientId', patientId)
        .input('Limit',     limit)
        .input('Offset',    offset);

      if (status) req2.input('Status', status);

      result = await req2.query(`
        SELECT
          b.Id, b.BillNumber, b.BillDate, b.BillType,
          b.Subtotal, b.DiscountAmount, b.TaxAmount,
          b.TotalAmount, b.PaidAmount,
          b.TotalAmount - b.PaidAmount AS BalanceAmount,
          b.PaymentStatus, b.InsuranceClaimed,
          b.InsuranceAmount, b.Notes, b.CreatedAt,
          a.AppointmentNo, a.AppointmentDate,
          adm.AdmissionNo
        FROM  dbo.Bills       b
        LEFT JOIN dbo.Appointments a   ON a.Id   = b.AppointmentId
        LEFT JOIN dbo.Admissions   adm ON adm.Id = b.AdmissionId
        WHERE b.PatientId = @PatientId
          ${status ? 'AND b.PaymentStatus = @Status' : ''}
        ORDER BY b.BillDate DESC, b.CreatedAt DESC
        OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;

        SELECT COUNT(*) AS Total
        FROM dbo.Bills
        WHERE PatientId = @PatientId
          ${status ? 'AND PaymentStatus = @Status' : ''};
      `);
    } else {
      // Receptionist/admin sees all bills for their hospital
      const req2 = pool.request()
        .input('Limit',  limit)
        .input('Offset', offset);

      if (status) req2.input('Status', status);

      result = await req2.query(`
        SELECT
          b.Id, b.BillNumber, b.BillDate, b.BillType,
          b.Subtotal, b.DiscountAmount, b.TaxAmount,
          b.TotalAmount, b.PaidAmount,
          b.TotalAmount - b.PaidAmount AS BalanceAmount,
          b.PaymentStatus, b.CreatedAt,
          p.FirstName + ' ' + p.LastName AS PatientName,
          p.UHID, p.Phone AS PatientPhone,
          a.AppointmentNo
        FROM  dbo.Bills           b
        JOIN  dbo.PatientProfiles  p   ON p.Id = b.PatientId
        LEFT JOIN dbo.Appointments a   ON a.Id = b.AppointmentId
        WHERE 1=1
          ${status ? 'AND b.PaymentStatus = @Status' : ''}
        ORDER BY b.BillDate DESC, b.CreatedAt DESC
        OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;

        SELECT COUNT(*) AS Total FROM dbo.Bills
        WHERE 1=1 ${status ? 'AND PaymentStatus = @Status' : ''};
      `);
    }

    const bills = result.recordsets[0];
    const total = result.recordsets[1]?.[0]?.Total || 0;

    res.json({
      success: true,
      data: bills,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) }
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/bills/:id  — single bill with line items and payments
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const pool = await getPool();

    const billRes = await pool.request()
      .input('Id', req.params.id)
      .query(`
        SELECT
          b.Id, b.BillNumber, b.BillDate, b.BillType,
          b.Subtotal, b.DiscountAmount, b.DiscountReason,
          b.TaxAmount, b.TotalAmount, b.PaidAmount,
          b.TotalAmount - b.PaidAmount AS BalanceAmount,
          b.PaymentStatus, b.InsuranceClaimed,
          b.InsuranceAmount, b.Notes, b.CreatedAt,
          p.FirstName + ' ' + p.LastName AS PatientName,
          p.UHID, p.DateOfBirth, p.Gender,
          p.Phone AS PatientPhone, p.Email AS PatientEmail,
          ug.FirstName + ' ' + ug.LastName AS GeneratedByName,
          hosp.Name  AS HospitalName,
          hosp.Phone AS HospitalPhone,
          hosp.GSTIN AS HospitalGSTIN,
          a.AppointmentNo, a.AppointmentDate,
          adm.AdmissionNo
        FROM  dbo.Bills           b
        JOIN  dbo.PatientProfiles  p    ON p.Id    = b.PatientId
        LEFT JOIN dbo.Users        ug   ON ug.Id   = b.GeneratedBy
        LEFT JOIN dbo.HospitalSetup hosp ON hosp.Id = b.HospitalId
        LEFT JOIN dbo.Appointments a    ON a.Id    = b.AppointmentId
        LEFT JOIN dbo.Admissions   adm  ON adm.Id  = b.AdmissionId
        WHERE b.Id = @Id
      `);

    if (!billRes.recordset.length) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    // Bill line items
    const itemsRes = await pool.request()
      .input('BillId', req.params.id)
      .query(`
        SELECT
          bi.Id, bi.Description, bi.Quantity,
          bi.UnitPrice, bi.DiscountPct, bi.TaxPct,
          bi.Quantity * bi.UnitPrice * (1 - bi.DiscountPct/100.0) * (1 + bi.TaxPct/100.0) AS TotalPrice,
          svc.Name AS ServiceName, svc.Category AS ServiceCategory
        FROM  dbo.BillItems bi
        LEFT JOIN dbo.Services svc ON svc.Id = bi.ServiceId
        WHERE bi.BillId = @BillId
      `);

    // Payment history
    const paymentsRes = await pool.request()
      .input('BillId', req.params.id)
      .query(`
        SELECT
          py.Id, py.Amount, py.Method,
          py.TransactionRef, py.PaidAt, py.Notes,
          u.FirstName + ' ' + u.LastName AS ReceivedByName
        FROM  dbo.Payments py
        LEFT JOIN dbo.Users u ON u.Id = py.ReceivedBy
        WHERE py.BillId = @BillId
        ORDER BY py.PaidAt ASC
      `);

    res.json({
      success: true,
      data: {
        ...billRes.recordset[0],
        items:    itemsRes.recordset,
        payments: paymentsRes.recordset
      }
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/bills  — receptionist/admin creates bill
// ─────────────────────────────────────────────────────────────────────────────
router.post('/',
  authorize('receptionist', 'admin', 'superadmin'),
  async (req, res, next) => {
    try {
      const {
        patientId, appointmentId, admissionId,
        billType = 'OPD', discountAmount = 0,
        discountReason, taxAmount = 0, notes,
        items = []
      } = req.body;

      if (!patientId || !items.length) {
        return res.status(400).json({ success: false, message: 'patientId and items are required' });
      }

      const pool = await getPool();

      // Get hospitalId from the user's record
      const userRes = await pool.request()
        .input('UserId', req.user.id)
        .query(`SELECT HospitalId FROM dbo.Users WHERE Id = @UserId AND DeletedAt IS NULL`);

      const hospitalId = userRes.recordset[0]?.HospitalId;
      if (!hospitalId) {
        return res.status(400).json({ success: false, message: 'Could not determine hospital' });
      }

      // Calculate subtotal from items
      const subtotal = items.reduce((sum, i) => {
        return sum + (i.quantity * i.unitPrice * (1 - (i.discountPct || 0) / 100));
      }, 0);
      const total = parseFloat(subtotal) + parseFloat(taxAmount) - parseFloat(discountAmount);

      // Generate BillNumber: BILL-YYYYMMDD-{random5}
      const today  = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const billNo = `BILL-${today}-${Math.floor(10000 + Math.random() * 90000)}`;

      const billRes = await pool.request()
        .input('HospitalId',     hospitalId)
        .input('PatientId',      patientId)
        .input('AppointmentId',  appointmentId  || null)
        .input('AdmissionId',    admissionId    || null)
        .input('BillNumber',     billNo)
        .input('BillType',       billType)
        .input('Subtotal',       subtotal.toFixed(2))
        .input('DiscountAmount', discountAmount)
        .input('DiscountReason', discountReason || null)
        .input('TaxAmount',      taxAmount)
        .input('TotalAmount',    total.toFixed(2))
        .input('Notes',          notes          || null)
        .input('GeneratedBy',    req.user.id)
        .input('CreatedBy',      req.user.id)
        .query(`
          INSERT INTO dbo.Bills
            (HospitalId, PatientId, AppointmentId, AdmissionId,
             BillNumber, BillType, Subtotal, DiscountAmount, DiscountReason,
             TaxAmount, TotalAmount, Notes, GeneratedBy, CreatedBy)
          OUTPUT INSERTED.Id
          VALUES
            (@HospitalId, @PatientId, @AppointmentId, @AdmissionId,
             @BillNumber, @BillType, @Subtotal, @DiscountAmount, @DiscountReason,
             @TaxAmount, @TotalAmount, @Notes, @GeneratedBy, @CreatedBy);
        `);

      const billId = billRes.recordset[0].Id;

      for (const item of items) {
        await pool.request()
          .input('BillId',      billId)
          .input('ServiceId',   item.serviceId   || null)
          .input('Description', item.description)
          .input('Quantity',    item.quantity     || 1)
          .input('UnitPrice',   item.unitPrice)
          .input('DiscountPct', item.discountPct  || 0)
          .input('TaxPct',      item.taxPct       || 0)
          .query(`
            INSERT INTO dbo.BillItems
              (BillId, ServiceId, Description, Quantity, UnitPrice, DiscountPct, TaxPct)
            VALUES
              (@BillId, @ServiceId, @Description, @Quantity, @UnitPrice, @DiscountPct, @TaxPct);
          `);
      }

      res.status(201).json({
        success: true,
        message: 'Bill created',
        data: { id: billId, billNumber: billNo, totalAmount: total.toFixed(2) }
      });
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/bills/:id/payments  — record a payment against a bill
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/payments',
  authorize('receptionist', 'admin', 'superadmin'),
  async (req, res, next) => {
    try {
      const { amount, method, transactionRef, notes } = req.body;

      if (!amount || !method) {
        return res.status(400).json({ success: false, message: 'amount and method are required' });
      }

      const pool = await getPool();

      // Record payment
      await pool.request()
        .input('BillId',         req.params.id)
        .input('Amount',         amount)
        .input('Method',         method)
        .input('TransactionRef', transactionRef || null)
        .input('ReceivedBy',     req.user.id)
        .input('Notes',          notes || null)
        .query(`
          INSERT INTO dbo.Payments (BillId, Amount, Method, TransactionRef, ReceivedBy, Notes)
          VALUES (@BillId, @Amount, @Method, @TransactionRef, @ReceivedBy, @Notes);
        `);

      // Update bill's PaidAmount and PaymentStatus
      await pool.request()
        .input('BillId', req.params.id)
        .query(`
          UPDATE dbo.Bills SET
            PaidAmount    = PaidAmount + (
                              SELECT COALESCE(SUM(Amount),0)
                              FROM dbo.Payments
                              WHERE BillId = @BillId
                            ) - PaidAmount +
                            (SELECT TOP 1 Amount FROM dbo.Payments
                             WHERE BillId = @BillId ORDER BY CreatedAt DESC),
            PaymentStatus = CASE
              WHEN (PaidAmount + (SELECT TOP 1 Amount FROM dbo.Payments WHERE BillId = @BillId ORDER BY CreatedAt DESC)) >= TotalAmount THEN 'Paid'
              WHEN (PaidAmount + (SELECT TOP 1 Amount FROM dbo.Payments WHERE BillId = @BillId ORDER BY CreatedAt DESC)) > 0         THEN 'Partial'
              ELSE 'Pending'
            END,
            UpdatedAt = SYSUTCDATETIME()
          WHERE Id = @BillId;

          -- Recalculate cleanly
          UPDATE dbo.Bills SET
            PaidAmount    = (SELECT COALESCE(SUM(Amount),0) FROM dbo.Payments WHERE BillId = @BillId),
            PaymentStatus = CASE
              WHEN (SELECT COALESCE(SUM(Amount),0) FROM dbo.Payments WHERE BillId = @BillId) >= TotalAmount THEN 'Paid'
              WHEN (SELECT COALESCE(SUM(Amount),0) FROM dbo.Payments WHERE BillId = @BillId) > 0 THEN 'Partial'
              ELSE 'Pending'
            END,
            UpdatedAt = SYSUTCDATETIME()
          WHERE Id = @BillId;
        `);

      res.status(201).json({ success: true, message: 'Payment recorded' });
    } catch (err) { next(err); }
  }
);

module.exports = router;
