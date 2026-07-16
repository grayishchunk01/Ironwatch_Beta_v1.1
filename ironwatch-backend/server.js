require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.error('[fatal] JWT_SECRET is not set. Copy .env.example to .env and configure it before starting the server.');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const path = require('path');
const fs = require('fs');
const { seedIfEmpty } = require('./src/db');
const authRoutes = require('./src/routes/auth.routes');
const usersRoutes = require('./src/routes/users.routes');
const stateRoutes = require('./src/routes/state.routes');

seedIfEmpty();

const app = express();

app.use(helmet());
app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Allow non-browser tools (curl, server-to-server) with no Origin header,
    // and any origin explicitly listed in CORS_ORIGIN.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
}));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/state', stateRoutes);

// Optionally serve the IronWatch frontend from the same server/port, so the
// whole app works from one origin with no CORS configuration needed.
// Put index.html in a "public" folder next to this file to enable this.
const FRONTEND_DIR = path.join(__dirname, 'public');
if (fs.existsSync(path.join(FRONTEND_DIR, 'index.html'))) {
  app.use(express.static(FRONTEND_DIR));
  app.get('/', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'index.html')));
  console.log('[static] serving frontend from ./public');
}

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`IronWatch backend listening on http://localhost:${PORT}`);
});
