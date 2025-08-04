import { body } from "express-validator";

export const validateTerms = [
  body("name")
    .trim()
    .notEmpty().withMessage("Name is required")
    .isLength({ min: 2 }).withMessage("Name must be at least 2 characters")
    .isLength({ max: 64 }).withMessage("Name must not exceed 64 characters"),

  body("description")
    .trim()
    .notEmpty().withMessage("Description is required")
    .isLength({ max: 500 }).withMessage("Description must not exceed 500 characters"),

  body("days")
        .trim()
        .notEmpty().withMessage("Days is required")
        .isNumeric().withMessage("Days must be numeric"),
];
