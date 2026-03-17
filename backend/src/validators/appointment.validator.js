// src/validators/appointment.validator.js
const { body, param, query } = require('express-validator');

const bookAppointment = [
  body('doctorId')
    .notEmpty().withMessage('Doctor is required')
    .isInt({ min: 1 }).withMessage('Invalid doctor ID'),

  body('appointmentDate')
    .notEmpty().withMessage('Date is required')
    .isDate().withMessage('Invalid date format (YYYY-MM-DD)')
    .custom(val => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (new Date(val) < today) throw new Error('Appointment date cannot be in the past');
      return true;
    }),

  body('appointmentTime')
    .notEmpty().withMessage('Time is required')
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('Time must be HH:MM (24h)'),

  body('visitType')
    .optional()
    .isIn(['OPD', 'IPD', 'Emergency', 'FollowUp']).withMessage('Invalid visit type'),

  body('reason')
    .optional()
    .isLength({ max: 1000 }).withMessage('Reason too long'),

  body('departmentId')
    .optional()
    .isInt({ min: 1 }).withMessage('Invalid department ID'),
];

const updateStatus = [
  param('id').isInt({ min: 1 }).withMessage('Invalid appointment ID'),
  body('status')
    .notEmpty().withMessage('Status is required')
    .isIn(['Confirmed', 'Cancelled', 'Completed', 'NoShow', 'Rescheduled'])
    .withMessage('Invalid status value'),
  body('cancelReason')
    .if(body('status').equals('Cancelled'))
    .notEmpty().withMessage('Cancel reason is required when cancelling'),
];

const reschedule = [
  param('id').isInt({ min: 1 }).withMessage('Invalid appointment ID'),
  body('appointmentDate')
    .notEmpty().withMessage('New date is required')
    .isDate()
    .custom(val => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (new Date(val) < today) throw new Error('New date cannot be in the past');
      return true;
    }),
  body('appointmentTime')
    .notEmpty().withMessage('New time is required')
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/),
];

module.exports = { bookAppointment, updateStatus, reschedule };
