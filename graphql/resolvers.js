const User = require('../models/user');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { generateQRURL } = require('../utils/2FA');
const sendVerificationEmail = require('../utils/sendVerificationEmail');

const createUser = async ({ userInput }, _context, _info) => {
  // first registered user is an admin  // req
  const isFirstAccount = (await User.countDocuments({})) === 0;
  const role = isFirstAccount ? 'admin' : 'user';

  // Create a verification token for the new user to use it to verify email using email verification
  const verificationToken = crypto.randomBytes(40).toString('hex');

  // Generate a secret key for the user to use it in 2FA
  const userSecret = speakeasy.generateSecret({ length: 20 });
  const user = await User.create({
    ...userInput,
    role: role,
    verificationToken: verificationToken,
    secret: userSecret.base32,
  });

  // Generate a QR code URL for the user
  const qrURL = generateQRURL(userSecret.base32, userInput.email);

  // Send a confirmation email to the new user
  await sendVerificationEmail({
    email: userInput.email,
    name: userInput.name,
    verificationToken: verificationToken,
  });
  return {
    ...user._doc,
    qrURL: qrURL,
  };
};

const login = async ({ email, password }, _context, _info) => {
  console.log(email, password);
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    const error = new Error('User not found.');
    error.code = 401;
    throw error;
  }
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    const error = new Error('Incorrect password.');
    error.code = 401;
    throw error;
  }
  if (!user.isVerified) {
    const error = new Error('Please verify your email.');
    error.code = 401;
    throw error;
  }
  const token = jwt.sign(
    {
      userId: user._id.toString(),
      email: user.email,
    },
    process.env.JWT_SECRET_KEY,
    { expiresIn: '1h' }
  );
  return { token: token, userId: user._id.toString() };
};

module.exports = { createUser, login };
