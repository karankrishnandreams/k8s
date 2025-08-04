import { Router } from "express";
import {
  createProject,
  listProjects,
  updateProject,
  deleteProject,
  listProjectNumbers,
  getProjectDetailsByNumber,
} from "../controllers/project.controller";

const router = Router();
router.post("/create", createProject);
router.get("/list",  listProjects);
router.put("/update/:id", updateProject);
router.delete("/delete/:id", deleteProject);
router.get("/project-numbers", listProjectNumbers);
router.get("/project-number/:projectNumber", getProjectDetailsByNumber);


export default router;
