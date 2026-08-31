const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'kapebara-fallback-secret';

/**
 * Verify a JWT token from the Authorization header.
 * Returns the decoded payload or throws.
 */
function verifyToken(req) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw { status: 401, message: 'No authentication token provided.' };
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    throw { status: 401, message: 'Invalid or expired token. Please log in again.' };
  }
}

/**
 * Middleware: allow any authenticated staff or admin.
 */
function requireStaff(req, res, next) {
  try {
    const payload = verifyToken(req);
    if (!['staff', 'admin'].includes(payload.role)) {
      return res.status(403).json({ error: 'Access denied. Staff login required.' });
    }
    req.user = payload;
    next();
  } catch (err) {
    res.status(err.status || 401).json({ error: err.message || 'Unauthorized' });
  }
}

/**
 * Middleware: allow only admin role.
 */
function requireAdmin(req, res, next) {
  try {
    const payload = verifyToken(req);
    if (payload.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }
    req.user = payload;
    next();
  } catch (err) {
    res.status(err.status || 401).json({ error: err.message || 'Unauthorized' });
  }
}

/**
 * Middleware: allow authenticated customers.
 * The customer token stores { customerId, role: 'customer' }
 */
function requireCustomer(req, res, next) {
  try {
    const payload = verifyToken(req);
    if (payload.role !== 'customer') {
      return res.status(403).json({ error: 'Access denied. Customer login required.' });
    }
    req.customer = payload;
    next();
  } catch (err) {
    res.status(err.status || 401).json({ error: err.message || 'Unauthorized' });
  }
}

module.exports = { requireStaff, requireAdmin, requireCustomer, verifyToken };
