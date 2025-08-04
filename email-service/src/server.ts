import { app, connectToDatabase } from "./app";
import logger from "./utils/logger";

const PORT = process.env.EMAIL_SERVICE_PORT || 6002;

(async () => {
  try {
    await connectToDatabase();
    logger.info(`Connected to ${process.env.EMAILSERVICE_NAME} database`);

    app.listen(PORT, () => {
      logger.info(
        `${process.env.EMAILSERVICE_NAME} is running on port ${PORT}`
      );
    });
  } catch (error) {
    logger.error(`Failed to start ${process.env.EMAILSERVICE_NAME}:`, error);
    process.exit(1);
  }
})();
