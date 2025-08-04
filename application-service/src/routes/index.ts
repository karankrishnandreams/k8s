import { Router } from "express";
import healthCheckRoutes from "./healthCheck.routes";
import { verifyInternalToken } from "@middlewares/verifyInternalToken";
import todoRoutes from "./todo.routes";
import notesRoutes from "./notes.routes";
import taskflowRoutes from "./taskflow.routes";
import moment from "moment";

const router = Router();

// Add this to your clinic-service routes
router.get("/health", (req, res) => {
  // Add any additional health checks (database connection, etc)
  res.status(200).json({
    service_name: process.env.APPLICATIONSERVICE_NAME,
    status: "UP",
    timestamp: moment().toDate().toISOString(),
  });
});

// Todo routes
router.use("/todo", todoRoutes); 

// notes routes
router.use("/note", notesRoutes);

//taskflow routes
router.use('/taskflow',taskflowRoutes)

export default router;
