const jwt = require('jsonwebtoken');
const { promisify } = require('util');
require('dotenv').config();
const crypto = require('crypto');
const speakeasy = require('speakeasy');

const User = require('../models/user');
const { catchAsync } = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const sendEmail = require('../utils/email');
const sendVerificationEmail = require('../utils/sendVerificationEmail');
const Token = require('../models/token');
const { generateQRURL, verifyTOTP } = require('../utils/2FA');
const { generateTokens } = require('../utils/jwt');

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

  // Create a verification token for the new user to use it to verify email using email verification
  const verificationToken = crypto.randomBytes(40).toString('hex');

  // Generate a secret key for the user to use it in 2FA
  const userSecret = speakeasy.generateSecret({ length: 20 });

  const newUser = await User.create({
    ...req.body,
    role: role,
    verificationToken: verificationToken,
    secret: userSecret.base32,
  });

  // Generate a QR code URL for the user
  const qrURL = generateQRURL(userSecret.base32, req.body.email);

  // Send a confirmation email to the new user
  await sendVerificationEmail({
    email: req.body.email,
    name: req.body.name,
    verificationToken: verificationToken,
  });
  createSendToken({ ...newUser._doc, qrURL }, 201, res);
});

const verifyEmail = catchAsync(async (req, res, next) => {
  const { token } = req.query;
  const email = req.user.email;
  const user = await User.findOne({ email });

  if (!user) {
    return next(new AppError('Verification failed please log in', 401));
  }

  if (user.verificationToken !== token) {
    return next(new AppError('Verification failed', 401));
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

// verify using 2 factory authentication [google authenticator]
// can be added to verify email method
const verifyWith2FA = async (req, res, next) => {
  const { token } = req.body;
  const userId = req.user._id;
  if (!token) {
    return next(
      new AppError('please enter email and google authenticator token', 400)
    );
  }
  const user = await User.findOne({ _id: userId });
  // Retrieve the user's secret key from your database
  const userSecret = user.secret;
  const isValid = verifyTOTP(userSecret, token);
  if (!isValid) {
    return next(
      new AppError('Verification with two step verification failed', 401)
    );
  }
  await User.findOneAndUpdate(
    { _id: userId },
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
    return next(new AppError('Please enter email and password', 400));
  }
  const user = await User.findOne({ email: email }).select('+password');
  if (user) {
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return next(new AppError('Invalid email or password', 401));
    }
    if (!user.isVerified) {
      return next(new AppError('Please verify your email', 401));
    }
  } else {
    return next(new AppError('Invalid email or password', 401));
  }

  let refreshToken;
  // check for the existing token // old user
  const existingToken = await Token.findOne({ user: user._id });
  if (existingToken) {
    if (!existingToken.isValid) {
      return next(new AppError('Invalid Credentials', 401));
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
    return next(new AppError('Authentication failed', 401));
  }
  // 2) Verification accessToken
  const decoded = await promisify(jwt.verify)(
    accessToken,
    process.env.JWT_SECRET_KEY
  );

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.userId);
  if (!currentUser) {
    return next(
      new AppError(
        'The user belonging to this token does no longer exist.',
        401
      )
    );
  }

  // 4) Check if user changed password after the token was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password! Please log in again.', 401)
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
    return next(new AppError('Missing refresh token', 400));
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
    return next(new AppError('Authentication failed', 401));
  }

  const user = await User.findById(decoded.userId);
  // Fetch user from database
  if (user) {
    const { accessToken } = generateTokens(user._id);
    // Generate new access and refresh tokens
    return res.json({ accessToken: accessToken });
  }
});

const logout = catchAsync(async (req, res) => {
  await Token.findOneAndDelete({ user: req.user._id });

  res.cookie('jwt', 'logout', {
    httpOnly: true,
    expires: new Date(Date.now()),
  });
  res.cookie('jwtRefresh', 'logout', {
    httpOnly: true,
    expires: new Date(Date.now()),
  });
  res.status(200).json({
    status: 'success',
  });
});

const forgetPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    return next(new AppError('Email not found', 404));
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
  const { password, passwordConfirm } = req.body;

  const user = await User.findOne({
    resetToken: hashedToken,
    resetTokenExpiry: { $gt: Date.now() },
  });
  if (!user) {
    return next(new AppError('Invalid or expired reset token', 401));
  }

  user.password = password;
  user.passwordConfirm = passwordConfirm;
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
    return next(new AppError('Your current password is wrong.', 401));
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

// const isLoggedIn = async (req, res, next) => {
//   const accessToken = req.cookies.jwt;
//   if (accessToken) {
//     // 1) verify token
//     const decoded = await promisify(jwt.verify)(
//       accessToken,
//       process.env.JWT_SECRET_KEY
//     );

//     // 2) Check if user still exists
//     const currentUser = await User.findById(decoded.id);
//     if (!currentUser) {
//       return next();
//     }

//     // 3) Check if user changed password after the token was issued
//     if (currentUser.changedPasswordAfter(decoded.iat)) {
//       return next();
//     }

//     // THERE IS A LOGGED IN USER
//     res.locals.user = currentUser;
//     return next();
//   }
//   next();
// };

module.exports = {
  generateTokens,
  signup,
  login,
  protect,
  logout,
  dashboard,
  forgetPassword,
  resetPassword,
  refresh,
  restrictTo,
  updatePassword,
  // isLoggedIn,
  verifyEmail,
  verifyWith2FA,
};
