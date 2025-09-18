const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'auto_marketplace',
  user: process.env.POSTGRES_USER || 'admin',
  password: process.env.POSTGRES_PASSWORD || 'password123',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const connectPostgres = async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    logger.info('PostgreSQL connected successfully');

    // Create tables if they don't exist
    await createTables();
  } catch (error) {
    logger.error('PostgreSQL connection error:', error);
    throw error;
  }
};

const createTables = async () => {
  const client = await pool.connect();

  try {
    // Quotes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS quotes (
        id SERIAL PRIMARY KEY,
        request_id VARCHAR(255) NOT NULL,
        shop_id VARCHAR(255) NOT NULL,
        shop_name VARCHAR(255) NOT NULL,
        labor_cost DECIMAL(10, 2) NOT NULL,
        parts_cost DECIMAL(10, 2) NOT NULL,
        total_cost DECIMAL(10, 2) NOT NULL,
        estimated_hours INTEGER NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Spare parts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS spare_parts (
        id SERIAL PRIMARY KEY,
        vendor_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        description TEXT,
        sku VARCHAR(100) UNIQUE,
        compatible_cars TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_quotes_request_id ON quotes(request_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_quotes_shop_id ON quotes(shop_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_spare_parts_vendor_id ON spare_parts(vendor_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_spare_parts_category ON spare_parts(category)');

    logger.info('PostgreSQL tables created successfully');
  } catch (error) {
    logger.error('Error creating tables:', error);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  connectPostgres
};