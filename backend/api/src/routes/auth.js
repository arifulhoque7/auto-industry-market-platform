const express = require('express');
const { body, validationResult } = require('express-validator');
const passport = require('passport');
const User = require('../models/User');
const { generateTokens, refreshAccessToken } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Validation middleware
const validateRegister = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('name').notEmpty().trim(),
  body('role').isIn(['car_owner', 'repair_shop', 'vendor']),
  body('businessName').if(body('role').isIn(['repair_shop', 'vendor'])).notEmpty(),
  body('businessLicense').if(body('role').isIn(['repair_shop', 'vendor'])).notEmpty()
];

const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
];

// Register
router.post('/register', validateRegister, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name, role, phone, address, businessName, businessLicense } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const user = new User({
      email,
      password,
      name,
      role,
      phone,
      address,
      businessName,
      businessLicense
    });

    await user.save();

    const tokens = generateTokens(user._id, user.role);
    user.refreshToken = tokens.refreshToken;
    await user.save();

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      ...tokens
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', validateLogin, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is inactive' });
    }

    const tokens = generateTokens(user._id, user.role);
    user.refreshToken = tokens.refreshToken;
    await user.save();

    res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      ...tokens
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Refresh token
router.post('/refresh', refreshAccessToken);

// Logout
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      const user = await User.findOne({ refreshToken });
      if (user) {
        user.refreshToken = null;
        await user.save();
      }
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Google OAuth
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    const tokens = generateTokens(req.user._id, req.user.role);
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${tokens.accessToken}&refresh=${tokens.refreshToken}`);
  }
);

module.exports = router;