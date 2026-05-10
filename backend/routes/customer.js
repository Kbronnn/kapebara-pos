const express = require('express');
const crypto  = require('crypto');
const multer  = require('multer');
const path    = require('path');
const { Customer } = require('../db/database');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename:    (req, file, cb) => cb(null, `avatar_${Date.now()}_${file.originalname}`)
});
const upload = multer({ storage });

function hashPassword(p) {
  return crypto.createHash('sha256').update(p).digest('hex');
}

// Register new customer
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Name, email, and password are required' });

  try {
    const existing = await Customer.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const customer = await Customer.create({ name, email, password_hash: hashPassword(password) });
    res.status(201).json({ message: 'Registration successful', customerId: customer.id });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login customer
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  try {
    const customer = await Customer.findOne({ email });
    if (!customer || customer.password_hash !== hashPassword(password))
      return res.status(401).json({ error: 'Invalid email or password' });

    res.json({ message: 'Login successful', customerId: customer.id, name: customer.name });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET customer info
router.get('/info', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Customer ID is required' });

  try {
    const customer = await Customer.findById(id).select('name email points loyalty_level avatar_url');
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customer info' });
  }
});

// PUT update customer info (with optional avatar upload)
router.put('/update', upload.single('avatar'), async (req, res) => {
  const id = req.query.id || req.body.id;
  if (!id) return res.status(400).json({ error: 'Customer ID is required' });

  const { name, email, password } = req.body;
  const updates = {};

  try {
    if (name)     updates.name = name;
    if (email) {
      const existing = await Customer.findOne({ email, _id: { $ne: id } });
      if (existing) return res.status(400).json({ error: 'Email already in use' });
      updates.email = email;
    }
    if (password)  updates.password_hash = hashPassword(password);
    if (req.file)  updates.avatar_url    = '/uploads/' + req.file.filename;

    if (Object.keys(updates).length === 0)
      return res.status(400).json({ error: 'No changes provided' });

    await Customer.findByIdAndUpdate(id, updates);
    res.json({ message: 'Account updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update account' });
  }
});

module.exports = router;
