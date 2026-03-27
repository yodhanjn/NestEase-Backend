const Booking = require('../models/Booking');
const PGProperty = require('../models/PGProperty');
const Review = require('../models/Review');

const toDateKey = (date) => {
  const d = new Date(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const isBetweenInclusive = (date, start, end) => {
  const d = new Date(date).getTime();
  return d >= new Date(start).getTime() && d <= new Date(end).getTime();
};

const submitReview = async (req, res, next) => {
  try {
    const {
      pgId,
      bookingId,
      cleanlinessRating,
      foodRating,
      waterRating,
      electricityRating,
      wifiRating,
      securityRating,
      comment,
      reviewDate,
    } = req.body;

    if (!pgId || !bookingId) {
      return res.status(400).json({ success: false, message: 'PG and booking are required' });
    }

    const ratings = [
      cleanlinessRating,
      foodRating,
      waterRating,
      electricityRating,
      wifiRating,
      securityRating,
    ].map(Number);

    if (ratings.some((r) => Number.isNaN(r) || r < 1 || r > 5)) {
      return res.status(400).json({ success: false, message: 'All ratings must be between 1 and 5' });
    }

    const booking = await Booking.findOne({ _id: bookingId, user: req.user._id, pg: pgId });
    if (!booking) {
      return res.status(400).json({ success: false, message: 'Valid booking not found for this PG' });
    }

    if (!['confirmed', 'completed'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'Only confirmed/completed bookings can submit reviews' });
    }

    const now = reviewDate ? new Date(reviewDate) : new Date();
    const inStayRange = isBetweenInclusive(now, booking.checkInDate, booking.checkOutDate);
    if (!inStayRange && booking.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Review allowed only during stay or after completion' });
    }

    const reviewDateKey = toDateKey(now);

    const review = await Review.create({
      pg: pgId,
      user: req.user._id,
      booking: bookingId,
      reviewDate: now,
      reviewDateKey,
      cleanlinessRating: ratings[0],
      foodRating: ratings[1],
      waterRating: ratings[2],
      electricityRating: ratings[3],
      wifiRating: ratings[4],
      securityRating: ratings[5],
      comment: comment || '',
    });

    const reviews = await Review.find({ pg: pgId }).select(
      'cleanlinessRating foodRating waterRating electricityRating wifiRating securityRating'
    );

    const overallScores = reviews.map((r) => {
      const values = [
        r.cleanlinessRating,
        r.foodRating,
        r.waterRating,
        r.electricityRating,
        r.wifiRating,
        r.securityRating,
      ];
      return values.reduce((sum, val) => sum + val, 0) / values.length;
    });

    const overallRating =
      overallScores.length > 0
        ? overallScores.reduce((sum, val) => sum + val, 0) / overallScores.length
        : 0;

    await PGProperty.findByIdAndUpdate(pgId, {
      overallRating: Number(overallRating.toFixed(2)),
      totalReviews: reviews.length,
    });

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      review,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'You can submit only one review per day for this PG',
      });
    }
    next(err);
  }
};

const getReviewsByPG = async (req, res, next) => {
  try {
    const reviews = await Review.find({ pg: req.params.pgId })
      .populate('user', 'name')
      .sort({ createdAt: -1 });

    const foodStats = reviews.length
      ? {
          taste: Number((reviews.reduce((s, r) => s + r.foodRating, 0) / reviews.length).toFixed(2)),
          hygiene: Number((reviews.reduce((s, r) => s + r.cleanlinessRating, 0) / reviews.length).toFixed(2)),
          quantity: Number((reviews.reduce((s, r) => s + r.waterRating, 0) / reviews.length).toFixed(2)),
          variety: Number((reviews.reduce((s, r) => s + r.electricityRating, 0) / reviews.length).toFixed(2)),
          overallFood: Number((reviews.reduce((s, r) => s + r.foodRating, 0) / reviews.length).toFixed(2)),
        }
      : { taste: 0, hygiene: 0, quantity: 0, variety: 0, overallFood: 0 };

    res.status(200).json({ success: true, reviews, foodStats });
  } catch (err) {
    next(err);
  }
};

const getEligibleReviewBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.find({
      user: req.user._id,
      status: { $in: ['confirmed', 'completed'] },
    })
      .populate('pg', 'pgName location')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, bookings });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  submitReview,
  getReviewsByPG,
  getEligibleReviewBookings,
};
