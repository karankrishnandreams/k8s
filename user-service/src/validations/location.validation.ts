import { getDbConnection } from '@config/database';
import { body, param, query } from 'express-validator';

// Validation rules for creating a location
export const createLocationValidator = [
  body('name')
    .isString()
    .withMessage('Name must be a string')
    .notEmpty()
    .withMessage('Name is required'),

  body('type')
    .isIn(['country', 'state', 'city'])
    .withMessage('Type must be either "country", "state", or "city"'),

  body('countryPhoneCode')
    .if(body('type').equals('country')) // Only required for country
    .notEmpty()
    .withMessage('Country phone code is required for country type')
    .bail()
    .isString()
    .matches(/^\+\d{1,3}$/)
    .withMessage('Phone code must be in format +[countryCode]'),
    // .custom(async (value, { req }) => {
    //   //@ts-ignore
    //   const dbName: string | null = (req.headers['x-db-name'] as string) || null;
    //   const connection = getDbConnection(dbName);
    //   const LocationModel =
    //     connection.models.Location || connection.model<ILocation>('Location', LocationSchema);

    //   const existingLocation = await LocationModel.findOne({
    //     countryPhoneCode: value,
    //     type: 'country',
    //   });
    //   if (existingLocation) {
    //     throw new Error('Phone code already exists for another country');
    //   }
    //   return true;
    // }),

  body('countryShortCode')
    .if(body('type').equals('country')) // Only required for country
    .notEmpty()
    .withMessage('Country short code is required for country type')
    .bail()
    .isString()
    .isLength({ min: 2, max: 3 })
    .withMessage('Country short code must be between 2 and 3 characters'),
    // .custom(async (value, { req }) => {
    //   //@ts-ignore
    //   const dbName: string | null = (req.headers['x-db-name'] as string) || null;
    //   const connection = getDbConnection(dbName);
    //   const LocationModel =
    //     connection.models.Location || connection.model<ILocation>('Location', LocationSchema);

    //   const existingLocation = await LocationModel.findOne({
    //     countryShortCode: value,
    //     type: 'country',
    //   });
    //   if (existingLocation) {
    //     throw new Error('Country short code already exists for another country');
    //   }
    //   return true;
    // }),

  body('stateCode')
    .if(body('type').equals('state')) // Only required for state
    .notEmpty()
    .withMessage('State code is required for state type')
    .bail()
    .isString()
    .isLength({ min: 2, max: 3 })
    .withMessage('State code must be between 2 and 3 characters'),
    // .custom(async (value, { req }) => {
    //   //@ts-ignore
    //   const dbName: string | null = (req.headers['x-db-name'] as string) || null;
    //   const connection = getDbConnection(dbName);
    //   const LocationModel =
    //     connection.models.Location || connection.model<ILocation>('Location', LocationSchema);

    //   const existingLocation = await LocationModel.findOne({ stateCode: value, type: 'state' });
    //   if (existingLocation) {
    //     throw new Error('State code already exists for another state');
    //   }
    //   return true;
    // }),

  body('parent')
    .optional()
    .isMongoId()
    .withMessage('Parent must be a valid ObjectId')
    .bail(),
    // .custom(async (value, { req }: any) => {
    //   const dbName: string | null = (req.headers['x-db-name'] as string) || null;
    //   if (!dbName) {
    //     throw new Error('Database connection missing');
    //   }
    //   const connection = getDbConnection(dbName);
    //   const LocationModel =
    //     connection.models.Location || connection.model<ILocation>('Location', LocationSchema);

    //   const parentLocation = await LocationModel.findById(value);
    //   if (!parentLocation) {
    //     throw new Error('Parent location does not exist');
    //   }
    //   return true;
    // }),

  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean value'),
];

// Validation rules for getting locations
export const getLocationsValidator = [
  query('type')
    .optional()
    .isIn(['country', 'state', 'city'])
    .withMessage('Type must be either "country", "state", or "city"'),

  query('parent').optional().isMongoId().withMessage('Parent must be a valid ObjectId string'),

  query('active').optional().isBoolean().withMessage('Active must be a boolean value'),

  query('countryCode')
    .optional()
    .isString()
    .isLength({ min: 2, max: 3 })
    .withMessage('Country code must be between 2 and 3 characters'),

  query('stateCode')
    .optional()
    .isString()
    .isLength({ min: 2, max: 3 })
    .withMessage('State code must be between 2 and 3 characters'),

  query('phoneCode')
    .optional()
    .isString()
    .matches(/^\+\d{1,3}$/)
    .withMessage('Phone code must be in format +[countryCode]'),
];

// Validation rules for getting a location by ID
export const getLocationByIdValidator = [
  param('id').isMongoId().withMessage('Invalid location ID format'),
];

// Validation rules for getting countries by phone code
export const getCountriesByPhoneCodeValidator = [
  param('phoneCode')
    .isString()
    .matches(/^\+\d{1,3}$/)
    .withMessage('Phone code must be in format +[countryCode]'),
];

// Validation rules for getting states by country code
export const getStatesByCountryCodeValidator = [
  query('countryCode')
    .optional()
    .isString()
    .isLength({ min: 2, max: 3 })
    .withMessage('Country code must be between 2 and 3 characters'),
  query('phoneCode')
    .optional()
    .isString()
    .isLength({ min: 1, max: 4 })
    .withMessage('Phone code must be between 1 and 4 characters'),
];

export const listCountryValidationRules = [
  query('search').optional().isString().withMessage('Search must be a string'),

  query('sortBy')
    .optional()
    .isIn(['name', 'countryShortCode', 'countryPhoneCode', 'isActive', 'createdAt', 'updatedAt'])
    .withMessage('Invalid sortBy field'),

  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be either "asc" or "desc"'),

  query('page').optional().isInt({ min: 1 }).withMessage('Page must be an integer greater than 0'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be an integer between 1 and 50'),
];

export const listStateValidationRules = [
  query('search').optional().isString().withMessage('Search must be a string'),

  query('countryShortCode')
    .optional()
    .isString()
    .withMessage('Country short code must be a string'),

  query('sortBy')
    .optional()
    .isIn(['name', 'stateCode', 'createdAt', 'updatedAt'])
    .withMessage('Invalid sortBy field'),

  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be either "asc" or "desc"'),

  query('page').optional().isInt({ min: 1 }).withMessage('Page must be an integer greater than 0'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be an integer between 1 and 50'),
];

export const listCityValidationRules = [
  query('search').optional().isString().withMessage('Search must be a string'),

  query('stateCode').optional().isString().withMessage('State code must be a string'),

  query('sortBy')
    .optional()
    .isIn(['name', 'stateCode', 'countryCode', 'isActive', 'createdAt', 'updatedAt'])
    .withMessage('Invalid sortBy field'),

  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be either "asc" or "desc"'),

  query('page').optional().isInt({ min: 1 }).withMessage('Page must be an integer greater than 0'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be an integer between 1 and 50'),
];
