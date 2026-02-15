# Real-Time Poll Application

A modern web application for creating and sharing polls with real-time vote tracking. Built with React, Node.js, Express, MongoDB, and Socket.IO.

## Features

- **Create Polls** - Simple interface to create polls with custom questions and up to 10 options
- **Real-Time Updates** - Vote counts update instantly across all connected users via WebSocket
- **Share Links** - Each poll gets a unique shareable URL
- **Duplicate Prevention** - Anti-abuse mechanisms prevent duplicate voting
- **Persistent Storage** - All polls and votes stored in MongoDB
- **Responsive Design** - Works seamlessly on desktop, tablet, and mobile devices

## Tech Stack

### Frontend
- **React** - UI framework
- **Tailwind CSS** - Utility-first styling
- **Socket.IO Client** - Real-time communication
- **React Router** - Client-side routing
- **Axios** - HTTP requests
- **Vite** - Fast build tool

### Backend
- **Node.js** - Runtime environment
- **Express** - Web framework
- **MongoDB** - Database
- **Socket.IO** - Real-time bidirectional communication
- **Express Rate Limit** - API rate limiting

## Project Structure

```
poll-app/
├── backend/
│   ├── models/
│   │   └── Poll.js              # Poll schema and methods
│   ├── routes/
│   │   └── polls.js             # API endpoints
│   ├── middleware/
│   │   └── fingerprint.js       # Client fingerprinting
│   ├── server.js                # Main server file
│   ├── package.json
│   └── .env.example
│
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── CreatePoll.jsx   # Poll creation page
    │   │   ├── PollView.jsx     # Poll viewing/voting page
    │   │   └── NotFound.jsx     # 404 error page
    │   ├── App.jsx              # Main app component
    │   ├── App.css              # Custom styles
    │   ├── main.jsx             # Entry point
    │   └── index.css            # Tailwind imports
    ├── index.html
    ├── package.json
    ├── tailwind.config.js
    ├── postcss.config.js
    └── vite.config.js
```

## Getting Started

### Prerequisites

- **Node.js** (v18 or higher)
- **MongoDB** (local installation or MongoDB Atlas account)
- **npm** or **yarn**

### Installation

#### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd poll-app
```

#### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file:

```bash
cp .env.example .env
```

Configure your environment variables in `.env`:

```env
MONGODB_URI=mongodb://localhost:27017/poll-app
# Or use MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/poll-app

FRONTEND_URL=http://localhost:5173
PORT=3000
```

Start the backend server:

```bash
npm run dev
```

The server will run on `http://localhost:3000`

#### 3. Frontend Setup

Open a new terminal:

```bash
cd frontend
npm install
```

Create a `.env` file:

```bash
cp .env.example .env
```

Configure your environment variables in `.env`:

```env
VITE_API_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000
```

Start the development server:

```bash
npm run dev
```

The app will run on `http://localhost:5173`

### MongoDB Setup

MongoDB Atlas (Cloud)

1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster (M0 Free tier)
3. Create a database user
4. Whitelist your IP address (or use `0.0.0.0/0` for development)
5. Get your connection string and update `MONGODB_URI` in `backend/.env`

## Usage

### Creating a Poll

1. Navigate to `http://localhost:5173`
2. Enter your question (max 200 characters)
3. Add 2-10 answer options
4. Click "Create Poll"
5. Copy the share link and send it to others

### Voting on a Poll

1. Open the poll link
2. Click on your preferred option
3. View real-time results as others vote
4. Results update automatically without refresh

## API Endpoints

### POST `/api/polls`
Create a new poll

**Request Body:**
```json
{
  "question": "What's your favorite color?",
  "options": ["Red", "Blue", "Green"]
}
```

**Response:**
```json
{
  "pollId": "507f1f77bcf86cd799439011",
  "shareUrl": "/poll/507f1f77bcf86cd799439011"
}
```

### GET `/api/polls/:id`
Get poll data

**Response:**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "question": "What's your favorite color?",
  "options": [
    { "_id": "...", "text": "Red", "votes": 5 },
    { "_id": "...", "text": "Blue", "votes": 3 }
  ],
  "totalVotes": 8,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### POST `/api/polls/:id/vote`
Submit a vote

**Request Body:**
```json
{
  "optionId": "507f1f77bcf86cd799439012"
}
```

**Response:**
```json
{
  "success": true,
  "option": {
    "_id": "...",
    "text": "Red",
    "votes": 6
  }
}
```

### GET `/api/polls/:id/check-vote`
Check if user has already voted

**Response:**
```json
{
  "hasVoted": true
}
```

## Real-Time Communication

The app uses **Socket.IO** for real-time updates:

### Client Events
- `joinPoll(pollId)` - Join a poll room to receive updates
- `leavePoll(pollId)` - Leave a poll room

### Server Events
- `voteUpdate` - Emitted when someone votes
  ```json
  {
    "optionId": "...",
    "votes": 6,
    "totalVotes": 10
  }
  ```

## Anti-Abuse Mechanisms

