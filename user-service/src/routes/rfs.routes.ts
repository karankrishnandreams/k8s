
import { createRFS, getAllRfs ,updateRFS} from '../controllers/rfs.controller'; 
import multer from "multer";
import { NextFunction, Router } from 'express';
import { Request, Response } from "express";
import path from "path";
import fs from "fs";

const router = Router();

// Create upload directory if not exists
const uploadDir = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  // filename: (req, file, cb) => {
  //   const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
  //   const ext = path.extname(file.originalname);
  //   cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  // }
  filename: (req, file, cb) => {
  const timestamp = Date.now();
  const sanitized = file.originalname.replace(/\s+/g, "_"); // remove spaces
  cb(null, `${sanitized}_${timestamp}`);
}
,
});

const upload = multer({ storage });

const parseFormDataJson = (req: Request, res: Response, next: NextFunction) => {
  if (req.body && typeof req.body.data === 'string') {
    try {
      const parsed = JSON.parse(req.body.data);
      req.body = { ...req.body, ...parsed }; // flatten into req.body
    } catch (e) {
      res.status(400).json({ error: 'Invalid JSON in form-data field: data' });
    }
  }
  next();
};

router.post("/create", upload.single("attachedFile"),createRFS);
router.get("/list", getAllRfs); 
router.put("/update/:id", upload.single("attachedFile"), parseFormDataJson, updateRFS);


export default router;

