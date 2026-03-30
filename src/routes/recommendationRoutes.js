const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const { getUserRecommendations } = require('../controllers/recommendationController');

router.get('/', protect, restrictTo('resident'), getUserRecommendations);

module.exports = router;
