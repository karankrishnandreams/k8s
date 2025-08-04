import { downloadTransactionPdf, listTransactions, listTransactionsbyIdExport, listTransactionsExport } from "@controllers/transaction.controller";
import { authenticate } from "@middlewares/authentication";
import { Router } from "express";

const router = Router();

router.get('/list',authenticate,listTransactions)
router.get('/:export',authenticate,listTransactionsExport)
router.get('/download/:id',authenticate,downloadTransactionPdf)
export default router;