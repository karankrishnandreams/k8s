// routes/term.routes.ts
import express from "express";
import {
  createTerm,
  listTerms,
  getTermById,
} from "../controllers/terms.controller";
import { authenticateWithSubdomainCheck } from "@middlewares/authentication";
import { validate } from "@middlewares/validation";
import { validateTerms } from "@validations/terms.validate";

const router = express.Router();

router.post("/create",authenticateWithSubdomainCheck(true), validate(validateTerms),createTerm);
router.get("/list", authenticateWithSubdomainCheck(true),listTerms);
router.get("/view/:id",authenticateWithSubdomainCheck(true), getTermById);

export default router;
