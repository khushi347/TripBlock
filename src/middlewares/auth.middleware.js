const jwt = require('jsonwebtoken');
const Farmer = require('../models/Farmer');
const Provider = require('../models/Provider');

/**
 * Protect middleware to verify JWT and attach user object to requests.
 */
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized to access this route. Token is missing.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkeyfortripblockbackend1234!');

    let user = await Farmer.findById(decoded.id);
    let role = 'farmer';

    if (!user) {
      user = await Provider.findById(decoded.id);
      role = 'provider';
    }

    // fallback for admin or system user
    if (!user && decoded.role === 'admin') {
      user = { _id: decoded.id, name: 'Admin', email: decoded.email };
      role = 'admin';
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'User matching this token no longer exists.' });
    }

    req.user = user;
    req.role = role;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Not authorized, token validation failed.' });
  }
};

/**
 * Authorize middleware to restrict access based on roles.
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.role}' is not authorized to access this resource.`
      });
    }
    next();
  };
};

module.exports = { protect, authorize };
