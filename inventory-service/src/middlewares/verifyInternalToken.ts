import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const verifyInternalToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: `Missing or invalid Authorization header from ${process.env.CLONESERVICE_NAME}`,
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.INTERNAL_JWT_SECRET as string);

    if (typeof decoded === 'object' && decoded.service !== 'api-gateway') {
      res
        .status(403)
        .json({ error: `Forbidden: Invalid service from ${process.env.CLONESERVICE_NAME}` });
      return;
    }

    (req as any).internalService = decoded;
    next();
  } catch (error) {
    res
      .status(401)
      .json({ error: `Invalid or expired token from ${process.env.CLONESERVICE_NAME}` });
    return;
  }
};
