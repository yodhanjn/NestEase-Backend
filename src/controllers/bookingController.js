const Booking = require('../models/Booking');
const PGProperty = require('../models/PGProperty');

const createBooking = async (req, res, next) => {
  try {
    const { pgId, checkInDate, checkOutDate, note } = req.body;

    if (!pgId || !checkInDate || !checkOutDate) {
      return res.status(400).json({ success: false, message: 'PG, check-in and check-out dates are required' });
    }

    const pg = await PGProperty.findById(pgId);
    if (!pg || !pg.isActive) {
      return res.status(404).json({ success: false, message: 'PG listing not found' });
    }

    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid check-in or check-out date' });
    }

    if (checkIn >= checkOut) {
      return res.status(400).json({ success: false, message: 'Check-out date must be after check-in date' });
    }

    const booking = await Booking.create({
      user: req.user._id,
      pg: pgId,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      note: note || '',
    });

    const populated = await Booking.findById(booking._id)
      .populate('pg', 'pgName location price images')
      .populate('user', 'name email');

    res.status(201).json({
      success: true,
      message: 'Booking request submitted successfully',
      booking: populated,
    });
  } catch (err) {
    next(err);
  }
};

const getMyBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate('pg', 'pgName location price images owner')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, bookings });
  } catch (err) {
    next(err);
  }
};

const getOwnerBookings = async (req, res, next) => {
  try {
    const ownerPGs = await PGProperty.find({ owner: req.user._id }).select('_id');
    const pgIds = ownerPGs.map((pg) => pg._id);

    const bookings = await Booking.find({ pg: { $in: pgIds } })
      .populate('pg', 'pgName location price')
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, bookings });
  } catch (err) {
    next(err);
  }
};

const updateBookingStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid booking status' });
    }

    const booking = await Booking.findById(req.params.id).populate('pg', 'owner');
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const isOwner = booking.pg.owner.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this booking' });
    }

    booking.status = status;
    await booking.save();

    res.status(200).json({ success: true, message: 'Booking status updated', booking });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createBooking,
  getMyBookings,
  getOwnerBookings,
  updateBookingStatus,
};
