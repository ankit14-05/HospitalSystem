const profileService = require('../services/profile.service');
const { success } = require('../utils/apiResponse');

exports.getMyProfile = async (req, res, next) => {
  try {
    const data = await profileService.getMyProfile({ ...req.user, sessionId: req.sessionId });
    return success(res, data);
  } catch (error) {
    return next(error);
  }
};

exports.updateMyProfile = async (req, res, next) => {
  try {
    const data = await profileService.updateMyProfile({ ...req.user, sessionId: req.sessionId }, req.body || {});
    return success(res, data, 'Profile updated successfully');
  } catch (error) {
    return next(error);
  }
};

exports.listPatientProfiles = async (req, res, next) => {
  try {
    const data = await profileService.getPatientProfiles({ ...req.user, sessionId: req.sessionId });
    return success(res, data, 'Patient profiles retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

exports.switchPatientProfile = async (req, res, next) => {
  try {
    const patientId = Number.parseInt(req.body?.patientId, 10);
    if (Number.isNaN(patientId)) {
      throw Object.assign(new Error('patientId is required'), { statusCode: 422 });
    }

    const data = await profileService.switchPatientProfile({ ...req.user, sessionId: req.sessionId }, patientId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      switchSource: 'ui',
    });
    return success(res, data, 'Active patient profile updated successfully');
  } catch (error) {
    return next(error);
  }
};

exports.addFamilyMember = async (req, res, next) => {
  try {
    const data = await profileService.addFamilyMember({ ...req.user, sessionId: req.sessionId }, req.body || {});
    return success(res, data, 'Patient profile added successfully', 201);
  } catch (error) {
    return next(error);
  }
};
