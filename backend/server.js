require('dotenv').config();
// Force Google DNS so MongoDB Atlas SRV records resolve correctly
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express       = require('express');
const cors          = require('cors');
const helmet        = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const path          = require('path');
const fs            = require('fs');
const { connectDatabase } = require('./db/database');

const PORT = process.env.PORT || 3000;

async function startServer() {
  await connectDatabase();

  const app = express();

  // ── Security headers (helmet) ────────────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: false, // Disabled to allow inline scripts in React app
    crossOriginEmbedderPolicy: false
  }));

  // ── CORS — restrict to app's own origin ──────────────────────────────────────
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://kapebara-pos.onrender.com',
    /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/  // Allow local network IPs
  ];
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, Postman, same-origin)
      if (!origin) return callback(null, true);
      const allowed = allowedOrigins.some(o =>
        typeof o === 'string' ? o === origin : o.test(origin)
      );
      if (allowed) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  }));

  // ── Body parsing ─────────────────────────────────────────────────────────────
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // ── NoSQL injection sanitization ─────────────────────────────────────────────
  // Strips $ and . from user-supplied input to prevent MongoDB operator injection
  app.use(mongoSanitize({ replaceWith: '_' }));

  // ── Static files ──────────────────────────────────────────────────────────────
  const staticDir = fs.existsSync(path.join(__dirname, '../frontend/dist'))
    ? path.join(__dirname, '../frontend/dist')
    : path.join(__dirname, '../frontend');

  app.use(express.static(staticDir, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    }
  }));
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  // ── API Routes ────────────────────────────────────────────────────────────────
  app.use('/api/products',  require('./routes/products'));
  app.use('/api/orders',    require('./routes/orders'));
  app.use('/api/inventory', require('./routes/inventory'));
  app.use('/api/forecast',  require('./routes/forecast'));
  app.use('/api/customer',  require('./routes/customer'));
  app.use('/api/events',    require('./routes/events'));
  app.use('/api/auth',      require('./routes/auth'));
  app.use('/api/ratings',   require('./routes/ratings'));
  app.use('/api/settings',  require('./routes/settings'));

  // ── SPA fallback ──────────────────────────────────────────────────────────────
  app.get('/customer.html', (_req, res) => {
    res.sendFile(path.join(staticDir, 'customer.html'));
  });

  app.get('*', (_req, res) => {
    res.sendFile(path.join(staticDir, 'index.html'));
  });

  app.listen(PORT, '0.0.0.0', () => {
    const os   = require('os');
    const nets = os.networkInterfaces();
    let localIP = 'localhost';
    for (const iface of Object.values(nets)) {
      for (const net of iface) {
        if (net.family === 'IPv4' && !net.internal) { localIP = net.address; break; }
      }
    }
    console.log(`\n☕  KapeBara POS is running! (🔒 Security enabled)\n`);
    console.log(`   → Local (this PC):  http://localhost:${PORT}`);
    console.log(`   → Staff Portal:     http://${localIP}:${PORT}/`);
    console.log(`   → Customer Portal:  http://${localIP}:${PORT}/customer.html\n`);
  });
}

startServer().catch(err => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
