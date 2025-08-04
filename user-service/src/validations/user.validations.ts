import { body, query } from "express-validator";

export const validateCreateUser = [
  body("username")
    .notEmpty()
    .withMessage("User name is required")
    .isLength({ min: 3 })
    .withMessage("User name must be at least 3 characters"),

  body("mobileNumber")
    .notEmpty()
    .withMessage("Phone number is required")
    .matches(/^[0-9]{10,15}$/)
    .withMessage(
      "Phone number must contain only digits and be between 10 to 15 digits"
    ),

  body("email")
    .notEmpty()
    .withMessage("Valid email is required")
    .isEmail()
    .withMessage("Valid email is required"),

  // body('role')
  //   .notEmpty().withMessage('Please assign a role'),

  body("role")
    .if((value, { req }) => !req.body.isWarehouseAdmin) // only validate if not warehouse admin
    .notEmpty()
    .withMessage("Please assign a role"),

  body("status").notEmpty().withMessage("Please choose a status"),

  body("password")
    .notEmpty()
    .withMessage("Password must be at least 6 characters")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),

  body("description")
    .optional()
    .isLength({ max: 600 })
    .withMessage("Maximum 600 characters allowed in description"),

  body("warehouseId")
    .custom((value, { req }) => {
      if (req.body.isWarehouseAdmin && !value) {
        throw new Error("warehouseId is required when isWarehouseAdmin is true");
      }
      return true;
    }),

];

export const validateUpdateUser = [
  body("username")
    .optional()
    .isLength({ min: 3 })
    .withMessage("User name must be at least 3 characters"),

  body("mobileNumber")
    .optional()
    .matches(/^[0-9]{10,15}$/)
    .withMessage(
      "Phone number must contain only digits and be between 10 to 15 digits"
    ),

  body("email").notEmpty().isEmail().withMessage("Invalid email address"),

  body("role").optional(),

  body("status").optional(),

  body("password")
    .optional()
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),

  body("description")
    .optional()
    .isLength({ max: 600 })
    .withMessage("Maximum 600 characters allowed in description"),

  body("warehouseId")
    .custom((value, { req }) => {
      if (req.body.isWarehouseAdmin && !value) {
        throw new Error("warehouseId is required when isWarehouseAdmin is true");
      }
      return true;
    }),


];

export const listUsersValidator = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit").optional().isInt().withMessage("Limit must be a number"), // ✅ Only use .withMessage after a validator

  query("search").optional().isString().withMessage("Search must be a string"), // ✅ OK

  query("status")
    .optional()
    .isIn(["Active", "Inactive", "All"])
    .withMessage("Status must be either 'Active' or 'Inactive' or 'All'"),

  query("role")
    .optional()
    .isString()
    .notEmpty()
    .withMessage("Role must be a non-empty string"),
];
