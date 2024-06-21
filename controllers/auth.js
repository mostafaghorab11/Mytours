const jwt = require('jsonwebtoken');
const { promisify } = require('util');
require('dotenv').config();
const crypto = require('crypto');

const User = require('../models/user');
const { catchAsync } = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const sendEmail = require('../utils/email');
const sendVerificationEmail = require('../utils/sendVerificationEmail');
const Token = require('../models/token');

const signToken = (payload, secret, expiresIn) => {
  return jwt.sign(payload, secret, {
    expiresIn: expiresIn,
  });
};

const generateTokens = (userId, dbRefreshToken) => {
  const accessToken = signToken(
    { userId },
    process.env.JWT_SECRET_KEY,
    process.env.ACCESS_TOKEN_EXPIRES_IN
  );
  const refreshToken = signToken(
    { userId: userId, refreshToken: dbRefreshToken },
    process.env.JWT_SECRET_KEY,
    process.env.REFRESH_TOKEN_EXPIRES_IN
  );

  return { accessToken, refreshToken };
};

const createSendToken = async (user, statusCode, res, dbRefreshToken) => {
  const { accessToken, refreshToken } = generateTokens(
    user._id,
    dbRefreshToken
  );

  const oneDay = 1000 * 60 * 60 * 24;
  const longerExp = 1000 * 60 * 60 * 24 * 30;

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // signed: process.env.NODE_ENV === 'production',
  };

  res.cookie('jwt', accessToken, {
    ...cookieOptions,
    expires: new Date(Date.now() + oneDay),
  });
  res.cookie('jwtRefresh', refreshToken, {
    ...cookieOptions,
    expires: new Date(Date.now() + longerExp),
  });

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    accessToken,
    refreshToken,
    data: {
      user,
    },
  });
};

const signup = catchAsync(async (req, res, next) => {
  // first registered user is an admin
  const isFirstAccount = (await User.countDocuments({})) === 0;
  const role = isFirstAccount ? 'admin' : 'user';

  const verificationToken = crypto.randomBytes(40).toString('hex');

  const newUser = await User.create({
    name: req.body.name,
    username: req.body.username,
    email: req.body.email,
    role: role,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    verificationToken: verificationToken,
  });

  // Send an confirmation email to the new user
  sendVerificationEmail({
    email: req.body.email,
    name: req.body.name,
    verificationToken: verificationToken,
  });
  createSendToken(newUser, 201, res);
});

const verifyEmail = catchAsync(async (req, res) => {
  const { token, email } = req.query;
  const user = await User.findOne({ email });

  if (!user) {
    throw new AppError('Verification failed', 401);
  }

  if (user.verificationToken !== token) {
    throw new AppError('Verification failed', 401);
  }

  await User.findOneAndUpdate(
    { email: email },
    { isVerified: true, verified: Date.now(), verificationToken: '' },
    { runValidators: false }
  );

  res.status(200).json({
    status: 'success',
  });
});

const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new AppError('Please enter email and password', 400);
  }
  const user = await User.findOne({ email: email }).select('+password');
  if (user) {
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AppError('Invalid email or password', 401);
    }
    if (!user.isVerified) {
      throw new AppError('Please verify your email', 401);
    }
  } else {
    throw new AppError('Invalid email or password', 401);
  }

  // const tokenUser = { name: user.name, userId: user._id, role: user.role };

  let refreshToken;
  // check for the existing token // old user
  const existingToken = await Token.findOne({ user: user._id });
  if (existingToken) {
    if (!existingToken.isValid) {
      throw new AppError('Invalid Credentials', 401);
    }
    refreshToken = existingToken.refreshToken;
    createSendToken(user, 200, res, refreshToken);
    return;
  }

  refreshToken = crypto.randomBytes(40).toString('hex');
  const ip = req.ip;
  const userAgent = req.headers['user-agent'];

  await Token.create({ refreshToken, ip, userAgent, user: user._id });

  createSendToken(user, 200, res, refreshToken);
});

