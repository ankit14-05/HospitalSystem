// src/utils/AppError.js
class AppError extends Error {
  constructor(message, statusCode = 500, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = statusCode;
    this.isOperational = true;
    this.errors = errors; // validation error array
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
