import { app, connectToDatabase } from './app';
import logger from './utils/logger';

const PORT = process.env.PEOPLE_SERVICE_PORT || 6004;

(async () => {
  try {
    await connectToDatabase();
    logger.info('Connected to people Service database');

    app.listen(PORT, () => {
      logger.info(`people Service is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start people Service:', error);
    process.exit(1);
  }
})();
