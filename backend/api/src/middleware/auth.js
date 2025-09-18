const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

const generateTokens = (userId, role) => {
  const accessToken = jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '15m' }
  );

  const refreshToken = jwt.sign(
    { userId, role },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
  );

  return { accessToken, refreshToken };
};

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        logger.error('Token verification failed:', err);
        return res.status(403).json({ error: 'Invalid or expired token' });
      }

      const user = await User.findById(decoded.userId).select('-password');
      if (!user || !user.isActive) {
        return res.status(403).json({ error: 'User not found or inactive' });
      }

      req.user = user;
      next();
    });
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

const authorizeRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid refresh token' });
      }

      const user = await User.findById(decoded.userId);
      if (!user || user.refreshToken !== refreshToken) {
        return res.status(403).json({ error: 'Invalid refresh token' });
      }

      const tokens = generateTokens(user._id, user.role);

      user.refreshToken = tokens.refreshToken;
      await user.save();

      res.json(tokens);
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
};

module.exports = {
  generateTokens,
  authenticateToken,
  authorizeRole,
  refreshAccessToken
};