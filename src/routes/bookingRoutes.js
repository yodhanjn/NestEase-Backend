const express = require('express');
const router = express.Router();
const {
  createBooking,
  getMyBookings,
  getOwnerBookings,
  updateBookingStatus,
} = require('../controllers/bookingController');
const { protect, restrictTo } = require('../middleware/auth');

router.post('/', protect, restrictTo('resident'), createBooking);
router.get('/my', protect, restrictTo('resident'), getMyBookings);
router.get('/owner', protect, restrictTo('owner', 'admin'), getOwnerBookings);
router.put('/:id/status', protect, restrictTo('owner', 'admin'), updateBookingStatus);

module.exports = router;
