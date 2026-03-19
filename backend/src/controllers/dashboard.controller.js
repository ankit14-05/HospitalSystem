const dashboardService = require('../services/dashboard.service');
const { success } = require('../utils/apiResponse');

exports.getAdminOverview = async (req, res, next) => {
  try {
    const data = await dashboardService.getAdminOverview({
      user: req.user,
      requestedHospitalId: req.query.hospitalId || req.headers['x-hospital-id'] || req.user?.hospitalId,
    });
    return success(res, data);
  } catch (error) {
    return next(error);
  }
};

exports.getOpdOverview = async (req, res, next) => {
  try {
    const data = await dashboardService.getOpdOverview({
      user: req.user,
      requestedHospitalId: req.query.hospitalId || req.headers['x-hospital-id'] || req.user?.hospitalId,
    });
    return success(res, data);
  } catch (error) {
    return next(error);
  }
};

exports.getPeopleDirectory = async (req, res, next) => {
  try {
    const data = await dashboardService.getPeopleDirectory({
      user: req.user,
      requestedHospitalId: req.query.hospitalId || req.headers['x-hospital-id'] || req.user?.hospitalId,
      category: req.query.category,
      search: req.query.search || req.query.q,
      page: req.query.page,
      limit: req.query.limit,
    });
    return success(res, data);
  } catch (error) {
    return next(error);
  }
};
