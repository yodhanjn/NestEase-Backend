const Notification = require('../models/Notification');

const createNotification = async ({ userId, type = 'system', title, message, route = '', entityId = '' }) => {
  try {
    if (!userId || !title || !message) return null;
    return await Notification.create({
      user: userId,
      type,
      title,
      message,
      meta: { route, entityId: entityId ? String(entityId) : '' },
    });
  } catch (error) {
    console.error('Notification create failed:', error.message);
    return null;
  }
};

const createBulkNotifications = async (notifications) => {
  if (!Array.isArray(notifications) || notifications.length === 0) return;
  await Promise.all(notifications.map((item) => createNotification(item)));
};

module.exports = {
  createNotification,
  createBulkNotifications,
};
