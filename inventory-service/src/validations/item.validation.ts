import { body } from "express-validator";
import mongoose from "mongoose";

export const validateCreateItem = [
  // Item Name - Required
  body("itemName")
    .notEmpty()
    .withMessage("Item name is required"),
    // .isString()
    // .withMessage("Item name must be a string"),

  // Manufacturer - Required ObjectId
  body("manufacturer")
    .notEmpty()
    .withMessage("Required field")
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Manufacturer must be a valid ID"),

  // Type - Required ObjectId
  body("type")
    .optional(),
    // .withMessage("Required field")
    // .custom((value) => mongoose.Types.ObjectId.isValid(value))
    // .withMessage("Type must be a valid ID"),

  // Category - Required ObjectId
  body("category")
    .notEmpty()
    .withMessage("Required field")
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Category must be a valid ID"),

  // Description (word count max 100, example)
  body("description")
    .optional()
    .isString()
    .withMessage("Description must be a string")
    .custom((value) => {
      const wordCount = value.trim().split(/\s+/).length;
      if (wordCount > 100) throw new Error("Exceeds allowed word count");
      return true;
    }),

  // Extended description - Optional (word count max 100, example)
  body("extDescription")
    .optional()
    .isString()
    .withMessage("Extended description must be a string")
    .custom((value) => {
      const wordCount = value.trim().split(/\s+/).length;
      if (wordCount > 100) throw new Error("Exceeds allowed word count");
      return true;
    }),

  // Warehouse - Required ObjectId
  body("warehouse")
    .optional(),
    // .withMessage("Required field")
    // .custom((value) => mongoose.Types.ObjectId.isValid(value))
    // .withMessage("Warehouse must be a valid ID"),

  // Weight - Optional Number
  body("weight")
    .optional()
    .isFloat({ gt: 0 })
    .withMessage("Enter valid number"),

  // GL Code - Required
  body("itemGLCode")
    .optional(),
    // .withMessage("GL Code is required")
    // .isString()
    // .withMessage("GL Code must be a string"),

  // Optional Fields
  body("clei").optional().isBoolean().withMessage("CLIE must be true/false"),
  body("nonInventory")
    .optional()
    .isBoolean()
    .withMessage("No Inventory must be true/false"),
  body("heci").optional().isString().withMessage("HECI must be a string"),
  body("extDescription")
    .optional()
    .isString()
    .withMessage("Extended description must be a string"),
  body("primaryLocation")
    .optional()
    .isString()
    .withMessage("Primary location must be a string"),
  body("taxGoodCategory")
    .optional()
    .isString()
    .withMessage("Tax good category must be a string"),
];

/**
 * Validate a single row of item import data.
 * @param row The row object from Excel.
 * @returns { errors: string[], validRow: any }
 */
export function validateItemImportRow(row: any) {
  const errors: string[] = [];
  const validRow: any = {};

  // Required fields
  if (
    !row.item_name ||
    typeof row.item_name !== "string" ||
    !row.item_name.trim()
  ) {
    errors.push("Item Name is required and cannot be empty.");
  } else {
    validRow.itemName = row.item_name.trim();
  }

  if (
    !row.manufacturer_name ||
    typeof row.manufacturer_name !== "string" ||
    !row.manufacturer_name.trim()
  ) {
    errors.push("Manufacturer is required and cannot be empty.");
  } else {
    validRow.manufacturerName = row.manufacturer_name.trim();
  }

  if (
    !row.type_name ||
    typeof row.type_name !== "string" ||
    !row.type_name.trim()
  ) {
    errors.push("Type is required and cannot be empty.");
  } else {
    validRow.typeName = row.type_name.trim();
  }

  if (
    !row.category_name ||
    typeof row.category_name !== "string" ||
    !row.category_name.trim()
  ) {
    errors.push("Category is required and cannot be empty.");
  } else {
    validRow.categoryName = row.category_name.trim();
  }

  if (
    !row.warehouse_name ||
    typeof row.warehouse_name !== "string" ||
    !row.warehouse_name.trim()
  ) {
    errors.push("Warehouse is required and cannot be empty.");
  } else {
    validRow.warehouseName = row.warehouse_name.trim();
  }

  if (!row.gl_code || typeof row.gl_code !== "string" || !row.gl_code.trim()) {
    errors.push("Item GL Code is required and cannot be empty.");
  } else {
    validRow.glCode = row.gl_code.trim();
  }

  // Optional fields with validation
  if (row.clei !== undefined) {
    const cleiValue =
      typeof row.clei === "boolean" ? row.clei : String(row.clei).toLowerCase();

    if (
      cleiValue !== true &&
      cleiValue !== false &&
      !["yes", "no", "1", "0", "true", "false"].includes(cleiValue)
    ) {
      errors.push("CLEI must be Yes/No, 1/0, or true/false.");
    } else {
      validRow.clei = ["yes", "1", "true", true].includes(cleiValue);
    }
  }

  if (row.description !== undefined) {
    if (typeof row.description !== "string" || row.description.length > 255) {
      errors.push("Description must be a string with max length 255.");
    } else {
      validRow.description = row.description;
    }
  }

  if (row.ext_description !== undefined) {
    validRow.extDescription = String(row.ext_description);
  }

  if (row.non_inventory !== undefined) {
    if (
      !["yes", "no", "1", "0", true, false].includes(
        String(row.non_inventory).toLowerCase()
      )
    ) {
      errors.push("Non Inventory must be Yes/No, 1/0, or true/false.");
    } else {
      validRow.nonInventory = ["yes", "1", "true", true].includes(
        String(row.non_inventory).toLowerCase()
      );
    }
  }

  if (row.weight !== undefined) {
    if (isNaN(Number(row.weight))) {
      errors.push("Weight must be a number.");
    } else {
      validRow.weight = Number(row.weight);
    }
  }

  if (row.primary_location !== undefined) {
    validRow.primaryLocation = String(row.primary_location);
  }

  if (row.tax_good_category !== undefined) {
    validRow.taxGoodCategory = String(row.tax_good_category);
  }

  return { errors, validRow };
}

export const updateStatus = [
  body("status")
    .notEmpty()
    .bail()
    .exists({ checkFalsy: true })
    .withMessage("status is required")
    .bail()
    .isIn(["Completed", "Inprogress", "Todo", "Blocked"])
    .withMessage("Please select the task status"),
];
