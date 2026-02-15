import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL;
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;

function PollView() {
  const { pollId } = useParams();
  const navigate = useNavigate();
  
  const [poll, setPoll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [error, setError] = useState('');
  const [socket, setSocket] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchPoll = async () => {
      try {
        const response = await axios.get(`${API_URL}/polls/${pollId}`);
        setPoll(response.data);

        const voteCheckResponse = await axios.get(`${API_URL}/polls/${pollId}/check-vote`);
        setHasVoted(voteCheckResponse.data.hasVoted);
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
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      newSocket.emit('joinPoll', pollId);
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

  const handleVote = async (optionId) => {
    if (hasVoted || voting) return;

    setVoting(true);
    setError('');

    try {
      await axios.post(`${API_URL}/polls/${pollId}/vote`, {
        optionId
      });

      setHasVoted(true);
    } catch (err) {
      console.error('Error voting:', err);
      
      if (err.response?.data?.alreadyVoted) {
        setError('You have already voted in this poll');
        setHasVoted(true);
      } else if (err.response?.data?.rateLimited) {
        setError('Rate limit exceeded. Please try again later.');
      } else {
        setError(err.response?.data?.error || 'Failed to record vote. Please try again.');
      }
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

  const calculatePercentage = (votes) => {
    if (!poll || poll.totalVotes === 0) return 0;
    return Math.round((votes / poll.totalVotes) * 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
          <p className="text-gray-600 font-medium">Loading poll...</p>
        </div>
      </div>
    );
  }

  if (error && !poll) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700"
            >
              Create New Poll
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        
        <div className="mb-6">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-gray-600 hover:text-gray-900 mb-4 inline-flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Home
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-4">
          
          <div className="mb-6 pb-6 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              {poll.question}
            </h1>
            <div className="flex items-center text-sm text-gray-600">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="font-medium">{poll.totalVotes} votes</span>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {hasVoted && (
            <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-green-800 font-medium">
                  Your vote has been recorded. Results update in real-time.
                </span>
              </div>
            </div>
          )}

          <div className="space-y-3 mb-6">
            {poll.options.map((option) => {
              const percentage = calculatePercentage(option.votes);
              
              return (
                <button
                  key={option._id}
                  onClick={() => handleVote(option._id)}
                  disabled={hasVoted || voting}
                  className={`
                    relative w-full p-4 rounded-md border text-left transition-all
                    ${hasVoted 
                      ? 'border-gray-300 bg-gray-50 cursor-default' 
                      : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50 cursor-pointer'
                    }
                    ${voting ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  {hasVoted && (
                    <div 
                      className="absolute inset-0 bg-blue-100 rounded-md transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  )}

                  <div className="relative flex items-center justify-between">
                    <span className="font-medium text-gray-900">
                      {option.text}
                    </span>
                    
                    {hasVoted && (
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-bold text-blue-600">
                          {percentage}%
                        </span>
                        <span className="text-sm text-gray-500">
                          ({option.votes})
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-200">
            <button
              onClick={copyShareLink}
              className="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 flex items-center justify-center"
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy Link
                </>
              )}
            </button>
            
            <button
              onClick={() => navigate('/')}
              className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700"
            >
              Create New Poll
            </button>
          </div>
        </div>

        <div className="text-center text-sm">
          {socket?.connected ? (
            <span></span>
          ) : (
            <span className="inline-flex items-center text-gray-500">
              <span className="w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
              Connecting...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default PollView;