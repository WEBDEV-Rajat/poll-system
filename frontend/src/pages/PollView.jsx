import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import QRCode from 'qrcode';
import { sendVerificationEmail } from '../utils/emailService.js';

const API_URL = import.meta.env.VITE_API_URL;
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;

function PollView() {
  const { pollId } = useParams();
  const navigate = useNavigate();
  
  const [poll, setPoll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [votedOptionId, setVotedOptionId] = useState(null);
  const [error, setError] = useState('');
  const [socket, setSocket] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [showChangeVote, setShowChangeVote] = useState(false);
  
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);

  useEffect(() => {
    const fetchPoll = async () => {
      try {
        const response = await axios.get(`${API_URL}/polls/${pollId}`);
        setPoll(response.data);

        const voteCheckResponse = await axios.get(`${API_URL}/polls/${pollId}/check-vote`);
        setHasVoted(voteCheckResponse.data.hasVoted);
        setVotedOptionId(voteCheckResponse.data.votedOptionId);
      } catch (err) {
        console.error('Error fetching poll:', err);
        if (err.response?.status === 404) {
          setError('Poll not found');
        } else {
          setError('Failed to load poll. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPoll();
  }, [pollId]);

  useEffect(() => {
    const generateQR = async () => {
      try {
        const pollUrl = window.location.href;
        const qrDataUrl = await QRCode.toDataURL(pollUrl, {
          width: 300,
          margin: 2,
          color: {
            dark: '#2563eb',
            light: '#ffffff'
          }
        });
        setQrCodeUrl(qrDataUrl);
      } catch (err) {
        console.error('Error generating QR code:', err);
      }
    };

    if (pollId) {
      generateQR();
    }
  }, [pollId]);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      setSocketConnected(true);
      newSocket.emit('joinPoll', pollId);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setSocketConnected(false);
    });

    newSocket.on('voteUpdate', (data) => {
      console.log('Vote update received:', data);
      setPoll(prevPoll => {
        if (!prevPoll) return prevPoll;

        const updatedOptions = prevPoll.options.map(opt =>
          opt._id === data.optionId
            ? { ...opt, votes: data.votes }
            : opt
        );

        return {
          ...prevPoll,
          options: updatedOptions,
          totalVotes: data.totalVotes
        };
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.emit('leavePoll', pollId);
      newSocket.close();
    };
  }, [pollId]);

  const handleRequestCode = async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setSendingCode(true);
    setError('');

    try {
      const response = await axios.post(`${API_URL}/polls/${pollId}/request-verification`, {
        email
      });

      const { code } = response.data;

      await sendVerificationEmail(email, code);

      setCodeSent(true);
      setError('');
    } catch (err) {
      console.error('Error requesting code:', err);

      if (err.response?.data?.alreadyVoted) {
        setHasVoted(true);
        setError(err.response.data.error);
      } else if (err.message?.includes('EmailJS')) {
        setError('Email service not configured. Please contact the poll creator.');
      } else {
        setError(err.response?.data?.error || 'Failed to send verification code. Please try again.');
      }
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifiedVote = async (optionId) => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter the 6-digit verification code');
      return;
    }

    setVoting(true);
    setError('');

    try {
      await axios.post(`${API_URL}/polls/${pollId}/vote-verified`, {
        optionId,
        email,
        code: verificationCode
      });

      setHasVoted(true);
      setVotedOptionId(optionId);
      setCodeSent(false);
      setVerificationCode('');
    } catch (err) {
      console.error('Error voting:', err);
      setError(err.response?.data?.error || 'Failed to record vote');
      
      if (err.response?.data?.alreadyVoted) {
        setHasVoted(true);
      }
    } finally {
      setVoting(false);
    }
  };

  const handleChangeVote = async (newOptionId) => {
    if (voting) return;

    setVoting(true);
    setError('');

    try {
      await axios.put(`${API_URL}/polls/${pollId}/vote`, {
        newOptionId,
        email: email || undefined
      });

      setVotedOptionId(newOptionId);
      setShowChangeVote(false);
      setError('');
    } catch (err) {
      console.error('Error changing vote:', err);
      setError(err.response?.data?.error || 'Failed to change vote');
    } finally {
      setVoting(false);
    }
  };

  const handleRemoveVote = async () => {
    if (voting) return;
    if (!window.confirm('Are you sure you want to remove your vote?')) return;

    setVoting(true);
    setError('');

    try {
      await axios.delete(`${API_URL}/polls/${pollId}/vote`, {
        data: { email: email || undefined }
      });

      setHasVoted(false);
      setVotedOptionId(null);
      setShowChangeVote(false);
      setEmail('');
      setCodeSent(false);
      setVerificationCode('');
    } catch (err) {
      console.error('Error removing vote:', err);
      setError(err.response?.data?.error || 'Failed to remove vote');
    } finally {
      setVoting(false);
    }
  };

  const copyShareLink = () => {
    const shareUrl = window.location.href;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadQRCode = () => {
    const link = document.createElement('a');
    link.download = `poll-${pollId}-qr.png`;
    link.href = qrCodeUrl;
    link.click();
  };

  const calculatePercentage = (votes) => {
    if (!poll || poll.totalVotes === 0) return 0;
    return Math.round((votes / poll.totalVotes) * 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-4 border-blue-600 border-t-transparent mb-3 sm:mb-4"></div>
          <p className="text-sm sm:text-base text-gray-600 font-medium">Loading poll...</p>
        </div>
      </div>
    );
  }

  if (error && !poll) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sm:p-8 text-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <svg className="w-7 h-7 sm:w-8 sm:h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Error</h2>
            <p className="text-sm sm:text-base text-gray-600 mb-5 sm:mb-6">{error}</p>
            <button
              onClick={() => navigate('/')}
              className="w-full sm:w-auto px-5 sm:px-6 py-2 sm:py-2.5 bg-blue-600 text-white text-sm sm:text-base font-medium rounded-md hover:bg-blue-700"
            >
              Create New Poll
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 sm:py-8 px-4">
      <div className="max-w-3xl mx-auto">
        
        <div className="mb-4 sm:mb-6">
          <button
            onClick={() => navigate('/')}
            className="text-xs sm:text-sm text-gray-600 hover:text-gray-900 mb-4 inline-flex items-center"
          >
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Home
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 md:p-8 mb-4">
          
          <div className="mb-5 sm:mb-6 pb-5 sm:pb-6 border-b border-gray-200">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-2 sm:mb-3 break-words">
              {poll.question}
            </h1>
            <div className="flex items-center text-xs sm:text-sm text-gray-600">
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="font-medium">{poll.totalVotes} votes</span>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-2.5 sm:p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-xs sm:text-sm text-red-800">{error}</p>
            </div>
          )}

          {!hasVoted && !codeSent && (
            <div className="mb-5 sm:mb-6 p-4 sm:p-5 bg-blue-50 border-2 border-blue-200 rounded-lg">
              <div className="flex items-start gap-3 mb-4">
                <svg className="w-6 h-6 text-blue-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-sm sm:text-base font-bold text-gray-900 mb-1">
                    Verify your email to vote
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-700">
                    Enter your email address to receive a verification code. This ensures one vote per person.
                  </p>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="flex-1 px-3 sm:px-4 py-2.5 text-sm sm:text-base border-2 border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={sendingCode}
                />
                <button
                  onClick={handleRequestCode}
                  disabled={sendingCode || !email}
                  className="px-4 sm:px-6 py-2.5 bg-blue-600 text-white text-sm sm:text-base font-semibold rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {sendingCode ? 'Sending...' : 'Send Code'}
                </button>
              </div>
            </div>
          )}

          {!hasVoted && codeSent && (
            <div className="mb-5 sm:mb-6 p-4 sm:p-5 bg-green-50 border-2 border-green-200 rounded-lg">
              <div className="flex items-start gap-3 mb-4">
                <svg className="w-6 h-6 text-green-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm sm:text-base font-bold text-green-900 mb-1">
                    Verification code sent!
                  </p>
                  <p className="text-xs sm:text-sm text-green-800">
                    Check your email at <strong>{email}</strong> and enter the 6-digit code below.
                  </p>
                </div>
              </div>
              
              <div className="mb-3">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                  Enter Verification Code
                </label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full px-3 sm:px-4 py-3 text-center text-xl sm:text-2xl font-mono font-bold border-2 border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 tracking-widest"
                />
              </div>
              
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-gray-600">
                  Code expires in 10 minutes
                </p>
                <button
                  onClick={() => {
                    setCodeSent(false);
                    setVerificationCode('');
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Use different email
                </button>
              </div>
              
              <div className="mt-4 p-3 bg-white border border-green-200 rounded-md">
                <p className="text-xs sm:text-sm text-gray-700 font-medium">
                  ✓ Now click on an option below to cast your vote
                </p>
              </div>
            </div>
          )}

          {hasVoted && !showChangeVote && (
            <div className="mb-5 sm:mb-6 p-2.5 sm:p-3 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs sm:text-sm text-green-800 font-medium">
                    Your vote has been recorded.
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowChangeVote(true)}
                    className="text-xs sm:text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Change
                  </button>
                  <button
                    onClick={handleRemoveVote}
                    disabled={voting}
                    className="text-xs sm:text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          )}

          {showChangeVote && (
            <div className="mb-5 sm:mb-6 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-blue-900">
                  Select a new option:
                </span>
                <button
                  onClick={() => setShowChangeVote(false)}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2.5 sm:space-y-3 mb-5 sm:mb-6">
            {poll.options.map((option) => {
              const percentage = calculatePercentage(option.votes);
              const isCurrentVote = votedOptionId === option._id;
              const canClick = (codeSent && verificationCode.length === 6) || showChangeVote;
              
              return (
                <button
                  key={option._id}
                  onClick={() => {
                    if (showChangeVote) {
                      handleChangeVote(option._id);
                    } else if (canClick) {
                      handleVerifiedVote(option._id);
                    }
                  }}
                  disabled={(hasVoted && !showChangeVote) || voting || !canClick}
                  className={`
                    relative w-full p-3 sm:p-4 rounded-md border text-left transition-all
                    ${hasVoted && !showChangeVote
                      ? 'border-gray-300 bg-gray-50 cursor-default' 
                      : canClick
                        ? 'border-blue-300 bg-blue-50 hover:border-blue-500 hover:bg-blue-100 cursor-pointer active:scale-[0.98]'
                        : 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                    }
                    ${voting ? 'opacity-50 cursor-not-allowed' : ''}
                    ${isCurrentVote && hasVoted ? 'ring-2 ring-green-500' : ''}
                  `}
                >
                  {hasVoted && !showChangeVote && (
                    <div 
                      className="absolute inset-0 bg-blue-100 rounded-md transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  )}

                  <div className="relative flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      {isCurrentVote && hasVoted && (
                        <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      <span className="text-sm sm:text-base font-medium text-gray-900 break-words">
                        {option.text}
                      </span>
                    </div>
                    
                    {hasVoted && !showChangeVote && (
                      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        <span className="text-lg sm:text-xl font-bold text-blue-600">
                          {percentage}%
                        </span>
                        <span className="text-xs sm:text-sm text-gray-500">
                          ({option.votes})
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 pt-5 sm:pt-6 border-t border-gray-200">
            <button
              onClick={copyShareLink}
              className="flex-1 px-4 py-2.5 sm:py-2 bg-white border border-gray-300 text-gray-700 text-sm sm:text-base font-medium rounded-md hover:bg-gray-50 flex items-center justify-center"
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span className="hidden sm:inline">Copy Link</span>
                  <span className="sm:hidden">Copy</span>
                </>
              )}
            </button>

            <button
              onClick={() => setShowQR(!showQR)}
              className="flex-1 px-4 py-2.5 sm:py-2 bg-white border border-gray-300 text-gray-700 text-sm sm:text-base font-medium rounded-md hover:bg-gray-50 flex items-center justify-center"
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              {showQR ? 'Hide' : 'Show'} QR
            </button>
            
            <button
              onClick={() => navigate('/')}
              className="flex-1 px-4 py-2.5 sm:py-2 bg-blue-600 text-white text-sm sm:text-base font-medium rounded-md hover:bg-blue-700"
            >
              New Poll
            </button>
          </div>
        </div>

        {showQR && qrCodeUrl && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-4 text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Scan to Vote</h3>
            <div className="inline-block p-4 bg-white border-2 border-gray-200 rounded-lg">
              <img src={qrCodeUrl} alt="Poll QR Code" className="w-64 h-64 mx-auto" />
            </div>
            <button
              onClick={downloadQRCode}
              className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 inline-flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download QR Code
            </button>
          </div>
        )}

        <div className="text-center text-xs sm:text-sm">
          {socketConnected ? (
            <span className="text-green-600 font-medium">● Connected</span>
          ) : (
            <span className="inline-flex items-center text-gray-500">
              <span className="w-2 h-2 bg-gray-400 rounded-full mr-2 animate-pulse"></span>
              Connecting...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default PollView;