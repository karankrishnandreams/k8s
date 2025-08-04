import { body, query } from 'express-validator';
import mongoose from 'mongoose';

export const validateCreateTax = [
  body('state')
    .notEmpty().withMessage('State is required')
    .custom((id) => mongoose.Types.ObjectId.isValid(id))
    .withMessage('State must be a valid ObjectId'),

  body('city')
    .notEmpty().withMessage('City is required')
    .custom((id) => mongoose.Types.ObjectId.isValid(id))
    .withMessage('City must be a valid ObjectId'),

  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name must be 100 characters or fewer'),

  body('tax')
    .notEmpty().withMessage('Tax value is required')
    .isFloat({ min: 0 }).withMessage('Tax must be a non-negative number'),

  body('country')
    .notEmpty().withMessage('Country is required')
    .custom((id) => mongoose.Types.ObjectId.isValid(id))
    .withMessage('Country must be a valid ObjectId'),

  body('taxAccount')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Tax Account must be 100 characters or fewer'),
];

export const validateUpdateTax = [
  body('taxAuthority')
    .optional()
    .trim()
    .notEmpty().withMessage('Tax Authority cannot be empty')
    .isLength({ max: 100 }).withMessage('Tax Authority must be 100 characters or fewer'),

  body('name')
    .optional()
    .trim()
    .notEmpty().withMessage('Name cannot be empty')
    .isLength({ max: 100 }).withMessage('Name must be 100 characters or fewer'),

  body('tax')
    .optional()
    .notEmpty().withMessage('Tax value cannot be empty')
    .isFloat({ min: 0 }).withMessage('Tax must be a non-negative number'),

  body('country')
    .notEmpty().withMessage('Country is required')
    .custom((id) => mongoose.Types.ObjectId.isValid(id))
    .withMessage('Country must be a valid ObjectId'),
  body('state')
    .notEmpty().withMessage('State is required')
    .custom((id) => mongoose.Types.ObjectId.isValid(id))
    .withMessage('State must be a valid ObjectId'),
    body('city')
    .notEmpty().withMessage('City is required')
    .custom((id) => mongoose.Types.ObjectId.isValid(id))
    .withMessage('City must be a valid ObjectId'),

  body('taxAccount')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Tax Account must be 100 characters or fewer'),
];
