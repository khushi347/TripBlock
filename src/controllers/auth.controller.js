const Farmer = require('../models/Farmer');
const Provider = require('../models/Provider');
const jwt = require('jsonwebtoken');

const generateToken = (id, role, email) => {
  return jwt.sign(
    { id, role, email },
    process.env.JWT_SECRET || 'supersecretkeyfortripblockbackend1234!',
    { expiresIn: '30d' }
  );
};

/**
 * Register a new Farmer or Provider.
 * POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { name, phone, email, password, location, role } = req.body;

    // Check if user already exists in either collection
    const existingFarmer = await Farmer.findOne({ $or: [{ email }, { phone }] });
    const existingProvider = await Provider.findOne({ $or: [{ email }, { phone }] });

    if (existingFarmer || existingProvider) {
      res.status(400);
      throw new Error('User with this email or phone number already exists');
    }

    let user;
    const userRole = role === 'provider' ? 'provider' : 'farmer';

    if (userRole === 'provider') {
      const { serviceType, capacity, costPerTrip } = req.body;
      user = new Provider({
        name,
        phone,
        email,
        password,
        location,
        serviceType,
        capacity,
        costPerTrip,
        availability: true,
        status: 'active'
      });
    } else {
      user = new Farmer({
        name,
        phone,
        email,
        password,
        location
      });
    }

    await user.save();

    // Create copy without password for response
    const userResponse = user.toObject();
    delete userResponse.password;

    const token = generateToken(user._id, userRole, user.email);

    res.status(201).json({
      success: true,
      token,
      role: userRole,
      data: userResponse
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login Farmer or Provider.
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Try to find farmer
    let user = await Farmer.findOne({ email }).select('+password');
    let role = 'farmer';

    // 2. If not farmer, try provider
    if (!user) {
      user = await Provider.findOne({ email }).select('+password');
      role = 'provider';
    }

    if (!user) {
      res.status(401);
      throw new Error('Invalid email or password');
    }

    // 3. Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401);
      throw new Error('Invalid email or password');
    }

    // Generate token
    const token = generateToken(user._id, role, user.email);

    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json({
      success: true,
      token,
      role,
      data: userResponse
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login
};
