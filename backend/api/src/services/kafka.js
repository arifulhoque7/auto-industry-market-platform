const { Kafka } = require('kafkajs');
const logger = require('../utils/logger');

class KafkaService {
  constructor() {
    this.kafka = new Kafka({
      clientId: 'marketplace-api',
      brokers: [process.env.KAFKA_BROKERS || 'localhost:9092'],
    });

    this.producer = this.kafka.producer();
    this.consumer = this.kafka.consumer({ groupId: 'marketplace-group' });
    this.connected = false;
  }

  async connect() {
    try {
      await this.producer.connect();
      await this.consumer.connect();
      this.connected = true;
      logger.info('Connected to Kafka');

      // Subscribe to topics
      await this.consumer.subscribe({ topic: 'inventory-updates', fromBeginning: false });
      await this.consumer.subscribe({ topic: 'service-requests', fromBeginning: false });
      await this.consumer.subscribe({ topic: 'quotes', fromBeginning: false });

      // Start consuming
      this.startConsumer();
    } catch (error) {
      logger.error('Kafka connection error:', error);
      // Fallback to RabbitMQ if Kafka is not available
      this.connected = false;
    }
  }

  async startConsumer() {
    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const messageValue = JSON.parse(message.value.toString());
        logger.info(`Received message from ${topic}:`, messageValue);

        switch (topic) {
          case 'inventory-updates':
            this.handleInventoryUpdate(messageValue);
            break;
          case 'service-requests':
            this.handleServiceRequest(messageValue);
            break;
          case 'quotes':
            this.handleQuote(messageValue);
            break;
        }
      },
    });
  }

  async publishInventoryUpdate(data) {
    if (!this.connected) return false;

    try {
      await this.producer.send({
        topic: 'inventory-updates',
        messages: [
          {
            key: data.partId,
            value: JSON.stringify({
              ...data,
              timestamp: new Date().toISOString()
            }),
          },
        ],
      });
      logger.info('Inventory update published to Kafka');
      return true;
    } catch (error) {
      logger.error('Error publishing to Kafka:', error);
      return false;
    }
  }

  async publishServiceRequest(data) {
    if (!this.connected) return false;

    try {
      await this.producer.send({
        topic: 'service-requests',
        messages: [
          {
            key: data.requestId,
            value: JSON.stringify({
              ...data,
              timestamp: new Date().toISOString()
            }),
          },
        ],
      });
      logger.info('Service request published to Kafka');
      return true;
    } catch (error) {
      logger.error('Error publishing to Kafka:', error);
      return false;
    }
  }

  async publishQuote(data) {
    if (!this.connected) return false;

    try {
      await this.producer.send({
        topic: 'quotes',
        messages: [
          {
            key: data.quoteId,
            value: JSON.stringify({
              ...data,
              timestamp: new Date().toISOString()
            }),
          },
        ],
      });
      logger.info('Quote published to Kafka');
      return true;
    } catch (error) {
      logger.error('Error publishing to Kafka:', error);
      return false;
    }
  }

  handleInventoryUpdate(data) {
    // Emit via WebSocket for real-time updates
    const io = require('./websocket').getIO();
    if (io) {
      io.emit('inventory_update', data);
    }
  }

  handleServiceRequest(data) {
    const io = require('./websocket').getIO();
    if (io) {
      io.to(`user_${data.ownerId}`).emit('request_update', data);
      io.to('role_repair_shop').emit('new_request', data);
    }
  }

  handleQuote(data) {
    const io = require('./websocket').getIO();
    if (io) {
      io.to(`request_${data.requestId}`).emit('new_quote', data);
      io.to(`user_${data.ownerId}`).emit('new_quote', data);
    }
  }

  async disconnect() {
    if (this.connected) {
      await this.producer.disconnect();
      await this.consumer.disconnect();
      this.connected = false;
      logger.info('Disconnected from Kafka');
    }
  }
}

module.exports = new KafkaService();