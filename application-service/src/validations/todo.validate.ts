import { stripHtmlTags } from '@utils/striptags';
import { body, query } from 'express-validator';
import createHttpError from 'http-errors';
import moment from 'moment';
import mongoose from 'mongoose';

export const validateCreateTodo = [
  body('title')
    .exists({ checkFalsy: true }).withMessage('Todo title is required').bail()
    .isString()
    .trim()
    .isLength({ max: 60 }).withMessage('Title must be 60 characters or fewer'),

  body('assignee')
    .exists({ checkFalsy: true }).withMessage('Please select an assignee').bail()
    .isArray({ min: 1 }).withMessage('Please select an assignee') // ensure it's an array
    .custom((assignees) => {
      if (!Array.isArray(assignees)) return false;
      return assignees.every((id) => mongoose.Types.ObjectId.isValid(id));
    }).withMessage('All assignee IDs must be valid ObjectIds'),

  body('taskflow')
    .exists({ checkFalsy: true }).withMessage('Taskflow is required').bail(),

  body('priority')
    .exists({ checkFalsy: true }).withMessage('Please select a priority level').bail()
    .isIn(['High', 'Medium', 'Low', 'Critical']).withMessage('Please select a priority level'),

  body('due_date')
    .exists({ checkFalsy: true }).withMessage('Please set a due date').bail()
    .isISO8601().withMessage('Due date must be a valid date format').bail()
    .custom((value) => {
      const inputDate = new Date(value + 'T00:00:00'); // ensure time is at start of day
      const today = moment().toDate();
      today.setHours(0, 0, 0, 0); // start of today
      if (inputDate < today) {
        throw createHttpError(400, 'Due date must be today or later');
      }

      return true;
    }),


  body('status')
    .exists({ checkFalsy: true }).withMessage('Please select the task status').bail()
    .isIn(['Completed', 'Inprogress', 'Todo', 'Blocked']).withMessage('Please select the task status'),

  body('description')
    .optional({ nullable: true })
    .custom((value) => {
      const plainText = stripHtmlTags(value || '');
      if (plainText.length > 500) {
        throw new Error('Description must be 500 characters or less');
      }
      return true;
    }),

  body('comments')
    .optional({ nullable: true })
];

export const validateUpdateTodo = [
  body('title')
    .optional()
    .isString().withMessage('Todo title is required')
    .trim()
    .isLength({ max: 60 }).withMessage('Title must be 60 characters or fewer'),

  body('assignee')
    .optional()
    .isArray({ min: 1 }).withMessage('Please select an assignee')
    .custom((assignees) => {
      if (!Array.isArray(assignees)) return false;
      return assignees.every((id) => mongoose.Types.ObjectId.isValid(id));
    }).withMessage('All assignee IDs must be valid ObjectIds'),

  body('taskflow')
    .optional()
    .isString().withMessage('Taskflow is required'),

  body('priority')
    .optional()
    .isIn(['High', 'Medium', 'Low', 'Critical']).withMessage('Please select a priority level'),

  body('due_date')
    .optional()
    .isISO8601().withMessage('Due date must be a valid date format'),

  body('status')
    .optional()
    .isIn(['Completed', 'Inprogress', 'Todo', 'Blocked'])
    .withMessage('Please select the task status'),

  body('description')
    .optional({ nullable: true })
    .isLength({ max: 500 }).withMessage('Description max length is 500'),

  body('comments')
    .optional({ nullable: true })
    .isLength({ max: 500 }).withMessage('Comments max length is 500'),
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
      "created_date",
      "priority",
      'last7days',
      'lastMonth',
      'lastYear',
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