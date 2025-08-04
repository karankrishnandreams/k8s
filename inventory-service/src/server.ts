import { app, connectToDatabase } from './app';
import logger from './utils/logger';

const PORT = process.env.INVENTORY_SERVICE_PORT || 6006;

(async () => {
  try {
    await connectToDatabase();
    logger.info('Connected to Inventory service database');

    app.listen(PORT, () => {
      logger.info(`Inventory Service is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start Inventory Service:', error);
    process.exit(1);
  }
})();
