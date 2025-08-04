import { body, param } from "express-validator";
import mongoose from "mongoose";

// Utility to check for valid MongoDB ObjectId
const isValidObjectId = (value: string) => mongoose.Types.ObjectId.isValid(value);

// ----------------------
// CREATE SKU VALIDATION
// ----------------------
export const createSKUValidator = [
  body("skuCode")
    .notEmpty()
    .withMessage("SKU Code is required")
    .isAlphanumeric()
    .withMessage("SKU Code must be alphanumeric"),

  body("productName")
    .notEmpty()
    .withMessage("Product Name is required"),

  body("category")
    .notEmpty()
    .withMessage("Category is required")
    .custom((value) => isValidObjectId(value))
    .withMessage("Category must be a valid ID"),

  body("warehouse")
    .notEmpty()
    .withMessage("Warehouse is required"),

  body("stockQty")
    .notEmpty()
    .isNumeric()
    .withMessage("Quantity must be a number")
    .custom((qty) => qty >= 0)
    .withMessage("Quantity must be 0 or more"),

  body("reorderLevel")
    .optional()
    .isNumeric()
    .withMessage("Reorder Level must be a number")
    .custom((val) => val >= 0)
    .withMessage("Reorder Level must be 0 or more"),

  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .isIn(["Active", "Inactive"])
    .withMessage("Status must be either 'active' or 'inactive'"),

  body("description")
    .optional()
    .isString()
    .withMessage("Description must be text"),
];

// ----------------------
// UPDATE SKU VALIDATION
// ----------------------
export const updateSKUValidator = [
  param("id")
    .notEmpty()
    .custom(isValidObjectId)
    .withMessage("Invalid SKU ID"),

 body("skuCode")
    .notEmpty()
    .withMessage("SKU Code is required")
    .isAlphanumeric()
    .withMessage("SKU Code must be alphanumeric"),

  body("productName")
    .notEmpty()
    .withMessage("Product Name is required"),

  body("category")
    .notEmpty()
    .withMessage("Category is required")
    .custom((value) => isValidObjectId(value))
    .withMessage("Category must be a valid ID"),

  body("warehouse")
    .notEmpty()
    .withMessage("At least one warehouse is required"),

  body("stockQty")
    .notEmpty()
    .isNumeric()
    .withMessage("Quantity must be a number")
    .custom((qty) => qty >= 0)
    .withMessage("Quantity must be 0 or more"),

  body("reorderLevel")
    .optional()
    .isNumeric()
    .withMessage("Reorder Level must be a number")
    .custom((val) => val >= 0)
    .withMessage("Reorder Level must be 0 or more"),

  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .isIn(["Active", "Inactive"])
    .withMessage("Status must be either 'active' or 'inactive'"),

  body("description")
    .optional()
    .isString()
    .withMessage("Description must be text"),
];

// ----------------------
// STATUS VALIDATION
// ----------------------
export const updateSKUStatusValidator = [
  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .isIn(["Active", "Inactive"])
    .withMessage("Status must be either 'Active' or 'Inactive'"),
];


