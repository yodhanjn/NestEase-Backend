const PGProperty = require('../models/PGProperty');
const { createNotification } = require('../services/notificationService');

const getPendingPGs = async (req, res, next) => {
  try {
    const pendingPGs = await PGProperty.find({ isVerified: false, isActive: true })
      .populate('owner', 'name email phone')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: pendingPGs.length, pgs: pendingPGs });
  } catch (err) {
    next(err);
  }
};

const getUnderperformingPGs = async (req, res, next) => {
  try {
    const ratingThreshold = Number(req.query.ratingThreshold || 3);
    const minReviews = Number(req.query.minReviews || 5);

    const pgs = await PGProperty.find({
      isVerified: true,
      isActive: true,
      overallRating: { $lte: ratingThreshold },
      totalReviews: { $gte: minReviews },
    })
      .populate('owner', 'name email phone')
      .sort({ overallRating: 1, totalReviews: -1 });

    res.status(200).json({
      success: true,
      criteria: { ratingThreshold, minReviews },
      count: pgs.length,
      pgs,
    });
  } catch (err) {
    next(err);
  }
};

const approvePG = async (req, res, next) => {
  try {
    const pg = await PGProperty.findById(req.params.id);
    if (!pg) {
      return res.status(404).json({ success: false, message: 'PG not found' });
    }

    pg.isVerified = true;
    pg.isActive = true;
    await pg.save();

    await createNotification({
      userId: pg.owner,
      type: 'approval',
      title: 'PG approved',
      message: `${pg.pgName} has been approved and is now visible to residents.`,
      route: '/dashboard/owner',
      entityId: pg._id,
    });

    res.status(200).json({ success: true, message: 'PG approved successfully', pg });
  } catch (err) {
    next(err);
  }
};

const rejectPG = async (req, res, next) => {
  try {
    const pg = await PGProperty.findById(req.params.id);
    if (!pg) {
      return res.status(404).json({ success: false, message: 'PG not found' });
    }

    pg.isVerified = false;
    pg.isActive = false;
    pg.isFlagged = true;
    await pg.save();

    await createNotification({
      userId: pg.owner,
      type: 'approval',
      title: 'PG rejected',
      message: `${pg.pgName} was rejected by admin and removed from listings.`,
      route: '/dashboard/owner',
      entityId: pg._id,
    });

    res.status(200).json({ success: true, message: 'PG rejected and removed from listing', pg });
  } catch (err) {
    next(err);
  }
};

const removeUnderperformingPG = async (req, res, next) => {
  try {
    const pg = await PGProperty.findById(req.params.id);
    if (!pg) {
      return res.status(404).json({ success: false, message: 'PG not found' });
    }

    pg.isActive = false;
    pg.isFlagged = true;
    await pg.save();

    await createNotification({
      userId: pg.owner,
      type: 'approval',
      title: 'PG removed by admin',
      message: `${pg.pgName} was removed due to low performance.`,
      route: '/dashboard/owner',
      entityId: pg._id,
    });

    res.status(200).json({ success: true, message: 'PG removed due to low performance', pg });
  } catch (err) {
    next(err);
  }
};

const getAdminPGStats = async (req, res, next) => {
  try {
    const [pending, verifiedActive, removed, total] = await Promise.all([
      PGProperty.countDocuments({ isVerified: false, isActive: true }),
      PGProperty.countDocuments({ isVerified: true, isActive: true }),
      PGProperty.countDocuments({ isActive: false }),
      PGProperty.countDocuments({}),
    ]);

    res.status(200).json({
      success: true,
      stats: { pending, verifiedActive, removed, total },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPendingPGs,
  getUnderperformingPGs,
  approvePG,
  rejectPG,
  removeUnderperformingPG,
  getAdminPGStats,
};
