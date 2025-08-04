import { stripHtmlTags } from '@utils/striptags';
import { body, query } from 'express-validator';
import moment from 'moment';
import mongoose from 'mongoose';

export const validateCreateNotes = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required').bail()
    .isLength({ max: 60 }).withMessage('Title must be 60 characters or fewer'),


  body('tag')
    .trim()
    .notEmpty().withMessage('Tag is required'),

  body('priority')
    .notEmpty().withMessage('Please select a priority level').bail()
    .isIn(['High', 'Medium', 'Low', 'Critical'])
    .withMessage('Priority must be High, Medium, Low, or Critical'),

  body('due_date')
    .notEmpty().withMessage('Please set a due date').bail()
    .isISO8601().withMessage('Due date must be a valid date format').bail()
    .custom(value => {
      const inputDate = new Date(value);
      const today = moment().toDate();
      today.setHours(0, 0, 0, 0);
      return inputDate >= today;
    }).withMessage('Due date must be today or later')
    .toDate(),

  body('status')
    .notEmpty().withMessage('Please select the task status').bail()
    .isIn(['Completed', 'Pending', 'Onhold', 'Inprogress', 'Blocked', 'Todo'])
    .withMessage('Invalid status value'),

  body('description')
    .optional()
    .trim()
    .custom((value) => {
    const plainText = stripHtmlTags(value || '');
    if (plainText.length > 500) {
      throw new Error('Description must be 500 characters or less');
    }
    return true;
  }),

];

export const validateUpdateNotes = [
  body('title')
    .optional()
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ max: 60 }).withMessage('Title must be 60 characters or fewer'),


  body('tag')
    .optional()
    .trim()
    .notEmpty().withMessage('Tag is required'),

  body('priority')
    .optional()
    .notEmpty().withMessage('Please select a priority level')
    .isIn(['High', 'Medium', 'Low', 'Critical'])
    .withMessage('Priority must be High, Medium, Low, or Critical'),

  body('due_date')
    .optional()
    .notEmpty().withMessage('Please set a due date')
    .isISO8601().withMessage('Due date must be a valid date format')
    .custom(value => {
      const inputDate = new Date(value);
      const today = moment().toDate();
      today.setHours(0, 0, 0, 0);
      return inputDate >= today;
    }).withMessage('Due date must be today or later')
    .toDate(),

  body('status')
    .optional()
    .notEmpty().withMessage('Please select the task status')
    .isIn(['Completed', 'Pending', 'Onhold', 'Inprogress', 'Blocked', 'Todo'])
    .withMessage('Invalid status value'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Description must be 500 characters or fewer'),

  // Extra fields specific to update:
  body('is_important')
    .optional()
    .isInt({ min: 0, max: 1 }).withMessage('is_important must be 0 or 1'),

  body('update_user_email')
    .notEmpty().withMessage('Update user email is required')
    .isEmail().withMessage('Update user email must be a valid email address')
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