import { Request, Response, NextFunction, Router } from "express";
import {
  createMessage,
  getMessageById,
  updateMessage,
  deleteMessage,
  listMessages,
  addMessageReaction,
  getChatsList,
  bulkMarkMessagesSeen,
  toggleUserChatMeta,
  calendarTrigger,
} from "@controllers/message.controller";
import { authenticateWithSubdomainCheck } from "@middlewares/authentication";
import { validate } from "@middlewares/validation";
import { createMessageValidator, updateMessageValidator } from "../validation/message.validation";
import multer from 'multer';

const router = Router();

const upload = multer({
  limits: { fieldSize: 2 * 1024 * 1024 },
});

const profileUpload = upload.fields([{ name: 'attachment', maxCount: 5 }]);

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

// In your router
router.post("/create", authenticateWithSubdomainCheck(true), profileUpload, parseFormDataJson, validate(createMessageValidator), createMessage);
router.get("/chat/list", authenticateWithSubdomainCheck(true), getChatsList);
router.get("/list", authenticateWithSubdomainCheck(true), listMessages);
router.get("/:id", authenticateWithSubdomainCheck(true), getMessageById);
router.put("/updatestatus", authenticateWithSubdomainCheck(true), bulkMarkMessagesSeen);
router.put("/:id", authenticateWithSubdomainCheck(true), validate(updateMessageValidator), updateMessage);
router.post("/reactions/:id", authenticateWithSubdomainCheck(true), addMessageReaction);
router.put("/chat/toggle", authenticateWithSubdomainCheck(true), toggleUserChatMeta);
router.post("/calendar", calendarTrigger);

export default router;
