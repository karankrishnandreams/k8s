import { Router } from 'express';
import { checkHealth } from '../controllers/heath.controller';

const router = Router();

router.get('/', checkHealth);

export default router;