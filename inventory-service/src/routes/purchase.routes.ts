import { Router } from "express";
import { authenticateWithScanToken, authenticateWithSubdomainCheck } from "@middlewares/authentication";
import {
    createPurchase,
    getAllPurchases,
    getPurchaseById,
    updatePurchase,
    deletePurchase,
    samplePurchaseXLSX,
    importPurchase,
    exportAllPurchases,
    statusUpdatePurchase,
    convertPoPurchase,
    downloadPurchasePdf,
    updatePurchaseItem,
    getInventoryItem,
    getAllInventories,
    updateInventrory,
    updateComments,
    updateSalesInventory,
    inventoryUpdateComments,
    isSerialNumberExist
} from "../controllers/purchase.controller";
import multer from "multer";

const uploadXl = multer({ storage: multer.memoryStorage() }); // in-memory sto

const router = Router();
router.get('/download/:id', downloadPurchasePdf)
router.get('/sample-import', authenticateWithSubdomainCheck(true), samplePurchaseXLSX);
router.get('/convert-po/:id', authenticateWithSubdomainCheck(true), convertPoPurchase);

router.get('/list', authenticateWithSubdomainCheck(true), getAllPurchases);
router.get('/list/:id', authenticateWithSubdomainCheck(true), getPurchaseById);
router.get('/export/:export', authenticateWithSubdomainCheck(true), exportAllPurchases);
router.get('/get-inventory-item/:id', authenticateWithSubdomainCheck(true), getInventoryItem);
router.post('/create', authenticateWithSubdomainCheck(true), createPurchase);
router.post('/import', authenticateWithSubdomainCheck(true), uploadXl.single('file'), importPurchase);
router.put('/update/:id', authenticateWithSubdomainCheck(true), updatePurchase);
router.put('/update-status/:id', authenticateWithSubdomainCheck(true), statusUpdatePurchase);
router.post('/delete/:id', authenticateWithSubdomainCheck(true), deletePurchase);
router.get('/update-item/:serialNumber', authenticateWithScanToken(true), updatePurchaseItem);
router.get('/inventory/list', authenticateWithSubdomainCheck(true), getAllInventories);
router.put('/inventory/update/:id', authenticateWithSubdomainCheck(true), updateInventrory);
router.get('/inventory-item/list', authenticateWithSubdomainCheck(true), getAllInventories);
router.post('/reserve/update', authenticateWithSubdomainCheck(true), updateSalesInventory);
router.put('/comment-update/:id', authenticateWithSubdomainCheck(true), updateComments);
router.put('/inventory-comment-update/:id', authenticateWithSubdomainCheck(true), inventoryUpdateComments);
router.post('/inventory-item/check', authenticateWithSubdomainCheck(true), isSerialNumberExist);

export default router;
