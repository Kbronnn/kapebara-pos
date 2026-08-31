const express      = require('express');
const bcrypt       = require('bcryptjs');
const jwt          = require('jsonwebtoken');
const rateLimit    = require('express-rate-limit');
const { Admin, AuditLog } = require('../db/database');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'kapebara-fallback-secret';

// ── Rate limiter: max 10 login attempts per 15 minutes per IP ────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait 15 minutes and try again.' }
});

// ── Helper: get client IP ─────────────────────────────────────────────────────
function getIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

// ── Hash a new password with bcrypt ──────────────────────────────────────────
async function hashPassword(p) {
  return bcrypt.hash(p, 12);
}

// ── Verify password: supports both bcrypt and legacy sha256 ──────────────────
async function verifyPassword(plain, storedHash) {
  // Try bcrypt first
  try {
    const isBcrypt = storedHash.startsWith('$2');
    if (isBcrypt) return bcrypt.compare(plain, storedHash);
  } catch {}
  // Fallback: legacy SHA-256 (auto-migrate on match)
  const crypto = require('crypto');
  const sha256  = crypto.createHash('sha256').update(plain).digest('hex');
  return sha256 === storedHash;
}

// ── Admin / Staff login ───────────────────────────────────────────────────────
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password are required' });

  try {
    const admin = await Admin.findOne({ username });
    const valid = admin ? await verifyPassword(password, admin.password_hash) : false;

    if (!admin || !valid)
      return res.status(401).json({ error: 'Invalid username or password' });

    // Auto-upgrade legacy SHA-256 hash to bcrypt on successful login
    if (admin.password_hash && !admin.password_hash.startsWith('$2')) {
      const upgraded = await hashPassword(password);
      await Admin.findByIdAndUpdate(admin._id, { password_hash: upgraded });
    }

    // Record login in audit log
    await AuditLog.create({
      admin_id: admin._id,
      username: admin.username,
      role:     admin.role || 'staff',
      action:   'login',
      ip:       getIP(req)
    });

    // Sign JWT token (8-hour session)
    const token = jwt.sign(
      { id: admin._id, username: admin.username, role: admin.role || 'staff' },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      message:  'Login successful',
      token,
      adminId:  admin.id,
      username: admin.username,
      role:     admin.role || 'staff'
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── GET audit logs — admin only ───────────────────────────────────────────────
router.get('/audit-logs', requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const skip  = parseInt(req.query.skip)  || 0;
    const logs  = await AuditLog.find().sort({ created_at: -1 }).skip(skip).limit(limit);
    const total = await AuditLog.countDocuments();
    res.json({ logs, total });
  } catch (err) {
    console.error('Audit log fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// ── GET all staff/admin accounts — admin only ─────────────────────────────────
router.get('/accounts', requireAdmin, async (req, res) => {
  try {
    const accounts = await Admin.find({}, { password_hash: 0 }).sort({ created_at: 1 });
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// ── POST create new account — admin only ──────────────────────────────────────
router.post('/accounts', requireAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
  if (!['admin', 'staff'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  try {
    const existing = await Admin.findOne({ username });
    if (existing) return res.status(409).json({ error: 'Username already exists' });
    const hashed = await hashPassword(password);
    const acc    = await Admin.create({ username, password_hash: hashed, role });
    res.status(201).json({ message: 'Account created', id: acc.id, username: acc.username, role: acc.role });
  } catch (err) {
    console.error('Account create error:', err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// ── DELETE account — admin only ───────────────────────────────────────────────
router.delete('/accounts/:id', requireAdmin, async (req, res) => {
  try {
    const acc = await Admin.findByIdAndDelete(req.params.id);
    if (!acc) return res.status(404).json({ error: 'Account not found' });
    res.json({ message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

module.exports = router;
