import { createTaskflow, updateTaskflow, deleteTaskflow,listTaskflow} from '@controllers/taskflow.controller';
import { authenticateWithSubdomainCheck } from '@middlewares/authentication';
import { validate } from '@middlewares/validation';
import { validateTaskflow } from '@validations/taskflow.validate';
import { Router } from 'express';

const router = Router();

router.post('/create', authenticateWithSubdomainCheck(),validate(validateTaskflow), createTaskflow);
router.put('/update/:id', authenticateWithSubdomainCheck(),validate(validateTaskflow), updateTaskflow);
router.delete('/delete/:id', authenticateWithSubdomainCheck(), deleteTaskflow);
router.get('/list', authenticateWithSubdomainCheck(), listTaskflow); 
 
export default router;