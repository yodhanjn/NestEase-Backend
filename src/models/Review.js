const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
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
    reviewDate: {
      type: Date,
      default: Date.now,
    },
    reviewDateKey: {
      type: String,
      required: true,
    },
    cleanlinessRating: { type: Number, min: 1, max: 5, required: true },
    foodRating: { type: Number, min: 1, max: 5, required: true },
    waterRating: { type: Number, min: 1, max: 5, required: true },
    electricityRating: { type: Number, min: 1, max: 5, required: true },
    wifiRating: { type: Number, min: 1, max: 5, required: true },
    securityRating: { type: Number, min: 1, max: 5, required: true },
    comment: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

reviewSchema.index({ user: 1, pg: 1, reviewDateKey: 1 }, { unique: true });
reviewSchema.index({ pg: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
