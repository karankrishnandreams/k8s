import { stripHtmlTags } from "@utils/striptags";
import { body } from "express-validator";

export const createWarehouseValidation = [
  body("name")
    .notEmpty()
    .withMessage("Warehouse name is required")
    .isLength({ max: 100 })
    .withMessage("Warehouse name must be at most 100 characters"),

  body("description")
    .notEmpty()
    .withMessage("Description is required")
    .isLength({ max: 500 })
    .withMessage("Description must be at most 500 characters"),

  body("contactPerson")
    .notEmpty()
    .withMessage("Contact person is required"),
    // .matches(/^[A-Za-z\s]+$/)
    // .withMessage("Contact person must contain only letters and spaces"),

  body("phoneNumber")
    .optional()
    .matches(/^(\+)?\d{0,15}$/)
    .withMessage("Invalid phone number"),



  body("address")
    .notEmpty()
    .withMessage("Address line  is required")
    .isLength({ max: 200 })
    .withMessage("Address line must be at most 200 characters"),


  body("country")
    .notEmpty()
    .withMessage("Please select a country"),

  body("state")
    .notEmpty()
    .withMessage("Please enter or select a state"),

  body("city")
    .notEmpty()
    .withMessage("City is required"),
    // .matches(/^[A-Za-z\s]+$/)
    // .withMessage("City must contain only letters and spaces")
    // .isLength({ max: 50 })
    // .withMessage("City must be at most 50 characters"),

  body("zipcode")
    .notEmpty()
    .withMessage("Zipcode is required")
    .matches(/^[A-Za-z0-9]+$/)
    .withMessage("Zipcode must be alphanumeric")
    .isLength({ max: 10 })
    .withMessage("Zipcode must be at most 10 characters"),
];

export const updateWarehouseValidation = [
  body("name")
    .notEmpty()
    .withMessage("Warehouse name cannot be empty")
    .isLength({ max: 100 })
    .withMessage("Warehouse name must be at most 100 characters"),

  body("description")
    .notEmpty()
    .withMessage("Description cannot be empty")
    .custom((value) => {
    const plainText = stripHtmlTags(value || '');
    if (plainText.length > 500) {
      throw new Error('Description must be 500 characters or less');
    }
    return true;
  }),

  body("contactPerson")
    .optional()
    .notEmpty()
    .withMessage("Contact person cannot be empty"),
    // .matches(/^[A-Za-z\s]+$/)
    // .withMessage("Contact person must contain only letters and spaces"),

  body("phoneNumber")
    .optional()
    .matches(/^(\+)?\d{0,15}$/)
    .withMessage("Invalid phone number"),


  body("address")
    .optional()
    .notEmpty()
    .withMessage("Address line  cannot be empty")
    .isLength({ max: 200 })
    .withMessage("Address line  must be at most 200 characters"),


  body("country")
    .optional()
    .notEmpty()
    .withMessage("Country cannot be empty"),

  body("state")
    .optional()
    .notEmpty()
    .withMessage("State cannot be empty"),

  body("city")
    .optional()
    .notEmpty()
    .withMessage("City cannot be empty"),
    // .matches(/^[A-Za-z\s]+$/)
    // .withMessage("City must contain only letters and spaces")
    // .isLength({ max: 50 })
    // .withMessage("City must be at most 50 characters"),

  body("zipcode")
    .optional()
    .notEmpty()
    .withMessage("Zipcode cannot be empty")
    .matches(/^[A-Za-z0-9]+$/)
    .withMessage("Zipcode must be alphanumeric")
    .isLength({ max: 10 })
    .withMessage("Zipcode must be at most 10 characters"),
];

/**
 * Validate a single row of warehouse import data.
 * @param row The row object from Excel.
 * @returns { errors: string[], validRow: any }
 */
export function validateWarehouseImportRow(row: any) {
  const errors: string[] = [];
  const validRow: any = {};

  // Required: name
  if (!row.name || typeof row.name !== "string" || !row.name.trim()) {
    errors.push("Warehouse name is required.");
  } else if (row.name.trim().length > 100) {
    errors.push("Warehouse name must be at most 100 characters.");
  } else {
    validRow.name = row.name.trim();
  }

  // Required: description
  if (!row.description || typeof row.description !== "string" || !row.description.trim()) {
    errors.push("Description is required.");
  } else if (row.description.trim().length > 500) {
    errors.push("Description must be at most 500 characters.");
  } else {
    validRow.description = row.description.trim();
  }

  // Required: contactPerson
  if (!row.contactPerson || typeof row.contactPerson !== "string" || !row.contactPerson.trim()) {
    errors.push("Contact person is required.");
  } else {
    validRow.contactPerson = row.contactPerson.trim();
  }

  // Optional: phoneNumber
  if (row.phoneNumber !== undefined && row.phoneNumber !== "") {
    const phoneRegex = /^(\+)?\d{0,15}$/;
    if (!phoneRegex.test(String(row.phoneNumber))) {
      errors.push("Invalid phone number.");
    } else {
      validRow.phoneNumber = String(row.phoneNumber);
    }
  }


  // Optional: email
  if (row.email !== undefined && row.email !== "") {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(row.email))) {
      errors.push("Please enter a valid email.");
    } else {
      validRow.email = String(row.email);
    }
  }

  // Required: address1
  if (!row.address || typeof row.address !== "string" || !row.address.trim()) {
    errors.push("Address line  is required.");
  } else if (row.address.trim().length > 200) {
    errors.push("Address line  must be at most 200 characters.");
  } else {
    validRow.address = row.address.trim();
  }



  // Required: country
  if (!row.country || typeof row.country !== "string" || !row.country.trim()) {
    errors.push("Please select a country.");
  } else {
    validRow.country = row.country.trim();
  }
  // Required: status
  if (!row.status || typeof row.status !== "string" || !row.status.trim()) {
    errors.push("Please select a status.");
  } else {
    validRow.status = row.status.trim();
  }

  // Required: state
  if (!row.state || typeof row.state !== "string" || !row.state.trim()) {
    errors.push("Please enter or select a state.");
  } else {
    validRow.state = row.state.trim();
  }

  // Required: city
  if (!row.city || typeof row.city !== "string" || !row.city.trim()) {
    errors.push("City is required.");
  } else {
    validRow.city = row.city.trim();
  }

  // Required: zipcode
  if (!row.zipcode) {
    errors.push("Zipcode is required.");
  } else {
    const zip = row.zipcode;
    const zipRegex = /^[A-Za-z0-9]+$/;
    if (!zipRegex.test(zip)) {
      errors.push("Zipcode must be alphanumeric.");
    } else if (zip.length > 10) {
      errors.push("Zipcode must be at most 10 characters.");
    } else {
      validRow.zipcode = zip;
    }
  }

  return { errors, validRow };
}
