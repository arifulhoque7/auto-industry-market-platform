const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Auto Industry Marketplace API',
      version: '1.0.0',
      description: 'API documentation for the Auto Industry Marketplace platform',
      contact: {
        name: 'API Support',
        email: 'support@automarketplace.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server'
      },
      {
        url: 'https://api.automarketplace.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            role: {
              type: 'string',
              enum: ['car_owner', 'repair_shop', 'vendor']
            },
            businessName: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        ServiceRequest: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            ownerId: { type: 'string' },
            ownerName: { type: 'string' },
            carDetails: {
              type: 'object',
              properties: {
                make: { type: 'string' },
                model: { type: 'string' },
                year: { type: 'integer' },
                vin: { type: 'string' },
                mileage: { type: 'integer' }
              }
            },
            serviceType: { type: 'string' },
            description: { type: 'string' },
            urgency: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'emergency']
            },
            status: {
              type: 'string',
              enum: ['open', 'quoted', 'accepted', 'in_progress', 'completed', 'cancelled']
            },
            quotes: { type: 'array', items: { type: 'object' } },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Quote: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            requestId: { type: 'string' },
            shopId: { type: 'string' },
            shopName: { type: 'string' },
            laborCost: { type: 'number' },
            partsCost: { type: 'number' },
            totalCost: { type: 'number' },
            estimatedHours: { type: 'integer' },
            description: { type: 'string' },
            status: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        SparePart: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            vendorId: { type: 'string' },
            name: { type: 'string' },
            category: { type: 'string' },
            price: { type: 'number' },
            stock: { type: 'integer' },
            description: { type: 'string' },
            sku: { type: 'string' },
            compatibleCars: { type: 'array', items: { type: 'string' } },
            createdAt: { type: 'string', format: 'date-time' }
          }
        }
      }
    },
    security: [{
      bearerAuth: []
    }]
  },
  apis: ['./src/routes/*.js']
};

module.exports = swaggerJsdoc(options);