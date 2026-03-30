const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const {
  getPendingPGs,
  getUnderperformingPGs,
  approvePG,
  rejectPG,
  removeUnderperformingPG,
  getAdminPGStats,
} = require('../controllers/adminController');
const { getFraudReports, actOnFraudReport } = require('../controllers/fraudReportController');

router.use(protect, restrictTo('admin'));

router.get('/pg/stats', getAdminPGStats);
router.get('/pg/pending', getPendingPGs);
router.get('/pg/underperforming', getUnderperformingPGs);
router.put('/pg/:id/approve', approvePG);
router.put('/pg/:id/reject', rejectPG);
router.put('/pg/:id/remove', removeUnderperformingPG);
router.get('/reports', getFraudReports);
router.put('/reports/:id', actOnFraudReport);

module.exports = router;
