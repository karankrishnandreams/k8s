import { body } from "express-validator";

export const validateCurrency = [
    body("currency")
        .trim()
        .notEmpty().withMessage("currency is required")
        .isLength({ min: 2 }).withMessage("currency must be at least 2 characters")
        .isLength({ max: 32 }).withMessage("currency must not exceed 32 characters"),

    body("value")
        .trim()
        .notEmpty().withMessage("value is required")
        .isNumeric().withMessage("value must be numeric"),

 
];
