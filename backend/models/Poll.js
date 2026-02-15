import mongoose from 'mongoose';

const voteSchema = new mongoose.Schema({
  optionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  ipAddress: String,
  fingerprint: String,
  votedAt: {
    type: Date,
    default: Date.now
  }
});

const optionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true
  },
  votes: {
    type: Number,
    default: 0
  }
});

const pollSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    trim: true
  },
  options: [optionSchema],
  votes: [voteSchema],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

pollSchema.methods.hasUserVoted = function(ipAddress, fingerprint) {
  return this.votes.some(vote => 
    vote.ipAddress === ipAddress && vote.fingerprint === fingerprint
  );
};

pollSchema.methods.canUserVote = function(ipAddress) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentVotes = this.votes.filter(vote => 
    vote.ipAddress === ipAddress && vote.votedAt > oneDayAgo
  );
  return recentVotes.length === 0;
};

const Poll = mongoose.model('Poll', pollSchema);

export default Poll;