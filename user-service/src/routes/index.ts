import { Router } from "express";
import authRoutes from "./auth.routes";
import userRoutes from "./user.routes";
import seedRoutes from "./seed.routes";
import companyRoutes from "./company.routes";
import dashboardRoutes from "./dashboard.routes";
import rolesRouter from "./roles.routes";
import locationRouter from "./location.routes";
import companyProfileRouter from "./companyprofile.routes";
import calendarRoutes from "./calendar.routes";
import rfsRoutes from './rfs.routes';
import commonRouter from "./common.routes"
import projectRoutes from "./project.routes";
import repositoryRoutes from './repository.routes';

const router = Router();

// Add this to your clinic-service routes
router.get("/health", (req, res) => {
  // Add any additional health checks (database connection, etc)
  res.status(200).json({
    service_name: process.env.USERSERVICE_NAME,
    status: "UP",
    timestamp: new Date().toISOString(),
  });
});

// Apply it only to internal protected routes
// router.use(verifyInternalToken);

// User route
router.use("/", userRoutes);

// Auth routes
router.use("/auth", authRoutes);

// Seed routes
router.use("/seed", seedRoutes);

// Company routes
router.use("/company", companyRoutes);

// Dashboard routes
router.use("/dashboard", dashboardRoutes);

//roles router
router.use("/roles", rolesRouter)

//roles router
router.use("/locations", locationRouter);

//CompanyAdmin router
router.use("/company-profile", companyProfileRouter);

//Calendar routes
router.use("/calendar", calendarRoutes);

//Calendar routes
router.use("/common", commonRouter);

//router.use('/rfs', rfsRoutes);
// routes/index.ts
// Replace this
router.use('/rfs', rfsRoutes);

router.use("/project", projectRoutes);

router.use("/repository", repositoryRoutes);


export default router;
