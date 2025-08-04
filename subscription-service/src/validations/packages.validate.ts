import { Request, Response, NextFunction } from "express";
import {
  check,
  validationResult,
  CustomValidator,
  body,
} from "express-validator";
import { getDbConnection } from "@config/database";
import PackageSchema from "@models/package.model";

const db_Name = process.env.DB_NAME;

export const create1 = [
  // Validate plan_type (enum)
  body("plan_type")
    .trim()
    .notEmpty()
    .withMessage("Plan type is required")
    .isIn(["month", "year", "day"])
    .withMessage("Plan type must be one of ['month', 'year', 'day']"),

  body("plan_name")
    .trim()
    .notEmpty()
    .withMessage("Plan is required")
    .custom(async (value, { req }) => {
      const planType = req.body.plan_type;
      if (!planType) {
        throw new Error(
          "Plan type is required to validate plan name uniqueness."
        );
      }
      if (!db_Name) {
        throw new Error("Database name header 'x-db-name' is required.");
      }
      const db = await getDbConnection(db_Name);
      const PackageModel =
        db.models.Package || db.model("Package", PackageSchema);

      const existingPackage = await PackageModel.findOne({
        plan_name: value,
        plan_type: planType,
        deletedAt: null,
      });

      if (existingPackage) {
        throw new Error("Plan name already exists with the same plan type.");
      }

      return true;
    }),

  // Validate plan_position
  body("plan_position")
    .notEmpty()
    .withMessage("Plan position is required")
    .isNumeric()
    .withMessage("Plan position must be a number"),

  // Validate plan_currency (optional)
  body("plan_currency")
    .optional()
    .trim()
    .toLowerCase()
    .isIn(["usd", "cad"])
    .withMessage("plan_currency must be one of: usd, cad"),

  // Validate price
  body("price")
    .notEmpty()
    .withMessage("Price is required")
    .isNumeric()
    .withMessage("Price must be a number"),

  // Validate discount_type (optional enum)
  body("discount_type")
    .optional()
    .trim()
    .toLowerCase()
    .isIn(["fixed", "percentage", null])
    .withMessage("discount_type must be 'fixed' or 'percentage'"),

  // Validate discount (required if discount_type exists)
  body("discount")
    .if(body("discount_type").exists())
    .notEmpty()
    .withMessage("discount is required when discount_type is provided")
    .isNumeric()
    .withMessage("discount must be a number"),

  // Validate access_trial (optional boolean)
  body("access_trial")
    .optional()
    .isBoolean()
    .withMessage("Access trial must be a boolean"),

  // Validate is_free (optional string with custom logic)
  body("is_free")
    .optional()
    .notEmpty()
    .isString()
    .withMessage("Is free must be a string")
    .custom(async (value, { req }) => {
      if (req.body.is_free === "yes" && req.body.price !== "0") {
        throw new Error("Free packages must have a price of 0.");
      } else if (req.body.is_free === "no" && req.body.price === "0") {
        throw new Error("A paid package must have a price greater than zero.");
      } else if (req.body.is_free === "yes") {
        const db = await getDbConnection();
        const Package = db.model("packages");
        const existingPackage = await Package.findOne({ is_free: "yes" });
        if (existingPackage)
          throw new Error(
            "Only one free plan with access trial can be created."
          );
      }
      return true;
    }),

  // Validate trial_days (optional number)
  body("trial_days")
    .optional()
    .isNumeric()
    .withMessage("Trial days must be a number"),

  // Validate is_recommended (optional boolean)
  body("is_recommended")
    .optional()
    .isBoolean()
    .withMessage("Is recommended must be a boolean"),

  // Validate description (optional string)
  body("description").optional().trim(),

  // Validate status (optional boolean)
  body("status")
    .optional()
    .toBoolean()
    .isBoolean()
    .withMessage("Status must be a boolean"),

  // body("plan_image").custom((value, { req }) => {
  //   const file = req?.files?.["plan_image"]?.[0];

  // if (!file) {
  //   return true;
  // }
  //   const allowedMimeTypes = ["image/jpeg", "image/png", "image/jpg"];
  //   const maxSizeInBytes = 4 * 1024 * 1024; // 4MB

  //   if (!allowedMimeTypes.includes(file.mimetype)) {
  //     throw new Error("Only JPG, PNG, or JPEG images are allowed");
  //   }

  //   if (file.size > maxSizeInBytes) {
  //     throw new Error("Image must be 4MB or less");
  //   }

  //   return true;
  // }),
];

