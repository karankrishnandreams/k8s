import { body, check } from "express-validator";
import createHttpError from "http-errors";

export const validateClientVendor = [
  body("type")
    .notEmpty()
    .withMessage("Please select a type")
    .isIn(["client", "vendor"])
    .withMessage("Type must bre client or vendor"),

  body("currency")
    .if((value, { req }) => req.body.type === "vendor")
    .notEmpty()
    .withMessage("Currency is required when type is vendor"),

  body("companyName")
    .isString()
    .withMessage("Company Name must be a string")
    .isLength({ min: 2 })
    .withMessage("Company Name must be at least 2 characters long"),

  body("firstName")
    .notEmpty()
    .withMessage("First Name is required")
    .isString()
    .withMessage("First Name must be a string")
    .isLength({ min: 2 })
    .withMessage("First Name must be at least 2 characters"),

  body("lastName")
    .notEmpty()
    .withMessage("Last Name is required")
    .isString()
    .withMessage("Last Name must be a string"),

  body("preTitle")
    .optional()
    .isString()
    .withMessage("Pre-title must be a string")
    .isLength({ min: 2 })
    .withMessage("Pre-title must be at least 2 characters"),

  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please enter a valid email address"),

  body("phone")
    .notEmpty()
    .withMessage("Phone number is required")
    .matches(/^\d+$/)
    .withMessage("Phone number should contain only digits"),

  body("address")
    .notEmpty()
    .withMessage("Address is required")
    .isString()
    .withMessage("Address must be a string"),

  body("city").notEmpty().withMessage("Please select a city"),

  body("state").notEmpty().withMessage("Please select a state"),

  body("country").notEmpty().withMessage("Please select a country"),

  body("postalCode")
    .notEmpty()
    .withMessage("Please enter a valid postal code")
    .isLength({ min: 5, max: 10 })
    .withMessage("Postal Code must be between 5 to 10 characters"),

  body("status")
    .notEmpty()
    .withMessage("Please select customer status")
    .isIn(["active", "inactive"])
    .withMessage("Status must be Active or Inactive"),

  check("customer_image").custom((_, { req }) => {
    const file = req.files?.customer_image?.[0];
    if (!file) return true; // Optional upload

    const allowedTypes = ["image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.mimetype)) {
      throw createHttpError(400, "Only JPEG/PNG up to 2MB is allowed");
    }
    if (file.size > 2 * 1024 * 1024) {
      throw createHttpError(400, "Only JPEG/PNG up to 2MB is allowed");
    }
    return true;
  }),
  // Certification checkbox + date dependency validators
  body("r2ApprovedDate").custom((value, { req }) => {
    if (req.body.r2Approved === "true" || req.body.r2Approved === true) {
      if (!value)
        throw createHttpError(
          400,
          "R2 Approved date is required when checkbox is selected."
        );
    }
    return true;
  }),

  body("iso9001Date").custom((value, { req }) => {
    if (req.body.iso9001 === "true" || req.body.iso9001 === true) {
      if (!value)
        throw createHttpError(
          400,
          "ISO 9001 date is required when checkbox is selected."
        );
    }
    return true;
  }),

  body("iso14001Date").custom((value, { req }) => {
    if (req.body.iso14001 === "true" || req.body.iso14001 === true) {
      if (!value)
        throw createHttpError(
          400,
          "ISO 14001 date is required when checkbox is selected."
        );
    }
    return true;
  }),

  body("iso45001Date").custom((value, { req }) => {
    if (req.body.iso45001 === "true" || req.body.iso45001 === true) {
      if (!value)
        throw createHttpError(
          400,
          "ISO 45001 date is required when checkbox is selected."
        );
    }
    return true;
  }),
];

