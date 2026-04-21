const { body } = require('express-validator');

const createLabOrderRules = [
  body('patientId').isInt({ gt: 0 }).withMessage('patientId must be a positive integer'),
  body('tests').isArray({ min: 1 }).withMessage('At least one lab test is required'),
];

const updateOrderStatusRules = [
  body('status').trim().notEmpty().withMessage('status is required'),
  body('sampleId').optional({ checkFalsy: true }).isString().withMessage('sampleId must be a string'),
];

const enterResultRules = [
  body('resultValue').optional({ nullable: true }).isString().withMessage('resultValue must be text'),
  body('resultUnit').optional({ nullable: true }).isString().withMessage('resultUnit must be text'),
  body('normalRange').optional({ nullable: true }).isString().withMessage('normalRange must be text'),
  body('remarks').optional({ nullable: true }).isString().withMessage('remarks must be text'),
];

module.exports = {
  createLabOrderRules,
  updateOrderStatusRules,
  enterResultRules,
};
