import { body } from 'express-validator';

export const validateCreateRole = [
  body('role_name')
    .notEmpty().withMessage('Role name is required')
    .isString().withMessage('Role name must be a string')
    .isLength({ min: 2, max: 50 }).withMessage('Role name must be between 2 and 50 characters'),
];

export const validateUpdateRole = [
  body('role_name')
    .optional() // allow partial updates
    .isString().withMessage('Role name must be a string')
    .isLength({ min: 2, max: 50 }).withMessage('Role name must be between 2 and 50 characters'),
];
