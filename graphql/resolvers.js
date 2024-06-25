const User = require('../models/user');
const AppError = require('../utils/appError');

const createUser = async function ({ userInput }, _context, _info) {
  console.log(userInput);
  const existingUser = await User.findOne({ email: userInput.email });
  if (existingUser) {
    throw new AppError('User already exists', 401);
  }
  const user = await User.create(userInput);
  console.log(user);
  return {
    ...user._doc,
  };
};

module.exports = { createUser };
