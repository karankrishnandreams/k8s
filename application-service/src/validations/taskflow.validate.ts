import { stripHtmlTags } from '@utils/striptags';
import { body } from 'express-validator';

export const validateTaskflow = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required').bail()
    .isLength({ max: 60 }).withMessage('Name must be 60 characters or fewer'),

  body('description')
    .optional()
    .trim()
    .custom((value) => {
    const plainText = stripHtmlTags(value || '');
    if (plainText.length > 255) {
      throw new Error('Description must be 255 characters or less');
    }
    return true; 
  }),
];