const path = require('path');
const express = require('express');
require('dotenv').config();
const session = require('express-session');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const hpp = require('hpp');

const authRouter = require('./routes/auth.js');
const userRouter = require('./routes/user.js');
const tourRouter = require('./routes/tour.js');
const reviewRouter = require('./routes/review.js');
const { globalErrorsHandler } = require('./controllers/errorController.js');
const AppError = require('./utils/appError.js');
const viewRouter = require('./routes/viewRoutes.js');

const app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(cookieParser());

// 1) GLOBAL MIDDLEWARES
app.use(express.static(path.join(__dirname, 'public')));
// Set security HTTP headers
app.use(helmet());

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false }, // Set to true if using HTTPS only
    })
  );
}

// Limit requests from same IP
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour!',
});
app.use('/api', limiter);

app.use(express.json({ limit: '10kb' })); // to handle req.body
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Prevent parameter pollution
app.use(
  hpp({
    whitelist: ['duration', 'ratingQuantity', 'ratingAverage', 'price'],
  })
);

// Routes
app.use('/', viewRouter);
app.use('/api/v1', authRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/reviews', reviewRouter);

app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});
app.use(globalErrorsHandler);

module.exports = app;
