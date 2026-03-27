const Booking = require('../models/Booking');
const DailyFeedback = require('../models/DailyFeedback');

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

const submitDailyFeedback = async (req, res, next) => {
  try {
    const { pgId, bookingId, foodQuality, cleanliness, safety, internet, comment, feedbackDate } = req.body;
    if (!pgId || !bookingId) {
      return res.status(400).json({ success: false, message: 'PG and booking are required' });
    }

    const scores = [foodQuality, cleanliness, safety, internet].map(Number);
    if (scores.some((score) => Number.isNaN(score) || score < 1 || score > 5)) {
      return res.status(400).json({ success: false, message: 'All feedback scores must be between 1 and 5' });
    }

    const booking = await Booking.findOne({ _id: bookingId, user: req.user._id, pg: pgId });
    if (!booking) {
      return res.status(400).json({ success: false, message: 'Valid booking not found for this PG' });
    }

    if (!['confirmed', 'completed'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'Only confirmed/completed bookings can submit feedback' });
    }

    const now = feedbackDate ? new Date(feedbackDate) : new Date();
    const inStayRange = isBetweenInclusive(now, booking.checkInDate, booking.checkOutDate);
    if (!inStayRange) {
      return res.status(400).json({ success: false, message: 'Daily feedback can be submitted only during your stay' });
    }

    const feedbackDateKey = toDateKey(now);

    const feedback = await DailyFeedback.create({
      pg: pgId,
      user: req.user._id,
      booking: bookingId,
      feedbackDate: now,
      feedbackDateKey,
      foodQuality: scores[0],
      cleanliness: scores[1],
      safety: scores[2],
      internet: scores[3],
      comment: comment || '',
    });

    res.status(201).json({
      success: true,
      message: 'Daily feedback submitted successfully',
      feedback,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted daily feedback for this PG today',
      });
    }
    next(err);
  }
};

const getFeedbackByPG = async (req, res, next) => {
  try {
    const feedbacks = await DailyFeedback.find({ pg: req.params.pgId }).sort({ createdAt: -1 });
    const total = feedbacks.length;
    const aggregates = total
      ? {
          foodQuality: Number((feedbacks.reduce((s, item) => s + item.foodQuality, 0) / total).toFixed(2)),
          cleanliness: Number((feedbacks.reduce((s, item) => s + item.cleanliness, 0) / total).toFixed(2)),
          safety: Number((feedbacks.reduce((s, item) => s + item.safety, 0) / total).toFixed(2)),
          internet: Number((feedbacks.reduce((s, item) => s + item.internet, 0) / total).toFixed(2)),
        }
      : { foodQuality: 0, cleanliness: 0, safety: 0, internet: 0 };

    res.status(200).json({
      success: true,
      total,
      aggregates,
      feedbacks,
    });
  } catch (err) {
    next(err);
  }
};

const getEligibleFeedbackBookings = async (req, res, next) => {
  try {
    const now = new Date();
    const bookings = await Booking.find({
      user: req.user._id,
      status: { $in: ['confirmed', 'completed'] },
      checkInDate: { $lte: now },
      checkOutDate: { $gte: now },
    })
      .populate('pg', 'pgName location')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, bookings });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  submitDailyFeedback,
  getFeedbackByPG,
  getEligibleFeedbackBookings,
};
