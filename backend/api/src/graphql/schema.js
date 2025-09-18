const { gql } = require('apollo-server-express');
const ServiceRequest = require('../models/ServiceRequest');
const { pool } = require('../db/postgres');
const logger = require('../utils/logger');

const typeDefs = gql`
  type User {
    id: ID!
    email: String!
    name: String!
    role: String!
    businessName: String
  }

  type CarDetails {
    make: String!
    model: String!
    year: Int!
    vin: String
    mileage: Int
  }

  type Location {
    city: String
    state: String
    zipCode: String
  }

  type Quote {
    id: ID!
    requestId: String!
    shopId: String!
    shopName: String!
    laborCost: Float!
    partsCost: Float!
    totalCost: Float!
    estimatedHours: Int!
    description: String
    status: String!
    createdAt: String!
  }

  type QuoteReference {
    quoteId: String!
    shopId: String!
    shopName: String!
    totalCost: Float!
    estimatedHours: Int!
    createdAt: String!
  }

  type ServiceRequest {
    id: ID!
    ownerId: String!
    ownerName: String!
    carDetails: CarDetails!
    serviceType: String!
    description: String!
    urgency: String!
    location: Location
    preferredDate: String
    status: String!
    quotes: [QuoteReference]
    createdAt: String!
    updatedAt: String!
  }

  type QuoteAnalytics {
    avgCost: Float
    minCost: Float
    maxCost: Float
    avgHours: Float
    totalQuotes: Int
  }

  type Query {
    # Service Requests
    serviceRequests(
      status: String
      urgency: String
      make: String
      model: String
      page: Int
      limit: Int
    ): [ServiceRequest]

    serviceRequest(id: ID!): ServiceRequest

    # Quotes
    quotesForRequest(requestId: ID!): [Quote]
    quotesByShop(shopId: ID!): [Quote]
    quote(id: ID!): Quote

    # Analytics
    quoteAnalytics(
      make: String
      model: String
      serviceType: String
    ): QuoteAnalytics
  }

  type Mutation {
    # Service Requests
    createServiceRequest(
      carDetails: CarDetailsInput!
      serviceType: String!
      description: String!
      urgency: String
      location: LocationInput
      preferredDate: String
    ): ServiceRequest

    updateRequestStatus(
      requestId: ID!
      status: String!
    ): ServiceRequest

    # Quotes
    createQuote(
      requestId: ID!
      laborCost: Float!
      partsCost: Float!
      estimatedHours: Int!
      description: String
    ): Quote

    acceptQuote(
      requestId: ID!
      quoteId: ID!
    ): ServiceRequest
  }

  input CarDetailsInput {
    make: String!
    model: String!
    year: Int!
    vin: String
    mileage: Int
  }

  input LocationInput {
    city: String
    state: String
    zipCode: String
  }
`;

