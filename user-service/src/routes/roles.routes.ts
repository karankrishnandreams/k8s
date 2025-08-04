import { createRole, deleteRole, exportRoles, getRoleById, listRoles, statusUpdate, updateRole, } from '@controllers/role.controller';
import { authenticateWithSubdomainCheck } from '@middlewares/authentication';
import { Router } from 'express';

const router = Router();
router.get('/list', authenticateWithSubdomainCheck(true), listRoles);
router.get('/:export',authenticateWithSubdomainCheck(true),exportRoles)
router.post('/create', authenticateWithSubdomainCheck(true), createRole);
router.get('/list/:id', authenticateWithSubdomainCheck(true), getRoleById);
router.put('/update', authenticateWithSubdomainCheck(true), updateRole);
router.delete('/delete/:id', authenticateWithSubdomainCheck(true), deleteRole);
router.put('/status/update/:id', authenticateWithSubdomainCheck(true), statusUpdate);

export default router;