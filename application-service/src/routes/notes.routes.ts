import { createNote, deleteNote, getNoteById, listNotes, setNoteImportant, updateNote ,exportNotes,getUserExistInNotes} from '@controllers/notes.controller';
import { authenticateWithSubdomainCheck } from '@middlewares/authentication';
import { validate } from '@middlewares/validation';
import { validateCreateNotes, validateUpdateNotes } from '@validations/notes.validate';
import { Router } from 'express';
import { RoleKeys } from '../utils/constants/roleKeys';

const router = Router();

router.post('/create', authenticateWithSubdomainCheck(true, RoleKeys.NOTES),validate(validateCreateNotes), createNote);
router.put('/update/:id', authenticateWithSubdomainCheck( true , RoleKeys.NOTES),validate(validateUpdateNotes), updateNote);
router.delete('/delete/:id', authenticateWithSubdomainCheck(true, RoleKeys.NOTES), deleteNote);
router.get('/list', authenticateWithSubdomainCheck(true, RoleKeys.NOTES), listNotes);
router.get('/view/:id',authenticateWithSubdomainCheck(true, RoleKeys.NOTES), getNoteById); 
router.patch('/important/:id',authenticateWithSubdomainCheck(), setNoteImportant);
router.get('/:export',authenticateWithSubdomainCheck(true, RoleKeys.NOTES), exportNotes);
router.get('/user/exist/:id', authenticateWithSubdomainCheck(true, RoleKeys.NOTES), getUserExistInNotes);

export default router;