const mongoose = require('mongoose');

const pgPropertySchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    pgName: {
      type: String,
      required: [true, 'PG name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    location: {
      address: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String },
      pincode: { type: String },
      lat: { type: Number },
      lng: { type: Number },
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
    },
    genderAllowed: {
      type: String,
      enum: ['male', 'female', 'any'],
      default: 'any',
    },
    availableRooms: {
      type: Number,
      default: 0,
    },
    amenities: [{ type: String }],
    images: [{ type: String }],
    overallRating: {
      type: Number,
      default: 0,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isFlagged: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

pgPropertySchema.index({ 'location.city': 1, price: 1, overallRating: -1 });

module.exports = mongoose.model('PGProperty', pgPropertySchema);
