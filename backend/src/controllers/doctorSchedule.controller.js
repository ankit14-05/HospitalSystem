const ApiResponse = require('../utils/apiResponse');
const scheduleService = require('../services/schedule.service');

const getHospitalId = (req) => {
  const requestedHospitalId =
    req.headers['x-hospital-id'] ||
    req.query?.hospitalId ||
    req.body?.hospitalId;

  const parsedRequestedHospitalId = Number(requestedHospitalId);
  if (Number.isInteger(parsedRequestedHospitalId) && parsedRequestedHospitalId > 0) {
    return parsedRequestedHospitalId;
  }

  const userHospitalId = Number(req.user?.hospitalId ?? req.user?.HospitalId);
  if (Number.isInteger(userHospitalId) && userHospitalId > 0) {
    return userHospitalId;
  }

  return 1;
};

exports.getActivityTypes = async (req, res, next) => {
  try {
    const activityTypes = await scheduleService.getActivityTypes();
    return ApiResponse.success(res, activityTypes, 'Schedule activity types fetched');
  } catch (error) {
    next(error);
  }
};

exports.getAllDoctorSchedules = async (req, res, next) => {
  try {
    const data = await scheduleService.listDoctorSchedules({
      hospitalId: getHospitalId(req),
      doctorId: req.query?.doctorId ? Number(req.query.doctorId) : null,
      departmentId: req.query?.departmentId ? Number(req.query.departmentId) : null,
      specializationId: req.query?.specializationId ? Number(req.query.specializationId) : null,
      activityTypeId: req.query?.activityTypeId ? Number(req.query.activityTypeId) : null,
      search: req.query?.search || '',
      view: req.query?.view || 'month',
      cursorDate: req.query?.cursorDate || req.query?.date || null,
      startDate: req.query?.startDate || null,
      endDate: req.query?.endDate || null,
    });

    return ApiResponse.success(res, data, 'Doctor schedules fetched');
  } catch (error) {
    next(error);
  }
};

exports.getDoctorScheduleById = async (req, res, next) => {
  try {
    const schedule = await scheduleService.getDoctorScheduleById({
      hospitalId: getHospitalId(req),
      id: Number(req.params.id),
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule assignment not found',
      });
    }

    return ApiResponse.success(res, schedule, 'Schedule assignment fetched');
  } catch (error) {
    next(error);
  }
};

exports.createDoctorSchedule = async (req, res, next) => {
  try {
    const rows = await scheduleService.createDoctorSchedule({
      hospitalId: getHospitalId(req),
      userId: Number(req.user?.id),
      body: req.body,
    });

    return ApiResponse.created(res, rows, 'Doctor schedule assignment created');
  } catch (error) {
    next(error);
  }
};

exports.updateDoctorSchedule = async (req, res, next) => {
  try {
    const row = await scheduleService.updateDoctorSchedule({
      hospitalId: getHospitalId(req),
      userId: Number(req.user?.id),
      id: Number(req.params.id),
      body: req.body,
    });

    return ApiResponse.success(res, row, 'Doctor schedule assignment updated');
  } catch (error) {
    next(error);
  }
};

exports.deleteDoctorSchedule = async (req, res, next) => {
  try {
    await scheduleService.deleteDoctorSchedule({
      hospitalId: getHospitalId(req),
      userId: Number(req.user?.id),
      id: Number(req.params.id),
    });

    return ApiResponse.success(res, null, 'Doctor schedule assignment removed');
  } catch (error) {
    next(error);
  }
};

exports.getDayOverview = async (req, res, next) => {
  try {
    const overview = await scheduleService.getDayOverview({
      hospitalId: getHospitalId(req),
      doctorId: Number(req.query?.doctorId || req.body?.doctorId),
      date: req.query?.date || req.body?.date,
    });

    return ApiResponse.success(res, overview, 'Day schedule overview fetched');
  } catch (error) {
    next(error);
  }
};

exports.createOpdSlotSession = async (req, res, next) => {
  try {
    const overview = await scheduleService.createOpdSlotSession({
      hospitalId: getHospitalId(req),
      userId: Number(req.user?.id),
      body: req.body,
    });

    return ApiResponse.created(res, overview, 'OPD slots published');
  } catch (error) {
    next(error);
  }
};

exports.getMySchedule = async (req, res, next) => {
  try {
    const data = await scheduleService.getMySchedule({
      userId: Number(req.user?.id),
      hospitalId: getHospitalId(req),
      view: req.query?.view || 'month',
      cursorDate: req.query?.cursorDate || req.query?.date || null,
    });

    return ApiResponse.success(res, data, 'Doctor schedule fetched');
  } catch (error) {
    next(error);
  }
};

exports.getDoctorsList = async (req, res, next) => {
  try {
    const doctors = await scheduleService.getDoctorsList({
      hospitalId: getHospitalId(req),
    });
    return ApiResponse.success(res, doctors, 'Doctors list fetched');
  } catch (error) {
    next(error);
  }
};

exports.getRooms = async (req, res, next) => {
  try {
    const rooms = await scheduleService.getRooms({
      hospitalId: getHospitalId(req),
    });
    return ApiResponse.success(res, rooms, 'OPD rooms fetched');
  } catch (error) {
    next(error);
  }
};

exports.getLocations = async (req, res, next) => {
  try {
    const locations = await scheduleService.getLocations({
      hospitalId: getHospitalId(req),
      locationKind: req.query?.locationKind || null,
      departmentId: req.query?.departmentId ? Number(req.query.departmentId) : null,
      search: req.query?.search || '',
    });
    return ApiResponse.success(res, locations, 'Hospital locations fetched');
  } catch (error) {
    next(error);
  }
};

exports.getShiftTemplates = async (req, res, next) => {
  try {
    const templates = await scheduleService.getShiftTemplates({
      hospitalId: getHospitalId(req),
      category: req.query?.category || null,
      activityTypeId: req.query?.activityTypeId ? Number(req.query.activityTypeId) : null,
      doctorId: req.query?.doctorId ? Number(req.query.doctorId) : null,
    });
    return ApiResponse.success(res, templates, 'Shift templates fetched');
  } catch (error) {
    next(error);
  }
};

exports.getWeeklyTemplates = async (req, res, next) => {
  try {
    const templates = await scheduleService.getWeeklyTemplates({
      hospitalId: getHospitalId(req),
      doctorId: req.query?.doctorId ? Number(req.query.doctorId) : null,
    });
    return ApiResponse.success(res, templates, 'Weekly schedule templates fetched');
  } catch (error) {
    next(error);
  }
};

exports.saveWeeklyTemplate = async (req, res, next) => {
  try {
    await scheduleService.saveWeeklyTemplate({
      hospitalId: getHospitalId(req),
      userId: Number(req.user?.id),
      body: req.body,
    });
    return ApiResponse.success(res, null, 'Weekly schedule template saved');
  } catch (error) {
    next(error);
  }
};

exports.deleteWeeklyTemplate = async (req, res, next) => {
  try {
    await scheduleService.deleteWeeklyTemplate({
      hospitalId: getHospitalId(req),
      doctorId: Number(req.query?.doctorId || req.body?.doctorId),
      dayOfWeek: Number(req.query?.dayOfWeek || req.body?.dayOfWeek),
      category: req.query?.category || req.body?.category || 'other',
    });
    return ApiResponse.success(res, null, 'Weekly schedule template removed');
  } catch (error) {
    next(error);
  }
};
