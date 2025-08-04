import { app, connectToDatabase, initializeAgenda } from './app';
import logger from './utils/logger';

const PORT = process.env.USER_SERVICE_PORT || 6001;

(async () => {
  try {
    await connectToDatabase();
    logger.info('Connected to User Service database');

    await initializeAgenda();
    logger.info('Connected to Agenda');

    app.listen(PORT, () => {
      logger.info(`User Service is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start User Service:', error);
    process.exit(1);
  }
})();
