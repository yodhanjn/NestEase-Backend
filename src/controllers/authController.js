const User = require('../models/User');
const PendingRegistration = require('../models/PendingRegistration');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../utils/jwt');
const { sendOTPEmail } = require('../utils/mailer');

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const register = async (req, res, next) => {
  try {
    const { name, email, phone, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    const allowedPublicRoles = ['resident', 'owner'];
    const safeRole = allowedPublicRoles.includes(role) ? role : 'resident';

    const passwordHash = await bcrypt.hash(password, 12);

    const pending = await PendingRegistration.findOneAndUpdate(
      { email },
      {
        name,
        email,
        phone: phone || '',
        passwordHash,
        role: safeRole,
        otp,
        otpExpiry,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    try {
      await sendOTPEmail(email, otp);
    } catch (mailErr) {
      console.error('Email send error during register:', mailErr.message);
      return res.status(502).json({
        success: false,
        message: 'OTP email could not be sent. Please try again.',
        userId: pending._id,
      });
    }

    res.status(201).json({
      success: true,
      message: 'OTP sent. Your account will be created after verification.',
      userId: pending._id,
    });
  } catch (err) {
    console.error('Register error:', err);
    next(err);
  }
};

const verifyOTP = async (req, res, next) => {
  try {
    const { userId, otp } = req.body;

    const pending = await PendingRegistration.findById(userId).select('+otp +otpExpiry +passwordHash');
    if (!pending) {
      return res.status(404).json({ success: false, message: 'Pending registration not found' });
    }

    if (pending.otp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    if (pending.otpExpiry < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    const existingUser = await User.findOne({ email: pending.email });
    if (existingUser) {
      await PendingRegistration.deleteOne({ _id: pending._id });
      return res.status(400).json({ success: false, message: 'Email already registered. Please login.' });
    }

    const user = await User.create({
      name: pending.name,
      email: pending.email,
      phone: pending.phone,
      // already bcrypt-hashed; User model hook skips re-hash for $2* values
      password: pending.passwordHash,
      role: pending.role,
      isVerified: true,
    });

    await PendingRegistration.deleteOne({ _id: pending._id });

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Email verified successfully',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
    });
  } catch (err) {
    next(err);
  }
};

const resendOTP = async (req, res, next) => {
  try {
    const { userId } = req.body;

    const pending = await PendingRegistration.findById(userId);
    if (!pending) {
      return res.status(404).json({ success: false, message: 'Pending registration not found' });
    }

    const otp = generateOTP();
    pending.otp = otp;
    pending.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await pending.save();

    try {
      await sendOTPEmail(pending.email, otp);
    } catch (mailErr) {
      console.error('OTP email resend error:', mailErr.message);
      return res.status(502).json({
        success: false,
        message: 'Failed to send OTP email. Please try again.',
      });
    }

    res.status(200).json({ success: true, message: 'New OTP sent to your email' });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in',
        userId: user._id,
      });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage,
        isVerified: user.isVerified,
      },
    });
  } catch (err) {
    next(err);
  }
};

const getMe = async (req, res) => {
  res.status(200).json({ success: true, user: req.user });
};

// Dev-only: retrieve OTP for testing when email is unavailable
const getOTPDev = async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ success: false, message: 'Not available in production' });
    }
    const { userId } = req.params;
    const pending = await PendingRegistration.findById(userId).select('+otp +otpExpiry');
    if (pending) {
      return res.status(200).json({ success: true, otp: pending.otp, otpExpiry: pending.otpExpiry });
    }

    // Backward compatibility for older unverified users.
    const user = await User.findById(userId).select('+otp +otpExpiry');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.status(200).json({ success: true, otp: user.otp, otpExpiry: user.otpExpiry });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, verifyOTP, resendOTP, login, getMe, getOTPDev };
