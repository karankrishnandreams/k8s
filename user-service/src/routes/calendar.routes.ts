import { createEvent, getEvent, getUpcomingEvents, updateEvent, deleteCalendar, exportCalendar, } from '@controllers/calendar.controller';
import { authenticate, authenticateWithSubdomainCheck } from '@middlewares/authentication';
import { validate } from '@middlewares/validation';
import { validateEvent, validateUpdateEvent, validateDeleteEvent, validateExportCalendar } from '@validations/calendar.validate';
import { Router } from 'express';
import { RoleKeys } from '../utils/constants/roleKeys';

const router = Router();

router.post('/create', authenticateWithSubdomainCheck(true, RoleKeys.CALENDAR), validate(validateEvent), createEvent);
router.get('/get', authenticateWithSubdomainCheck(true, RoleKeys.CALENDAR), getEvent);
router.put('/update', authenticateWithSubdomainCheck(true, RoleKeys.CALENDAR), validate(validateUpdateEvent), updateEvent);
router.get('/upcoming', authenticateWithSubdomainCheck(true, RoleKeys.CALENDAR), getUpcomingEvents);
router.delete('/delete/:id', authenticateWithSubdomainCheck(true, RoleKeys.CALENDAR), validate(validateDeleteEvent), deleteCalendar);
router.get('/exportEvent/:export', authenticateWithSubdomainCheck(true),validate(validateExportCalendar), exportCalendar);

export default router;