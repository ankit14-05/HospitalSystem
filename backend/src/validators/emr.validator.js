const { body } = require('express-validator');

const createEncounterRules = [
  body('patientId').isInt({ gt: 0 }).withMessage('patientId must be a positive integer'),
  body('encounterDate').optional({ checkFalsy: true }).isISO8601().withMessage('encounterDate must be a valid date'),
];

const noteRules = [
  body('noteText').optional({ nullable: true }).isString().withMessage('noteText must be text'),
  body('noteType').optional({ nullable: true }).isString().withMessage('noteType must be text'),
];

module.exports = {
  createEncounterRules,
  noteRules,
};
