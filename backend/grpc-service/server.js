const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const { Pool } = require('pg');
const Redis = require('ioredis');
const amqp = require('amqplib');
require('dotenv').config();

// Load proto file
const PROTO_PATH = path.join(__dirname, 'inventory.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const inventoryProto = grpc.loadPackageDefinition(packageDefinition).inventory;

// Database connections
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'auto_marketplace',
  user: process.env.POSTGRES_USER || 'admin',
  password: process.env.POSTGRES_PASSWORD || 'password123'
});

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379
});

let rabbitChannel;

// Connect to RabbitMQ
async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    rabbitChannel = await connection.createChannel();
    await rabbitChannel.assertExchange('inventory', 'topic', { durable: true });
    console.log('RabbitMQ connected');
  } catch (error) {
    console.error('RabbitMQ connection error:', error);
    setTimeout(connectRabbitMQ, 5000);
  }
}

// Service implementations
const getPart = async (call, callback) => {
  try {
    const { id } = call.request;

    // Check cache first
    const cached = await redis.get(`part:${id}`);
    if (cached) {
      return callback(null, JSON.parse(cached));
    }

    // Query database
    const result = await pool.query('SELECT * FROM spare_parts WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: 'Part not found'
      });
    }

    const part = result.rows[0];

    // Cache for 10 minutes
    await redis.setex(`part:${id}`, 600, JSON.stringify(part));

    callback(null, part);
  } catch (error) {
    console.error('Error getting part:', error);
    callback({
      code: grpc.status.INTERNAL,
      message: 'Failed to get part'
    });
  }
};

const listParts = async (call, callback) => {
  try {
    const { category, page = 1, limit = 20, in_stock } = call.request;

    let query = 'SELECT * FROM spare_parts WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (in_stock) {
      query += ' AND stock > 0';
    }

    const offset = (page - 1) * limit;
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM spare_parts WHERE 1=1';
    const countParams = params.slice(0, -2);
    const countResult = await pool.query(countQuery, countParams);

    callback(null, {
      parts: result.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      pages: Math.ceil(countResult.rows[0].count / limit)
    });
  } catch (error) {
    console.error('Error listing parts:', error);
    callback({
      code: grpc.status.INTERNAL,
      message: 'Failed to list parts'
    });
  }
};

const addPart = async (call, callback) => {
  try {
    const { vendor_id, name, category, price, stock, description, sku, compatible_cars } = call.request;

    const result = await pool.query(
      `INSERT INTO spare_parts (vendor_id, name, category, price, stock, description, sku, compatible_cars)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [vendor_id, name, category, price, stock, description, sku, compatible_cars || []]
    );

    const part = result.rows[0];

    // Cache the new part
    await redis.setex(`part:${part.id}`, 600, JSON.stringify(part));

    // Publish to RabbitMQ
    if (rabbitChannel) {
      rabbitChannel.publish('inventory', 'parts.created', Buffer.from(JSON.stringify({
        action: 'create',
        partId: part.id,
        vendorId: vendor_id,
        name,
        category,
        stock
      })));
    }

    callback(null, part);
  } catch (error) {
    console.error('Error adding part:', error);
    callback({
      code: grpc.status.INTERNAL,
      message: 'Failed to add part'
    });
  }
};

const updateStock = async (call, callback) => {
  try {
    const { id, stock, operation = 'set' } = call.request;

    // Get current stock
    const currentResult = await pool.query('SELECT stock FROM spare_parts WHERE id = $1', [id]);

    if (currentResult.rows.length === 0) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: 'Part not found'
      });
    }

    let newStock = stock;
    if (operation === 'increment') {
      newStock = currentResult.rows[0].stock + stock;
    } else if (operation === 'decrement') {
      newStock = Math.max(0, currentResult.rows[0].stock - stock);
    }

    const result = await pool.query(
      'UPDATE spare_parts SET stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [newStock, id]
    );

    const part = result.rows[0];

    // Update cache
    await redis.setex(`part:${id}`, 600, JSON.stringify(part));

    // Publish to RabbitMQ
    if (rabbitChannel) {
      rabbitChannel.publish('inventory', 'parts.stock_updated', Buffer.from(JSON.stringify({
        action: 'stock_update',
        partId: id,
        oldStock: currentResult.rows[0].stock,
        newStock
      })));
    }

    callback(null, part);
  } catch (error) {
    console.error('Error updating stock:', error);
    callback({
      code: grpc.status.INTERNAL,
      message: 'Failed to update stock'
    });
  }
};

const searchParts = async (call, callback) => {
  try {
    const { query: searchQuery, category, min_price, max_price, page = 1, limit = 20 } = call.request;

    let query = 'SELECT * FROM spare_parts WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (searchQuery) {
      query += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      params.push(`%${searchQuery}%`);
      paramIndex++;
    }

    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (min_price) {
      query += ` AND price >= $${paramIndex}`;
      params.push(min_price);
      paramIndex++;
    }

    if (max_price) {
      query += ` AND price <= $${paramIndex}`;
      params.push(max_price);
      paramIndex++;
    }

    const offset = (page - 1) * limit;
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM spare_parts WHERE 1=1';
    const countParams = params.slice(0, -2);
    const countResult = await pool.query(countQuery, countParams);

    callback(null, {
      parts: result.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      pages: Math.ceil(countResult.rows[0].count / limit)
    });
  } catch (error) {
    console.error('Error searching parts:', error);
    callback({
      code: grpc.status.INTERNAL,
      message: 'Failed to search parts'
    });
  }
};

const getRealTimeStock = async (call, callback) => {
  try {
    const { id } = call.request;

    // Get real-time stock from Redis (cached)
    const cached = await redis.get(`stock:realtime:${id}`);
    if (cached) {
      return callback(null, JSON.parse(cached));
    }

    // Fallback to database
    const result = await pool.query('SELECT id, stock FROM spare_parts WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: 'Part not found'
      });
    }

    const stockInfo = {
      id,
      current_stock: result.rows[0].stock,
      reserved_stock: 0, // Could be tracked separately
      available_stock: result.rows[0].stock,
      last_updated: new Date().toISOString()
    };

    // Cache for 1 minute
    await redis.setex(`stock:realtime:${id}`, 60, JSON.stringify(stockInfo));

    callback(null, stockInfo);
  } catch (error) {
    console.error('Error getting real-time stock:', error);
    callback({
      code: grpc.status.INTERNAL,
      message: 'Failed to get real-time stock'
    });
  }
};

// Start gRPC server
async function startServer() {
  await connectRabbitMQ();

  const server = new grpc.Server();

  server.addService(inventoryProto.InventoryService.service, {
    getPart,
    listParts,
    addPart,
    updateStock,
    searchParts,
    getRealTimeStock
  });

  const PORT = process.env.GRPC_SERVER_PORT || 50051;

  server.bindAsync(
    `0.0.0.0:${PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (error, port) => {
      if (error) {
        console.error('Failed to start gRPC server:', error);
        return;
      }
      console.log(`gRPC server running on port ${port}`);
    }
  );
}

startServer();