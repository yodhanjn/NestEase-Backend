const express = require('express');
const router = express.Router();
const {
  submitDailyFeedback,
  getFeedbackByPG,
  getEligibleFeedbackBookings,
} = require('../controllers/feedbackController');
const { protect, restrictTo } = require('../middleware/auth');

router.get('/pg/:pgId', getFeedbackByPG);
router.get('/eligible-bookings', protect, restrictTo('resident'), getEligibleFeedbackBookings);
router.post('/', protect, restrictTo('resident'), submitDailyFeedback);

module.exports = router;
