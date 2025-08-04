// routes/conditions.routes.ts
import express from "express";
import {
  createcondition,
  listconditions,
  getconditionById,
} from "../controllers/condition.controller";
import { authenticateWithSubdomainCheck } from "@middlewares/authentication";
import { validateCondition } from "@validations/conditions.validate";
import { validate } from "@middlewares/validation";

const router = express.Router();

router.post("/create",authenticateWithSubdomainCheck(true),validate(validateCondition), createcondition);
router.get("/list", authenticateWithSubdomainCheck(true),listconditions);
router.get("/view/:id",authenticateWithSubdomainCheck(true), getconditionById);

export default router;
