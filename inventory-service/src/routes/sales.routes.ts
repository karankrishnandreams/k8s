import { Router } from "express";
import { authenticateWithSubdomainCheck } from "@middlewares/authentication";
import { validateCreateSale } from "@validations/sales.validate";
import { validate } from '@middlewares/validation';
import {
  createSale,
  getAllSales,
  getSaleById,
  updateSale,
  deleteSale,
  importSale,
  sampleSaleXLSX,
  exportAllSales,
  statusUpdateSale,
  convertSoSale,
  downloadSalePdf,
  updateComments,
  getInventory
} from "@controllers/sales.controller";
import multer from "multer";

const uploadXl = multer({ storage: multer.memoryStorage() });


const router = Router();
router.get("/import-sample", authenticateWithSubdomainCheck(true), sampleSaleXLSX);
router.post('/import', authenticateWithSubdomainCheck(true), uploadXl.single('file'), importSale);

router.get("/list", authenticateWithSubdomainCheck(true), getAllSales);
router.get("/view/:id", authenticateWithSubdomainCheck(true), getSaleById);
router.post("/create", authenticateWithSubdomainCheck(true), validate(validateCreateSale), createSale);
router.put("/update/:id", authenticateWithSubdomainCheck(true), validate(validateCreateSale), updateSale);
router.delete("/delete/:id", authenticateWithSubdomainCheck(true), deleteSale);
router.get("/export/:export", authenticateWithSubdomainCheck(true), exportAllSales);
router.get("/voided/:id", authenticateWithSubdomainCheck(true), statusUpdateSale);
router.get("/convert-so/:id", authenticateWithSubdomainCheck(true), convertSoSale);
router.get("/download/:id", authenticateWithSubdomainCheck(true), downloadSalePdf);
router.put("/update-comments/:id", authenticateWithSubdomainCheck(true), updateComments);
router.get("/inventory-items/:id", authenticateWithSubdomainCheck(true), getInventory);


export default router;
