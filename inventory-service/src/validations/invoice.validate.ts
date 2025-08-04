import { body } from 'express-validator';

export const validateCreateInvoice = [
  body('soid').notEmpty().withMessage('soid is required'),
  body('inventoryIds').notEmpty().withMessage('InventoryIds is required').isArray().withMessage('InventoryIds must be an array'),
];

export const validateUpdateInvoice = [
  // same as create, or only the fields you allow to update
  body('invoiceNumber').optional().notEmpty().withMessage('Invoice number cannot be empty'),
  body('clientId').optional().isMongoId().withMessage('Valid clientId'),
  body('clientPurchaseId').optional().isMongoId().withMessage('Valid clientPurchaseId'),
  body('termsId').optional().isMongoId().withMessage('Valid termsId'),
  body('currencyId').optional().isMongoId().withMessage('Valid currencyId'),
  body('fromSale').optional().isNumeric().withMessage('fromSale must be a number'),
  body('dept').optional().isNumeric().withMessage('dept must be a number'),
  body('rep').isMongoId().withMessage('Valid repId is required'),
  body('date').optional().isISO8601().toDate().withMessage('Valid date'),
  body('dueDate').optional().isISO8601().toDate().withMessage('Valid dueDate'),
  body('earlyInvoice').optional().isBoolean().withMessage('earlyInvoice must be boolean'),
  body('paid').optional().notEmpty().withMessage('paid is required'),
  body('subTotal').optional().notEmpty().withMessage('subTotal is required'),
  body('tax').optional().notEmpty().withMessage('tax is required'),
  body('total').optional().notEmpty().withMessage('total is required'),
  body('CAD').optional().notEmpty().withMessage('CAD is required'),
];
