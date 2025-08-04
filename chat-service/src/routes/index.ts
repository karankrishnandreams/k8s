import { Router } from "express";
import chatRoutes from "./chat.routes";
import { verifyInternalToken } from "@middlewares/verifyInternalToken";

const router = Router();

// Add this to your clinic-service routes
router.get("/health", (req, res) => {
  // Add any additional health checks (database connection, etc)
  res.status(200).json({
    service_name: process.env.CHATSERVICE_NAME,
    status: "UP",
    timestamp: new Date().toISOString(),
  });
});

// Apply it only to internal protected routes
// router.use(verifyInternalToken);

// Chat routes
router.use("/message", chatRoutes);

export default router;
