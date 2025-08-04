import { listCounterConfigs, updateCounterConfig } from "@controllers/counter.controller";
import { authenticateWithSubdomainCheck } from "@middlewares/authentication";
import express from "express";
const router = express.Router();


router.put('/update',authenticateWithSubdomainCheck(true),updateCounterConfig)
router.get('/list',authenticateWithSubdomainCheck(true),listCounterConfigs)

export default router;
