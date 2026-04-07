const FraudReport = require('../models/FraudReport');
const PGProperty = require('../models/PGProperty');
const User = require('../models/User');
const { createBulkNotifications, createNotification } = require('../services/notificationService');

const riskScoreFromReason = (reason = '') => {
  const text = String(reason).toLowerCase();
  if (text.includes('fake') || text.includes('fraud') || text.includes('scam')) return 85;
  if (text.includes('wrong location') || text.includes('mislead') || text.includes('false')) return 70;
  if (text.includes('safety') || text.includes('threat')) return 80;
  return 55;
};

const submitFraudReport = async (req, res, next) => {
  try {
    const { reportedPgId, reason, details } = req.body;

    if (!reportedPgId || !reason) {
      return res.status(400).json({ success: false, message: 'PG and reason are required' });
    }

    const pg = await PGProperty.findById(reportedPgId);
    if (!pg) {
      return res.status(404).json({ success: false, message: 'PG not found' });
    }

    const report = await FraudReport.create({
      reportedPg: reportedPgId,
      reportedBy: req.user._id,
      reason: String(reason).trim(),
      details: details ? String(details).trim() : '',
      detectionSource: 'user',
      riskScore: riskScoreFromReason(reason),
      status: 'open',
    });

    // Auto-flag listing when many open reports are received.
    const openReportsCount = await FraudReport.countDocuments({
      reportedPg: reportedPgId,
      status: { $in: ['open', 'under_review'] },
    });
    if (openReportsCount >= 3) {
      pg.isFlagged = true;
      await pg.save();
    }

    const admins = await User.find({ role: 'admin' }).select('_id');
    await createBulkNotifications(
      admins.map((admin) => ({
        userId: admin._id,
        type: 'fraud',
        title: 'New fraud report',
        message: `A new fraud report was submitted for ${pg.pgName}.`,
        route: '/dashboard/admin',
        entityId: report._id,
      }))
    );

    res.status(201).json({
      success: true,
      message: 'Fraud report submitted. Admin will review it.',
      report,
    });
  } catch (err) {
    next(err);
  }
};

const getMyFraudReports = async (req, res, next) => {
  try {
    const reports = await FraudReport.find({ reportedBy: req.user._id })
      .populate('reportedPg', 'pgName location isActive isVerified')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, reports });
  } catch (err) {
    next(err);
  }
};

const getFraudReports = async (req, res, next) => {
  try {
    const status = req.query.status ? String(req.query.status) : null;
    const query = {};
    if (status && status !== 'all') query.status = status;

    const reports = await FraudReport.find(query)
      .populate('reportedPg', 'pgName location isActive isVerified isFlagged')
      .populate('reportedBy', 'name email role')
      .sort({ riskScore: -1, createdAt: -1 });

    res.status(200).json({ success: true, count: reports.length, reports });
  } catch (err) {
    next(err);
  }
};

const actOnFraudReport = async (req, res, next) => {
  try {
    const { status, adminNote, action } = req.body;
    const allowedStatuses = ['open', 'under_review', 'resolved', 'dismissed'];
    const allowedActions = ['none', 'flag_pg', 'deactivate_pg', 'approve_pg'];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid report status' });
    }
    if (action && !allowedActions.includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid admin action' });
    }

    const report = await FraudReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    if (status) report.status = status;
    if (typeof adminNote === 'string') report.adminNote = adminNote.trim();

    const pg = await PGProperty.findById(report.reportedPg);
    if (pg && action) {
      if (action === 'flag_pg') {
        pg.isFlagged = true;
      } else if (action === 'deactivate_pg') {
        pg.isActive = false;
        pg.isFlagged = true;
      } else if (action === 'approve_pg') {
        pg.isVerified = true;
        pg.isActive = true;
        pg.isFlagged = false;
      }
      await pg.save();
    }

    await report.save();

    if (report.reportedBy) {
      await createNotification({
        userId: report.reportedBy,
        type: 'fraud',
        title: 'Fraud report updated',
        message: `Your fraud report status is now ${report.status.replace('_', ' ')}.`,
        route: '/dashboard/resident',
        entityId: report._id,
      });
    }

    const populated = await FraudReport.findById(report._id)
      .populate('reportedPg', 'pgName location isActive isVerified isFlagged')
      .populate('reportedBy', 'name email role');

    res.status(200).json({
      success: true,
      message: 'Fraud report updated',
      report: populated,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  submitFraudReport,
  getMyFraudReports,
  getFraudReports,
  actOnFraudReport,
};
