import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

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
    <div className="bg-gray-100 mx-20 flex items-center justify-center py-12 px-4 rounded-3xl">
      <div className="w-full ">
        
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Create a Poll</h1>
          <p className="text-gray-600 text-lg">
            Create a new poll and share it with others to collect responses
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            
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
                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
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

              <div className="space-y-3">
                {options.map((option, index) => (
                  <div key={index} className="flex gap-3">
                    <div className="shrink-0 w-10 h-11 flex items-center justify-center bg-gray-100 border border-gray-300 rounded text-sm font-medium text-gray-700">
                      {index + 1}
                    </div>
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                      maxLength={100}
                      disabled={loading}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                      />
                    {options.length > 2 && (
                      <button
                      type="button"
                      onClick={() => handleRemoveOption(index)}
                      disabled={loading}
                      className="shrink-0 px-4 py-2 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Remove
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
                className="mt-3 w-full px-4 py-2 text-sm text-blue-600 bg-white border border-blue-300 rounded-md hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + Add Option
                </button>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                {loading ? 'Creating Poll...' : 'Create Poll'}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
          <p className="text-sm text-blue-900">
            <strong>Note:</strong> Once created, you'll receive a unique link to share your poll. 
            Responses are collected in real-time and duplicate voting is prevented.
          </p>
        </div>
      </div> 
    </div>
  );
}

export default CreatePoll;