import { app, connectToDatabase } from './app';
import logger from './utils/logger';

const PORT = process.env.CALL_SERVICE_PORT || 5008;

(async () => {
  try {
    await connectToDatabase();
    logger.info('Connected to Call Service database');

    app.listen(PORT, () => {
      logger.info(`Call Service is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start User Service:', error);
    process.exit(1);
  }
})();