export const create = [
  // Validate access_trial
  body("access_trial")
    .not()
    .isEmpty()
    .withMessage("access_trial is required")
    .isBoolean()
    .withMessage("access_trial must be a boolean"),

  // -------------------------------
  // COMMON (required if access_trial === true)
  // -------------------------------
  body("plan_name")
    .if((_, { req }) => req.body.access_trial === true)
    .notEmpty()
    .withMessage("Plan name is required")
    .isLength({ max: 30 })
    .withMessage("Plan name must not exceed 30 characters"),

  body("plan_type")
    .if((_, { req }) => req.body.access_trial === true)
    .notEmpty()
    .withMessage("Plan type is required")
    .isIn(["month", "year", "day"])
    .withMessage("Plan type must be one of ['month', 'year', 'day']"),

  body("price")
    .if((_, { req }) => req.body.access_trial === true)
    .notEmpty()
    .withMessage("Price is required")
    .isNumeric()
    .withMessage("Price must be a number"),

  body("status")
    .if((_, { req }) => req.body.access_trial === true)
    .notEmpty()
    .withMessage("Status is required")
    .isBoolean()
    .withMessage("Status must be a boolean"),

  body("trial_days")
    .if((_, { req }) => req.body.access_trial === true)
    .notEmpty()
    .withMessage("Trial days is required")
    .isNumeric()
    .withMessage("Trial days must be a number"),

  body("is_recommended")
    .if((_, { req }) => req.body.access_trial === true)
    .optional()
    .isBoolean()
    .withMessage("is_recommended must be a boolean"),

  body("description")
    .if((_, { req }) => req.body.access_trial === true)
    .optional()
    .isString()
    .withMessage("Description must be a string")
    .isLength({ max: 250 })
    .withMessage("Description must not exceed 30 characters"),

  ,
  // -------------------------------
  // FULL VALIDATION when access_trial === false
  // -------------------------------
  body("plan_type")
    .if((_, { req }) => req.body.access_trial === false)
    .notEmpty()
    .withMessage("Plan type is required")
    .isIn(["month", "year", "day"])
    .withMessage("Plan type must be one of ['month', 'year', 'day']"),

  body("plan_name")
    .if((_, { req }) => req.body.access_trial === false)
    .notEmpty()
    .withMessage("Plan name is required")
    .isLength({ max: 30 })
    .withMessage("Plan name must not exceed 30 characters")
    .custom(async (value, { req }) => {
      const planType = req.body.plan_type;
      const db = await getDbConnection(db_Name);
      const PackageModel =
        db.models.Package || db.model("Package", PackageSchema);
      const existing = await PackageModel.findOne({
        plan_name: value,
        plan_type: planType,
        deletedAt: null,
      });
      if (existing)
        throw new Error("Plan name already exists for this plan type");
      return true;
    }),

  body("plan_position")
    .if((_, { req }) => req.body.access_trial === false)
    .notEmpty()
    .withMessage("Plan position is required")
    .isNumeric()
    .withMessage("Plan position must be a number"),

  body("price")
    .if((_, { req }) => req.body.access_trial === false)
    .notEmpty()
    .withMessage("Price is required")
    .isNumeric()
    .withMessage("Price must be a number"),

  body("plan_currency")
    .if(
      (_, { req }) =>
        req.body.access_trial === false && req.body.plan_currency !== undefined
    )
    .toLowerCase()
    .isIn(["usd", "cad"])
    .withMessage("Plan currency must be 'usd' or 'cad'"),

body("discount_type")
  .if((_, { req }) => req.body.access_trial === false)
  .optional({ checkFalsy: true }) // allows empty string or undefined
  .customSanitizer(value => (value === "" ? undefined : value)) // normalize empty string to undefined
  .toLowerCase()
  .isIn(["fixed", "percentage", null])
  .withMessage("Discount type must be 'fixed', 'percentage', or null"),

body("discount")
  .if((_, { req }) => req.body.access_trial === false)
  .optional({ checkFalsy: true })
  .custom((value, { req }) => {
    const discountType = req.body.discount_type;

    // Discount type is undefined: discount must not be present
    if (typeof discountType === "undefined") {
      if (value !== undefined && value !== "") {
        throw new Error("Discount is not allowed without discount_type");
      }
      return true;
    }

    // Discount type is null: only allow 0
    if (discountType === null) {
      if (value !== 0 && value !== "0") {
        throw new Error("Discount must be 0 when discount_type is null");
      }
      return true;
    }

    // Discount type is fixed/percentage: discount is required
    if (value === undefined || value === "") {
      throw new Error("Discount is required when discount_type is provided");
    }

    if (isNaN(value)) {
      throw new Error("Discount must be a number");
    }

    return true;
  }),

  body("is_free")
    .if(
      (_, { req }) =>
        req.body.access_trial === false && req.body.is_free !== undefined
    )
    .isString()
    .withMessage("is_free must be a string")
    .custom(async (value, { req }) => {
      const price = req.body.price;
      if (value === "yes" && price !== "0") {
        throw new Error("Free packages must have a price of 0");
      } else if (value === "no" && price === "0") {
        throw new Error("Paid packages must have a price greater than 0");
      } else if (value === "yes") {
        const db = await getDbConnection(db_Name);
        const Package = db.model("packages");
        const existing = await Package.findOne({ is_free: "yes" });
        if (existing) throw new Error("Only one free plan is allowed");
      }
      return true;
    }),

  body("is_recommended")
    .if((_, { req }) => req.body.access_trial === false)
    .optional()
    .isBoolean()
    .withMessage("is_recommended must be a boolean"),

  body("description")
    .if((_, { req }) => req.body.access_trial === false)
    .optional()
    .isString()
    .withMessage("Description must be a string")
    .isLength({ max: 250 })
    .withMessage("Description must not exceed 250 characters"),

  ,
  body("status")
    .if((_, { req }) => req.body.access_trial === false)
    .optional()
    .isBoolean()
    .withMessage("Status must be a boolean"),
];

