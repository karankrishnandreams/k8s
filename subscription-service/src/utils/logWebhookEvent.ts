import fs from "fs";
import path from "path";

const LOG_FILE_PATH = path.join(__dirname, "webhook-events-log.json");

export const logWebhookEvent = async (eventType: string, payload: any) => {
  try {
    const logData = fs.existsSync(LOG_FILE_PATH)
      ? JSON.parse(fs.readFileSync(LOG_FILE_PATH, "utf-8"))
      : {};

    if (!logData[eventType]) {
      logData[eventType] = [];
    }

    logData[eventType].push({
      timestamp: new Date().toISOString(),
      payload,
    });

    fs.writeFileSync(LOG_FILE_PATH, JSON.stringify(logData, null, 2));
  } catch (err) {
    console.error("Failed to log webhook event:", err);
  }
};
