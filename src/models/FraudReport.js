const mongoose = require('mongoose');

const fraudReportSchema = new mongoose.Schema(
  {
    reportedPg: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PGProperty',
      required: true,
      index: true,
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    details: {
      type: String,
      trim: true,
      default: '',
    },
    detectionSource: {
      type: String,
      enum: ['user', 'system'],
      default: 'user',
    },
    riskScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    status: {
      type: String,
      enum: ['open', 'under_review', 'resolved', 'dismissed'],
      default: 'open',
      index: true,
    },
    adminNote: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

fraudReportSchema.index({ reportedBy: 1, reportedPg: 1, createdAt: -1 });

module.exports = mongoose.model('FraudReport', fraudReportSchema);
