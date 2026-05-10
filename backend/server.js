require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { connectDatabase } = require('./db/database');

const PORT = process.env.PORT || 3000;

async function startServer() {
  await connectDatabase();

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use(express.static(path.join(__dirname, '../frontend')));
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  app.use('/api/products',  require('./routes/products'));
  app.use('/api/orders',    require('./routes/orders'));
  app.use('/api/inventory', require('./routes/inventory'));
  app.use('/api/forecast',  require('./routes/forecast'));
  app.use('/api/customer',  require('./routes/customer'));
  app.use('/api/events',    require('./routes/events'));
  app.use('/api/auth',      require('./routes/auth'));
  app.use('/api/ratings',   require('./routes/ratings'));

  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  });

  app.listen(PORT, () => {
    console.log(`\n☕  KapeBara POS is running!\n`);
    console.log(`   → Open in browser: http://localhost:${PORT}\n`);
  });
}

startServer().catch(err => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
