import { createTax, deleteTax, getTaxById, getTaxByState, listTax,updateTax } from '@controllers/tax.controller';
import { authenticateWithSubdomainCheck } from '@middlewares/authentication';
import { validate } from '@middlewares/validation';
import { validateCreateTax, validateUpdateTax } from '@validations/tax.validate';
import { Router } from 'express';
import { RoleKeys } from '../utils/constants/roleKeys';

const router = Router();

router.post('/create', authenticateWithSubdomainCheck(true,RoleKeys.TAX),validate(validateCreateTax), createTax);
router.put('/update/:id', authenticateWithSubdomainCheck(true,RoleKeys.TAX),validate(validateUpdateTax), updateTax);
router.delete('/delete/:id', authenticateWithSubdomainCheck(true,RoleKeys.TAX), deleteTax);
router.get('/list', authenticateWithSubdomainCheck(true,RoleKeys.TAX), listTax);
router.get('/view/:id',authenticateWithSubdomainCheck(true,RoleKeys.TAX), getTaxById);
router.get('/value/:id', authenticateWithSubdomainCheck(true,RoleKeys.TAX), getTaxByState);
export default router;