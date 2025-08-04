// routes.ts
import express from 'express';
import { generateTwilioToken, handleVoiceTwiML } from '../controllers/call.controller';
import { authenticateWithSubdomainCheck } from '@middlewares/authentication';

const router = express.Router();

router.post('/token', authenticateWithSubdomainCheck(true), generateTwilioToken);
router.post('/makeCall', handleVoiceTwiML);

export default router;
