/**
 * Global application error handler.
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log full trace locally for debugging
  console.error(err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = `Resource not found with ID: ${err.value}`;
    res.status(404);
    error = new Error(message);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate key value entered (resource already exists)';
    res.status(400);
    error = new Error(message);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    res.status(400);
    error = new Error(message);
  }

  const statusCode = res.statusCode === 200 ? 500 : (res.statusCode || 500);

  res.status(statusCode).json({
    success: false,
    message: error.message || 'Internal Server Error'
  });
};

module.exports = errorHandler;
