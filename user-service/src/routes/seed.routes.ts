import { Router } from 'express';
import { getUser, createUser, updateUser, deleteUser } from '../controllers/user.controller';

const router = Router();

router.post('/', createUser);

export default router;

