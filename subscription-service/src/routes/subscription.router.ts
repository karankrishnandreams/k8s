import { exportSingleSubscription, exportAllSubscriptions, listSubscriptions, subscriptionMetrics, viewSubscriptionInvoiceHtml } from "@controllers/subscription.controller";
import { authenticate } from "@middlewares/authentication";
import { Router } from "express";

const router = Router();

router.get("/list", authenticate, listSubscriptions);
router.get("/subscription/metrics", authenticate, subscriptionMetrics);
router.get('/:export', authenticate,exportAllSubscriptions)
router.get("/download/:id", authenticate,viewSubscriptionInvoiceHtml)
export default router;