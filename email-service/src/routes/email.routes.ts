import {  
  // sendEmailWithFile,
  // sendMultipleEmails,
  sendSimpleEmail,
} from "@controllers/mail.controller";
import { Router } from "express";

const router = Router();

// POST /api/emails
router.post('/send', sendSimpleEmail);
// router.post("/send-attachment", sendEmailWithFile);
// router.post("/send-multiple", sendMultipleEmails);

export default router;
