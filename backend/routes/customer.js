const express   = require('express');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const multer    = require('multer');
const path      = require('path');
const { Customer } = require('../db/database');
const { requireStaff, requireCustomer } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'kapebara-fallback-secret';

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename:    (req, file, cb) => cb(null, `avatar_${Date.now()}_${file.originalname}`)
});
const upload = multer({ storage });

// ── Rate limiters ─────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait 15 minutes and try again.' }
});

// ── Password helpers ──────────────────────────────────────────────────────────
async function hashPassword(p) {
  return bcrypt.hash(p, 12);
}

async function verifyPassword(plain, storedHash) {
  try {
    if (storedHash.startsWith('$2')) return bcrypt.compare(plain, storedHash);
  } catch {}
  // Fallback: legacy SHA-256
  const crypto = require('crypto');
  const sha256  = crypto.createHash('sha256').update(plain).digest('hex');
  return sha256 === storedHash;
}

// ── Generate a random 6-digit loyalty ID ─────────────────────────────────────
function generateUniqueId() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ── Register new customer ─────────────────────────────────────────────────────
router.post('/register', authLimiter, async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Name, email, and password are required' });

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    return res.status(400).json({ error: 'Please enter a valid email address' });

  // Password minimum length
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

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

    const hashed   = await hashPassword(password);
    const customer = await Customer.create({
      name: name.trim(),
      email: trimmedEmail,
      password_hash: hashed,
      phone: phone ? phone.trim() : '',
      unique_id
    });

    // Issue customer token immediately on register
    const token = jwt.sign(
      { customerId: customer.id, name: customer.name, role: 'customer' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      customerId: customer.id,
      name: customer.name,
      unique_id
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ── Login customer ────────────────────────────────────────────────────────────
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  try {
    const inputStr   = email.trim();
    const cleanEmail = inputStr.toLowerCase();
    const escapedEmail = cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const customer = await Customer.findOne({
      $or: [
        { email: { $regex: new RegExp(`^${escapedEmail}$`, 'i') } },
        { unique_id: inputStr },
        { phone: inputStr }
      ]
    });

    const valid = customer ? await verifyPassword(password, customer.password_hash) : false;
    if (!customer || !valid)
      return res.status(401).json({ error: 'Invalid email/ID or password' });

    // Auto-upgrade legacy SHA-256 to bcrypt on login
    if (customer.password_hash && !customer.password_hash.startsWith('$2')) {
      const upgraded = await hashPassword(password);
      await Customer.findByIdAndUpdate(customer._id, { password_hash: upgraded });
    }

    // Issue JWT token (24-hour session)
    const token = jwt.sign(
      { customerId: customer.id, name: customer.name, role: 'customer' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      customerId: customer.id,
      name: customer.name
    });
  } catch (err) {
    console.error('Customer login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── GET all customers — staff / admin only ────────────────────────────────────
router.get('/all', requireStaff, async (req, res) => {
  try {
    const customers = await Customer.find()
      .select('name email phone points loyalty_level unique_id birthdate avatar_url created_at')
      .sort({ created_at: -1 });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// ── GET customer info — public (used by portal after login with their own ID) ─
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

// ── PUT update customer info — customer must be logged in ─────────────────────
router.put('/update', requireCustomer, upload.single('avatar'), async (req, res) => {
  // Customers can only edit their own account
  const id = req.customer.customerId;

  const { name, email, password, birthdate, phone } = req.body;
  const updates = {};

  try {
    if (name)                        updates.name      = name;
    if (birthdate !== undefined)     updates.birthdate = birthdate;
    if (phone !== undefined)         updates.phone     = phone;
    if (email) {
      const existing = await Customer.findOne({ email, _id: { $ne: id } });
      if (existing) return res.status(400).json({ error: 'Email already in use' });
      updates.email = email;
    }
    if (password) {
      if (password.length < 6)
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      updates.password_hash = await hashPassword(password);
    }
    if (req.file) updates.avatar_url = '/uploads/' + req.file.filename;

    if (Object.keys(updates).length === 0)
      return res.status(400).json({ error: 'No changes provided' });

    await Customer.findByIdAndUpdate(id, updates);
    res.json({ message: 'Account updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update account' });
  }
});

// ── POST add loyalty points by unique_id — staff / admin only ─────────────────
router.post('/add-points', requireStaff, async (req, res) => {
  const { unique_id, order_total } = req.body;
  if (!unique_id || !order_total)
    return res.status(400).json({ error: 'unique_id and order_total are required' });

  try {
    const customer = await Customer.findOne({ unique_id });
    if (!customer) return res.status(404).json({ error: 'Customer ID not found' });

    const earned    = Math.floor(parseFloat(order_total) / 10);
    const newPoints = (customer.points || 0) + earned;

    let loyalty_level = 'Bronze';
    if (newPoints >= 3000)      loyalty_level = 'Gold';
    else if (newPoints >= 1000) loyalty_level = 'Silver';

    await Customer.findByIdAndUpdate(customer._id, { points: newPoints, loyalty_level });
    res.json({
      message:       `+${earned} points awarded!`,
      customer_name: customer.name,
      points_earned: earned,
      new_total:     newPoints,
      loyalty_level
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add points' });
  }
});

// ── GET lookup customer by unique_id — staff / admin only ─────────────────────
router.get('/lookup', requireStaff, async (req, res) => {
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
