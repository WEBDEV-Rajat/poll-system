import mongoose from 'mongoose';

const voteSchema = new mongoose.Schema({
  optionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },

  ipAddress: {
    type: String,
    required: true,
    index: true
  },

  fingerprint: {
    type: String,
    required: true,
    index: true
  },

  email: {
    type: String,
    lowercase: true,
    trim: true,
    index: true
  },

  verified: {
    type: Boolean,
    default: false
  },

  votedAt: {
    type: Date,
    default: Date.now
  }
});
voteSchema.index({ email: 1, optionId: 1 });

export default voteSchema;
