import mongoose from 'mongoose';

const verificationCodeSchema = new mongoose.Schema({
  pollId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Poll'
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    length: 6
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 } 
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

verificationCodeSchema.index({ pollId: 1, email: 1 });

const VerificationCode = mongoose.model('VerificationCode', verificationCodeSchema);

export default VerificationCode;