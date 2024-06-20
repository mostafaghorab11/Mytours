const jwt = require('jsonwebtoken');
const { promisify } = require('util');
require('dotenv').config();
const crypto = require('crypto');

const User = require('../models/user');
const { catchAsync } = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const sendEmail = require('../utils/email');
const sendVerificationEmail = require('../utils/sendVerificationEmail');

const signToken = (id, secret, expiresIn) => {
  return jwt.sign({ id }, secret, {
    expiresIn: expiresIn,
  });
};

const generateTokens = (userId) => {
  const accessToken = signToken(
    userId,
    process.env.JWT_SECRET_KEY,
    process.env.ACCESS_TOKEN_EXPIRES_IN
  );
  const refreshToken = signToken(
    userId,
    process.env.JWT_SECRET_KEY,
    process.env.REFRESH_TOKEN_EXPIRES_IN
  );

  return { accessToken, refreshToken };
};

const createSendToken = (user, statusCode, res) => {
  //TODO: REFRESH TOKEN SHOULD BE SAVED ON THE SERVER NOT CLIENT
  const { accessToken, refreshToken } = generateTokens(user._id);

  const cookieOptions = {
    maxAge: 1000 * 60 * 60, // 1 hour
    httpOnly: true,
  };
  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;
  res.cookie('jwt', accessToken, cookieOptions);
  res.cookie('jwtRefresh', refreshToken, cookieOptions);

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

const verifyEmail = async (req, res) => {
  console.log(req.query);
  const { token, email } = req.query;
  const user = await User.findOne({ email });

  if (!user) {
    return new AppError('Verification failed', 401);
  }

  if (user.verificationToken !== token) {
    return new AppError('Verification failed', 401);
  }

  await User.findOneAndUpdate(
    { email: email },
    { isVerified: true, verified: Date.now(), verificationToken: '' },
    { runValidators: false }
  );

  res.status(200).json({
    status: 'success',
  });
};

const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new AppError('Please enter email and password', 400);
  }
  const user = await User.findOne({ email: email }).select('+password');
  if (user) {
    const isMatch = await user.comparePassword(password);
    if (isMatch) {
      createSendToken(user, 200, res);
    } else {
      throw new AppError('Invalid email or password', 401);
    }
  } else {
    throw new AppError('Invalid email or password again', 401);
  }
});

// jwt authentication method
const protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check of it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    throw new AppError(
      'You are not logged in! Please log in to get access.',
      401
    );
  }

  // 2) Verification token
  const decoded = await promisify(jwt.verify)(
    token,
    process.env.JWT_SECRET_KEY
  );

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);
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

const refresh = catchAsync(async (req, res) => {
  const refreshToken = req.body.refreshToken;
  if (!refreshToken) {
    throw new AppError('Missing refresh token', 400);
  }
  try {
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_SECRET_KEY + 'refresh'
    );
    const user = await User.findById(decoded.userId);
    // Fetch user from database
    if (user) {
      const { accessToken } = generateTokens(user._id);
      // Generate new access and refresh tokens
      return res.json({ accessToken: accessToken });
    }
  } catch (err) {
    throw new AppError('Invalid refresh token', 401);
  }
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
