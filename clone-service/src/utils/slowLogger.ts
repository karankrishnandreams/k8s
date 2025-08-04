// utils/slowLogger.ts
import winston from 'winston';
import 'winston-daily-rotate-file';

const { combine, timestamp, printf } = winston.format;

const slowLogFormat = printf(({ timestamp, level, message, ...meta }) => {
  return `${timestamp} ${level}: ${message} ${JSON.stringify(meta)}`;
});

const slowLogger = winston.createLogger({
  level: 'warn',
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), slowLogFormat),
  transports: [
    new winston.transports.DailyRotateFile({
      filename: 'logs/slow-api-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: false,
      maxSize: '10m',
      maxFiles: '7d',
    }),
  ],
});

export default slowLogger;
