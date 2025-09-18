const express = require('express');
const { body, validationResult } = require('express-validator');
const ServiceRequest = require('../models/ServiceRequest');
const { authorizeRole } = require('../middleware/auth');
const { publishMessage } = require('../services/rabbitmq');
const logger = require('../utils/logger');

const router = express.Router();

// Validation middleware
const validateRequest = [
  body('carDetails').isObject(),
  body('carDetails.make').notEmpty().withMessage('Car make is required'),
  body('carDetails.model').notEmpty().withMessage('Car model is required'),
  body('carDetails.year').isInt({ min: 1900, max: new Date().getFullYear() + 1 }).withMessage('Valid year is required'),
  body('serviceType').notEmpty().withMessage('Service type is required'),
  body('description').notEmpty().isLength({ min: 10 }).withMessage('Description must be at least 10 characters')
];

// Get all requests (with filters)
router.get('/', async (req, res) => {
  try {
    const { status, urgency, make, model, page = 1, limit = 10 } = req.query;
    const query = {};

    // Build query based on user role
    if (req.user.role === 'car_owner') {
      query.ownerId = req.user._id.toString();
    }

    if (status) query.status = status;
    if (urgency) query.urgency = urgency;
    if (make) query['carDetails.make'] = new RegExp(make, 'i');
    if (model) query['carDetails.model'] = new RegExp(model, 'i');

    const skip = (page - 1) * limit;

    const requests = await ServiceRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ServiceRequest.countDocuments(query);

    res.json({
      requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching requests:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Get single request
router.get('/:id', async (req, res) => {
  try {
    const request = await ServiceRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Check authorization
    if (req.user.role === 'car_owner' && request.ownerId !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Increment view count
    request.metadata.viewCount++;
    request.metadata.lastViewedAt = new Date();
    await request.save();

    res.json(request);
  } catch (error) {
    logger.error('Error fetching request:', error);
    res.status(500).json({ error: 'Failed to fetch request' });
  }
});

// Create new request (car owners only)
router.post('/', authorizeRole('car_owner'), validateRequest, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const requestData = {
      ...req.body,
      ownerId: req.user._id.toString(),
      ownerName: req.user.name
    };

    const serviceRequest = new ServiceRequest(requestData);
    await serviceRequest.save();

    // Publish to RabbitMQ
    await publishMessage('requests', '', {
      type: 'new_request',
      requestId: serviceRequest._id,
      ownerId: serviceRequest.ownerId,
      carDetails: serviceRequest.carDetails,
      serviceType: serviceRequest.serviceType
    });

    res.status(201).json({
      message: 'Service request created successfully',
      request: serviceRequest
    });
  } catch (error) {
    logger.error('Error creating request:', error);
    res.status(500).json({ error: 'Failed to create request' });
  }
});

// Update request status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const request = await ServiceRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Check authorization
    if (req.user.role === 'car_owner' && request.ownerId !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    request.status = status;
    await request.save();

    res.json({
      message: 'Request status updated',
      request
    });
  } catch (error) {
    logger.error('Error updating request status:', error);
    res.status(500).json({ error: 'Failed to update request' });
  }
});

// Accept a quote
router.post('/:id/accept-quote', authorizeRole('car_owner'), async (req, res) => {
  try {
    const { quoteId } = req.body;
    const request = await ServiceRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.ownerId !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const quote = request.quotes.find(q => q.quoteId === quoteId);
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    request.acceptedQuote = {
      ...quote.toObject(),
      acceptedAt: new Date()
    };
    request.status = 'accepted';
    await request.save();

    // Notify via RabbitMQ
    await publishMessage('quotes', 'quote_accepted', {
      requestId: request._id,
      quoteId,
      shopId: quote.shopId
    });

    res.json({
      message: 'Quote accepted successfully',
      request
    });
  } catch (error) {
    logger.error('Error accepting quote:', error);
    res.status(500).json({ error: 'Failed to accept quote' });
  }
});

module.exports = router;