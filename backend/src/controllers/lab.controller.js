const { validationResult } = require('express-validator');
const labService = require('../services/lab.service');
const { getPool, sql } = require('../config/database');
const { normalizeRole } = require('../constants/roles');
const AppError = require('../utils/AppError');

const isLabTechRole = (role) => normalizeRole(role) === 'labtech';

function validationFail(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }
  return null;
}

// GET /api/v1/lab/tests
exports.getLabTests = async (req, res, next) => {
  try {
    const { search, category, active } = req.query;
    const tests = await labService.getLabTests({
      search,
      category,
      active: active === undefined ? true : active !== 'false',
    });
    res.json({ success: true, data: tests, total: tests.length });
  } catch (err) { next(err); }
};

// POST /api/v1/lab/orders
exports.createLabOrder = async (req, res, next) => {
  if (validationFail(req, res)) return;
  try {
    const hospitalId = req.user.hospitalId;
    let orderedBy = null;
    
    if (req.user.role === 'doctor') {
      const pool = await getPool();
      const dr = await pool.request()
        .input('uid', sql.BigInt, req.user.id)
        .query('SELECT Id FROM dbo.DoctorProfiles WHERE UserId = @uid');
      if (dr.recordset.length > 0) orderedBy = dr.recordset[0].Id;
    }

    const {
      patientId, appointmentId, notes, tests,
    } = req.body;

    const result = await labService.createLabOrder({
      hospitalId,
      patientId: Number(patientId),
      orderedBy,
      appointmentId: appointmentId ? Number(appointmentId) : null,
      notes,
      tests,
    });

    res.status(201).json({ success: true, message: 'Lab order created', data: result });
  } catch (err) { next(err); }
};

