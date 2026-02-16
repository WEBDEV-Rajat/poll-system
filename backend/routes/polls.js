  import express from 'express';
  import mongoose from 'mongoose';
  import Poll from '../models/Poll.js';
  import VerificationCode from '../models/Verififcation.js';
  import { extractFingerprint, getClientIP } from '../middleware/fingerprint.js';
  import { sendEmail } from '../utils/emailService.js'
  import {generateVerificationEmail} from '../mails/emailverification.js';

  const router = express.Router();

  const votingAttempts = new Map();

  const RATE_LIMIT = {
    windowMs: 60 * 1000,
    maxAttempts: 3,
    blockDuration: 15 * 60 * 1000
  };

  setInterval(() => {
    const now = Date.now();
    for (const [key, data] of votingAttempts.entries()) {
      if (now - data.firstAttempt > RATE_LIMIT.blockDuration) {
        votingAttempts.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  const checkRateLimit = (req, res, next) => {
    const ipAddress = getClientIP(req);
    const fingerprint = req.fingerprint;
    const key = `${ipAddress}-${fingerprint}`;
    const now = Date.now();

    const attempts = votingAttempts.get(key);

    if (!attempts) {
      votingAttempts.set(key, {
        count: 1,
        firstAttempt: now,
        blocked: false
      });
      return next();
    }

    if (attempts.blocked && (now - attempts.firstAttempt < RATE_LIMIT.blockDuration)) {
      const remainingTime = Math.ceil((RATE_LIMIT.blockDuration - (now - attempts.firstAttempt)) / 60000);
      return res.status(429).json({
        error: `Too many attempts. Please try again in ${remainingTime} minutes.`,
        rateLimited: true,
        retryAfter: remainingTime
      });
    }

    if (now - attempts.firstAttempt > RATE_LIMIT.windowMs) {
      votingAttempts.set(key, {
        count: 1,
        firstAttempt: now,
        blocked: false
      });
      return next();
    }

    attempts.count++;

    if (attempts.count > RATE_LIMIT.maxAttempts) {
      attempts.blocked = true;
      attempts.firstAttempt = now;
      return res.status(429).json({
        error: 'Too many attempts. Please try again later.',
        rateLimited: true,
        retryAfter: Math.ceil(RATE_LIMIT.blockDuration / 60000)
      });
    }

    next();
  };

  router.post('/polls', async (req, res) => {
    try {
      const { question, options } = req.body;

      if (!question || !options || options.length < 2) {
        return res.status(400).json({ 
          error: 'Question and at least 2 options are required' 
        });
      }

      if (options.some(opt => !opt.trim())) {
        return res.status(400).json({ 
          error: 'All options must be non-empty' 
        });
      }

      const poll = new Poll({
        question: question.trim(),
        options: options.map(opt => ({ text: opt.trim(), votes: 0 }))
      });

      await poll.save();

      res.status(201).json({
        pollId: poll._id,
        shareUrl: `/poll/${poll._id}`
      });
    } catch (error) {
      console.error('Error creating poll:', error);
      res.status(500).json({ error: 'Failed to create poll' });
    }
  });

  router.get('/polls/:id', async (req, res) => {
    try {
      const poll = await Poll.findById(req.params.id);

      if (!poll) {
        return res.status(404).json({ error: 'Poll not found' });
      }

      const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);

      res.json({
        _id: poll._id,
        question: poll.question,
        options: poll.options.map(opt => ({
          _id: opt._id,
          text: opt.text,
          votes: opt.votes
        })),
        totalVotes,
        createdAt: poll.createdAt
      });
    } catch (error) {
      console.error('Error fetching poll:', error);
      res.status(500).json({ error: 'Failed to fetch poll' });
    }
  });

  router.post('/polls/:id/request-verification', checkRateLimit, async (req, res) => {
    try {
      const { email } = req.body;

      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email is required' });
      }

      const poll = await Poll.findById(req.params.id);
      if (!poll) {
        return res.status(404).json({ error: 'Poll not found' });
      }

      const existingVote = poll.votes.find(vote => 
        vote.email && vote.email.toLowerCase() === email.toLowerCase()
      );

      if (existingVote) {
        return res.status(403).json({ 
          error: 'This email has already voted in this poll',
          alreadyVoted: true
        });
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();

      await VerificationCode.deleteMany({ 
        pollId: req.params.id, 
        email: email.toLowerCase() 
      });

      await VerificationCode.create({
        pollId: req.params.id,
        email: email.toLowerCase(),
        code,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      });

      await sendEmail({
      email: email.toLowerCase(),
      subject: "Email Verification",
      htmlContent: generateVerificationEmail(code),
    });
    return res.json({
    success: true,
    message: "Verification code sent"
  });
  }
  catch(err){
      res.status(500).json({ error: 'Failed to send verification code' });
  }
  });

  router.post('/polls/:id/vote-verified', extractFingerprint, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { optionId, email, code } = req.body;
      const ipAddress = getClientIP(req);
      const fingerprint = req.fingerprint;

      if (!optionId || !email || !code) {
        await session.abortTransaction();
        return res.status(400).json({ 
          error: 'Option ID, email, and verification code are required' 
        });
      }

      const verification = await VerificationCode.findOne({
        pollId: req.params.id,
        email: email.toLowerCase(),
        code: code.trim(),
        expiresAt: { $gt: new Date() }
      });

      if (!verification) {
        await session.abortTransaction();
        return res.status(400).json({ 
          error: 'Invalid or expired verification code',
          codeInvalid: true
        });
      }

      const poll = await Poll.findById(req.params.id).session(session);

      if (!poll) {
        await session.abortTransaction();
        return res.status(404).json({ error: 'Poll not found' });
      }

      const emailVote = poll.votes.find(vote => 
        vote.email && vote.email.toLowerCase() === email.toLowerCase()
      );

      if (emailVote) {
        await session.abortTransaction();
        return res.status(403).json({ 
          error: 'This email has already voted in this poll',
          alreadyVoted: true
        });
      }

      const fingerprintVote = poll.votes.find(vote => 
        vote.ipAddress === ipAddress && vote.fingerprint === fingerprint
      );

      if (fingerprintVote) {
        await session.abortTransaction();
        return res.status(403).json({ 
          error: 'You have already voted in this poll from this device',
          alreadyVoted: true
        });
      }

      const option = poll.options.id(optionId);
      
      if (!option) {
        await session.abortTransaction();
        return res.status(400).json({ error: 'Invalid option ID' });
      }

      option.votes += 1;
      poll.votes.push({
        optionId: option._id,
        email: email.toLowerCase(),
        verified: true,
        ipAddress,
        fingerprint,
        votedAt: new Date()
      });

      await poll.save({ session });
      
      await VerificationCode.deleteOne({ _id: verification._id }, { session });
      
      await session.commitTransaction();

      const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);

      req.io.to(req.params.id).emit('voteUpdate', {
        optionId: option._id,
        votes: option.votes,
        totalVotes
      });

      res.json({ 
        success: true,
        verified: true,
        option: {
          _id: option._id,
          text: option.text,
          votes: option.votes
        }
      });
    } catch (error) {
      await session.abortTransaction();
      console.error('Error voting with verification:', error);
      res.status(500).json({ error: 'Failed to record vote' });
    } finally {
      session.endSession();
    }
  });

  router.post('/polls/:id/vote', extractFingerprint, checkRateLimit, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { optionId } = req.body;
      const ipAddress = getClientIP(req);
      const fingerprint = req.fingerprint;

      if (!optionId) {
        await session.abortTransaction();
        return res.status(400).json({ error: 'Option ID is required' });
      }

      const poll = await Poll.findById(req.params.id).session(session);

      if (!poll) {
        await session.abortTransaction();
        return res.status(404).json({ error: 'Poll not found' });
      }

      const existingVote = poll.votes.find(vote => 
        vote.ipAddress === ipAddress && vote.fingerprint === fingerprint
      );

      if (existingVote) {
        await session.abortTransaction();
        return res.status(403).json({ 
          error: 'You have already voted in this poll.',
          alreadyVoted: true
        });
      }

      const option = poll.options.id(optionId);
      
      if (!option) {
        await session.abortTransaction();
        return res.status(400).json({ error: 'Invalid option ID' });
      }

      option.votes += 1;
      poll.votes.push({
        optionId: option._id,
        ipAddress,
        fingerprint,
        verified: false,
        votedAt: new Date()
      });

      await poll.save({ session });
      await session.commitTransaction();

      const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);

      req.io.to(req.params.id).emit('voteUpdate', {
        optionId: option._id,
        votes: option.votes,
        totalVotes
      });

      res.json({ 
        success: true,
        verified: false,
        option: {
          _id: option._id,
          text: option.text,
          votes: option.votes
        }
      });
    } catch (error) {
      await session.abortTransaction();
      console.error('Error voting:', error);
      res.status(500).json({ error: 'Failed to record vote' });
    } finally {
      session.endSession();
    }
  });

  router.put('/polls/:id/vote', extractFingerprint, checkRateLimit, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { newOptionId, email } = req.body;
      const ipAddress = getClientIP(req);
      const fingerprint = req.fingerprint;

      if (!newOptionId) {
        await session.abortTransaction();
        return res.status(400).json({ error: 'New option ID is required' });
      }

      const poll = await Poll.findById(req.params.id).session(session);

      if (!poll) {
        await session.abortTransaction();
        return res.status(404).json({ error: 'Poll not found' });
      }

      let existingVote;
      if (email) {
        existingVote = poll.votes.find(vote => 
          vote.email && vote.email.toLowerCase() === email.toLowerCase()
        );
      } else {
        existingVote = poll.votes.find(vote => 
          vote.ipAddress === ipAddress && vote.fingerprint === fingerprint
        );
      }

      if (!existingVote) {
        await session.abortTransaction();
        return res.status(404).json({ 
          error: 'No existing vote found',
          hasVoted: false
        });
      }

      if (existingVote.optionId.toString() === newOptionId) {
        await session.abortTransaction();
        return res.status(400).json({ 
          error: 'You have already voted for this option'
        });
      }

      const oldOption = poll.options.id(existingVote.optionId);
      const newOption = poll.options.id(newOptionId);

      if (!oldOption || !newOption) {
        await session.abortTransaction();
        return res.status(400).json({ error: 'Invalid option ID' });
      }

      oldOption.votes -= 1;
      newOption.votes += 1;

      existingVote.optionId = newOption._id;
      existingVote.votedAt = new Date();

      await poll.save({ session });
      await session.commitTransaction();

      const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);

      req.io.to(req.params.id).emit('voteUpdate', {
        optionId: oldOption._id,
        votes: oldOption.votes,
        totalVotes
      });

      req.io.to(req.params.id).emit('voteUpdate', {
        optionId: newOption._id,
        votes: newOption.votes,
        totalVotes
      });

      res.json({ 
        success: true,
        message: 'Vote updated successfully'
      });
    } catch (error) {
      await session.abortTransaction();
      console.error('Error changing vote:', error);
      res.status(500).json({ error: 'Failed to change vote' });
    } finally {
      session.endSession();
    }
  });

  router.delete('/polls/:id/vote', extractFingerprint, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { email } = req.body;
      const ipAddress = getClientIP(req);
      const fingerprint = req.fingerprint;

      const poll = await Poll.findById(req.params.id).session(session);

      if (!poll) {
        await session.abortTransaction();
        return res.status(404).json({ error: 'Poll not found' });
      }

      let voteIndex;
      if (email) {
        voteIndex = poll.votes.findIndex(vote => 
          vote.email && vote.email.toLowerCase() === email.toLowerCase()
        );
      } else {
        voteIndex = poll.votes.findIndex(vote => 
          vote.ipAddress === ipAddress && vote.fingerprint === fingerprint
        );
      }

      if (voteIndex === -1) {
        await session.abortTransaction();
        return res.status(404).json({ 
          error: 'No vote found to remove',
          hasVoted: false
        });
      }

      const existingVote = poll.votes[voteIndex];
      const option = poll.options.id(existingVote.optionId);
      
      if (!option) {
        await session.abortTransaction();
        return res.status(400).json({ error: 'Invalid option ID' });
      }

      option.votes -= 1;
      poll.votes.splice(voteIndex, 1);

      await poll.save({ session });
      await session.commitTransaction();

      const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);

      req.io.to(req.params.id).emit('voteUpdate', {
        optionId: option._id,
        votes: option.votes,
        totalVotes
      });

      res.json({ 
        success: true,
        message: 'Vote removed successfully'
      });
    } catch (error) {
      await session.abortTransaction();
      console.error('Error removing vote:', error);
      res.status(500).json({ error: 'Failed to remove vote' });
    } finally {
      session.endSession();
    }
  });

  router.get('/polls/:id/check-vote', extractFingerprint, async (req, res) => {
    try {
      const { email } = req.query;
      const ipAddress = getClientIP(req);
      const fingerprint = req.fingerprint;

      const poll = await Poll.findById(req.params.id);

      if (!poll) {
        return res.status(404).json({ error: 'Poll not found' });
      }

      let existingVote;
      
      if (email) {
        existingVote = poll.votes.find(vote => 
          vote.email && vote.email.toLowerCase() === email.toLowerCase()
        );
      }
      
      if (!existingVote) {
        existingVote = poll.votes.find(vote => 
          vote.ipAddress === ipAddress && vote.fingerprint === fingerprint
        );
      }

      if (existingVote) {
        res.json({ 
          hasVoted: true,
          votedOptionId: existingVote.optionId,
          verified: existingVote.verified || false
        });
      } else {
        res.json({ hasVoted: false });
      }
    } catch (error) {
      console.error('Error checking vote:', error);
      res.status(500).json({ error: 'Failed to check vote status' });
    }
  });

  export default router;