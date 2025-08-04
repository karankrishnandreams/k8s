import {
  createPackage,
  createPlanImage,
  createSubscription,
  deletePackage,
  getNextPackagePosition,
  getPackageById,
  getPackageViewById,
  listPackages,
  listPackagesExport,
  packageMetrics,
  updatePackage,
  updatePackageStatus,
  uploadPlanImage,
} from "@controllers/packages.controller";
import { validate } from "@middlewares/validation";
import {
  create,
  updatePlan,
  validatePlanImage,
} from "../validations/packages.validate";
import { Router } from "express";
import multer from "multer";
import { authenticate } from "@middlewares/authentication";

const router = Router();

const upload = multer({
  limits: { fieldSize: 40 * 1024 * 1024 },
});

const planUpload = upload.fields([{ name: "plan_image", maxCount: 1 }]);
router.get("/view/:id", getPackageViewById);
router.get("/details/:export", listPackagesExport);
router.post("/create", authenticate, validate(create), createPackage);
router.get("/list", listPackages);
router.get("/list/:id", authenticate, getPackageById);
router.put("/update/:id", authenticate, validate(updatePlan), updatePackage);
router.delete("/delete/:id", authenticate, deletePackage);
router.get("/metrics", authenticate, packageMetrics);
router.post(
  "/image/add",
  authenticate,
  planUpload,
  validate(validatePlanImage),
  createPlanImage
);
router.post(
  "/image/:id",
  authenticate,
  planUpload,
  validate(validatePlanImage),
  uploadPlanImage
);
router.post("/make", createSubscription);
router.get("/position", authenticate, getNextPackagePosition);
router.put("/status/:id", authenticate, updatePackageStatus)
export default router;
