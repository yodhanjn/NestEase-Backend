const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const { listConversations, getMessages, sendMessage } = require('../controllers/chatController');

router.use(protect, restrictTo('resident', 'owner'));

router.get('/conversations', listConversations);
router.get('/messages', getMessages);
router.post('/messages', sendMessage);

module.exports = router;
