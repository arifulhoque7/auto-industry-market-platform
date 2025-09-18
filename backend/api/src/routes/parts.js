const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../db/postgres');
const { getCache, setCache, deleteCache } = require('../db/redis');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { publishMessage } = require('../services/rabbitmq');
const logger = require('../utils/logger');

const router = express.Router();

// Validation middleware
const validatePart = [
  body('name').notEmpty().trim(),
  body('category').notEmpty(),
  body('price').isFloat({ min: 0 }),
  body('stock').isInt({ min: 0 })
];

// Get all parts (public)
router.get('/', async (req, res) => {
  try {
    const { category, search, minPrice, maxPrice, inStock, page = 1, limit = 20 } = req.query;
    const cacheKey = `parts:${JSON.stringify(req.query)}`;

    // Check cache first
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    let query = 'SELECT * FROM spare_parts WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (search) {
      query += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (minPrice) {
      query += ` AND price >= $${paramIndex}`;
      params.push(minPrice);
      paramIndex++;
    }

    if (maxPrice) {
      query += ` AND price <= $${paramIndex}`;
      params.push(maxPrice);
      paramIndex++;
    }

    if (inStock === 'true') {
      query += ' AND stock > 0';
    }

    // Add pagination
    const offset = (page - 1) * limit;
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM spare_parts WHERE 1=1';
    const countParams = params.slice(0, -2); // Remove limit and offset
    const countResult = await pool.query(countQuery, countParams);

    const response = {
      parts: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(countResult.rows[0].count / limit)
      }
    };

    // Cache for 5 minutes
    await setCache(cacheKey, response, 300);

    res.json(response);
  } catch (error) {
    logger.error('Error fetching parts:', error);
    res.status(500).json({ error: 'Failed to fetch parts' });
  }
});

// Get single part
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `part:${id}`;

    // Check cache
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const result = await pool.query('SELECT * FROM spare_parts WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Part not found' });
    }

    const part = result.rows[0];

    // Cache for 10 minutes
    await setCache(cacheKey, part, 600);

    res.json(part);
  } catch (error) {
    logger.error('Error fetching part:', error);
    res.status(500).json({ error: 'Failed to fetch part' });
  }
});

// Add new part (vendors only)
router.post('/', authenticateToken, authorizeRole('vendor'), validatePart, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, category, price, stock, description, sku, compatibleCars } = req.body;

    const result = await pool.query(
      `INSERT INTO spare_parts (vendor_id, name, category, price, stock, description, sku, compatible_cars)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        req.user._id.toString(),
        name,
        category,
        price,
        stock,
        description,
        sku,
        compatibleCars || []
      ]
    );

    const part = result.rows[0];

    // Cache the new part
    await setCache(`part:${part.id}`, part, 600);

    // Invalidate list cache
    await deleteCache('parts:*');

    // Publish to RabbitMQ
    await publishMessage('inventory', 'parts.created', {
      partId: part.id,
      vendorId: req.user._id.toString(),
      name,
      category,
      stock
    });

    res.status(201).json({
      message: 'Part added successfully',
      part
    });
  } catch (error) {
    logger.error('Error adding part:', error);
    res.status(500).json({ error: 'Failed to add part' });
  }
});

// Update part stock
router.patch('/:id/stock', authenticateToken, authorizeRole('vendor'), async (req, res) => {
  try {
    const { id } = req.params;
    const { stock, operation = 'set' } = req.body;

    // Check ownership
    const checkResult = await pool.query(
      'SELECT vendor_id, stock as current_stock FROM spare_parts WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Part not found' });
    }

    if (checkResult.rows[0].vendor_id !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    let newStock = stock;
    if (operation === 'increment') {
      newStock = checkResult.rows[0].current_stock + stock;
    } else if (operation === 'decrement') {
      newStock = Math.max(0, checkResult.rows[0].current_stock - stock);
    }

    const result = await pool.query(
      'UPDATE spare_parts SET stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [newStock, id]
    );

    const part = result.rows[0];

    // Update cache
    await setCache(`part:${part.id}`, part, 600);
    await deleteCache('parts:*');

    // Publish to RabbitMQ
    await publishMessage('inventory', 'parts.stock_updated', {
      partId: part.id,
      vendorId: req.user._id.toString(),
      oldStock: checkResult.rows[0].current_stock,
      newStock
    });

    res.json({
      message: 'Stock updated successfully',
      part
    });
  } catch (error) {
    logger.error('Error updating stock:', error);
    res.status(500).json({ error: 'Failed to update stock' });
  }
});

// Update part details
router.put('/:id', authenticateToken, authorizeRole('vendor'), validatePart, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, price, stock, description, sku, compatibleCars } = req.body;

    // Check ownership
    const checkResult = await pool.query(
      'SELECT vendor_id FROM spare_parts WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Part not found' });
    }

    if (checkResult.rows[0].vendor_id !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      `UPDATE spare_parts SET name = $1, category = $2, price = $3, stock = $4,
       description = $5, sku = $6, compatible_cars = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 RETURNING *`,
      [name, category, price, stock, description, sku, compatibleCars || [], id]
    );

    const part = result.rows[0];

    // Update cache
    await setCache(`part:${part.id}`, part, 600);
    await deleteCache('parts:*');

    // Publish to RabbitMQ
    await publishMessage('inventory', 'parts.updated', {
      partId: part.id,
      vendorId: req.user._id.toString()
    });

    res.json({
      message: 'Part updated successfully',
      part
    });
  } catch (error) {
    logger.error('Error updating part:', error);
    res.status(500).json({ error: 'Failed to update part' });
  }
});

module.exports = router;