// GET /api/v1/lab/orders
exports.getLabOrders = async (req, res, next) => {
  try {
    const hospitalId = req.user.hospitalId;
    const { patientId, status, priority, date, page = 1, limit = 20 } = req.query;

    // Doctors only see their own orders unless admin
    let orderedBy = undefined;
    let allowedRooms = undefined;
    
    if (['doctor'].includes(req.user.role)) {
      const pool = await getPool();
      const dr = await pool.request()
        .input('uid', sql.BigInt, req.user.id)
        .query('SELECT Id FROM dbo.DoctorProfiles WHERE UserId = @uid');
      if (dr.recordset.length > 0) orderedBy = dr.recordset[0].Id;
      else orderedBy = -1; // doctor with no profile shouldn't see others
    } else if (isLabTechRole(req.user.role)) {
      const pool = await getPool();
      const techRes = await pool.request()
        .input('uid', sql.BigInt, req.user.id)
        .query('SELECT RoomId FROM dbo.LabTechnicianProfiles WHERE UserId = @uid');
        
      if (techRes.recordset.length > 0 && techRes.recordset[0].RoomId) {
        allowedRooms = [techRes.recordset[0].RoomId];
      } else {
        allowedRooms = []; // assigned to none
      }
    }

    const result = await labService.getLabOrders({
      hospitalId,
      patientId: patientId ? Number(patientId) : undefined,
      orderedBy,
      status,
      priority,
      allowedRooms,
      date,
      page:  page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });

    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

// GET /api/v1/lab/orders/:orderId
exports.getLabOrderById = async (req, res, next) => {
  try {
    const order = await labService.getLabOrderById(
      Number(req.params.orderId),
      req.user.hospitalId,
    );
    if (!order) return res.status(404).json({ success: false, message: 'Lab order not found' });
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
};

// GET /api/v1/lab/next-sample-id
exports.getNextSampleId = async (req, res, next) => {
  try {
    const nextId = await labService.generateSampleId();
    res.json({ success: true, sampleId: nextId });
  } catch (err) { next(err); }
};

// PATCH /api/v1/lab/orders/:orderId/status
exports.updateOrderStatus = async (req, res, next) => {
  if (validationFail(req, res)) return;
  try {
    const updated = await labService.updateOrderStatus(
      Number(req.params.orderId),
      req.user.hospitalId,
      req.body.status,
      req.user.id,
      req.body.sampleId,
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Order not found or no change' });
    res.json({ success: true, message: 'Status updated' });
  } catch (err) { next(err); }
};

// PATCH /api/v1/lab/orders/:orderId/items/:itemId/result
exports.enterTestResult = async (req, res, next) => {
  if (validationFail(req, res)) return;
  try {
    const { resultValue, resultUnit, normalRange, isAbnormal, remarks } = req.body;
    const updated = await labService.enterTestResult(
      Number(req.params.orderId),
      Number(req.params.itemId),
      { resultValue, resultUnit, normalRange, isAbnormal, remarks },
      req.user.id,
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Order item not found' });
    res.json({ success: true, message: 'Result entered' });
  } catch (err) { next(err); }
};

// GET /api/v1/lab/orders/patient/:patientId
exports.getPatientOrders = async (req, res, next) => {
  try {
    const hospitalId = req.user.hospitalId;
    const { page = 1, limit = 20 } = req.query;
    const result = await labService.getLabOrders({
      hospitalId,
      patientId: Number(req.params.patientId),
      page: Number(page),
      limit: Number(limit),
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// APPROVAL & REJECTION
// ─────────────────────────────────────────────────────────────


// POST /api/v1/lab/orders/:id/reject
exports.rejectLabOrder = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required.' });
    }
    const result = await labService.rejectLabTest(
      Number(req.params.id),
      reason,
      req.user.id,
      req.user.hospitalId
    );
    res.json(result);
  } catch (err) { next(err); }
};

// GET /api/v1/lab/results/:patientId
exports.getPatientLabResults = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await labService.getPatientLabResults(
      Number(req.params.patientId),
      req.user.hospitalId,
      { page: Number(page), limit: Number(limit) },
    );
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

// GET /api/v1/lab/orders/:orderId/attachments
exports.getOrderAttachments = async (req, res, next) => {
  try {
    const orderId = Number(req.params.orderId);
    const attachments = await labService.getLabAttachments(orderId);
    res.json({ success: true, data: attachments });
  } catch (err) { next(err); }
};

// POST /api/v1/lab/orders/:orderId/attachments
exports.uploadAttachments = async (req, res, next) => {
  try {
    const orderId = Number(req.params.orderId);
    console.log(`[LabUpload] Attempting upload for Order #${orderId}. Files received: ${req.files?.length || 0}`);
    
    if (!req.files || req.files.length === 0) {
      console.warn(`[LabUpload] No files found in request for Order #${orderId}`);
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const savedFiles = [];
    for (const file of req.files) {
      // We store path as relative to project root for flexibility
      const relativePath = file.path.replace(/\\/g, '/'); 
      
      await labService.addLabAttachment({
        labOrderId: orderId,
        fileName: file.originalname,
        filePath: '/' + relativePath,
        fileType: file.mimetype,
        fileSize: file.size,
        uploadedBy: req.user.id
      });
      savedFiles.push({ 
        name: file.originalname, 
        url: '/' + relativePath,
        type: file.mimetype,
        size: file.size
      });
    }

    res.json({ success: true, message: 'Files uploaded successfully', data: savedFiles });
  } catch (err) { next(err); }
};

// DELETE /api/v1/lab/attachments/:id
exports.deleteAttachment = async (req, res, next) => {
  try {
    const success = await labService.removeLabAttachment(Number(req.params.id));
    res.json({ success, message: success ? 'File removed' : 'File not found' });
  } catch (err) { next(err); }
};

// GET /api/v1/lab/rooms
exports.getLabRooms = async (req, res, next) => {
  try {
    const rooms = await labService.getAvailableLabRooms(req.user.hospitalId);
    res.json({ success: true, data: rooms });
  } catch (err) { next(err); }
};

exports.getLabTechnicians = async (req, res, next) => {
  try {
    const technicians = await labService.getLabTechnicians(req.user.hospitalId);
    res.json({ success: true, data: technicians });
  } catch (err) { next(err); }
};

// POST /api/v1/lab/assign-room
exports.changeRoom = async (req, res, next) => {
  try {
    const { roomId, userId, assignmentType, notes } = req.body;
    const isAdmin = ['admin', 'superadmin'].includes(req.user.role);

    if (!isAdmin) {
      throw new AppError('Only admin can assign lab technician rooms.', 403);
    }

    const parsedRoomId = Number(roomId);
    const targetUserId = Number(userId);

    if (!parsedRoomId) {
      throw new AppError('Lab room selection is required.', 400);
    }

    if (!targetUserId) {
      throw new AppError('Lab technician selection is required.', 400);
    }
    
    await labService.assignTechnicianToRoom({
      userId: targetUserId,
      roomId: parsedRoomId,
      assignedBy: req.user.id,
      assignmentType: assignmentType || 'Admin Room Assignment',
      notes,
      status: 'Active',
      hospitalId: req.user.hospitalId
    });
    
    res.json({ 
      success: true, 
      message: 'Lab technician room assignment updated' 
    });
  } catch (err) { next(err); }
};

// GET /api/v1/lab/my-assignment
exports.getMyAssignment = async (req, res, next) => {
  try {
    const assignment = await labService.getTechnicianAssignment(req.user.id);
    res.json({ success: true, data: assignment });
  } catch (err) { next(err); }
};

// Admin Only: POST /api/v1/lab/rooms
exports.createRoom = async (req, res, next) => {
  try {
    const { labId, roomNo } = req.body;
    
    // Validation: Check if a room with the same number already exists
    const activeRooms = await labService.getAvailableLabRooms(req.user.hospitalId);
    if (activeRooms.some(r => r.RoomNo.toLowerCase() === roomNo.toLowerCase())) {
      return res.status(400).json({ success: false, message: `Room Number '${roomNo}' already exists.` });
    }

    const result = await labService.addLabRoom({ labId, roomNo });
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
};

// Admin Only: DELETE /api/v1/lab/rooms/:id
exports.deleteRoom = async (req, res, next) => {
  try {
    const success = await labService.removeLabRoom(req.params.id);
    res.json({ success, message: success ? 'Room deleted' : 'Room not found' });
  } catch (err) { next(err); }
};

// GET /api/v1/lab/my-transfers
exports.getMyTransfers = async (req, res, next) => {
  try {
    const history = await labService.getTransferHistory(req.user.id);
    res.json({ success: true, data: history });
  } catch (err) { next(err); }
};

// Admin Only: GET /api/v1/lab/pending-transfers
exports.getPending = async (req, res, next) => {
  try {
    const pending = await labService.getPendingAssignments(req.user.hospitalId);
    res.json({ success: true, data: pending });
  } catch (err) { next(err); }
};

// Admin Only: POST /api/v1/lab/approve-transfer
exports.approveTransfer = async (req, res, next) => {
  try {
    const { assignmentId } = req.body;
    await labService.approveRoomAssignment(assignmentId, req.user.id);
    res.json({ success: true, message: 'Transfer approved' });
  } catch (err) { next(err); }
};

// Admin Only: POST /api/v1/lab/reject-transfer
exports.rejectTransfer = async (req, res, next) => {
  try {
    const { assignmentId } = req.body;
    await labService.rejectRoomAssignment(assignmentId, req.user.id);
    res.json({ success: true, message: 'Transfer rejected' });
  } catch (err) { next(err); }
};
// GET /api/v1/lab/labs
exports.getLabs = async (req, res, next) => {
  try {
    const labs = await labService.getLabs();
    res.json({ success: true, data: labs });
  } catch (err) { next(err); }
};

// Admin Only: GET /api/v1/lab/autofill-rules
exports.getLabAutofillRules = async (req, res, next) => {
  try {
    const rules = await labService.getLabAutofillRules();
    res.json({ success: true, data: rules });
  } catch (err) { next(err); }
};

// Admin Only: POST /api/v1/lab/autofill-rules
exports.createLabAutofillRule = async (req, res, next) => {
  try {
    const { testCategory, place, roomId, labId } = req.body;
    await labService.addLabAutofillRule({ 
      testCategory, 
      place,
      roomId: roomId ? Number(roomId) : null, 
      labId: labId ? Number(labId) : null,
      createdBy: req.user.id 
    });
    res.status(201).json({ success: true, message: 'Autofill rule saved' });
  } catch (err) { next(err); }
};

// Admin Only: DELETE /api/v1/lab/autofill-rules/:id
exports.deleteLabAutofillRule = async (req, res, next) => {
  try {
    const success = await labService.removeLabAutofillRule(req.params.id);
    res.json({ success, message: success ? 'Autofill rule deleted' : 'Rule not found' });
  } catch (err) { next(err); }
};

// Admin Only: POST /api/v1/lab/tests
exports.createLabTest = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Test name is required.' });
    }
    
    // Validate uniqueness locally from all tests
    const allTests = await labService.getLabTests({ active: true });
    if (allTests.some(t => t.Name.toUpperCase() === name.trim().toUpperCase())) {
      return res.status(400).json({ success: false, message: 'Test already exists.' });
    }

    await labService.addLabTest({ name: name.trim().toUpperCase(), createdBy: req.user.id });
    res.status(201).json({ success: true, message: 'Lab test added successfully.' });
  } catch (err) { next(err); }
};

// Admin Only: DELETE /api/v1/lab/tests/:id
exports.deleteLabTest = async (req, res, next) => {
  try {
    const success = await labService.removeLabTest(req.params.id);
    res.json({ success, message: success ? 'Lab test deleted' : 'Test not found' });
  } catch (err) { next(err); }
};

// Lab Incharge: GET /api/v1/lab/pending-approvals
exports.getPendingApprovals = async (req, res, next) => {
  try {
    const orders = await labService.getPendingApprovalOrders(req.user.hospitalId);
    res.json({ success: true, orders });
  } catch (err) { next(err); }
};

// Lab Incharge: GET /api/v1/lab/completed-orders
exports.getCompletedOrders = async (req, res, next) => {
  try {
    const orders = await labService.getCompletedApprovalOrders(req.user.hospitalId);
    res.json({ success: true, orders });
  } catch (err) { next(err); }
};

// Lab Incharge: POST /api/v1/lab/orders/:id/approve
exports.approveLabOrder = async (req, res, next) => {
  try {
    const orderId = Number(req.params.id);
    const approvedByUserId = req.user.id;
    const approvedByName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || 'Lab Incharge';
    const hospitalId = req.user.hospitalId;

    const result = await labService.approveLabTest(orderId, approvedByUserId, approvedByName, hospitalId);
    res.json({
      success: true,
      message: `Lab result for ${result.patientName} (${result.orderNumber}) approved and digitally signed.`,
      data: result
    });
  } catch (err) { next(err); }
};
// Lab Incharge: POST /api/v1/lab/orders/:id/reject
exports.rejectLabOrder = async (req, res, next) => {
  try {
    const orderId = Number(req.params.id);
    const { reason } = req.body;
    const result = await labService.rejectLabTest(orderId, reason, req.user.id, req.user.hospitalId);
    res.json(result);
  } catch (err) { next(err); }
};

// Signature Settings
exports.getSignatureSettings = async (req, res, next) => {
  try {
    const settings = await labService.getSignatureSettings(req.user.id);
    res.json({ success: true, settings });
  } catch (err) { next(err); }
};

exports.updateSignatureSettings = async (req, res, next) => {
  try {
    const { signatureText, signaturePreference } = req.body;
    const signatureImagePath = req.file ? `/uploads/lab/signatures/${req.file.filename}` : null;
    
    await labService.updateSignatureSettings({
      userId: req.user.id,
      signatureText,
      signaturePreference,
      signatureImagePath
    });
    
    res.json({ success: true, message: 'Signature settings updated.' });
  } catch (err) { next(err); }
};
