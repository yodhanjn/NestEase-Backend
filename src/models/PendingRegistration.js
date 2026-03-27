const mongoose = require('mongoose');

const pendingRegistrationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    // Store a bcrypt hash only; account is created after OTP verification.
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ['resident', 'owner'],
      default: 'resident',
    },
    otp: {
      type: String,
      required: true,
      select: false,
    },
    otpExpiry: {
      type: Date,
      required: true,
      select: false,
    },
  },
  { timestamps: true }
);

pendingRegistrationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

module.exports = mongoose.model('PendingRegistration', pendingRegistrationSchema);