export const validateUpdateClientVendor = [
  body("companyName")
    .optional()
    .trim()
    .not()
    .isEmpty()
    .withMessage("Company Name must not be empty if provided")
    .isString()
    .withMessage("Company Name must be a string"),

  body("firstName")
    .optional()
    .trim()
    .not()
    .isEmpty()
    .withMessage("First Name must not be empty if provided")
    .isString()
    .withMessage("First Name must be a string"),

  body("currency")
    .if((value, { req }) => req.body.type === "vendor")
    .notEmpty()
    .withMessage("Currency is required when type is vendor"),

  body("lastName")
    .optional()
    .trim()
    .not()
    .isEmpty()
    .withMessage("Last Name must not be empty if provided")
    .isString()
    .withMessage("Last Name must be a string"),

  body("preTitle")
    .optional()
    .trim()
    .not()
    .isEmpty()
    .withMessage("Pre-title must not be empty if provided")
    .isString()
    .withMessage("Pre-title must be a string"),

  body("email")
    .optional()
    .trim()
    .not()
    .isEmpty()
    .withMessage("Email must not be empty if provided")
    .isEmail()
    .withMessage("Please enter a valid email address"),

  body("phone")
    .optional()
    .trim()
    .not()
    .isEmpty()
    .withMessage("Phone number must not be empty if provided")
    .matches(/^\d+$/)
    .withMessage("Phone number should contain only digits"),

  body("address")
    .optional()
    .trim()
    .not()
    .isEmpty()
    .withMessage("Address must not be empty if provided")
    .isString()
    .withMessage("Address must be a string"),

  body("city")
    .optional()
    .trim()
    .not()
    .isEmpty()
    .withMessage("City must not be empty if provided")
    .isString()
    .withMessage("City must be a string"),

  body("state")
    .optional()
    .trim()
    .not()
    .isEmpty()
    .withMessage("State must not be empty if provided")
    .isString()
    .withMessage("State must be a string"),

  body("country")
    .optional()
    .trim()
    .not()
    .isEmpty()
    .withMessage("Country must not be empty if provided")
    .isString()
    .withMessage("Country must be a string"),

  body("postalCode")
    .optional()
    .trim()
    .not()
    .isEmpty()
    .withMessage("Postal Code must not be empty if provided")
    .isLength({ min: 5, max: 10 })
    .withMessage("Postal Code must be between 5 to 10 characters"),

  body("status")
    .optional()
    .trim()
    .not()
    .isEmpty()
    .withMessage("Status must not be empty if provided")
    .isIn(["active", "inactive"])
    .withMessage("Status must be Active or Inactive"),

  // ✅ Certification validations
  body("r2Approved")
    .optional()
    .isBoolean()
    .withMessage("r2Approved must be a boolean"),
  body("r2ApprovedDate").custom((value, { req }) => {
    if (req.body.r2Approved === true && !value) {
      throw createHttpError(
        400,
        "r2ApprovedDate is required when r2Approved is true"
      );
    }
    return true;
  }),

  body("iso9001")
    .optional()
    .isBoolean()
    .withMessage("iso9001 must be a boolean"),
  body("iso9001Date").custom((value, { req }) => {
    if (req.body.iso9001 === true && !value) {
      throw createHttpError(
        400,
        "iso9001Date is required when iso9001 is true"
      );
    }
    return true;
  }),

  body("iso14001")
    .optional()
    .isBoolean()
    .withMessage("iso14001 must be a boolean"),
  body("iso14001Date").custom((value, { req }) => {
    if (req.body.iso14001 === true && !value) {
      throw createHttpError(
        400,
        "iso14001Date is required when iso14001 is true"
      );
    }
    return true;
  }),

  body("iso45001")
    .optional()
    .isBoolean()
    .withMessage("iso45001 must be a boolean"),
  body("iso45001Date").custom((value, { req }) => {
    if (req.body.iso45001 === true && !value) {
      throw createHttpError(
        400,
        "iso45001Date is required when iso45001 is true"
      );
    }
    return true;
  }),

  // ✅ Image validation (optional)
  check("customer_image").custom((_, { req }) => {
    const file = req.files?.customer_image?.[0];
    if (!file) return true;

    const allowedTypes = ["image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.mimetype)) {
      throw createHttpError(400, "Only JPEG/PNG up to 2MB is allowed");
    }
    if (file.size > 2 * 1024 * 1024) {
      throw createHttpError(400, "Only JPEG/PNG up to 2MB is allowed");
    }
    return true;
  }),
];
