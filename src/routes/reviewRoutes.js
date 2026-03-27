const express = require('express');
const router = express.Router();
const {
  submitReview,
  getReviewsByPG,
  getEligibleReviewBookings,
} = require('../controllers/reviewController');
const { protect, restrictTo } = require('../middleware/auth');

router.get('/pg/:pgId', getReviewsByPG);
router.get('/eligible-bookings', protect, restrictTo('resident'), getEligibleReviewBookings);
router.post('/', protect, restrictTo('resident'), submitReview);

module.exports = router;
