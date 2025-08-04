import { body, param } from "express-validator";
import mongoose from "mongoose";

export const validateEvent = [
  // Title: Required, max 100 characters
  body("title")
    .notEmpty().withMessage("Title is required")
    .isString().withMessage("Title must be a string")
    .isLength({ max: 100 }).withMessage("Max 100 characters"),

  // Description: Optional
  body("description")
    .optional()
    .isString().withMessage("Description must be a string"),

  // Start Time: Required and must be in HH:mm:ss format
  body("startTime")
    .notEmpty().withMessage("Start time is required")
    .matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/).withMessage("Start time must be in HH:mm:ss format"),

  // End Time: Required and must be in HH:mm:ss format and after start time
  body("endTime")
    .notEmpty().withMessage("End time is required")
    .matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/).withMessage("End time must be in HH:mm:ss format")
    .custom((end, { req }) => {
      // Compare times as strings (HH:mm:ss)
      return end > req.body.startTime;
    }).withMessage("End time must be after start time"),

  // Color Tag: Optional string
  body("colorTag")
    .optional()
    .isString().withMessage("Color tag must be a string"),

  // Location: Optional string
  body("location")
    .optional()
    .isString().withMessage("Location must be a string"),

  // Assignee: Optional string
  body("assignee")
    .optional()
    .isMongoId().withMessage("Assignee must be a valid user ID"),

];

export const validateUpdateEvent = [
  body("_id")
    .notEmpty().withMessage("Event ID is required")
    .isMongoId().withMessage("Invalid event ID format"),

  // Title: Required, max 100 characters
  body("title")
    .notEmpty().withMessage("Title is required")
    .isString().withMessage("Title must be a string")
    .isLength({ max: 100 }).withMessage("Max 100 characters"),

  // Description: Optional
  body("description")
    .optional()
    .isString().withMessage("Description must be a string"),

  // Start Time: Required and must be in HH:mm:ss format
  body("startTime")
    .notEmpty().withMessage("Start time is required")
    .matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/).withMessage("Start time must be in HH:mm:ss format"),

  // End Time: Required and must be in HH:mm:ss format and after start time
  body("endTime")
    .notEmpty().withMessage("End time is required")
    .matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/).withMessage("End time must be in HH:mm:ss format")
    .custom((end, { req }) => {
      // Compare times as strings (HH:mm:ss)
      return end > req.body.startTime;
    }).withMessage("End time must be after start time"),

  // Color Tag: Optional string
  body("colorTag")
    .optional()
    .isString().withMessage("Color tag must be a string"),

  // Location: Optional string
  body("location")
    .optional()
    .isString().withMessage("Location must be a string"),

  // Assignee: Optional string
  body("assignee")
    .optional()
    .isMongoId().withMessage("Assignee must be a valid user ID"),

];

// validateUpdateEvent is also used for deleteCalendar to validate _id

export const validateDeleteEvent = [
  param("id")
    .notEmpty().withMessage("Event ID is required")
    .isMongoId().withMessage("Invalid event ID format"),
];

export const validateExportCalendar = [
  param("export")
    .notEmpty().withMessage("Export format is required")
    .isIn(["pdf", "excel"]).withMessage("Invalid export format"),
];