const resolvers = {
  Query: {
    serviceRequests: async (_, args, context) => {
      try {
        const { status, urgency, make, model, page = 1, limit = 10 } = args;
        const query = {};

        if (context.user && context.user.role === 'car_owner') {
          query.ownerId = context.user._id.toString();
        }

        if (status) query.status = status;
        if (urgency) query.urgency = urgency;
        if (make) query['carDetails.make'] = new RegExp(make, 'i');
        if (model) query['carDetails.model'] = new RegExp(model, 'i');

        const skip = (page - 1) * limit;

        const requests = await ServiceRequest.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit);

        return requests;
      } catch (error) {
        logger.error('Error fetching service requests:', error);
        throw new Error('Failed to fetch service requests');
      }
    },

    serviceRequest: async (_, { id }) => {
      try {
        const request = await ServiceRequest.findById(id);
        if (!request) {
          throw new Error('Service request not found');
        }
        return request;
      } catch (error) {
        logger.error('Error fetching service request:', error);
        throw new Error('Failed to fetch service request');
      }
    },

    quotesForRequest: async (_, { requestId }) => {
      try {
        const result = await pool.query(
          'SELECT * FROM quotes WHERE request_id = $1 ORDER BY created_at DESC',
          [requestId]
        );
        return result.rows;
      } catch (error) {
        logger.error('Error fetching quotes:', error);
        throw new Error('Failed to fetch quotes');
      }
    },

    quotesByShop: async (_, { shopId }, context) => {
      try {
        if (!context.user || context.user._id.toString() !== shopId) {
          throw new Error('Unauthorized');
        }

        const result = await pool.query(
          'SELECT * FROM quotes WHERE shop_id = $1 ORDER BY created_at DESC',
          [shopId]
        );
        return result.rows;
      } catch (error) {
        logger.error('Error fetching shop quotes:', error);
        throw new Error('Failed to fetch quotes');
      }
    },

    quote: async (_, { id }) => {
      try {
        const result = await pool.query('SELECT * FROM quotes WHERE id = $1', [id]);
        if (result.rows.length === 0) {
          throw new Error('Quote not found');
        }
        return result.rows[0];
      } catch (error) {
        logger.error('Error fetching quote:', error);
        throw new Error('Failed to fetch quote');
      }
    },

    quoteAnalytics: async (_, { make, model, serviceType }) => {
      try {
        let query = `
          SELECT
            AVG(total_cost) as avg_cost,
            MIN(total_cost) as min_cost,
            MAX(total_cost) as max_cost,
            AVG(estimated_hours) as avg_hours,
            COUNT(*) as total_quotes
          FROM quotes
          WHERE 1=1
        `;

        const params = [];

        // Note: For full implementation, would need to join with service_requests
        // This is simplified for the demo

        const result = await pool.query(query, params);
        const data = result.rows[0];

        return {
          avgCost: data.avg_cost,
          minCost: data.min_cost,
          maxCost: data.max_cost,
          avgHours: data.avg_hours,
          totalQuotes: parseInt(data.total_quotes)
        };
      } catch (error) {
        logger.error('Error fetching analytics:', error);
        throw new Error('Failed to fetch analytics');
      }
    }
  },

  Mutation: {
    createServiceRequest: async (_, args, context) => {
      try {
        if (!context.user || context.user.role !== 'car_owner') {
          throw new Error('Unauthorized');
        }

        const requestData = {
          ...args,
          ownerId: context.user._id.toString(),
          ownerName: context.user.name
        };

        const serviceRequest = new ServiceRequest(requestData);
        await serviceRequest.save();

        return serviceRequest;
      } catch (error) {
        logger.error('Error creating service request:', error);
        throw new Error('Failed to create service request');
      }
    },

    updateRequestStatus: async (_, { requestId, status }, context) => {
      try {
        const request = await ServiceRequest.findById(requestId);

        if (!request) {
          throw new Error('Service request not found');
        }

        if (context.user._id.toString() !== request.ownerId) {
          throw new Error('Unauthorized');
        }

        request.status = status;
        await request.save();

        return request;
      } catch (error) {
        logger.error('Error updating request status:', error);
        throw new Error('Failed to update request status');
      }
    },

    createQuote: async (_, args, context) => {
      try {
        if (!context.user || context.user.role !== 'repair_shop') {
          throw new Error('Unauthorized');
        }

        const { requestId, laborCost, partsCost, estimatedHours, description } = args;

        const request = await ServiceRequest.findById(requestId);
        if (!request) {
          throw new Error('Service request not found');
        }

        const totalCost = laborCost + partsCost;

        const result = await pool.query(
          `INSERT INTO quotes (request_id, shop_id, shop_name, labor_cost, parts_cost, total_cost, estimated_hours, description)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
          [
            requestId,
            context.user._id.toString(),
            context.user.businessName || context.user.name,
            laborCost,
            partsCost,
            totalCost,
            estimatedHours,
            description
          ]
        );

        const quote = result.rows[0];

        // Update request
        request.quotes.push({
          quoteId: quote.id.toString(),
          shopId: context.user._id.toString(),
          shopName: context.user.businessName || context.user.name,
          totalCost,
          estimatedHours
        });

        if (request.status === 'open') {
          request.status = 'quoted';
        }

        await request.save();

        return quote;
      } catch (error) {
        logger.error('Error creating quote:', error);
        throw new Error('Failed to create quote');
      }
    },

    acceptQuote: async (_, { requestId, quoteId }, context) => {
      try {
        if (!context.user || context.user.role !== 'car_owner') {
          throw new Error('Unauthorized');
        }

        const request = await ServiceRequest.findById(requestId);

        if (!request) {
          throw new Error('Service request not found');
        }

        if (request.ownerId !== context.user._id.toString()) {
          throw new Error('Unauthorized');
        }

        const quote = request.quotes.find(q => q.quoteId === quoteId);
        if (!quote) {
          throw new Error('Quote not found');
        }

        request.acceptedQuote = {
          ...quote.toObject(),
          acceptedAt: new Date()
        };
        request.status = 'accepted';
        await request.save();

        return request;
      } catch (error) {
        logger.error('Error accepting quote:', error);
        throw new Error('Failed to accept quote');
      }
    }
  }
};

module.exports = { typeDefs, resolvers };