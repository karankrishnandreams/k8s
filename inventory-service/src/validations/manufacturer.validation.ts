import { body } from "express-validator";

export const createManufacturerValidator = [
  body("manufacturer")
    .optional()
    .isString().withMessage("Manufacturer must be a string")
    .isLength({ min: 2, max: 30 }).withMessage("Manufacturer must be between 2 and 30 characters"),
    
  body("full_name")
    .notEmpty().withMessage("Full name is required")
    .isString().withMessage("Full name must be a string")
    .isLength({ min: 2, max: 30 }).withMessage("Full name must be between 2 and 30 characters"),

];

export const updateManufacturerValidator = [
  body("manufacturer")
    .optional()
    .notEmpty().withMessage("Manufacturer cannot be empty")
    .isString().withMessage("Manufacturer must be a string")
    .isLength({ min: 2, max: 30 }).withMessage("Manufacturer must be between 2 and 30 characters"),

  body("full_name")
    .optional()
    .notEmpty().withMessage("Full name cannot be empty")
    .isString().withMessage("Full name must be a string")
    .isLength({ min: 2, max: 30 }).withMessage("Full name must be between 2 and 30 characters"),


];
