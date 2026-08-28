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

// Generate a random 6-digit unique loyalty ID
function generateUniqueId() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Register new customer
router.post('/register', async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Name, email, and password are required' });

  try {
    const trimmedEmail = email.trim().toLowerCase();
    const escapedEmail = trimmedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await Customer.findOne({
      email: { $regex: new RegExp(`^${escapedEmail}$`, 'i') }
    });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    // Generate a unique 6-digit ID (retry if collision)
    let unique_id;
    for (let i = 0; i < 10; i++) {
      const candidate = generateUniqueId();
      const clash = await Customer.findOne({ unique_id: candidate });
      if (!clash) { unique_id = candidate; break; }
    }

    const customer = await Customer.create({
      name: name.trim(),
      email: trimmedEmail,
      password_hash: hashPassword(password),
      phone: phone ? phone.trim() : '',
      unique_id
    });
    res.status(201).json({ message: 'Registration successful', customerId: customer.id, name: customer.name, unique_id });
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
    const inputStr = email.trim();
    const cleanEmail = inputStr.toLowerCase();
    const escapedEmail = cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Find customer by email (case-insensitive), unique_id, or phone number
    const customer = await Customer.findOne({
      $or: [
        { email: { $regex: new RegExp(`^${escapedEmail}$`, 'i') } },
        { unique_id: inputStr },
        { phone: inputStr }
      ]
    });

    if (!customer || customer.password_hash !== hashPassword(password))
      return res.status(401).json({ error: 'Invalid email/ID or password' });

    res.json({ message: 'Login successful', customerId: customer.id, name: customer.name });
  } catch (err) {
    console.error('Customer login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET all customers (for admin/staff portal)
router.get('/all', async (req, res) => {
  try {
    const customers = await Customer.find()
      .select('name email phone points loyalty_level unique_id birthdate avatar_url created_at')
      .sort({ created_at: -1 });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// GET customer info
router.get('/info', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Customer ID is required' });

  try {
    const customer = await Customer.findById(id).select(
      'name email points loyalty_level avatar_url unique_id birthdate phone'
    );
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

  const { name, email, password, birthdate, phone } = req.body;
  const updates = {};

  try {
    if (name)      updates.name     = name;
    if (birthdate !== undefined) updates.birthdate = birthdate;
    if (phone !== undefined)     updates.phone     = phone;
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

// POST add loyalty points by unique_id (called from POS after checkout)
router.post('/add-points', async (req, res) => {
  const { unique_id, order_total } = req.body;
  if (!unique_id || !order_total)
    return res.status(400).json({ error: 'unique_id and order_total are required' });

  try {
    const customer = await Customer.findOne({ unique_id });
    if (!customer) return res.status(404).json({ error: 'Customer ID not found' });

    // 1 point per ₱10 spent (₱100 = 10 points)
    const earned = Math.floor(parseFloat(order_total) / 10);
    const newPoints = (customer.points || 0) + earned;

    // Update loyalty level
    let loyalty_level = 'Bronze';
    if (newPoints >= 3000) loyalty_level = 'Gold';
    else if (newPoints >= 1000) loyalty_level = 'Silver';

    await Customer.findByIdAndUpdate(customer._id, { points: newPoints, loyalty_level });
    res.json({
      message: `+${earned} points awarded!`,
      customer_name: customer.name,
      points_earned: earned,
      new_total: newPoints,
      loyalty_level
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add points' });
  }
});

// GET lookup customer by unique_id (for POS display)
router.get('/lookup', async (req, res) => {
  const { unique_id } = req.query;
  if (!unique_id) return res.status(400).json({ error: 'unique_id is required' });

  try {
    const customer = await Customer.findOne({ unique_id }).select('name points loyalty_level unique_id');
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to lookup customer' });
  }
});

module.exports = router;
