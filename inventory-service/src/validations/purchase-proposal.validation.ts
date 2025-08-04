import { body } from "express-validator";
import mongoose from "mongoose";

export const validatePurchaseProposal = [
  body("date")
    .notEmpty()
    .withMessage("Date is required")
    .isISO8601()
    .withMessage("Date must be a valid ISO8601 date"),

  body("vendor")
    .notEmpty()
    .withMessage("Vendor is required")
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Invalid vendor ID"),

  body("vendorSO").notEmpty().withMessage("Vendor SO is required"),

  body("terms")
    .notEmpty()
    .withMessage("Terms is required")
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Invalid terms ID"),

  body("condition")
    .notEmpty()
    .withMessage("Condition is required")
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Invalid condition ID"),

  body("rep")
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Invalid rep ID"),

  body("currency")
    .notEmpty()
    .withMessage("Currency is required")
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Invalid currency ID"),

  body("shipDate")
    .isISO8601()
    .withMessage("Ship Date must be a valid ISO8601 date"),

  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .isIn(["Open", "Closed", "Pending"])
    .withMessage("Invalid status value"),

  body("receive").notEmpty().withMessage("Receive status is required"),

  body("hideLineItemPricing")
    .isBoolean()
    .withMessage("hideLineItemPricing must be a boolean"),

  body("freight").isNumeric().withMessage("Freight must be a number"),

  body("extraCost")
    .notEmpty()
    .withMessage("Extra cost is required")
    .isNumeric()
    .withMessage("Extra cost must be a number"),

  body("extendedCost")
    .notEmpty()
    .withMessage("Extended cost is required")
    .isNumeric()
    .withMessage("Extended cost must be a number"),

  body("subTotal")
    .notEmpty()
    .withMessage("Subtotal is required")
    .isNumeric()
    .withMessage("Subtotal must be a number"),

  body("total")
    .notEmpty()
    .withMessage("Total is required")
    .isNumeric()
    .withMessage("Total must be a number"),

  body("tax")
    .notEmpty()
    .withMessage("Tax is required")
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Invalid tax ID"),

  body("items")
    .isArray({ min: 1 })
    .withMessage("Items must be an array with at least one item"),

  body("items.*.item")
    .notEmpty()
    .withMessage("Item ID is required")
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Invalid item ID"),

  body("items.*.manufacturer")
    .notEmpty()
    .withMessage("Manufacturer is required")
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Invalid manufacturer ID"),

  body("items.*.quantity").isNumeric().withMessage("Quantity must be a number"),

  body("items.*.purchaseCostCAD")
    .isNumeric()
    .withMessage("Purchase Cost CAD must be a number"),

  body("items.*.purchaseCostUSD")
    .notEmpty()
    .withMessage("Purchase Cost USD is required")
    .isNumeric()
    .withMessage("Purchase Cost USD must be a number"),

  body("items.*.extendedCostCAD")
    .isNumeric()
    .withMessage("Extended Cost CAD must be a number"),

  body("items.*.extendedCostUSD")
    .notEmpty()
    .withMessage("Extended Cost USD is required")
    .isNumeric()
    .withMessage("Extended Cost USD must be a number"),

  body("items.*.serialNumber")
    .notEmpty()
    .withMessage("Serial Number is required"),

  body("items.*.condition")
    .notEmpty()
    .withMessage("Item Condition is required")
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Invalid item condition ID"),

  // body("items.*.wareHouse")
  //   .notEmpty()
  //   .withMessage("Warehouse is required")
  //   .custom((value) => mongoose.Types.ObjectId.isValid(value))
  //   .withMessage("Invalid warehouse ID"),

  body("items.*.location").notEmpty().withMessage("Location is required"),

  body("items.*.countryOfOrigin")
    .notEmpty()
    .withMessage("Country of Origin is required"),

  body("items.*.associatedNumber")
    .notEmpty()
    .withMessage("Associated Number is required"),

  // body('items.*.warranty')
  //   .notEmpty().withMessage('Warranty is required'),

  body("items.*.description").optional(),

  body("items.*.extDescription").optional(),

  body("items.*.internalComment").optional(),

  body("items.*.commentToVendor").optional(),
];

export const validatePurchaseProposalImportRow = (row: any) => {
  const errors: string[] = [];

  // Validate required top-level fields
  if (!row.userId) {
    errors.push("userId is required.");
  }

  if (!row.companyId) {
    errors.push("companyId is required.");
  }

  if (!row.date || isNaN(Date.parse(row.date))) {
    errors.push("Invalid or missing date.");
  }

  if (!row.vendor) {
    errors.push("vendor is required.");
  }

  if (!row.currency) {
    errors.push("currency is required.");
  }

  if (!row.terms) {
    errors.push("terms is required.");
  }

  // if (!row.condition) {
  //   errors.push("condition is required.");
  // }

  if (!row.address) {
    errors.push("address is required.");
  }

  if (!row.country) {
    errors.push("country is required.");
  }

  if (!row.state) {
    errors.push("state is required.");
  }

  if (!row.city) {
    errors.push("city is required.");
  }

  if (!row.wareHouse) {
    errors.push("wareHouse is required.");
  }

  if (!row.tax) {
    errors.push("tax is required.");
  }

  if (
    !row.status ||
    !["Open", "Approved", "Rejected", "Cancelled"].includes(row.status)
  ) {
    errors.push("Invalid or missing status.");
  }

  if (
    row.receive &&
    !["In Transit", "Partially Received", "Received"].includes(row.receive)
  ) {
    errors.push("Invalid receive status.");
  }

  // Validate optional numbers if present
  if (row.shipDate && isNaN(Date.parse(row.shipDate))) {
    errors.push("Invalid shipDate.");
  }

  ["freight", "extraCost", "extendedCost", "subTotal", "total"].forEach(
    (field) => {
      if (row[field] !== undefined && typeof row[field] !== "number") {
        errors.push(`${field} must be a number if provided.`);
      }
    }
  );

  // Validate items array
  if (!Array.isArray(row.items) || row.items.length === 0) {
    errors.push("At least one item is required.");
  } else {
    row.items.forEach((item: any, idx: number) => {
      const prefix = `Item ${idx + 1}:`;

      if (!item.item) {
        errors.push(`${prefix} item is required.`);
      }

      if (typeof item.quantity !== "number") {
        errors.push(`${prefix} quantity must be a number.`);
      }

      if (!item.condition) {
        errors.push(`${prefix} condition is required.`);
      }

      // Validate optional numbers if provided
      [
        "purchaseCostCAD",
        "purchaseCostUSD",
        "extendedCostCAD",
        "extendedCostUSD",
      ].forEach((field) => {
        if (item[field] !== undefined && typeof item[field] !== "number") {
          errors.push(`${prefix} ${field} must be a number if provided.`);
        }
      });

      if (
        item.serialNumber !== undefined &&
        typeof item.serialNumber !== "string"
      ) {
        errors.push(`${prefix} serialNumber must be a string if provided.`);
      }
    });
  }

  return {
    validRow: errors.length === 0,
    errors,
  };
};
