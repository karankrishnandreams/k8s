import { body, query } from 'express-validator';
import mongoose from 'mongoose';

export const validateCreateCompany = [
  body('name')
    .optional()
    .isString().withMessage('Name must be a string')
    .trim()
    .isLength({ max: 100 }).withMessage('Name max length is 100'),

  body('email')
    .optional()
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),

  body('account_url')
    .optional()
    .isString().withMessage('Account URL must be a string')
    .isURL().withMessage('Account URL must be a valid URL'),

  body('phoneNumber')
    .optional()
    .isString().withMessage('Phone number must be a string')
    .trim()
    .isLength({ max: 20 }).withMessage('Phone number max length is 20'),

  body('website')
    .optional({ nullable: true })
    .isString().withMessage('Website must be a string')
    .isURL().withMessage('Website must be a valid URL'),

  body('password')
    .optional()
    .isString().withMessage('Password must be a string')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),

  body('address')
    .optional({ nullable: true })
    .isString().withMessage('Address must be a string'),

  body('planName')
    .optional()
    .custom((value: string | number | mongoose.mongo.BSON.ObjectId | mongoose.mongo.BSON.ObjectIdLike | Uint8Array<ArrayBufferLike>) => mongoose.Types.ObjectId.isValid(value))
    .withMessage('planName must be a valid ObjectId'),

  body('planType')
    .optional()
    .custom((value: string | number | mongoose.mongo.BSON.ObjectId | mongoose.mongo.BSON.ObjectIdLike | Uint8Array<ArrayBufferLike>) => mongoose.Types.ObjectId.isValid(value))
    .withMessage('planType must be a valid ObjectId'),

  body('status')
    .optional()
    .isIn(['Active', 'Inactive'])
    .withMessage('Status must be either Active or Inactive'),

  body('profileImage')
    .optional({ nullable: true })
    .isString().withMessage('profileImage must be a string URL')
    .isURL().withMessage('profileImage must be a valid URL'),
];

export const validateUpdateCompany = [
  body('name')
    .optional()
    .isString().withMessage('Name must be a string')
    .trim()
    .isLength({ max: 100 }).withMessage('Name max length is 100'),

  body('email')
    .optional()
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),

  body('account_url')
    .optional()
    .isString().withMessage('Account URL must be a string')
    .isURL().withMessage('Account URL must be a valid URL'),

  body('phoneNumber')
    .optional()
    .isString().withMessage('Phone number must be a string')
    .trim()
    .isLength({ max: 20 }).withMessage('Phone number max length is 20'),

  body('website')
    .optional({ nullable: true })
    .isString().withMessage('Website must be a string')
    .isURL().withMessage('Website must be a valid URL'),

  body('password')
    .optional()
    .isString().withMessage('Password must be a string')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),

  body('address')
    .optional({ nullable: true })
    .isString().withMessage('Address must be a string'),

  body('planName')
    .optional()
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage('planName must be a valid ObjectId'),

  body('planType')
    .optional()
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage('planType must be a valid ObjectId'),

  body('status')
    .optional()
    .isIn(['Active', 'Inactive'])
    .withMessage('Status must be either Active or Inactive'),

  body('profileImage')
    .optional({ nullable: true })
    .isString().withMessage('profileImage must be a string URL')
    .isURL().withMessage('profileImage must be a valid URL'),
];