import { clientVendorUpdateStatus, createClientVendor, deleteClientVendor, exportClientVendors, getClientVendorById, getVendorById, listClientVendors, updateClientVendor, vendorSearch } from '@controllers/customer.controller';
import { authenticateWithSubdomainCheck } from '@middlewares/authentication';
import { validate } from '@middlewares/validate';
import { Router } from 'express';
import multer from "multer";
import { validateClientVendor, validateUpdateClientVendor } from '../validations.ts/customer.validation';
import { RoleKeys } from '../utils/constants/roleKeys';

const router = Router();

const upload = multer({
  limits: { fieldSize: 20 * 1024 * 1024 },
});

const customerupload = upload.fields([{ name: "customer_image", maxCount: 1 }]);

router.post('/create', authenticateWithSubdomainCheck(true,RoleKeys.CUSTOMERS), customerupload, validate(validateClientVendor), createClientVendor)
router.get('/list/:type', authenticateWithSubdomainCheck(true,RoleKeys.CUSTOMERS), listClientVendors)
router.get('/view/:id', authenticateWithSubdomainCheck(true,RoleKeys.CUSTOMERS), getClientVendorById)

router.get('/vender/:id', getVendorById)


router.put('/update/:id', authenticateWithSubdomainCheck(true,RoleKeys.CUSTOMERS), customerupload, validate(validateUpdateClientVendor), updateClientVendor)
router.delete('/delete/:id', authenticateWithSubdomainCheck(true,RoleKeys.CUSTOMERS), deleteClientVendor)
router.get('/:type/:export',authenticateWithSubdomainCheck(true),exportClientVendors)
router.get('/vender/search/:name', authenticateWithSubdomainCheck(true, RoleKeys.CUSTOMERS), vendorSearch);
router.put('/status/:id',authenticateWithSubdomainCheck(true,RoleKeys.CUSTOMERS),clientVendorUpdateStatus)


export default router;

