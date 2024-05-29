const catchAsync = (fn) => {
  return async (req, res, next) => {
    try {
      await fn(req, res, next); // Await the wrapped function execution
    } catch (err) {
      next(err);
    }
  };
};

module.exports = { catchAsync };
