import { app, connectToDatabase } from './app';
import logger from './utils/logger';

const PORT = process.env.APPLICATION_SERVICE_PORT || 6005;

(async () => {
  try {
    await connectToDatabase();
    logger.info('Connected to application Service database');

    app.listen(PORT, () => {
      logger.info(`application Service is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start application Service:', error);
    process.exit(1);
  }
})();
