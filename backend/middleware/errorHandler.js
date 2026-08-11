const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

const errorHandler = (error, req, res, next) => {
  const statusCode = error.statusCode || 500;
  const isProduction = process.env.NODE_ENV === "production";

  let message;
  if (isProduction) {
    if (statusCode === 404) {
      message = error.message || "Not found";
    } else if (statusCode >= 500 || !error.expose) {
      message = "Internal server error";
    } else {
      message = error.message || "Bad request";
    }
  } else {
    message = error.message || "Internal server error";
  }

  const response = { error: message };
  if (!isProduction && error.stack) {
    response.stack = error.stack;
  }

  res.status(statusCode).json(response);
};

module.exports = {
  notFoundHandler,
  errorHandler,
};
