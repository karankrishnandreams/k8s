import { app, connectToDatabase } from './app';
import logger from './utils/logger';

const PORT = process.env.CHAT_SERVICE_PORT || 6007;

(async () => {
  try {
    await connectToDatabase();
    logger.info(`Connected to ${process.env.CHATSERVICE_NAME} database`);

    app.listen(PORT, () => {
      logger.info(`${process.env.CHATSERVICE_NAME} is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error(`Failed to start ${process.env.CHATSERVICE_NAME}:`, error);
    process.exit(1);
  }
})();
