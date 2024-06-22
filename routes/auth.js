const express = require('express');
const {
  login,
  signup,
  dashboard,
  forgetPassword,
  resetPassword,
  refresh,
  protect,
  updatePassword,
  verifyEmail,
  logout,
  verifyWith2FA,
} = require('../controllers/auth');

const googlePassport = require('../config/google-passport');

const router = express.Router();

// "api/v1"
router.route('/signup').post(signup);
router.route('/login').post(login);
router.route('/refresh').get(refresh);
router.route('/dashboard').get(protect, dashboard);
router.route('/verify-email').post(verifyEmail);
router.route('/verify-two-factor-auth').post(protect, verifyWith2FA);
router.route('/logout').get(protect, logout);

router.get(
  '/login/google',
  googlePassport.authenticate('google', { scope: ['profile', 'email'] }),
  dashboard
); // Request Google profile and email

router.post('/forget-password', forgetPassword);

router.patch('/reset-password/:token', resetPassword);
router.patch('/updateMyPassword', protect, updatePassword);

module.exports = router;
