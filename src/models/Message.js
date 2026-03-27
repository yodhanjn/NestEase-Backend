const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    pg: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PGProperty',
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
      maxlength: 2000,
    },
    conversationKey: {
      type: String,
      required: true,
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true }
);

messageSchema.pre('validate', function onValidate() {
  if (!this.pg || !this.sender || !this.receiver) return;

  const a = this.sender.toString();
  const b = this.receiver.toString();
  const [first, second] = [a, b].sort();
  this.conversationKey = `${this.pg.toString()}::${first}::${second}`;
});

messageSchema.index({ conversationKey: 1, createdAt: -1 });
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
