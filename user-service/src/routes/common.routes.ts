import { convertCurrencyController } from "@controllers/common.controller";
import { Router } from "express";

const router = Router();

router.post("/convertamount", convertCurrencyController);

export default router;