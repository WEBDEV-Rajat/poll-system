import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

function CreatePoll() {
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAddOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!question.trim()) {
      setError('Please enter a question');
      return;
    }

    const validOptions = options.filter(opt => opt.trim());
    if (validOptions.length < 2) {
      setError('Please provide at least 2 options');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/polls`, {
        question: question.trim(),
        options: validOptions
      });

      navigate(`/poll/${response.data.pollId}`);
    } catch (err) {
      console.error('Error creating poll:', err);
      setError(err.response?.data?.error || 'Failed to create poll. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6 sm:py-8 md:py-12 px-4">
      <div className="max-w-3xl mx-auto">
        
        <div className="mb-6 sm:mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-2 sm:mb-3">
            Create a Poll
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-gray-600 px-4">
            Create a new poll and share it with others to collect responses
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
            
            <div className='text-left'>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Question
              </label>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Enter your question"
                maxLength={200}
                disabled={loading}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <div className="mt-1 text-right">
                <span className="text-xs text-gray-500">{question.length}/200</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-bold text-gray-700">
                  Options
                </label>
                <span className="text-xs text-gray-500">{options.length}/10 options</span>
              </div>

              <div className="space-y-2.5 sm:space-y-3">
                {options.map((option, index) => (
                  <div key={index} className="flex gap-2 sm:gap-3">
                    <div className="shrink-0 w-9 sm:w-10 h-10 sm:h-11 flex items-center justify-center bg-gray-100 border border-gray-300 rounded text-xs sm:text-sm font-medium text-gray-700">
                      {index + 1}
                    </div>
                    
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                      maxLength={100}
                      disabled={loading}
                      className="flex-1 px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                    />
                    
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(index)}
                        disabled={loading}
                        className="shrink-0 px-2.5 sm:px-4 py-2 text-xs sm:text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        <span className="hidden sm:inline">Remove</span>
                        <span className="sm:hidden">✕</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {options.length < 10 && (
                <button
                  type="button"
                  onClick={handleAddOption}
                  disabled={loading}
                  className="mt-3 w-full px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-blue-600 bg-white border border-blue-300 rounded-md hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + Add Option
                </button>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-xs sm:text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="pt-2 sm:pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 sm:py-3.5 text-sm sm:text-base bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Creating Poll...' : 'Create Poll'}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
          <p className="text-xs sm:text-sm text-blue-900">
            <strong>Note:</strong> Once created, you'll receive a unique link to share your poll. 
            Responses are collected in real-time and duplicate voting is prevented.
          </p>
        </div>
      </div> 
    </div>
  );
}

export default CreatePoll;