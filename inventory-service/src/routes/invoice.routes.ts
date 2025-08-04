import { Router } from "express";
import {
  updateInvoice,
  deleteInvoice,
  getInvoiceById,
  listInvoices,
  getNextInvoiceNumber,
  convertToInvoice,
  invoicePdf
} from "@controllers/invoice.controller";
import { authenticateWithSubdomainCheck } from "@middlewares/authentication";
import { validate } from "@middlewares/validation";
import {
  validateCreateInvoice,
  validateUpdateInvoice,
} from "@validations/invoice.validate";
import { RoleKeys } from "../utils/constants/roleKeys";

const router = Router();

// Create
router.post(
  "/create",
  authenticateWithSubdomainCheck(true, RoleKeys.INVOICE),
  validate(validateCreateInvoice),
  convertToInvoice
);

// Update
router.put(
  "/update/:id",
  authenticateWithSubdomainCheck(true, RoleKeys.INVOICE),
  validate(validateUpdateInvoice),
  updateInvoice
);

// Delete (soft delete)
router.delete(
  "/delete/:id",
  authenticateWithSubdomainCheck(true, RoleKeys.INVOICE),
  deleteInvoice
);

// List all (with optional filters/pagination)
router.get(
  "/list",
  authenticateWithSubdomainCheck(true, RoleKeys.INVOICE),
  listInvoices
);

// View single invoice by ID
router.get(
  "/view/:id",
  authenticateWithSubdomainCheck(true, RoleKeys.INVOICE),
  getInvoiceById
);

router.get(
  '/generate-invoice-number',
  authenticateWithSubdomainCheck(true, RoleKeys.INVOICE),
  getNextInvoiceNumber
);

router.get("/download/:id", authenticateWithSubdomainCheck(true), invoicePdf);

export default router;
