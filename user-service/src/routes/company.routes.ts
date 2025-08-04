import { createCompany, deleteCompany, updateCompany, listCompany, updateCompanySettings, getCompanyById, companyMetrics, exportAllCompanies, exportSingleCompany, webhookUpdate, statusUpate, twoFAUpdate, getCompanyDomainUrls, getAllRoles, getCompanySettings, listCompanyNames } from '@controllers/company.controller';
import { authenticate, authenticateWithSubdomainCheck } from '@middlewares/authentication';
import { validate } from '@middlewares/validation';
import { validateCreateCompany, validateListCompany, validateEmailSetting, validateUpdateCompany } from '@validations/company.validate';
import { Router } from 'express';
import multer from 'multer';



const router = Router();


const upload = multer({
    limits: { fieldSize: 2 * 1024 * 1024 },
});

const profileUpload = upload.fields([{ name: 'profile_image', maxCount: 1 }]);
router.get('/roleList', getAllRoles);
router.get('/companyurls', getCompanyDomainUrls);
// ✅ Specific route must be placed BEFORE the wildcard :export route
router.get('/company-names', listCompanyNames); // 
router.post('/create', authenticate, validate(validateCreateCompany), profileUpload, createCompany);
router.put('/update/:id', authenticate, validate(validateUpdateCompany), profileUpload, updateCompany);
router.delete('/delete/:id', authenticate, deleteCompany);
router.get('/list', authenticate, listCompany);
router.get('/emailsig/:id', authenticateWithSubdomainCheck(true), getCompanySettings);
router.get('/view/:id', authenticate, getCompanyById);
router.get('/company/metrics', authenticate, companyMetrics);
router.get('/:export', authenticate, exportAllCompanies);
router.get('/:export/:id', authenticate, exportSingleCompany);
router.post('/webhook/update', webhookUpdate);
router.put('/status/update/:id', authenticate, statusUpate);
router.put('/twofa/update/:id', authenticateWithSubdomainCheck(true), twoFAUpdate);
router.put('/email-setting/:id', authenticateWithSubdomainCheck(true), validate(validateEmailSetting), updateCompanySettings);

// router.put('/update-roles', updateRolesandPermission);

router.get('/companyurls', getCompanyDomainUrls);


export default router;