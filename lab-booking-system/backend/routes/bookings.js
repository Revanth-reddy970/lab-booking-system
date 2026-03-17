const express = require('express');
const db = require('../db');
const { auth } = require('./auth');

const router = express.Router();

// Stats must be before /:id routes
router.get('/stats/summary', auth, (req, res) => {
  if (req.user.role === 'student') return res.status(403).json({ error: 'Not authorized' });
  res.json({
    total:          db.get('SELECT COUNT(*) as c FROM bookings').c,
    pending:        db.get("SELECT COUNT(*) as c FROM bookings WHERE status='pending'").c,
    approved:       db.get("SELECT COUNT(*) as c FROM bookings WHERE status='approved'").c,
    rejected:       db.get("SELECT COUNT(*) as c FROM bookings WHERE status='rejected'").c,
    completed:      db.get("SELECT COUNT(*) as c FROM bookings WHERE status='completed'").c,
    totalEquipment: db.get('SELECT COUNT(*) as c FROM equipment').c,
    totalUsers:     db.get('SELECT COUNT(*) as c FROM users').c,
  });
});

router.post('/', auth, (req, res) => {
  const { equipment_id, booking_date, start_time, end_time, purpose } = req.body;
  if (!equipment_id || !booking_date || !start_time || !end_time)
    return res.status(400).json({ error: 'All fields required' });

  const eq = db.get('SELECT * FROM equipment WHERE id = ?', [equipment_id]);
  if (!eq) return res.status(404).json({ error: 'Equipment not found' });
  if (eq.available < 1) return res.status(409).json({ error: 'Equipment not available' });

  const conflict = db.get(
    `SELECT id FROM bookings WHERE equipment_id=? AND booking_date=? AND status IN ('pending','approved')
     AND NOT (end_time <= ? OR start_time >= ?)`,
    [equipment_id, booking_date, start_time, end_time]
  );
  if (conflict) return res.status(409).json({ error: 'Time slot already booked' });

  db.run('INSERT INTO bookings (user_id,equipment_id,booking_date,start_time,end_time,purpose) VALUES (?,?,?,?,?,?)',
    [req.user.id, equipment_id, booking_date, start_time, end_time, purpose]);
  res.status(201).json({ id: db.lastId(), message: 'Booking request submitted' });
});

router.get('/', auth, (req, res) => {
  const q = `
    SELECT b.*, u.name as user_name, u.email as user_email, u.roll_number,
           e.name as equipment_name, e.category, e.lab_location,
           a.name as approved_by_name
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    JOIN equipment e ON b.equipment_id = e.id
    LEFT JOIN users a ON b.approved_by = a.id
  `;
  const bookings = req.user.role === 'student'
    ? db.all(q + ' WHERE b.user_id = ? ORDER BY b.created_at DESC', [req.user.id])
    : db.all(q + ' ORDER BY b.created_at DESC');
  res.json(bookings);
});

router.patch('/:id/status', auth, (req, res) => {
  if (req.user.role === 'student') return res.status(403).json({ error: 'Not authorized' });
  const { status, remarks } = req.body;
  if (!['approved','rejected','completed'].includes(status))
    return res.status(400).json({ error: 'Invalid status' });

  const booking = db.get('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  db.run('UPDATE bookings SET status=?,approved_by=?,remarks=? WHERE id=?',
    [status, req.user.id, remarks, req.params.id]);

  if (status === 'approved') {
    db.run('UPDATE equipment SET available = available - 1 WHERE id = ? AND available > 0', [booking.equipment_id]);
  } else if ((status === 'completed' || status === 'rejected') && booking.status === 'approved') {
    db.run('UPDATE equipment SET available = available + 1 WHERE id = ?', [booking.equipment_id]);
  }

  res.json({ message: `Booking ${status}` });
});

router.patch('/:id/cancel', auth, (req, res) => {
  const booking = db.get('SELECT * FROM bookings WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (!['pending','approved'].includes(booking.status))
    return res.status(400).json({ error: 'Cannot cancel this booking' });

  db.run('UPDATE bookings SET status=? WHERE id=?', ['cancelled', req.params.id]);
  if (booking.status === 'approved')
    db.run('UPDATE equipment SET available = available + 1 WHERE id = ?', [booking.equipment_id]);

  res.json({ message: 'Booking cancelled' });
});

module.exports = router;
