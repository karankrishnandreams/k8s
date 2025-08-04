import { NextFunction, Router } from 'express';
import {
  getUser,
  createUser,
  updateUser,
  deleteUser,
  listUsers,
  exportUsers,
  statusUpdate,
  getUserforSocket,
  getUsersforSocket,
  getUserByName,
  getUserSettings,
  updateUserSettings
} from '../controllers/user.controller';
import { authenticateWithSubdomainCheck } from '@middlewares/authentication';
import { listUsersValidator, validateCreateUser, validateUpdateUser } from '@validations/user.validations';
import { validate } from '@middlewares/validation';
import multer from 'multer';
import { Request, Response } from "express";
import { RoleKeys } from '@utils/constants/roleKeys';

const router = Router();


const upload = multer({
  limits: { fieldSize: 2 * 1024 * 1024 },
});

const profileUpload = upload.fields([{ name: 'profile_image', maxCount: 1 }]);

// Middleware to parse req.body.data if present
const parseFormDataJson = (req: Request, res: Response, next: NextFunction) => {
  if (req.body && typeof req.body.data === 'string') {
    try {
      const parsed = JSON.parse(req.body.data);
      req.body = { ...req.body, ...parsed }; // flatten into req.body
    } catch (e) {
      res.status(400).json({ error: 'Invalid JSON in form-data field: data' });
    }
  }
  next();
};

router.post('/company/user/create', authenticateWithSubdomainCheck(true, RoleKeys.USERS), profileUpload, parseFormDataJson, validate(validateCreateUser), createUser);
router.get('/company/user/list', authenticateWithSubdomainCheck(true, RoleKeys.USERS), validate(listUsersValidator), listUsers);
router.get('/emailsig/:id', authenticateWithSubdomainCheck(true), getUserSettings);
router.get('/company/user/:export', authenticateWithSubdomainCheck(true, RoleKeys.USERS), exportUsers);
router.get('/company/user/detail/:id', authenticateWithSubdomainCheck(true, RoleKeys.USERS), getUser);
router.get('/company/user/detail-by-name/:name', authenticateWithSubdomainCheck(true, RoleKeys.USERS), getUserByName);
router.get('/company/user/socket-detail/:id', getUserforSocket);
router.post('/company/user/socket-details', getUsersforSocket);
router.put('/company/user/:id', authenticateWithSubdomainCheck(true, RoleKeys.USERS), profileUpload, parseFormDataJson, validate(validateUpdateUser), updateUser);
router.delete('/company/user/:id', authenticateWithSubdomainCheck(true, RoleKeys.USERS), deleteUser);
router.put('/company/user/status/update/:id', authenticateWithSubdomainCheck(true, RoleKeys.USERS), statusUpdate);
router.put('/email-setting/:id', authenticateWithSubdomainCheck(true), updateUserSettings);

export default router;
