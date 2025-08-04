import { createTodo, updateTodo, listTodos, deleteTodo,getTodoById,setTodoImportant, updateComment, getUserExist } from '@controllers/todo.controller';
import { authenticate,authenticateWithSubdomainCheck } from '@middlewares/authentication';
import { validate } from '@middlewares/validation';
import { RoleKeys } from '@utils/constants/roleKeys';
import { validateCreateTodo, validateUpdateTodo,validateListTodo } from '@validations/todo.validate';
import { Router } from 'express';

const router = Router();

router.post('/create', authenticateWithSubdomainCheck(true,RoleKeys.TICKETING),validate(validateCreateTodo), createTodo);
router.put('/update/:id', authenticateWithSubdomainCheck(true,RoleKeys.TICKETING),validate(validateUpdateTodo), updateTodo);
router.delete('/delete/:id', authenticateWithSubdomainCheck(true,RoleKeys.TICKETING),deleteTodo);
router.get('/list', authenticateWithSubdomainCheck(true,RoleKeys.TICKETING),validate(validateListTodo), listTodos);
router.get('/view/:id',authenticateWithSubdomainCheck(true,RoleKeys.TICKETING), getTodoById); 
router.get('/user/exist/:id',authenticateWithSubdomainCheck(true,RoleKeys.TICKETING), getUserExist); 
router.patch('/important/:id',authenticateWithSubdomainCheck(true,RoleKeys.TICKETING), setTodoImportant);
router.patch('/update-comment/:id',authenticateWithSubdomainCheck(true,RoleKeys.TICKETING), updateComment);

export default router;