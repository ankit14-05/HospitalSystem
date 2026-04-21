const { validationResult } = require('express-validator');
const labService = require('../services/lab.service');

const validationFail = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }
  return null;
};

exports.getLabTests = async (req, res, next) => {
  try {
    const tests = await labService.getLabTests({
      search: req.query.search,
      category: req.query.category,
      active: req.query.active === undefined ? true : req.query.active !== 'false',
    });
    res.json({ success: true, data: tests, total: tests.length });
  } catch (error) {
    next(error);
  }
};

exports.createLabOrder = async (req, res, next) => {
  if (validationFail(req, res)) return;
  try {
    const result = await labService.createLabOrder({
      hospitalId: req.user.hospitalId,
      patientId: Number(req.body.patientId),
      orderedBy: req.user.id,
      appointmentId: req.body.appointmentId ? Number(req.body.appointmentId) : null,
      notes: req.body.notes,
      tests: Array.isArray(req.body.tests) ? req.body.tests : [],
    });

    res.status(201).json({ success: true, message: 'Lab order created', data: result });
  } catch (error) {
    next(error);
  }
};

exports.getLabOrders = async (req, res, next) => {
  try {
    const orderedBy = req.user.role === 'doctor' ? req.user.id : undefined;
    const result = await labService.getLabOrders({
      hospitalId: req.user.hospitalId,
      patientId: req.query.patientId ? Number(req.query.patientId) : undefined,
      orderedBy,
      status: req.query.status,
      priority: req.query.priority,
      date: req.query.date,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 20,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

exports.getLabOrderById = async (req, res, next) => {
  try {
    const order = await labService.getLabOrderById(Number(req.params.orderId), req.user.hospitalId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Lab order not found' });
    }
    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

exports.getNextSampleId = async (req, res, next) => {
  try {
    const sampleId = await labService.generateSampleId();
    res.json({ success: true, sampleId });
  } catch (error) {
    next(error);
  }
};

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

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Order not found or no change' });
    }

    res.json({ success: true, message: 'Status updated' });
  } catch (error) {
    next(error);
  }
};

exports.enterTestResult = async (req, res, next) => {
  if (validationFail(req, res)) return;
  try {
    const updated = await labService.enterTestResult(
      Number(req.params.orderId),
      Number(req.params.itemId),
      {
        resultValue: req.body.resultValue,
        resultUnit: req.body.resultUnit,
        normalRange: req.body.normalRange,
        isAbnormal: req.body.isAbnormal,
        remarks: req.body.remarks,
      },
      req.user.id,
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Order item not found' });
    }

    res.json({ success: true, message: 'Result entered' });
  } catch (error) {
    next(error);
  }
};

exports.getPatientOrders = async (req, res, next) => {
  try {
    const result = await labService.getLabOrders({
      hospitalId: req.user.hospitalId,
      patientId: Number(req.params.patientId),
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 20,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

exports.getPatientLabResults = async (req, res, next) => {
  try {
    const result = await labService.getPatientLabResults(
      Number(req.params.patientId),
      req.user.hospitalId,
      {
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 20,
      },
    );
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

exports.uploadAttachments = async (req, res, next) => {
  try {
    const orderId = Number(req.params.orderId);
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const savedFiles = [];
    for (const file of req.files) {
      const relativePath = `/uploads/lab/${file.filename}`;
      await labService.addLabAttachment({
        labOrderId: orderId,
        fileName: file.originalname,
        filePath: relativePath,
        fileType: file.mimetype,
        fileSize: file.size,
        uploadedBy: req.user.id,
      });

      savedFiles.push({
        name: file.originalname,
        url: relativePath,
        type: file.mimetype,
        size: file.size,
      });
    }

    res.json({ success: true, message: 'Files uploaded successfully', data: savedFiles });
  } catch (error) {
    next(error);
  }
};

exports.deleteAttachment = async (req, res, next) => {
  try {
    const success = await labService.removeLabAttachment(Number(req.params.id));
    res.json({ success, message: success ? 'File removed' : 'File not found' });
  } catch (error) {
    next(error);
  }
};

exports.getLabRooms = async (req, res, next) => {
  try {
    const rooms = await labService.getAvailableLabRooms(req.user.hospitalId);
    res.json({ success: true, data: rooms });
  } catch (error) {
    next(error);
  }
};

exports.changeRoom = async (req, res, next) => {
  try {
    const isAdmin = ['admin', 'superadmin'].includes(req.user.role);
    const status = isAdmin ? 'Active' : 'Pending';
    const targetUserId = isAdmin && req.body.userId ? Number(req.body.userId) : req.user.id;

    await labService.assignTechnicianToRoom({
      userId: targetUserId,
      roomId: Number(req.body.roomId),
      assignedBy: req.user.id,
      assignmentType: req.body.assignmentType || (isAdmin ? 'Admin Override' : 'Formal Transfer'),
      notes: req.body.notes,
      status,
      hospitalId: req.user.hospitalId,
    });

    res.json({
      success: true,
      message: status === 'Pending' ? 'Transfer request sent for admin approval' : 'Room assignment updated',
    });
  } catch (error) {
    next(error);
  }
};

exports.getMyAssignment = async (req, res, next) => {
  try {
    const assignment = await labService.getTechnicianAssignment(req.user.id);
    res.json({ success: true, data: assignment });
  } catch (error) {
    next(error);
  }
};

exports.createRoom = async (req, res, next) => {
  try {
    const room = await labService.addLabRoom({
      labId: req.body.labId ? Number(req.body.labId) : null,
      roomNo: req.body.roomNo,
      hospitalId: req.user.hospitalId,
    });
    res.status(201).json({ success: true, data: room });
  } catch (error) {
    next(error);
  }
};

exports.deleteRoom = async (req, res, next) => {
  try {
    const success = await labService.removeLabRoom(Number(req.params.id));
    res.json({ success, message: success ? 'Room deleted' : 'Room not found' });
  } catch (error) {
    next(error);
  }
};

exports.getMyTransfers = async (req, res, next) => {
  try {
    const history = await labService.getTransferHistory(req.user.id);
    res.json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
};

exports.getPending = async (req, res, next) => {
  try {
    const pending = await labService.getPendingAssignments(req.user.hospitalId);
    res.json({ success: true, data: pending });
  } catch (error) {
    next(error);
  }
};

exports.approveTransfer = async (req, res, next) => {
  try {
    await labService.approveRoomAssignment(Number(req.body.assignmentId), req.user.id);
    res.json({ success: true, message: 'Transfer approved' });
  } catch (error) {
    next(error);
  }
};

exports.rejectTransfer = async (req, res, next) => {
  try {
    await labService.rejectRoomAssignment(Number(req.body.assignmentId), req.user.id);
    res.json({ success: true, message: 'Transfer rejected' });
  } catch (error) {
    next(error);
  }
};

exports.getLabs = async (req, res, next) => {
  try {
    const labs = await labService.getLabs(req.user.hospitalId);
    res.json({ success: true, data: labs });
  } catch (error) {
    next(error);
  }
};

exports.getLabAutofillRules = async (req, res, next) => {
  try {
    const rules = await labService.getLabAutofillRules();
    res.json({ success: true, data: rules });
  } catch (error) {
    next(error);
  }
};

exports.createLabAutofillRule = async (req, res, next) => {
  try {
    await labService.addLabAutofillRule({
      testCategory: req.body.testCategory,
      place: req.body.place,
      roomId: req.body.roomId ? Number(req.body.roomId) : null,
      labId: req.body.labId ? Number(req.body.labId) : null,
      createdBy: req.user.id,
    });
    res.status(201).json({ success: true, message: 'Autofill rule saved' });
  } catch (error) {
    next(error);
  }
};

exports.deleteLabAutofillRule = async (req, res, next) => {
  try {
    const success = await labService.removeLabAutofillRule(Number(req.params.id));
    res.json({ success, message: success ? 'Autofill rule deleted' : 'Rule not found' });
  } catch (error) {
    next(error);
  }
};

exports.createLabTest = async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim().toUpperCase();
    if (!name) {
      return res.status(400).json({ success: false, message: 'Test name is required.' });
    }

    const allTests = await labService.getLabTests({ active: true });
    if (allTests.some((test) => String(test.Name || '').toUpperCase() === name)) {
      return res.status(400).json({ success: false, message: 'Test already exists.' });
    }

    await labService.addLabTest({ name, createdBy: req.user.id });
    res.status(201).json({ success: true, message: 'Lab test added successfully.' });
  } catch (error) {
    next(error);
  }
};

exports.deleteLabTest = async (req, res, next) => {
  try {
    const success = await labService.removeLabTest(Number(req.params.id));
    res.json({ success, message: success ? 'Lab test deleted' : 'Test not found' });
  } catch (error) {
    next(error);
  }
};

exports.getPendingApprovals = async (req, res, next) => {
  try {
    const orders = await labService.getPendingApprovalOrders(req.user.hospitalId);
    res.json({ success: true, orders });
  } catch (error) {
    next(error);
  }
};

exports.approveLabOrder = async (req, res, next) => {
  try {
    const result = await labService.approveLabTest(
      Number(req.params.id),
      req.user.id,
      `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || 'Lab Incharge',
      req.user.hospitalId,
    );

    res.json({
      success: true,
      message: `Lab result for ${result.patientName} (${result.orderNumber}) approved and digitally signed.`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

exports.rejectLabOrder = async (req, res, next) => {
  try {
    if (!req.body.reason) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required.' });
    }

    const result = await labService.rejectLabTest(
      Number(req.params.id),
      req.body.reason,
      req.user.id,
      req.user.hospitalId,
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
};

exports.getSignatureSettings = async (req, res, next) => {
  try {
    const settings = await labService.getSignatureSettings(req.user.id);
    res.json({ success: true, settings });
  } catch (error) {
    next(error);
  }
};

exports.updateSignatureSettings = async (req, res, next) => {
  try {
    const signatureImagePath = req.file ? `/uploads/lab/signatures/${req.file.filename}` : null;
    await labService.updateSignatureSettings({
      userId: req.user.id,
      signatureText: req.body.signatureText,
      signaturePreference: req.body.signaturePreference,
      signatureImagePath,
    });
    res.json({ success: true, message: 'Signature settings updated.' });
  } catch (error) {
    next(error);
  }
};