The application implements two fairness controls to prevent duplicate voting:

### 1. IP Address + Browser Fingerprint Combination

**How it works:**

When a user visits the poll, the backend captures their IP address and creates a unique fingerprint from their browser headers:

```javascript
// Captured from request headers
const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
// Example: "192.168.1.1"

// Browser fingerprint created from:
const userAgent = req.headers['user-agent'];
const acceptLanguage = req.headers['accept-language'];
const acceptEncoding = req.headers['accept-encoding'];

// Combined into a unique fingerprint
const fingerprint = Buffer.from(
  `${userAgent}${acceptLanguage}${acceptEncoding}`
).toString('base64').substring(0, 32);
// Example: "TW96aWxsYS81LjAgKFdpbmRvd3MgTlQ="
```

When a user votes, both the IP address and fingerprint are stored:

```javascript
poll.votes.push({
  optionId: "option123",
  ipAddress: "192.168.1.1",
  fingerprint: "TW96aWxsYS81LjAgKFdpbmRvd3MgTlQ=",
  votedAt: new Date()
});
```

Before accepting any new vote, the system checks if this exact combination already exists:

```javascript
const hasVoted = poll.votes.some(vote => 
  vote.ipAddress === currentIP && 
  vote.fingerprint === currentFingerprint
);

if (hasVoted) {
  return res.status(403).json({ error: 'You have already voted' });
}
```

**What this prevents:**
- Same person clicking vote button multiple times
- Refreshing the page and voting again
- Closing and reopening the browser (same browser)
- Simple duplicate vote attempts

**Limitations:**
- Can be bypassed using a VPN (changes IP address)
- Can be bypassed using different browsers (different fingerprint)
- Can be bypassed using incognito/private mode (different fingerprint)
- Fingerprint is basic and doesn't use advanced techniques

### 2. Rate Limiting (24-hour Cooldown per IP)

**How it works:**

Each IP address can only submit one vote per poll within a 24-hour period. This acts as a secondary defense even if the fingerprint is bypassed:

```javascript
const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

const recentVotes = poll.votes.filter(vote => 
  vote.ipAddress === currentIP && 
  vote.votedAt > oneDayAgo
);

if (recentVotes.length > 0) {
  return res.status(429).json({ error: 'Rate limit exceeded' });
}
```

**What this prevents:**
- Automated bot attacks (rapid successive votes)
- Users who bypass fingerprinting (still blocked by IP)
- Script-based vote manipulation
- Spam voting attempts

**Limitations:**
- Can be bypassed with VPN (new IP address)
- May frustrate users who didn't actually vote but share an IP

### Code Implementation

The checks are implemented in `backend/routes/polls.js`:

```javascript
// Check #1: IP + Fingerprint combination
if (poll.hasUserVoted(ipAddress, fingerprint)) {
  return res.status(403).json({ 
    error: 'You have already voted in this poll',
    alreadyVoted: true
  });
}

// Check #2: Rate limiting
if (!poll.canUserVote(ipAddress)) {
  return res.status(429).json({ 
    error: 'Rate limit exceeded. Please try again later.',
    rateLimited: true
  });
}
```

The methods are defined in `backend/models/Poll.js`:

```javascript
// Method 1: Check if IP + Fingerprint already voted
pollSchema.methods.hasUserVoted = function(ipAddress, fingerprint) {
  return this.votes.some(vote => 
    vote.ipAddress === ipAddress && 
    vote.fingerprint === fingerprint
  );
};

// Method 2: Check if IP voted in last 24 hours
pollSchema.methods.canUserVote = function(ipAddress) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentVotes = this.votes.filter(vote => 
    vote.ipAddress === ipAddress && 
    vote.votedAt > oneDayAgo
  );
  return recentVotes.length === 0;
};
```

### Why These Mechanisms Are Appropriate

For this assignment scope, these mechanisms provide:
- **Practical protection** against casual duplicate voting
- **Balance** between security and user experience
- **Simple implementation** without requiring user accounts
- **Demonstration of understanding** security concepts

### Limitations and Improvements

**Current Limitations:**
- IP-based rate limiting affects shared networks
- No CAPTCHA to prevent automated bots
- No user authentication required

**Appropriate Use Cases:**
- Classroom polls and surveys
- Team decision-making polls
- Informal opinion gathering
- Event feedback collection

**Not Suitable For:**
- Official elections or governance
- Contests with monetary prizes
- High-stakes decision-making
- Legal or binding votes


## Known Limitations

1. **Vote Security**: Basic IP + fingerprint tracking can be bypassed
2. **Scalability**: Single-server architecture (not clustered)
3. **Features**: No poll editing, expiration, or analytics
4. **Storage**: Embedded votes array (consider separate collection for >10K votes)

## Future Improvements

- [ ] User authentication
- [ ] Poll editing and deletion
- [ ] Poll expiration dates
- [ ] Advanced analytics dashboard
- [ ] Multiple choice support
- [ ] Image options
- [ ] Export results (CSV/PDF)
- [ ] Email notifications
