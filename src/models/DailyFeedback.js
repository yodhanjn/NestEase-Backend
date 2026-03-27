const mongoose = require('mongoose');

const dailyFeedbackSchema = new mongoose.Schema(
  {
    pg: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PGProperty',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },
    feedbackDate: {
      type: Date,
      default: Date.now,
    },
    feedbackDateKey: {
      type: String,
      required: true,
    },
    foodQuality: { type: Number, min: 1, max: 5, required: true },
    cleanliness: { type: Number, min: 1, max: 5, required: true },
    safety: { type: Number, min: 1, max: 5, required: true },
    internet: { type: Number, min: 1, max: 5, required: true },
    comment: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

dailyFeedbackSchema.index({ user: 1, pg: 1, feedbackDateKey: 1 }, { unique: true });
dailyFeedbackSchema.index({ pg: 1, createdAt: -1 });

module.exports = mongoose.model('DailyFeedback', dailyFeedbackSchema);
