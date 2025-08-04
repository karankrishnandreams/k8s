import { Request, Response } from 'express';
import moment from 'moment';

export const checkHealth = (req: Request, res: Response) => {
  res.status(200).json({
    status: 'OK',
    message: 'Service is up and running',
    timestamp: moment().toDate().toISOString(),
  });
};
