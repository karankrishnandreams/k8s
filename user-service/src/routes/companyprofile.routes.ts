import { authenticateWithSubdomainCheck } from "@middlewares/authentication";
import { validateUpdateCompany } from "@validations/company.validate";
import multer from "multer";
import { Router } from "express";
import { validate } from "@middlewares/validation";
import { companyProfileUpdate, getCompanyProfileById } from "@controllers/companyprofile.controller";

const router = Router();

const upload = multer({
    limits: { fieldSize: 50 * 1024 * 1024 },
});

const profileUpload = upload.fields([{ name: 'profile_image', maxCount: 1 }]);

// Company Admin
router.put('/update/:id', authenticateWithSubdomainCheck(true), validate(validateUpdateCompany), profileUpload, companyProfileUpdate);
router.get('/view/:id', authenticateWithSubdomainCheck(true), getCompanyProfileById);

export default router;
