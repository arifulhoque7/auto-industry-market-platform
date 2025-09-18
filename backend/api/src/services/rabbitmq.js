const amqp = require('amqplib');
const logger = require('../utils/logger');

let connection;
let channel;

const connectRabbitMQ = async () => {
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    channel = await connection.createChannel();

    // Create exchanges and queues
    await channel.assertExchange('inventory', 'topic', { durable: true });
    await channel.assertExchange('quotes', 'direct', { durable: true });
    await channel.assertExchange('requests', 'fanout', { durable: true });

    // Create queues
    await channel.assertQueue('inventory_updates', { durable: true });
    await channel.assertQueue('quote_notifications', { durable: true });
    await channel.assertQueue('request_notifications', { durable: true });

    // Bind queues to exchanges
    await channel.bindQueue('inventory_updates', 'inventory', 'parts.*');
    await channel.bindQueue('quote_notifications', 'quotes', 'new_quote');
    await channel.bindQueue('request_notifications', 'requests', '');

    logger.info('RabbitMQ connected and configured');

    // Start consuming messages
    consumeInventoryUpdates();
    consumeQuoteNotifications();

  } catch (error) {
    logger.error('RabbitMQ connection error:', error);
    setTimeout(connectRabbitMQ, 5000);
  }
};

const publishMessage = async (exchange, routingKey, message) => {
  try {
    if (!channel) {
      throw new Error('RabbitMQ channel not initialized');
    }

    channel.publish(
      exchange,
      routingKey,
      Buffer.from(JSON.stringify(message)),
      { persistent: true }
    );

    logger.info(`Message published to ${exchange} with routing key ${routingKey}`);
  } catch (error) {
    logger.error('Error publishing message:', error);
  }
};

const consumeInventoryUpdates = () => {
  channel.consume('inventory_updates', async (msg) => {
    if (msg) {
      try {
        const data = JSON.parse(msg.content.toString());
        logger.info('Inventory update received:', data);

        // Sync with PostgreSQL and Redis
        const { syncInventory } = require('./inventory');
        await syncInventory(data);

        channel.ack(msg);
      } catch (error) {
        logger.error('Error processing inventory update:', error);
        channel.nack(msg, false, false);
      }
    }
  });
};

const consumeQuoteNotifications = () => {
  channel.consume('quote_notifications', async (msg) => {
    if (msg) {
      try {
        const data = JSON.parse(msg.content.toString());
        logger.info('Quote notification received:', data);

        // Send WebSocket notification
        const { notifyQuote } = require('./websocket');
        notifyQuote(data);

        channel.ack(msg);
      } catch (error) {
        logger.error('Error processing quote notification:', error);
        channel.nack(msg, false, false);
      }
    }
  });
};

module.exports = {
  connectRabbitMQ,
  publishMessage,
  getChannel: () => channel
};