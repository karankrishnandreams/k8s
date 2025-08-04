// src/middlewares/validate.ts
import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import createHttpError from 'http-errors';

/**
 * Wrap express‑validator chains in a middleware.
 *
 * @example
 * router.post(
 *   '/login',
 *   validate([
 *     body('email').isEmail().withMessage('Invalid email'),
 *     body('password').isLength({ min: 8 }).withMessage('Min 8 chars')
 *   ]),
 *   authController.login
 * );
 */
export const validate =
  (validations: ValidationChain[]) =>
    async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
      // 1. Run all validation chains in parallel
      await Promise.all(validations.map(v => v.run(req)));

      // 2. Collect the result
      const result = validationResult(req);
      if (result.isEmpty()) {
        return next();              // ✅ request is valid
      }

      // 3. Shape errors as key‑value pairs
      const details = result.array().reduce<Record<string, string>>((acc, err) => {
        const key = err.type === 'field' ? err.path : err.type;
        acc[key] = err.msg;
        return acc;
      }, {});

      // 4. Pass a 422 error to the global handler
      return next(
        createHttpError(422, {
          message: 'Validation Error',
          details,
        })
      );
    };
