const express = require('express');
const router = express.Router();
const { register, verifyOTP, resendOTP, login, getMe, getOTPDev } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.post('/login', login);
router.get('/me', protect, getMe);
router.get('/dev/otp/:userId', getOTPDev);

module.exports = router;
