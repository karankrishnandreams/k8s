import { body } from 'express-validator';

export const validateLogin = [
  body('email')
    .notEmpty().withMessage('Email is required').bail()
    .isEmail().withMessage('Invalid email format').bail()
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required').bail()
    .isString().withMessage('Password must be a string').bail()
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

export const validateForgotPassword = [
  body('_id')
    .notEmpty().withMessage('User ID is required'),
  body('newPassword')
    .notEmpty().withMessage('New password is required').bail()
    .isString().withMessage('New password must be a string').bail()
    .isLength({ min: 6, max: 30 }).withMessage('New password must be between 6 and 30 characters'),

  body('confirmPassword')
    .notEmpty().withMessage('Confirm password is required').bail()
    .isString().withMessage('Confirm password must be a string').bail()
    .isLength({ min: 6, max: 30 }).withMessage('Confirm password must be between 6 and 30 characters')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
];

export const validateScanLogin = [
  body('email')
    .notEmpty().withMessage('Email is required').bail()
    .isEmail().withMessage('Invalid email format').bail()
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required').bail()
    .isString().withMessage('Password must be a string').bail()
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),

  body('companyId')
    .notEmpty().withMessage('Company ID is required').bail()
    .isLength({ min: 1 }).withMessage('Company ID must be at least 1 character'),
];