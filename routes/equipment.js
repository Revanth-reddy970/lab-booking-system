const express = require('express');
const db = require('../db');
const { auth } = require('./auth');

const router = express.Router();

router.get('/', auth, (req, res) => {
  res.json(db.all('SELECT * FROM equipment ORDER BY category, name'));
});

router.get('/:id', auth, (req, res) => {
  const eq = db.get('SELECT * FROM equipment WHERE id = ?', [req.params.id]);
  if (!eq) return res.status(404).json({ error: 'Not found' });
  res.json(eq);
});

router.post('/', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { name, category, description, quantity, lab_location } = req.body;
  if (!name || !category) return res.status(400).json({ error: 'Name and category required' });
  const qty = quantity || 1;
  db.run('INSERT INTO equipment (name,category,description,quantity,available,lab_location) VALUES (?,?,?,?,?,?)',
    [name, category, description, qty, qty, lab_location]);
  res.status(201).json({ id: db.lastId(), message: 'Equipment added' });
});

router.put('/:id', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { name, category, description, quantity, available, lab_location } = req.body;
  db.run('UPDATE equipment SET name=?,category=?,description=?,quantity=?,available=?,lab_location=? WHERE id=?',
    [name, category, description, quantity, available, lab_location, req.params.id]);
  res.json({ message: 'Updated' });
});

router.delete('/:id', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  db.run('DELETE FROM equipment WHERE id = ?', [req.params.id]);
  res.json({ message: 'Deleted' });
});

module.exports = router;
