# Real-Time Poll Application

A modern web application for creating and sharing polls with real-time vote tracking. Built with React, Node.js, Express, MongoDB, Socket.IO, and EmailJS.

## Features

- **Create Polls** — Simple interface to create polls with custom questions and up to 10 options
- **Email Verification** — Secure voting via 6-digit email verification codes (powered by EmailJS)
- **Real-Time Updates** — Vote counts update instantly across all connected users via WebSocket
- **Change or Remove Vote** — Users can change their vote or remove it entirely after voting
- **QR Code Sharing** — Every poll gets a scannable QR code for instant mobile access
- **Share Links** — Each poll gets a unique shareable URL with one-click copy
- **Duplicate Prevention** — Multi-layer anti-abuse system (email + IP + browser fingerprint)
- **Persistent Storage** — All polls and votes stored in MongoDB
- **Responsive Design** — Works seamlessly on desktop, tablet, and mobile devices

---

## Tech Stack

### Frontend
- **React** — UI framework
- **Tailwind CSS** — Utility-first styling
- **Socket.IO Client** — Real-time communication
- **EmailJS** — Client-side email sending (no backend SMTP needed)
- **QRCode** — QR code generation

### Backend
- **Node.js** — Runtime environment
- **Express** — Web framework
- **MongoDB + Mongoose** — Database and ODM
- **Socket.IO** — Real-time bidirectional communication
- **Express Rate Limit** — API rate limiting

---

## Project Structure

```
poll-app/
├── backend/
│   ├── models/
│   │   │── Vote.js        # Vote subdocument schema
│   │   │── Option.js      # Option subdocument schema
│   │   ├── Poll.js                  # Poll model (uses VoteSchema + OptionSchema)
│   │   ├── Verification.js      # Email verification code model
│   │   └── index.js                 # Central model exports
│   ├── routes/
│   │   └── polls.js                 # All API endpoints
│   ├── middleware/
│   │   └── fingerprint.js           # Browser fingerprint extraction
│   ├── server.js                    # Main server file
│   ├── package.json
│   └── .env.example
│
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── CreatePoll.jsx        # Poll creation page
    │   │   ├── PollView.jsx          # Poll viewing, voting, and results page
    │   │   └── NotFound.jsx          # 404 error page
    │   ├── utils/
    │   │   └── emailService.js       # EmailJS integration
    │   ├── App.jsx                   # Main app component with routing
    │   ├── main.jsx                  # Entry point
    │   └── index.css                 # Tailwind imports
    ├── index.html
    ├── package.json
    ├── tailwind.config.js
    └── vite.config.js
```

---

## Getting Started

### Prerequisites

- **Node.js** (v18 or higher)
- **MongoDB** (local or MongoDB Atlas)
- **EmailJS account** (free at [emailjs.com](https://emailjs.com))
- **npm** or **yarn**

## Usage

### Creating a Poll

1. Navigate to `http://localhost:5173`
2. Enter your question (max 200 characters)
3. Add 2–10 answer options
4. Click **Create Poll**
5. Share the link or QR code with others

### Voting on a Poll

1. Open the poll link
2. Enter your email address and click **Send Code**
3. Check your inbox for the 6-digit verification code
4. Enter the code — options become clickable
5. Click your preferred option to vote
6. View real-time results instantly

### Changing or Removing a Vote

1. After voting, click **Change** to select a different option
2. Or click **Remove** to retract your vote entirely
3. All changes reflect in real-time for every connected user

### Sharing via QR Code

1. Open any poll
2. Click **Show QR** to display the QR code
3. Scan with any phone camera to open the poll instantly
4. Click **Download QR Code** to save it as a PNG for printing or sharing

## Real-Time Communication

The app uses **Socket.IO** for live vote updates across all connected clients.

### Client → Server Events
| Event | Payload | Description |
|-------|---------|-------------|
| `joinPoll` | `pollId` | Subscribe to a poll's updates |
| `leavePoll` | `pollId` | Unsubscribe from a poll |

### Server → Client Events
| Event | Payload | Description |
|-------|---------|-------------|
| `voteUpdate` | `{ optionId, votes, totalVotes }` | Emitted on every vote, change, or removal |

---

## Anti-Abuse Mechanisms

The application uses a **three-layer protection system** to prevent duplicate voting.

### Layer 1: Email Verification (Primary)

Every voter must verify their email with a one-time 6-digit code before voting.

```
User enters email
      ↓
Backend generates code → stores in MongoDB (10-min TTL)
      ↓
Frontend sends code via EmailJS
      ↓
User enters code → backend verifies against DB
      ↓
Vote accepted + code deleted
```

**What this prevents:**
- ✅ Same person voting multiple times with the same email
- ✅ Casual abuse without any technical knowledge

**Limitations:**
- ❌ Someone with multiple email addresses could vote multiple times
- Covered by Layer 2 below

---

### Layer 2: IP + Browser Fingerprint (Backup)

Even with email verification, each vote is also tied to the device's IP and browser fingerprint. This prevents a single device from voting with multiple emails.

```javascript
// Fingerprint created from browser headers
const fingerprint = Buffer.from(
  `${userAgent}${acceptLanguage}${acceptEncoding}`
).toString('base64').substring(0, 32);

// Both email AND device are checked before accepting vote
const emailVoted = poll.votes.some(v => v.email === email);
const deviceVoted = poll.votes.some(v =>
  v.ipAddress === ip && v.fingerprint === fingerprint
);

if (emailVoted || deviceVoted) {
  return res.status(403).json({ error: 'Already voted' });
}
```

**What this prevents:**
- ✅ Voting with email1@test.com then email2@test.com from the same device
- ✅ Basic browser-based abuse

**Limitations:**
- ❌ Different browsers on the same device produce different fingerprints
- ❌ VPN changes the IP address

---

### Layer 3: Sliding Window Rate Limiting

A fast in-memory rate limiter prevents spam and bot attacks.

```
3 attempts per 60 seconds → block for 15 minutes
```

**What this prevents:**
- ✅ Automated bot attacks
- ✅ Rapid-fire spam requests
- ✅ Accidental double-clicks

## Known Limitations

1. **Vote Security** — Email verification can be bypassed with multiple email addresses
2. **Scalability** — In-memory rate limiter resets on server restart (use Redis in production)
3. **No Poll Management** — Polls cannot be edited or deleted after creation
4. **No Expiration** — Polls stay open indefinitely
5. **EmailJS Limit** — Free plan allows 200 emails/month

---

## Future Improvements

- [ ] User authentication (login/signup)
- [ ] Poll expiration dates
- [ ] Poll editing and deletion
- [ ] Advanced analytics dashboard
- [ ] Multiple choice (select many) support
- [ ] Image options for visual polls
- [ ] Export results as CSV or PDF
- [ ] Redis for production-grade rate limiting
- [ ] CAPTCHA integration for bot prevention
- [ ] Admin dashboard for poll management
