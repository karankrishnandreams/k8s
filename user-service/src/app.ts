import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import routes from './routes';
import errorHandler from './middlewares/errorHandler';
import { connectToDatabase } from './config/database';
import logger from './utils/logger';
import { defineSubscriptionReminderJob } from "./jobs/subscriptionReminder";
import { agenda } from "@utils/agenda";
import { defineEventReminderJob } from "./jobs/calendarReminder";
import path from "path";


// if (process.env.NODE_ENV === 'production') {
//   // eslint-disable-next-line @typescript-eslint/no-var-requires
//   require('module-alias/register');
// }

const app = express();

// ======= Configurations =======
app.use(helmet());

if (process.env.NODE_ENV === 'production') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
  });
  app.use(limiter);
}

app.use(
  morgan('combined', {
    stream: {
      write: (message: any) => logger.info(message.trim()),
    },
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// ✅ Serve static files (uploaded files)
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.disable("x-powered-by");

export const initializeAgenda = async () => {
  defineSubscriptionReminderJob();
  defineEventReminderJob();
  await agenda.start();
};

// ======= Routes =======
app.use("/", routes);

// ======= Error Handler =======
app.use(errorHandler);

// ======= Export App and DB Connector =======
export { app, connectToDatabase };
