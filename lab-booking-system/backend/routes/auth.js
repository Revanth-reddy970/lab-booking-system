const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();
const SECRET = process.env.JWT_SECRET || 'lab_secret_key_2024';

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = db.get('SELECT * FROM users WHERE email = ?', [email]);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  if (!bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Invalid credentials' });

  // Only this specific email is allowed to log in as admin
  if (user.role === 'admin' && user.email !== 'sprevanthreddy@gmail.com')
    return res.status(403).json({ error: 'Unauthorized admin account' });

  const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, SECRET, { expiresIn: '8h' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department } });
});

router.post('/register', (req, res) => {
  const { name, email, password, role, department, roll_number } = req.body;
  if (!name || !email || !password || !role) return res.status(400).json({ error: 'All fields required' });
  if (role === 'admin') return res.status(403).json({ error: 'Cannot self-register as admin' });

  if (db.get('SELECT id FROM users WHERE email = ?', [email]))
    return res.status(409).json({ error: 'Email already registered' });

  const hashed = bcrypt.hashSync(password, 10);
  db.run('INSERT INTO users (name,email,password,role,department,roll_number) VALUES (?,?,?,?,?,?)',
    [name, email, hashed, role, department, roll_number]);
  const id = db.lastId();
  res.status(201).json({ message: 'Registered successfully', id });
});

const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(header.split(' ')[1], SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

router.get('/me', auth, (req, res) => {
  const user = db.get(
    'SELECT id,name,email,role,department,roll_number,created_at FROM users WHERE id = ?',
    [req.user.id]
  );
  res.json(user);
});

module.exports = { router, auth };
