import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CreatePoll from './pages/CreatePoll.jsx';
import PollView from './pages/PollView.jsx';
import NotFound from './pages/NotFound.jsx';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<CreatePoll />} />
          <Route path="/poll/:pollId" element={<PollView />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;