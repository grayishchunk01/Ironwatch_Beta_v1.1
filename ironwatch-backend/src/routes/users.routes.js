const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireAdmin);

function publicUser(row) {
  return {
    username: row.username,
    role: row.role,
    displayRole: row.display_role,
    access: row.access_label,
    lastLogin: row.last_login,
  };
}

// GET /api/users — list all login accounts (admin only)
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM users ORDER BY id ASC').all();
  res.json(rows.map(publicUser));
});

// POST /api/users — create a new login account
router.post('/', (req, res) => {
  const { username, password, role, displayRole, access } = req.body || {};
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'username, password and role are required' });
  }
  if (!['admin', 'viewer'].includes(role)) {
    return res.status(400).json({ error: "role must be 'admin' or 'viewer'" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' });
  }

  try {
    db.prepare(`
      INSERT INTO users (username, password_hash, role, display_role, access_label)
      VALUES (?,?,?,?,?)
    `).run(username, bcrypt.hashSync(password, 10), role, displayRole || '', access || '');
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    throw err;
  }

  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  res.status(201).json(publicUser(row));
});

// PUT /api/users/:username/password — admin resets a user's password
router.put('/:username/password', (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'newPassword must be at least 8 characters' });
  }
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(req.params.username);
  if (!row) return res.status(404).json({ error: 'User not found' });

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .run(bcrypt.hashSync(newPassword, 10), row.id);
  res.json({ ok: true });
});

// DELETE /api/users/:username
router.delete('/:username', (req, res) => {
  if (req.params.username === req.user.username) {
    return res.status(400).json({ error: "You can't delete the account you're logged in as" });
  }
  const info = db.prepare('DELETE FROM users WHERE username = ?').run(req.params.username);
  if (info.changes === 0) return res.status(404).json({ error: 'User not found' });
  res.json({ ok: true });
});

module.exports = router;
