import { app, connectToDatabase } from './app';
import logger from './utils/logger';

const PORT = process.env.USER_SERVICE_PORT || 6001;

(async () => {
  try {
    await connectToDatabase();
    logger.info('Connected to Clone Service database');

    app.listen(PORT, () => {
      logger.info(`Clone Service is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start User Service:', error);
    process.exit(1);
  }
})();
