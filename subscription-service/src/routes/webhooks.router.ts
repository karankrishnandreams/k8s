import express, { Router } from "express";
import { stripeWebhookHandler } from "@controllers/webhook.controller";

const app = express();

const router = Router();

router.post("/listen", express.raw({ type: 'application/json' }), stripeWebhookHandler);
export default router;
