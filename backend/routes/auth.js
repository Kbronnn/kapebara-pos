const express = require('express');
const crypto  = require('crypto');
const { Admin } = require('../db/database');

const router = express.Router();

function hashPassword(p) {
  return crypto.createHash('sha256').update(p).digest('hex');
}

// Admin login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password are required' });

  try {
    const admin = await Admin.findOne({ username });
    if (!admin || admin.password_hash !== hashPassword(password))
      return res.status(401).json({ error: 'Invalid username or password' });

    res.json({ message: 'Login successful', adminId: admin.id, username: admin.username });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;
