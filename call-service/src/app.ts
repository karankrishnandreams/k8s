import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import routes from './routes';
import errorHandler from './middlewares/errorHandler';
import { connectToDatabase } from './config/database';
import logger from './utils/logger';

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
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.disable('x-powered-by');

// ======= Routes =======
app.use('/', routes);

// ======= Error Handler =======
app.use(errorHandler);

// ======= Export App and DB Connector =======
export { app, connectToDatabase };
