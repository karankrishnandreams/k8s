// routes/currencys.routes.ts
import express from "express";
import {
  createcurrency,
  listcurrencies,
  getcurrencyById,
} from "../controllers/currency.controller";
import { authenticateWithSubdomainCheck } from "@middlewares/authentication";
import { validate } from "@middlewares/validation";
import { validateCurrency } from "@validations/currency.validate";

const router = express.Router();

router.post("/create",authenticateWithSubdomainCheck(true), validate(validateCurrency),createcurrency);
router.get("/list",authenticateWithSubdomainCheck(true), listcurrencies);
router.get("/view/:id",authenticateWithSubdomainCheck(true), getcurrencyById);

export default router;
