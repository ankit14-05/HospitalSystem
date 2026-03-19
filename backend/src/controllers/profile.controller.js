const profileService = require('../services/profile.service');
const { success } = require('../utils/apiResponse');

exports.getMyProfile = async (req, res, next) => {
  try {
    const data = await profileService.getMyProfile(req.user);
    return success(res, data);
  } catch (error) {
    return next(error);
  }
};

exports.updateMyProfile = async (req, res, next) => {
  try {
    const data = await profileService.updateMyProfile(req.user, req.body || {});
    return success(res, data, 'Profile updated successfully');
  } catch (error) {
    return next(error);
  }
};
