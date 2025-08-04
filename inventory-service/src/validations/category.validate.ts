import { body, query } from 'express-validator';
import mongoose from 'mongoose';

export const validateCreateCategory = [
  body('category')
    .trim()
    .notEmpty().withMessage('Category is required').bail()
    .isLength({ max: 60 }).withMessage('Category must be 60 characters or fewer'),
  
  body('categorySlug')
      .trim()
      .notEmpty().withMessage('Category Slug cannot be empty').bail()
      .matches(/^[a-z0-9-]+$/)
      .withMessage('Category Slug can only contain lowercase letters, numbers, and hyphens (no spaces or special characters)'),

  body('status')
    .notEmpty().withMessage('Please select the status').bail()
    .isIn(['Active', 'Inactive'])
    .withMessage('Invalid status value'),
];

export const validateUpdateCategory = [
  body('category')
    .optional()
    .trim()
    .notEmpty().withMessage('Category cannot be empty').bail()
    .isLength({ max: 60 }).withMessage('Category must be 60 characters or fewer'),

  body('categorySlug') // fixed here
    .optional()
    .trim()
    .notEmpty().withMessage('Category Slug cannot be empty').bail()
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Category Slug can only contain lowercase letters, numbers, and hyphens (no spaces or special characters)'),

  body('status')
    .optional()
    .notEmpty().withMessage('Please select the status').bail()
    .isIn(['Active', 'Inactive'])
    .withMessage('Invalid status value'),
];


export const validateListNotes = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
    .toInt(),

  query('sortBy')
    .optional()
    .isIn(['createdAt', 'due_date', 'priority', 'title'])
    .withMessage('Invalid sort field'),

  query('order')
    .optional()
    .isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),

  query('priority')
    .optional()
    .isIn(['High', 'Medium', 'Low', 'Critical'])
    .withMessage('Invalid priority value'),

  query('status')
    .optional()
    .isIn(['Completed', 'Pending', 'Onhold', 'Inprogress', 'Blocked', 'Todo'])
    .withMessage('Invalid status value'),

  query('is_important')
    .optional()
    .isBoolean().withMessage('is_important must be a boolean')
    .toBoolean(),

  query('search')
    .optional()
    .trim()
    .isString().withMessage('Search must be a string')
];

export const validateListTodo = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1 }).withMessage('Limit must be a positive integer'),

  query('sortBy')
    .optional()
    .isIn([
      'createdAt',
      'last7days',
      'lastMonth',
      'recentlyAdded',
      'ascending',
      'descending',
      'due_date'
    ]).withMessage('Invalid sortBy value'),

  query('order')
    .optional()
    .isIn(['asc', 'desc']).withMessage('Order must be either asc or desc'),

  query('search')
    .optional()
    .isString().withMessage('Search must be a string'),

  query('disablePagination')
    .optional()
    .isIn(['true', 'false']).withMessage('disablePagination must be "true" or "false"'),
];