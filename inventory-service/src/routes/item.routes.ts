import { Router } from "express";
import multer from "multer";
import { authenticateWithSubdomainCheck } from "@middlewares/authentication";
import { RoleKeys } from "@utils/constants/roleKeys";
import { validateCreateItem } from "@validations/item.validation";
import {
  createItem,
  getAllItems,
  getItemById,
  updateItem,
  deleteItem,
  exportItems,
  importItems,
  sampleItemImport,
  checkWarehouseAssigned
} from "@controllers/item.controller";


const router = Router();

const upload = multer({
    limits: { fieldSize: 5 * 1024 * 1024 },
});

const profileUpload = upload.fields([
  { name: 'profile_image', maxCount: 10 },
  { name: 'data', maxCount: 1 }
]);

const uploadXl = multer({ storage: multer.memoryStorage() }); // in-memory sto



router.get("/sample-import", authenticateWithSubdomainCheck(true), sampleItemImport);
router.get("/", authenticateWithSubdomainCheck(true), getAllItems);
router.get("/:id", authenticateWithSubdomainCheck(true), getItemById);
router.post("/create", authenticateWithSubdomainCheck(true), profileUpload, validateCreateItem, createItem);
router.post("/import", authenticateWithSubdomainCheck(true),  uploadXl.single('file'), importItems);
router.put("/:id", authenticateWithSubdomainCheck(true), profileUpload, validateCreateItem, updateItem);
router.delete("/:id", authenticateWithSubdomainCheck(true), deleteItem);
router.get("/export/:export", authenticateWithSubdomainCheck(true), exportItems);
router.get("/check-warehouse-assigned/:warehouseId", checkWarehouseAssigned);

export default router;
