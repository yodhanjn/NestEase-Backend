const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const { submitFraudReport, getMyFraudReports } = require('../controllers/fraudReportController');

router.post('/', protect, restrictTo('resident', 'owner'), submitFraudReport);
router.get('/my', protect, restrictTo('resident', 'owner'), getMyFraudReports);

module.exports = router;
