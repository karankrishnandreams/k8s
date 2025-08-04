import { body, param, query } from "express-validator";

export const createMessageValidator = [
  body("content")
    .isString().withMessage("Content must be a string")
    .trim()
    .isLength({ max: 2000 }).withMessage("Content cannot exceed 2000 characters")
    .optional(),

  body("repalyText")
    .isString().withMessage("repalyText must be a string")
    .trim()
    .isLength({ max: 2000 }).withMessage("Content cannot exceed 2000 characters")
    .optional(),

  body("senderId")
    .isString().withMessage("Sender ID must be a valid UUID")
    .notEmpty().withMessage("Sender ID is required"),

  body("recipientId")
    .optional()
    .isString().withMessage("Recipient ID must be a valid UUID"),

  body("groupId")
    .optional()
    .isString().withMessage("Group ID must be a valid UUID"),

  body()
    .custom((value) => {
      if (!value.recipientId && !value.groupId) {
        throw new Error("Either recipientId or groupId must be provided");
      }
      return true;
    }),
];

export const updateMessageValidator = [
  param("id")
    .isMongoId().withMessage("Invalid message ID"),

  body("content")
    .optional()
    .isString().withMessage("Content must be a string")
    .trim()
    .isLength({ max: 2000 }).withMessage("Content cannot exceed 2000 characters"),

  body("reactions")
    .optional()
    .isArray().withMessage("Reactions must be an array"),

  body("reactions.*.userId")
    .optional()
    .isUUID().withMessage("Reaction userId must be a valid UUID"),

  body("reactions.*.emoji")
    .optional()
    .isString().withMessage("Reaction emoji must be a string"),
];

export const listMessagesValidator = [
  query("senderId")
    .optional()
    .isUUID().withMessage("Sender ID must be a valid UUID"),

  query("recipientId")
    .optional()
    .isUUID().withMessage("Recipient ID must be a valid UUID"),

  query("groupId")
    .optional()
    .isUUID().withMessage("Group ID must be a valid UUID"),

  query("page")
    .optional()
    .isInt({ min: 1 }).withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
];