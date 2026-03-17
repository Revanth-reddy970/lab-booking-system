const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

let initialized = false;

async function ensureInit() {
  if (!initialized) {
    await db.init();
    const { router: authRouter } = require('./routes/auth');
    const equipmentRouter = require('./routes/equipment');
    const bookingsRouter = require('./routes/bookings');

    app.use('/api/auth', authRouter);
    app.use('/api/equipment', equipmentRouter);
    app.use('/api/bookings', bookingsRouter);

    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, '../frontend/index.html'));
    });

    initialized = true;
  }
}

// Vercel serverless export
module.exports = async (req, res) => {
  await ensureInit();
  app(req, res);
};

// Local dev
if (require.main === module) {
  db.init().then(() => {
    const { router: authRouter } = require('./routes/auth');
    const equipmentRouter = require('./routes/equipment');
    const bookingsRouter = require('./routes/bookings');

    app.use('/api/auth', authRouter);
    app.use('/api/equipment', equipmentRouter);
    app.use('/api/bookings', bookingsRouter);

    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, '../frontend/index.html'));
    });

    app.listen(PORT, () => {
      console.log(`\n🚀 Lab Booking System running at http://localhost:${PORT}`);
      console.log(`\nDefault credentials:`);
      console.log(`  Admin    → admin@lab.edu   / admin123`);
      console.log(`  Faculty  → faculty@lab.edu / faculty123`);
      console.log(`  Student  → student@lab.edu / student123\n`);
    });
  }).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
}
