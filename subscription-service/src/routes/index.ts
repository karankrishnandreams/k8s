import { Router } from "express";

import { verifyInternalToken } from "@middlewares/verifyInternalToken";
import packageRouter from "./packages.router";
import webhookRouter from "./webhooks.router";
import subScriptionRouter from "./subscription.router";
import transactionRouter from "./transaction.router"
const router = Router();

// Add this to your clinic-service routes
router.get("/health", (req, res) => {
  // Add any additional health checks (database connection, etc)
  res.status(200).json({
    status: "UP",
    timestamp: new Date().toISOString(),
  });
});

// Apply it only to internal protected routes
// router.use(verifyInternalToken);

//package routes
router.use("/packages", packageRouter);

//subscription routes
router.use("/subscription", subScriptionRouter);

router.use("/transaction",transactionRouter)

export default router;