export const updatePlan = [
  // Validate plan_name (optional, but if present check uniqueness with plan_type)
  body("plan_name")
    .optional()
    .trim()
    .isLength({ max: 30 })
    .withMessage("Plan name must not exceed 30 characters")
    .custom(async (plan_name, { req }) => {
      const dbName = db_Name;
      if (!dbName) {
        throw new Error("Database name header 'x-db-name' is required.");
      }
      const packageId = req.params?.id;
      if (!packageId) {
        throw new Error("Package ID parameter is required.");
      }

      // Only check if plan_name or plan_type are provided in the body
      const plan_type = req.body.plan_type;
      if (!plan_name && !plan_type) {
        // No plan_name or plan_type, skip uniqueness check
        return true;
      }

      if (!plan_name || !plan_type) {
        // If one is missing, skip or throw? Let's skip uniqueness check for partial info
        return true;
      }

      const db = await getDbConnection(dbName);
      const PackageModel =
        db.models.Package || db.model("Package", PackageSchema);

      const existing = await PackageModel.findOne({
        plan_name,
        plan_type,
        deletedAt: null,
        _id: { $ne: packageId }, // exclude current package
      });

      if (existing) {
        throw new Error("A plan with this name and type already exists");
      }
      return true;
    }),

  // Validate plan_type (optional, but if present check validity and uniqueness with plan_name)
  body("plan_type")
    .optional()
    .trim()
    .isIn(["month", "year", "day"])
    .withMessage("Plan type must be one of ['month', 'year', 'day']")
    .custom(async (plan_type, { req }) => {
      // Similar check as plan_name validator
      const dbName = db_Name;
      if (!dbName) {
        throw new Error("Database name header 'x-db-name' is required.");
      }
      const packageId = req.params?.id;
      if (!packageId) {
        throw new Error("Package ID parameter is required.");
      }

      const plan_name = req.body.plan_name;

      if (!plan_name && !plan_type) {
        // No plan_name or plan_type, skip uniqueness check
        return true;
      }

      if (!plan_name || !plan_type) {
        // Partial data, skip uniqueness check
        return true;
      }

      const db = await getDbConnection(dbName);
      const PackageModel =
        db.models.Package || db.model("Package", PackageSchema);

      const existing = await PackageModel.findOne({
        plan_name,
        plan_type,
        deletedAt: null,
        _id: { $ne: packageId },
      });

      if (existing) {
        throw new Error("A plan with this name and type already exists");
      }
      return true;
    }),

  // Other fields (optional or required as per your logic)
  body("plan_position")
    .optional()
    .isNumeric()
    .withMessage("Plan position must be a number"),

  body("plan_currency")
    .optional()
    .trim()
    .toLowerCase()
    .isIn(["usd", "cad"])
    .withMessage("Plan currency must be one of: usd, cad"),

body("discount_type")
  .if((_, { req }) => req.body.access_trial === false)
  .optional({ checkFalsy: true }) // allows empty string or undefined
  .customSanitizer(value => (value === "" ? undefined : value)) // normalize empty string to undefined
  .toLowerCase()
  .isIn(["fixed", "percentage", null])
  .withMessage("Discount type must be 'fixed', 'percentage', or null"),

body("discount")
  .if((_, { req }) => req.body.access_trial === false)
  .optional({ checkFalsy: true })
  .custom((value, { req }) => {
    const discountType = req.body.discount_type;

    // Discount type is undefined: discount must not be present
    if (typeof discountType === "undefined") {
      if (value !== undefined && value !== "") {
        throw new Error("Discount is not allowed without discount_type");
      }
      return true;
    }

    // Discount type is null: only allow 0
    if (discountType === null) {
      if (value !== 0 && value !== "0") {
        throw new Error("Discount must be 0 when discount_type is null");
      }
      return true;
    }

    // Discount type is fixed/percentage: discount is required
    if (value === undefined || value === "") {
      throw new Error("Discount is required when discount_type is provided");
    }

    if (isNaN(value)) {
      throw new Error("Discount must be a number");
    }

    return true;
  }),

  body("status")
    .optional()
    .toBoolean()
    .isBoolean()
    .withMessage("Status must be a boolean"),

  body("description")
    .optional()
    .isString()
    .withMessage("Description must be a string")
    .isLength({ max: 250 })
    .withMessage("Description must not exceed 250 characters"),

  ,
];

export const validatePlanImage = [
  body("plan_image").custom((value, { req }) => {
    const file = req?.files?.["plan_image"]?.[0];

    if (!file) {
      throw new Error("Plan image is required");
    }

    const allowedMimeTypes = ["image/jpeg", "image/png", "image/jpg"];
    const maxSizeInBytes = 4 * 1024 * 1024; // 4MB

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new Error("Only JPG, PNG, or JPEG images are allowed");
    }

    if (file.size > maxSizeInBytes) {
      throw new Error("Image must be 4MB or less");
    }

    return true;
  }),
];
