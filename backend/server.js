require('dotenv').config();
// Force Google DNS so MongoDB Atlas SRV records resolve correctly
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

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

  // Serve frontend files directly
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
  app.use('/api/settings',  require('./routes/settings'));

  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  });

  app.listen(PORT, '0.0.0.0', () => {
    const os = require('os');
    const nets = os.networkInterfaces();
    let localIP = 'localhost';
    for (const iface of Object.values(nets)) {
      for (const net of iface) {
        if (net.family === 'IPv4' && !net.internal) { localIP = net.address; break; }
      }
    }
    console.log(`\n☕  KapeBara POS is running!\n`);
    console.log(`   → Local (this PC):  http://localhost:${PORT}`);
    console.log(`   → Staff Portal:     http://${localIP}:${PORT}/`);
    console.log(`   → Customer Portal:  http://${localIP}:${PORT}/customer.html\n`);
  });
}

startServer().catch(err => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
