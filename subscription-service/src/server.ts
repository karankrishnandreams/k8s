import { app, connectToDatabase, initializeAgenda } from './app';
import logger from './utils/logger';

const PORT = process.env.SUBSCRIPTION_SERVICE_PORT || 6003;

(async () => {
  try {
    await connectToDatabase();
    logger.info('Connected to Subscription Service database');

    await initializeAgenda();
    logger.info('Connected to Agenda');

    app.listen(PORT, () => {
      logger.info(`Subscription Service is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start User Service:', error);
    process.exit(1);
  }
})();
