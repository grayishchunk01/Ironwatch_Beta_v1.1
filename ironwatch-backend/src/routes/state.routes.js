const express = require('express');
const { db, COLLECTIONS } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const selectStmt = db.prepare(
  'SELECT ref_id, payload FROM records WHERE collection = ? ORDER BY position ASC, id ASC'
);

function loadState() {
  const state = {};
  for (const collection of COLLECTIONS) {
    state[collection] = selectStmt.all(collection).map((row) => ({
      ...JSON.parse(row.payload),
      _id: row.ref_id,
    }));
  }
  return state;
}

// GET /api/state — full dashboard dataset (any authenticated user, admin or viewer)
router.get('/', requireAuth, (req, res) => {
  res.json(loadState());
});

const deleteCollectionStmt = db.prepare('DELETE FROM records WHERE collection = ?');
const insertRecordStmt = db.prepare(
  'INSERT INTO records (collection, ref_id, position, payload) VALUES (?,?,?,?)'
);

const replaceState = db.transaction((newState) => {
  for (const collection of COLLECTIONS) {
    const items = Array.isArray(newState[collection]) ? newState[collection] : [];
    deleteCollectionStmt.run(collection);
    items.forEach((item, i) => {
      const { _id, ...rest } = item || {};
      const refId = _id ? String(_id) : `${collection}-${Date.now()}-${i}`;
      insertRecordStmt.run(collection, refId, i, JSON.stringify(rest));
    });
  }
});

// PUT /api/state — replace the full dashboard dataset (admin only)
router.put('/', requireAuth, requireAdmin, (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Request body must be a JSON object keyed by collection name' });
  }

  const unknownKeys = Object.keys(body).filter((k) => !COLLECTIONS.includes(k));
  if (unknownKeys.length) {
    return res.status(400).json({ error: `Unknown collection(s): ${unknownKeys.join(', ')}` });
  }

  replaceState(body);
  res.json(loadState());
});

module.exports = router;
