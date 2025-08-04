import { Router } from "express";
import multer from "multer";
import path from "path";
import {
  createRepository,
  listRepositories,
  updateRepository,
  deleteRepository,
} from "../controllers/repository.controller";

const router = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, "../../uploads/repositories")); // adjust if needed
  },
  filename: (_req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

router.post("/create", upload.single("file"), createRepository);
router.get("/list", listRepositories);
router.put("/update/:id", upload.single("file"), updateRepository);
router.delete("/delete/:id", deleteRepository);

export default router;
