// src/utils/apiResponse.js

/**
 * Send a standardised success response
 */
const success = (res, data = {}, message = 'Success', statusCode = 200, meta = null) => {
  const body = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
};

/**
 * Send a standardised created response
 */
const created = (res, data = {}, message = 'Created successfully') => {
  return success(res, data, message, 201);
};

/**
 * Send a paginated response
 */
const paginated = (res, rows, total, page, limit, message = 'Success') => {
  return res.status(200).json({
    success: true,
    message,
    data: rows,
    meta: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
    },
  });
};

/**
 * Send a no-content response
 */
const noContent = (res) => res.status(204).send();

module.exports = { success, created, paginated, noContent };