// jwt authentication method
const protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check of it's there
  const accessToken = req.cookies.jwt;
  // if (
  //   req.headers.authorization &&
  //   req.headers.authorization.startsWith('Bearer')
  // ) {
  //   accessToken = req.headers.authorization.split(' ')[1];
  // }
  if (!accessToken) {
    throw new AppError('Authentication failed', 401);
  }
  // 2) Verification accessToken
  const decoded = await promisify(jwt.verify)(
    accessToken,
    process.env.JWT_SECRET_KEY
  );

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.userId);
  if (!currentUser) {
    throw new AppError(
      'The user belonging to this token does no longer exist.',
      401
    );
  }

  // 4) Check if user changed password after the token was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    throw new AppError(
      'User recently changed password! Please log in again.',
      401
    );
  }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = currentUser;
  next();
});

const restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles ['admin', 'lead-guide']. role='user'
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }

    next();
  };
};

const refresh = catchAsync(async (req, res) => {
  const refreshToken = req.cookies.jwtRefresh;
  if (!refreshToken) {
    throw new AppError('Missing refresh token', 400);
  }
  const decoded = await promisify(jwt.verify)(
    refreshToken,
    process.env.JWT_SECRET_KEY
  );

  const existingToken = await Token.findOne({
    refreshToken: decoded.refreshToken,
    user: decoded.userId,
  });
  if (!existingToken || !existingToken?.isValid) {
    throw new AppError('Authentication failed', 401);
  }

  const user = await User.findById(decoded.userId);
  // Fetch user from database
  if (user) {
    const { accessToken } = generateTokens(user._id);
    // Generate new access and refresh tokens
    return res.json({ accessToken: accessToken });
  }
});

const forgetPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError('Email not found', 404);
  }
  const resetToken = await user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${req.protocol}://${req.get(
    'host'
  )}/api/v1/reset-password/${resetToken}`; // Replace with your frontend reset password URL

  try {
    await sendEmail({
      email: email,
      subject: 'Password Reset Request',
      message: `
        <p>You requested a password reset for your account.</p>
        <p>Click this link to reset your password within 1 hour:</p>
        <a href="${resetUrl}">Reset Password</a>
      `,
    });

    res.json({
      status: 'success',
      message: 'Password reset instructions sent to your email',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError('There was an error sending the email. Try again later!'),
      500
    );
  }
});

const resetPassword = catchAsync(async (req, res, next) => {
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');
  const { password } = req.body;

  const user = await User.findOne({
    resetToken: hashedToken,
    resetTokenExpiry: { $gt: Date.now() },
  });
  if (!user) {
    throw new AppError('Invalid or expired reset token', 401);
  }

  user.password = password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.resetToken = undefined;
  user.resetTokenExpiry = undefined;
  await user.save();

  createSendToken(user, 200, res);
});

// reset password using the current password
// should be done after protected access
const updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findById(req.user.id).select('+password');

  // 2) Check if POSTed current password is correct
  const isMatch = await user.comparePassword(req.body.passwordCurrent);
  if (!isMatch) {
    throw new AppError('Your current password is wrong.', 401);
  }

  // 3) If so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  // User.findByIdAndUpdate will NOT work as intended!

  // 4) Log user in, send JWT
  createSendToken(user, 200, res);
});

const dashboard = (req, res) => {
  const luckyNumber = Math.floor(Math.random() * 100);

  res.status(200).json({
    msg: `Hello, ${req.user.name}`,
    secret: `Here is your authorized data, your lucky number is ${luckyNumber}`,
  });
};

const isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      // 1) verify token
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET_KEY
      );

      // 2) Check if user still exists
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }

      // 3) Check if user changed password after the token was issued
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next();
      }

      // THERE IS A LOGGED IN USER
      res.locals.user = currentUser;
      return next();
    } catch (err) {
      return next();
    }
  }
  next();
};

module.exports = {
  generateTokens,
  signup,
  login,
  protect,
  dashboard,
  forgetPassword,
  resetPassword,
  refresh,
  restrictTo,
  updatePassword,
  isLoggedIn,
  verifyEmail,
};
