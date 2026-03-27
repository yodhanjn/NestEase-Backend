const initChatSocket = (io) => {
  io.on('connection', (socket) => {
    const userId = socket.handshake.query?.userId;
    if (userId) {
      socket.join(`user:${userId}`);
    }

    socket.on('join_user_room', (payload) => {
      if (payload?.userId) {
        socket.join(`user:${payload.userId}`);
      }
    });

    socket.on('disconnect', () => {
      // no-op
    });
  });
};

module.exports = { initChatSocket };
