import { NextFunction, Request, Response } from 'express';
import createHttpError from 'http-errors';
import { Error as MongooseError } from 'mongoose';
import logger from '../utils/logger';

const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error(`Error: ${err.message}`);

  if (res.headersSent) {
    return next(err);
  }

  // Handle HTTP errors
  if (createHttpError.isHttpError(err)) {
    res.status(err.statusCode).json({
      error: {
        status: err.statusCode,
        message: err.message,
        details: err.details || {},
      },
    });
    return;
  }

  // // Handle Mongoose validation errors
  // if (err instanceof MongooseError.ValidationError) {
  //   const statusCode = 400;
  //   res.status(statusCode).json({
  //     error: {
  //       status: statusCode,
  //       message: 'Validation Error',
  //       details: err.message,
  //     },
  //   });
  //   return;
  // }


//  if (err instanceof MongooseError.ValidationError) {
//     const statusCode = 422;
//     res.status(statusCode).json({
//       error: {
//         status: statusCode,
//         message: 'Validation Error',
//         details: err.message,
//       },
//     });
//     return;
//   }


if (err instanceof MongooseError.ValidationError) {
  const statusCode = 422;

  // Combine all field errors into one message string
  const message = Object.values(err.errors)
    .map((e) => `${e.path}: ${e.message}`)
    .join('\n'); // or use `.join(', ')` if you prefer inline messages

  res.status(statusCode).json({
    error: {
      status: statusCode,
      message, // string with all validation messages
    },
  });
  return;
}

  // Handle Mongoose cast errors (400)
  if (err instanceof MongooseError.CastError) {
    const statusCode = 400;
    res.status(statusCode).json({
      error: {
        status: statusCode,
        message: 'Bad Request',
        details: err.message,
      },
    });
    return;
  }

  // Handle duplicate key errors
  if ((err as any).code === 11000) {
    const statusCode = 409;
    res.status(statusCode).json({
      error: {
        status: statusCode,
        message: 'Duplicate Key Error',
        details: 'A record with this value already exists',
      },
    });
    return;
  }

  // Default error handler
  const statusCode = 500;
 res.status(statusCode).json({
  error: {
    status: statusCode,
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === 'development' && { details: err.stack }),
  },
});
};

export default errorHandler;