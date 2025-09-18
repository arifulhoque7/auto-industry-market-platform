const { pool } = require('../db/postgres');
const { setCache, deleteCache } = require('../db/redis');
const { notifyInventoryUpdate } = require('./websocket');
const logger = require('../utils/logger');

const syncInventory = async (data) => {
  try {
    const { partId, action, ...updateData } = data;

    switch (action) {
      case 'create':
      case 'update':
        // Fetch updated part from PostgreSQL
        const result = await pool.query(
          'SELECT * FROM spare_parts WHERE id = $1',
          [partId]
        );

        if (result.rows.length > 0) {
          const part = result.rows[0];

          // Update Redis cache
          await setCache(`part:${partId}`, part, 600);

          // Invalidate list caches
          await deleteCache('parts:*');

          // Notify via WebSocket
          notifyInventoryUpdate({
            action,
            part
          });
        }
        break;

      case 'stock_update':
        // Update stock in PostgreSQL if needed
        const stockResult = await pool.query(
          'SELECT * FROM spare_parts WHERE id = $1',
          [partId]
        );

        if (stockResult.rows.length > 0) {
          const part = stockResult.rows[0];

          // Update cache
          await setCache(`part:${partId}`, part, 600);
          await deleteCache('parts:*');

          // Notify via WebSocket
          notifyInventoryUpdate({
            action: 'stock_update',
            partId,
            stock: part.stock
          });
        }
        break;

      case 'delete':
        // Remove from cache
        await deleteCache(`part:${partId}`);
        await deleteCache('parts:*');

        // Notify via WebSocket
        notifyInventoryUpdate({
          action: 'delete',
          partId
        });
        break;

      default:
        logger.warn(`Unknown inventory action: ${action}`);
    }
  } catch (error) {
    logger.error('Error syncing inventory:', error);
    throw error;
  }
};

module.exports = {
  syncInventory
};