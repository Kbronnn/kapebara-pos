const express = require('express');
const crypto  = require('crypto');
const { Admin, AuditLog } = require('../db/database');

const router = express.Router();

function hashPassword(p) {
  return crypto.createHash('sha256').update(p).digest('hex');
}

function getIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

// Admin / Staff login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password are required' });

  try {
    const admin = await Admin.findOne({ username });
    if (!admin || admin.password_hash !== hashPassword(password))
      return res.status(401).json({ error: 'Invalid username or password' });

    // Record login in audit log
    await AuditLog.create({
      admin_id: admin._id,
      username: admin.username,
      role:     admin.role || 'staff',
      action:   'login',
      ip:       getIP(req)
    });

    res.json({
      message:  'Login successful',
      adminId:  admin.id,
      username: admin.username,
      role:     admin.role || 'staff'
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET audit logs — admin only (frontend enforces this; backend accepts all for simplicity)
router.get('/audit-logs', async (req, res) => {
  try {
    const limit  = parseInt(req.query.limit)  || 100;
    const skip   = parseInt(req.query.skip)   || 0;
    const logs   = await AuditLog.find()
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);
    const total  = await AuditLog.countDocuments();
    res.json({ logs, total });
  } catch (err) {
    console.error('Audit log fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// GET all staff/admin accounts — admin only
router.get('/accounts', async (req, res) => {
  try {
    const accounts = await Admin.find({}, { password_hash: 0 }).sort({ created_at: 1 });
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// POST create new account — admin only
router.post('/accounts', async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
  if (!['admin', 'staff'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  try {
    const existing = await Admin.findOne({ username });
    if (existing) return res.status(409).json({ error: 'Username already exists' });
    const acc = await Admin.create({ username, password_hash: hashPassword(password), role });
    res.status(201).json({ message: 'Account created', id: acc.id, username: acc.username, role: acc.role });
  } catch (err) {
    console.error('Account create error:', err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// DELETE account — admin only
router.delete('/accounts/:id', async (req, res) => {
  try {
    const acc = await Admin.findByIdAndDelete(req.params.id);
    if (!acc) return res.status(404).json({ error: 'Account not found' });
    res.json({ message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

module.exports = router;
