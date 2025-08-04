import {
  createSKU,
  deleteSKU,
  getSKUById,
  importSKUs,
  listSKUs,
  updateSKU,
  updateSKUStatus,
} from "@controllers/sku.controller";
import { authenticateWithSubdomainCheck } from "@middlewares/authentication";
import { validate } from "@middlewares/validate";
import {
  createSKUValidator,
  updateSKUValidator,
  updateSKUStatusValidator,
} from "../validations/sku.validation";
import multer from "multer";

import { Router } from "express";
import { RoleKeys } from "../utils/constants/roleKeys";

const router = Router();

const upload = multer({
  limits: { fieldSize: 20 * 1024 * 1024 },
});

const uploads = upload.fields([{ name: "file", maxCount: 1 }]);
router.post(
  "/create",
  authenticateWithSubdomainCheck(true,RoleKeys.SKU),
  validate(createSKUValidator),
  createSKU
);

router.get(
  "/list",
  authenticateWithSubdomainCheck(true,RoleKeys.SKU),
  listSKUs
);

router.get(
  "/view/:id",
  authenticateWithSubdomainCheck(true,RoleKeys.SKU),
  getSKUById
);

router.put(
  "/update/:id",
  authenticateWithSubdomainCheck(true,RoleKeys.SKU),
  validate(updateSKUValidator),
  updateSKU
);

router.put(
  "/status/:id",
  authenticateWithSubdomainCheck(true,RoleKeys.SKU),
  validate(updateSKUStatusValidator), 
  updateSKUStatus
);

router.delete(
  "/delete/:id",
  authenticateWithSubdomainCheck(true,RoleKeys.SKU),
  deleteSKU
);


// Bulk upload SKU route
router.post(
  '/bulk-upload',
  authenticateWithSubdomainCheck(true),
  upload.single('file'), 
  importSKUs
);

export default router;