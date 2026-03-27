const Message = require('../models/Message');
const PGProperty = require('../models/PGProperty');
const User = require('../models/User');
const Booking = require('../models/Booking');

const listConversations = async (req, res, next) => {
  try {
    const currentUserId = req.user._id.toString();

    const messages = await Message.find({
      $or: [{ sender: req.user._id }, { receiver: req.user._id }],
    })
      .populate('sender', 'name email role')
      .populate('receiver', 'name email role')
      .populate('pg', 'pgName location')
      .sort({ createdAt: -1 })
      .limit(500);

    const map = new Map();
    messages.forEach((message) => {
      const key = message.conversationKey;
      const isCurrentReceiver = message.receiver._id.toString() === currentUserId;
      const already = map.get(key);

      const otherUser =
        message.sender._id.toString() === currentUserId ? message.receiver : message.sender;

      if (!already) {
        map.set(key, {
          conversationKey: key,
          pg: message.pg,
          otherUser,
          lastMessage: {
            _id: message._id,
            content: message.content,
            sender: message.sender._id,
            createdAt: message.createdAt,
          },
          unreadCount:
            isCurrentReceiver && !message.readBy.some((u) => u.toString() === currentUserId) ? 1 : 0,
        });
      } else if (
        isCurrentReceiver &&
        !message.readBy.some((u) => u.toString() === currentUserId)
      ) {
        already.unreadCount += 1;
      }
    });

    const conversations = Array.from(map.values()).sort(
      (a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
    );

    res.status(200).json({ success: true, conversations });
  } catch (err) {
    next(err);
  }
};

const getMessages = async (req, res, next) => {
  try {
    const { pgId, userId } = req.query;
    if (!pgId || !userId) {
      return res.status(400).json({ success: false, message: 'pgId and userId are required' });
    }

    const currentUserId = req.user._id.toString();
    const otherUserId = userId.toString();

    const [first, second] = [currentUserId, otherUserId].sort();
    const conversationKey = `${pgId}::${first}::${second}`;

    const messages = await Message.find({ conversationKey })
      .populate('sender', 'name role')
      .populate('receiver', 'name role')
      .sort({ createdAt: 1 });

    await Message.updateMany(
      {
        conversationKey,
        receiver: req.user._id,
        readBy: { $ne: req.user._id },
      },
      {
        $addToSet: { readBy: req.user._id },
      }
    );

    res.status(200).json({ success: true, messages });
  } catch (err) {
    next(err);
  }
};

const sendMessage = async (req, res, next) => {
  try {
    const { pgId, receiverId, content } = req.body;
    if (!pgId || !receiverId || !content?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: 'pgId, receiverId and content are required' });
    }

    if (receiverId.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot message yourself' });
    }

    const [pg, receiver] = await Promise.all([
      PGProperty.findById(pgId).select('owner isActive'),
      User.findById(receiverId).select('role name email'),
    ]);

    if (!pg || !pg.isActive) {
      return res.status(404).json({ success: false, message: 'PG not found or inactive' });
    }
    if (!receiver) {
      return res.status(404).json({ success: false, message: 'Receiver not found' });
    }

    const senderId = req.user._id.toString();
    const ownerId = pg.owner.toString();
    const receiverStr = receiverId.toString();

    if (req.user.role === 'resident') {
      if (receiverStr !== ownerId) {
        return res.status(403).json({ success: false, message: 'Residents can only message PG owner' });
      }
    } else if (req.user.role === 'owner') {
      if (senderId !== ownerId || receiver.role !== 'resident') {
        return res.status(403).json({ success: false, message: 'Owners can only message residents for their PG' });
      }

      const [hasBooking, hasPriorMessage] = await Promise.all([
        Booking.exists({ pg: pgId, user: receiverId }),
        Message.exists({ pg: pgId, sender: receiverId, receiver: req.user._id }),
      ]);
      if (!hasBooking && !hasPriorMessage) {
        return res
          .status(403)
          .json({ success: false, message: 'Owner can message only residents with booking or prior chat' });
      }
    } else {
      return res.status(403).json({ success: false, message: 'Chat is available only for resident and owner roles' });
    }

    const message = await Message.create({
      pg: pgId,
      sender: req.user._id,
      receiver: receiverId,
      content: content.trim(),
      readBy: [req.user._id],
    });

    const populated = await Message.findById(message._id)
      .populate('sender', 'name role')
      .populate('receiver', 'name role')
      .populate('pg', 'pgName');

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${req.user._id.toString()}`).emit('chat:new_message', populated);
      io.to(`user:${receiverId.toString()}`).emit('chat:new_message', populated);
    }

    res.status(201).json({ success: true, message: populated });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listConversations,
  getMessages,
  sendMessage,
};
