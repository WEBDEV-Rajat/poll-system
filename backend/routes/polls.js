import express from 'express';
import Poll from '../models/Poll.js';
import { extractFingerprint, getClientIP } from '../middleware/fingerprint.js';

const router = express.Router();

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

    res.json({
      _id: poll._id,
      question: poll.question,
      options: poll.options.map(opt => ({
        _id: opt._id,
        text: opt.text,
        votes: opt.votes
      })),
      totalVotes: poll.options.reduce((sum, opt) => sum + opt.votes, 0),
      createdAt: poll.createdAt
    });
  } catch (error) {
    console.error('Error fetching poll:', error);
    res.status(500).json({ error: 'Failed to fetch poll' });
  }
});

router.post('/polls/:id/vote', extractFingerprint, async (req, res) => {
  try {
    const { optionId } = req.body;
    const ipAddress = getClientIP(req);
    const fingerprint = req.fingerprint;

    if (!optionId) {
      return res.status(400).json({ error: 'Option ID is required' });
    }

    const poll = await Poll.findById(req.params.id);

    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    if (poll.hasUserVoted(ipAddress, fingerprint)) {
      return res.status(403).json({ 
        error: 'You have already voted in this poll',
        alreadyVoted: true
      });
    }

    if (!poll.canUserVote(ipAddress)) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded. Please try again later.',
        rateLimited: true
      });
    }

    const option = poll.options.id(optionId);
    
    if (!option) {
      return res.status(400).json({ error: 'Invalid option ID' });
    }

    option.votes += 1;
    poll.votes.push({
      optionId: option._id,
      ipAddress,
      fingerprint,
      votedAt: new Date()
    });

    await poll.save();

    req.io.to(req.params.id).emit('voteUpdate', {
      optionId: option._id,
      votes: option.votes,
      totalVotes: poll.options.reduce((sum, opt) => sum + opt.votes, 0)
    });

    res.json({ 
      success: true,
      option: {
        _id: option._id,
        text: option.text,
        votes: option.votes
      }
    });
  } catch (error) {
    console.error('Error voting:', error);
    res.status(500).json({ error: 'Failed to record vote' });
  }
});

router.get('/polls/:id/check-vote', extractFingerprint, async (req, res) => {
  try {
    const ipAddress = getClientIP(req);
    const fingerprint = req.fingerprint;

    const poll = await Poll.findById(req.params.id);

    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    const hasVoted = poll.hasUserVoted(ipAddress, fingerprint);

    res.json({ hasVoted });
  } catch (error) {
    console.error('Error checking vote:', error);
    res.status(500).json({ error: 'Failed to check vote status' });
  }
});

export default router;