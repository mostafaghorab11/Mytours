const express = require("express");
require("dotenv").config();
const session = require("express-session");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoSanitize = require("express-mongo-sanitize");

const authRoutes = require("./routes/auth.js");
const userRoutes = require("./routes/user.js");
const { globalErrorsHandler } = require("./controllers/errorController.js");
const AppError = require("./util/appError.js");

const app = express();
app.use(express.json()); // to handle req.body

// 1) GLOBAL MIDDLEWARES
// Set security HTTP headers
app.use(helmet());

// Development logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: true,
      cookie: { secure: false }, // Set to true if using HTTPS only
    })
  );
}

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

app.use("/api/v1", authRoutes);
app.use("/api/v1/users", userRoutes);

app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});
app.use(globalErrorsHandler);

module.exports = app;