const jwt = require('jsonwebtoken');
require('dotenv').config();

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

module.exports = { generateTokens };
