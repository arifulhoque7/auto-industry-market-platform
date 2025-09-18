const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../db/postgres');
const ServiceRequest = require('../models/ServiceRequest');
const { authorizeRole } = require('../middleware/auth');
const { publishMessage } = require('../services/rabbitmq');
const logger = require('../utils/logger');

const router = express.Router();

// Validation middleware
const validateQuote = [
  body('requestId').notEmpty(),
  body('laborCost').isFloat({ min: 0 }),
  body('partsCost').isFloat({ min: 0 }),
  body('estimatedHours').isInt({ min: 1 })
];

// Get quotes for a request
router.get('/request/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;

    const result = await pool.query(
      'SELECT * FROM quotes WHERE request_id = $1 ORDER BY created_at DESC',
      [requestId]
    );

    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching quotes:', error);
    res.status(500).json({ error: 'Failed to fetch quotes' });
  }
});

// Get quotes by shop
router.get('/shop/:shopId', authorizeRole('repair_shop'), async (req, res) => {
  try {
    const { shopId } = req.params;

    if (req.user._id.toString() !== shopId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      'SELECT * FROM quotes WHERE shop_id = $1 ORDER BY created_at DESC',
      [shopId]
    );

    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching shop quotes:', error);
    res.status(500).json({ error: 'Failed to fetch quotes' });
  }
});

// Create a quote (repair shops only)
router.post('/', authorizeRole('repair_shop'), validateQuote, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { requestId, laborCost, partsCost, estimatedHours, description } = req.body;

    // Check if request exists
    const request = await ServiceRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ error: 'Service request not found' });
    }

    const totalCost = parseFloat(laborCost) + parseFloat(partsCost);

    // Insert quote into PostgreSQL
    const result = await pool.query(
      `INSERT INTO quotes (request_id, shop_id, shop_name, labor_cost, parts_cost, total_cost, estimated_hours, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        requestId,
        req.user._id.toString(),
        req.user.businessName || req.user.name,
        laborCost,
        partsCost,
        totalCost,
        estimatedHours,
        description
      ]
    );

    const quote = result.rows[0];

    // Update request in MongoDB
    request.quotes.push({
      quoteId: quote.id.toString(),
      shopId: req.user._id.toString(),
      shopName: req.user.businessName || req.user.name,
      totalCost,
      estimatedHours
    });

    if (request.status === 'open') {
      request.status = 'quoted';
    }

    await request.save();

    // Publish to RabbitMQ
    await publishMessage('quotes', 'new_quote', {
      quoteId: quote.id,
      requestId,
      shopId: req.user._id.toString(),
      ownerId: request.ownerId,
      totalCost
    });

    res.status(201).json({
      message: 'Quote created successfully',
      quote
    });
  } catch (error) {
    logger.error('Error creating quote:', error);
    res.status(500).json({ error: 'Failed to create quote' });
  }
});

// Update quote
router.put('/:id', authorizeRole('repair_shop'), async (req, res) => {
  try {
    const { id } = req.params;
    const { laborCost, partsCost, estimatedHours, description } = req.body;

    // Check ownership
    const checkResult = await pool.query(
      'SELECT shop_id FROM quotes WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    if (checkResult.rows[0].shop_id !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const totalCost = parseFloat(laborCost) + parseFloat(partsCost);

    const result = await pool.query(
      `UPDATE quotes SET labor_cost = $1, parts_cost = $2, total_cost = $3,
       estimated_hours = $4, description = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 RETURNING *`,
      [laborCost, partsCost, totalCost, estimatedHours, description, id]
    );

    res.json({
      message: 'Quote updated successfully',
      quote: result.rows[0]
    });
  } catch (error) {
    logger.error('Error updating quote:', error);
    res.status(500).json({ error: 'Failed to update quote' });
  }
});

// Analytics endpoint
router.get('/analytics', async (req, res) => {
  try {
    const { make, model, serviceType } = req.query;
    let query = `
      SELECT
        AVG(total_cost) as avg_cost,
        MIN(total_cost) as min_cost,
        MAX(total_cost) as max_cost,
        AVG(estimated_hours) as avg_hours,
        COUNT(*) as total_quotes
      FROM quotes q
      JOIN service_requests sr ON q.request_id = sr._id::text
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (make) {
      query += ` AND sr.car_details->>'make' ILIKE $${paramIndex}`;
      params.push(`%${make}%`);
      paramIndex++;
    }

    if (model) {
      query += ` AND sr.car_details->>'model' ILIKE $${paramIndex}`;
      params.push(`%${model}%`);
      paramIndex++;
    }

    if (serviceType) {
      query += ` AND sr.service_type ILIKE $${paramIndex}`;
      params.push(`%${serviceType}%`);
    }

    const result = await pool.query(query, params);

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;