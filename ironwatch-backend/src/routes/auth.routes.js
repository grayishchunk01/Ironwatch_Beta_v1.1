const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again in a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function publicUser(row) {
  return {
    username: row.username,
    role: row.role,
    displayRole: row.display_role,
    access: row.access_label,
  };
}

// POST /api/auth/login
router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  const row = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(row.id);

  const token = jwt.sign(
    { sub: row.username, role: row.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
  );

  res.json({ token, user: publicUser(row) });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(req.user.username);
  if (!row) return res.status(404).json({ error: 'User not found' });
  res.json({ user: publicUser(row) });
});

// POST /api/auth/change-password  { currentPassword, newPassword }
router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'newPassword must be at least 8 characters' });
  }

  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(req.user.username);
  if (!row || !bcrypt.compareSync(currentPassword, row.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .run(bcrypt.hashSync(newPassword, 10), row.id);

  res.json({ ok: true });
});

module.exports = router;
