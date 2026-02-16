import mongoose from 'mongoose';
import voteSchema from './Vote.js';
import optionSchema from './Option.js';

const pollSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    trim: true,
    maxLength: 200
  },
  options: {
    type: [optionSchema],
    validate: {
      validator: function(options) {
        return options.length >= 2 && options.length <= 10;
      },
      message: 'Poll must have between 2 and 10 options'
    }
  },
  votes: [voteSchema],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

pollSchema.index({ createdAt: -1 });
pollSchema.index({ 'votes.email': 1 });
pollSchema.index({ 'votes.ipAddress': 1, 'votes.fingerprint': 1 });

const Poll = mongoose.model('Poll', pollSchema);

export default Poll;