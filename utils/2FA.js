const speakeasy = require('speakeasy');
const qrcode = require('qrcode');

function verifyTOTP(secret, token) {
  const isValid = speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 1, // Validates for the current time window only
  });
  return isValid;
}

// Generate a QR code URL for user setup with Google Authenticator
function generateQRURL(secret, email) {
  const url = speakeasy.otpauthURL({
    secret: secret,
    issuer: 'My Tours',
    label: email,
  });
  return url;
}

module.exports = {
  verifyTOTP,
  generateQRURL,
}