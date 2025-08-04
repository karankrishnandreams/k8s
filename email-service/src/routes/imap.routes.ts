import express, { Request, Response, NextFunction } from "express";
import { createEmailFolderController, deleteEmailsPermanentlyController, fetchAllEmails, fetchFolderEmails, getEmailFoldersController, getFolderStatsController, moveEmailsToFolderController, renameEmailFolderController, saveDraftEmailController, sendEmailController, updateEmailFlagsController } from "../controllers/imap.controller";
import multer from 'multer';
import { authenticateWithSubdomainCheck } from "@middlewares/authentication";

const router = express.Router();

const upload = multer({
    limits: { fieldSize: 2 * 1024 * 1024 },
});

const profileUpload = upload.fields([{ name: 'attachments', maxCount: 10 }]);

// Generic route to fetch any mailbox type
router.post("/fetch", authenticateWithSubdomainCheck(true), fetchAllEmails);
router.post("/folder", authenticateWithSubdomainCheck(true), fetchFolderEmails);
router.get("/folder/status", authenticateWithSubdomainCheck(true), getFolderStatsController);
router.post("/status/update", authenticateWithSubdomainCheck(true), updateEmailFlagsController);
router.post("/send", authenticateWithSubdomainCheck(true), profileUpload, sendEmailController);
router.post("/delete", authenticateWithSubdomainCheck(true), profileUpload, deleteEmailsPermanentlyController);
router.post("/draft/send", authenticateWithSubdomainCheck(true), profileUpload, saveDraftEmailController);
router.post("/list", authenticateWithSubdomainCheck(true), getEmailFoldersController);
router.post("/create/folder", authenticateWithSubdomainCheck(true), createEmailFolderController);
router.post("/update/folder", authenticateWithSubdomainCheck(true), renameEmailFolderController);
router.post("/folder/move", authenticateWithSubdomainCheck(true), moveEmailsToFolderController);

const operationHandlers: Record<
    string,
    (req: Request, res: Response, next: NextFunction) => Promise<any>
> = {
    "/folder": async (req, res, next) => {
        return await fetchFolderEmails(req, res, next);
    },
    "/folder/status": async (req, res, next) => {
        return await getFolderStatsController(req, res, next);
    },
};
router.post("/batch", authenticateWithSubdomainCheck(true), async (req, res, next) => {
    try {
        const results: any[] = [];
        console.log('req.body.operations -----', req.body.operations);
        for (const op of req.body.operations) {
            console.log('op ===', op);
            const handler = operationHandlers[op];
            console.log('handler ----', handler);
            if (handler) {
                const result = await handler(req, res, next);
                results.push({ path: op.path, result });
            } else {
                results.push({ path: op.path, error: "Unknown path" });
            }
        }

        res.json({ results });
    } catch (err) {
        next(err);
    }
});

export default router;
