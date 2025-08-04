import { createCategory, deleteCategory, getCategoryById, getSlug, listCategory,importCategories, categoryUpdateStatus,updateCategory,exportCategory,sampleCategoryImport } from '@controllers/category.controller';
import { authenticateWithSubdomainCheck } from '@middlewares/authentication';
import { validate } from '@middlewares/validation';
import { validateCreateCategory, validateUpdateCategory } from '@validations/category.validate';
import { Router } from 'express';
import { RoleKeys } from '../utils/constants/roleKeys';
const router = Router();

import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() }); // in-memory sto


router.post('/import',authenticateWithSubdomainCheck(true), upload.single('file'), importCategories)
router.get("/sample-import", authenticateWithSubdomainCheck(true,RoleKeys.CATEGORY),sampleCategoryImport);

router.post('/create', authenticateWithSubdomainCheck(true,RoleKeys.CATEGORY),validate(validateCreateCategory), createCategory);
router.put('/update/:id', authenticateWithSubdomainCheck(true,RoleKeys.CATEGORY),validate(validateUpdateCategory), updateCategory);
router.delete('/delete/:id', authenticateWithSubdomainCheck(true,RoleKeys.CATEGORY), deleteCategory);
router.get('/list', authenticateWithSubdomainCheck(true,RoleKeys.CATEGORY), listCategory);
router.get('/get-slug/:name', authenticateWithSubdomainCheck(true,RoleKeys.CATEGORY), getSlug);
router.get('/view/:id',authenticateWithSubdomainCheck(true,RoleKeys.CATEGORY), getCategoryById);
router.get('/get-slug/:name/:id', authenticateWithSubdomainCheck(true,RoleKeys.CATEGORY), getSlug);
router.get('/:export',authenticateWithSubdomainCheck(true), exportCategory)
router.put('/status/:id',authenticateWithSubdomainCheck(true,RoleKeys.CATEGORY),categoryUpdateStatus)

export default router;