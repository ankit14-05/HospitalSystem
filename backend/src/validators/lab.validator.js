// src/validators/lab.validator.js
const { body, param, query } = require('express-validator');

const createLabOrderRules = [
  body('patientId')
    .notEmpty().withMessage('patientId is required')
    .isInt({ gt: 0 }).withMessage('patientId must be a positive integer'),

  body('tests')
    .isArray({ min: 1 }).withMessage('tests must be a non-empty array'),

  body('tests.*.testId')
    .notEmpty().withMessage('each test must have a testId')
    .isInt({ gt: 0 }).withMessage('testId must be a positive integer'),

  body('tests.*.priority')
    .optional()
    .isIn(['Routine', 'Urgent', 'STAT']).withMessage("priority must be 'Routine', 'Urgent', or 'STAT'"),

  body('tests.*.placeType')
    .optional()
    .isIn(['Indoor', 'Outside']).withMessage("placeType must be 'Indoor' or 'Outside'"),

  body('tests.*.roomNo')
    .optional({ checkFalsy: true })
    .isLength({ max: 30 }).withMessage('roomNo max 30 chars')
    .matches(/^[a-zA-Z0-9\-]*$/).withMessage('roomNo: alphanumeric and hyphens only'),

  body('tests.*.externalLabName')
    .optional({ checkFalsy: true })
    .isLength({ max: 200 }).withMessage('externalLabName max 200 chars'),

  body('tests.*.criteria')
    .optional({ checkFalsy: true })
    .isLength({ max: 200 }).withMessage('criteria max 200 chars'),

  body('tests.*.additionalDetails')
    .optional({ checkFalsy: true })
    .isLength({ max: 2000 }).withMessage('additionalDetails max 2000 chars'),

  body('notes')
    .optional({ checkFalsy: true })
    .isLength({ max: 2000 }).withMessage('notes max 2000 chars'),
];

const updateOrderStatusRules = [
  param('orderId').isInt({ gt: 0 }).withMessage('orderId must be a positive integer'),
  body('status')
    .notEmpty().withMessage('status is required')
    .isIn(['Pending', 'Collecting', 'Processing', 'Pending Approval', 'Completed', 'Cancelled'])
    .withMessage('Invalid status value'),
];

const enterResultRules = [
  param('orderId').isInt({ gt: 0 }).withMessage('orderId must be a positive integer'),
  param('itemId').isInt({ gt: 0 }).withMessage('itemId must be a positive integer'),
  body('resultValue')
    .notEmpty().withMessage('resultValue is required')
    .isLength({ max: 500 }),
  body('resultUnit').optional().isLength({ max: 50 }),
  body('normalRange').optional().isLength({ max: 100 }),
  body('isAbnormal').optional().isBoolean(),
  body('remarks').optional().isLength({ max: 2000 }),
];

module.exports = { createLabOrderRules, updateOrderStatusRules, enterResultRules };
