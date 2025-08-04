import { Request, Response, NextFunction } from "express";
import { MailService } from "../services/mail.service";
import { fetchOutlookEmails, sendOutlookEmailViaSmtp } from "@services/outlook.service";
import kongAxios, { CustomAxiosRequestConfig } from "@services/kong.service";
import { getUserData } from "@utils/user.utils";
import { getDbConnection } from "@config/database";
import { Model } from "mongoose";
import { IUser } from "src/interface/user.interface";
import UserSchema from "@models/user.model";
import createHttpError from "http-errors";
import { getS3Parallel } from "@utils/auth.utils";
import path from "path";
import logger from "@utils/logger";
import axios from "axios";

type MailProvider = "gmail" | "outlook";

const isMailProvider = (value: string): value is MailProvider => {
    return value === "gmail" || value === "outlook";
};

const DB_NAME: any = process.env.DB_NAME;

// Helper to get tenant-aware User model
const getUserModel = (dbName: string): Model<IUser> => {
    const connection = getDbConnection(dbName);
    return connection.models.User || connection.model<IUser>("User", UserSchema);
};

export const fetchAllEmails = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { limit, offset, user, pass, provider } = req.body;

        if (!user || !pass || !provider) {
            res.status(400).json({ message: "Missing required fields" });
            return;
        }

        const mailService = new MailService({ user, pass, provider });
        const emails = await mailService.fetchAllFolders(Number(limit) || 5, Number(offset) || 0);

        res.status(200).json({ success: true, emails });
    } catch (err) {
        next(err);
    }
};

export const fetchFolderEmails = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { limit, folder, offset, searchQuery } = req.body;
        const dbName = (req.headers["x-db-name"] as string) || DB_NAME;

        const User = await getUserModel(dbName);

        //@ts-ignore
        const userId = req.user.id

        const userData = await User.findById(userId).select("-password");

        if (!userData) {
            throw createHttpError(404, "User not found");
        }

        console.log('userData', userData);

        const user = userData.emailSetting;
        const pass = userData.emailPassword;
        const provider = userData.emailType;

        console.log('user ---', user);
        console.log('pass ---', pass);
        console.log('provider ---', provider);

        if (!user || !pass || !provider || !folder || !offset || !limit) {
            res.status(400).json({ message: "Missing required fields" });
            return;
        }


        const mailService = new MailService({ user, pass, provider });
        const emails = await mailService.fetchEmailsFromFolder(folder, Number(limit), Number(offset), searchQuery);

        res.status(200).json({ success: true, emails });
    } catch (err) {
        console.log('error ---', err);
        next(err);
    }
};

export const sendEmailController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const body = JSON.parse(req.body.data);
        const { to, subject, text, html, cc, bcc } = body;
        const dbName = (req.headers["x-db-name"] as string) || DB_NAME;

        const User = await getUserModel(dbName);
        //@ts-ignore
        const userId = req.user.id;
        const userData: any = await User.findById(userId).select("-password");

        if (!userData) {
            throw createHttpError(404, "User not found");
        }

        console.log('userData ---', userData);

        const user = userData.emailSetting;
        const pass = userData.emailPassword;
        const provider = userData.emailType;
        const from = userData.emailSetting;
        const signatureHtml = userData.emailsignature;

        if (!user || !pass || !provider || !from || !to || !subject) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const files = req.files as {
            [field: string]: Express.Multer.File[];
        };

        const formattedAttachments =
            Object.values(files || {})
                .flat()
                .map((file: Express.Multer.File) => ({
                    filename: file.originalname,
                    content: file.buffer,
                    contentType: file.mimetype,
                }));

        console.log('formattedAttachments ---', formattedAttachments);
        let finalHtml = html || text || ""; // ✅ Always starts as string
        const attachments: any[] = [...formattedAttachments];

        // ✅ Handle signature safely
        let updatedSignature = typeof signatureHtml === "string" ? signatureHtml : "";

        console.log('updatedSignature ----', updatedSignature);

        if (updatedSignature.trim()) {
            const imgRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
            let match;
            let imgIndex = 0;

            while ((match = imgRegex.exec(updatedSignature)) !== null) {
                const originalSrc = match[1];
                console.log(`🔍 Found image src in signature: ${originalSrc}`);

                try {
                    const signedUrl = await getS3Parallel(originalSrc);
                    console.log('signedUrl ----', signedUrl);
                    const response = await axios.get(signedUrl, { responseType: "arraybuffer" });
                    console.log('response ----', response);
                    const imageBuffer = Buffer.from(response.data);
                    console.log('imageBuffer ----', imageBuffer);
                    const cid = `signatureImage${imgIndex}`;
                    console.log('cid ----', cid);

                    attachments.push({
                        filename: path.basename(originalSrc),
                        content: imageBuffer,
                        contentType: response.headers["content-type"] || "image/png",
                        cid,
                    });

                    console.log('attachments ----', attachments);

                    updatedSignature = updatedSignature.replace(originalSrc, `cid:${cid}`);
                    console.log('updatedSignature ----', updatedSignature);
                    imgIndex++;
                } catch (err) {
                    logger.warn(`⚠️ Failed to process signature image: ${originalSrc}`, err);
                }
            }

            finalHtml += updatedSignature;
            console.log("✅ Final HTML including signature:\n", finalHtml);
        } else {
            console.warn("⚠️ No valid signatureHtml found for user.");
        }

        const mailService = new MailService({ user, pass, provider });

        await mailService.sendAndStoreEmail({
            from,
            to,
            subject,
            text,
            html: finalHtml,
            attachments,
            cc,
            bcc,
        });

        res.status(200).json({
            success: true,
            message: "Email sent successfully",
        });
    } catch (err) {
        console.error("❌ Error in sendEmailController:", err);
        next(err);
    }
};

export const getFolderStatsController = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const dbName = (req.headers["x-db-name"] as string) || DB_NAME;

        const User = await getUserModel(dbName);

        //@ts-ignore
        const userId = req.user.id

        const userData = await User.findById(userId).select("-password");
        if (!userData) {
            throw createHttpError(404, "User not found");
        }

        console.log('userData', userData);

        const user = userData.emailSetting;
        const pass = userData.emailPassword;
        const provider = userData.emailType;

        console.log('user ---', user);
        console.log('pass ---', pass);
        console.log('provider ---', provider);


        if (
            typeof user !== "string" ||
            typeof pass !== "string" ||
            typeof provider !== "string" ||
            !isMailProvider(provider)
        ) {
            res.status(400).json({ message: "Missing or invalid email credentials." });
            return;
        }

        const mailService = new MailService({ user, pass, provider });

        const stats = await mailService.getAllFolderStats(); // ✅ dynamically fetch all folder counts
        await mailService.disconnect();

        res.status(200).json({ success: true, stats });
    } catch (err) {
        next(err);
    }
};


export const saveDraftEmailController = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const body = JSON.parse(req.body.data);

        const {
            from,
            to,
            cc,
            bcc,
            subject,
            text,
            html
        } = body;

        const dbName = (req.headers["x-db-name"] as string) || DB_NAME;

        const User = await getUserModel(dbName);

        //@ts-ignore
        const userId = req.user.id

        const userData = await User.findById(userId).select("-password");
        if (!userData) {
            throw createHttpError(404, "User not found");
        }

        console.log('userData', userData);

        const user = userData.emailSetting;
        const pass = userData.emailPassword;
        const provider = userData.emailType;

        console.log('user ---', user);
        console.log('pass ---', pass);
        console.log('provider ---', provider);


        // ✅ Validate required fields
        if (
            !user || !pass || !provider || !from || !to || !subject ||
            typeof user !== "string" ||
            typeof pass !== "string" ||
            typeof provider !== "string" ||
            typeof from !== "string" ||
            (typeof to !== "string" && !Array.isArray(to))
        ) {
            res.status(400).json({ message: "Missing or invalid required fields." });
            return;
        }

        if (provider !== "gmail" && provider !== "outlook") {
            res.status(400).json({ message: "Unsupported provider." });
            return;
        }

        const files = req.files as {
            [field: string]: Express.Multer.File[]; // e.g., attachments: [file1, file2]
        };
        const formattedAttachments =
            Object.values(files || {})
                .flat()
                .map((file: Express.Multer.File) => ({
                    filename: file.originalname,
                    content: file.buffer,
                    contentType: file.mimetype,
                }));

        const mailService = new MailService({ user, pass, provider: provider as MailProvider });

        await mailService.saveDraftEmail({
            from,
            to,
            cc,
            bcc,
            subject,
            text,
            html,
            attachments: formattedAttachments,
        });

        res.status(200).json({ success: true, message: "Email saved as draft successfully." });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Failed to save email as draft.",
            error: err instanceof Error ? err.message : String(err),
        });
    }
};

export const getOutlookEmails = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const start = Date.now();

    try {
        //@ts-ignore
        const user = req.emailSetting;

        //@ts-ignore
        const pass = req.emailPassword;

        const folder = (req.query.folder as string) || "INBOX";
        const limit = parseInt(req.query.limit as string) || 10;

        if (!user || !pass) {
            res.status(400).send({ message: "Missing x-email or x-password header" });
        }

        const messages = await fetchOutlookEmails({ user, pass, folder, limit });

        const end = Date.now();
        res.status(200).json({
            status: 200,
            message: "Emails fetched successfully",
            data: messages,
        });
    } catch (error) {
        return next(error);
    }
};

export const sendOutlookEmail = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const start = Date.now();

    try {
        //@ts-ignore
        const user = req.emailSetting;

        //@ts-ignore
        const pass = req.emailPassword;

        const { to, subject, text, html } = req.body;

        if (!user || !pass) {
            res.status(400).send({ message: "Missing x-email or x-password header" });
        }

        if (!to || !subject || (!text && !html)) {
            res.status(400).send({ message: "Missing required fields (to, subject, text/html)" });
        }

        const result = await sendOutlookEmailViaSmtp({
            user,
            pass,
            to,
            subject,
            text,
            html,
        });

        const end = Date.now();

        res.status(200).json({
            status: 200,
            message: "Email sent successfully",
            data: result,
        });
    } catch (error) {
        return next(error);
    }
};

export const updateEmailFlagsController = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { uid, addFlags, removeFlags } = req.body;

        if (!uid) {
            res.status(400).json({ error: "Missing uid" });
            return;
        }

        const dbName = (req.headers["x-db-name"] as string) || DB_NAME;

        const User = await getUserModel(dbName);

        //@ts-ignore
        const userId = req.user.id

        const userData = await User.findById(userId).select("-password");

        if (!userData) {
            throw createHttpError(404, "User not found");
        }

        console.log('userData', userData);

        const user: any = userData.emailSetting;
        const pass: any = userData.emailPassword;
        const provider: any = userData.emailType;

        console.log('user ---', user);
        console.log('pass ---', pass);
        console.log('provider ---', provider);


        const imapService = new MailService({ user, pass, provider });
        await imapService.updateEmailFlags({
            uid,
            addFlags: addFlags || [],
            removeFlags: removeFlags || [],
        });

        res.status(200).json({ message: 'Flags updated successfully' });
    } catch (error) {
        next(error);
    }
};

export const deleteEmailsPermanentlyController = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { uid } = req.body;

        const dbName = (req.headers["x-db-name"] as string) || DB_NAME;

        const User = await getUserModel(dbName);

        //@ts-ignore
        const userId = req.user.id

        const userData = await User.findById(userId).select("-password");

        if (!userData) {
            throw createHttpError(404, "User not found");
        }

        console.log('userData', userData);

        const user: any = userData.emailSetting;
        const pass: any = userData.emailPassword;
        const provider: any = userData.emailType;

        console.log('user ---', user);
        console.log('pass ---', pass);
        console.log('provider ---', provider);


        if (!uid || !Array.isArray(uid)) {
            res.status(400).json({ error: "Missing or invalid uid array" });
            return;
        }

        const imapService = new MailService({ user, pass, provider });

        await imapService.deleteEmailsPermanently(uid);

        res.status(200).json({ message: "Emails deleted permanently" });
    } catch (error) {
        next(error);
    }
};

export const getEmailFoldersController = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const dbName = (req.headers["x-db-name"] as string) || DB_NAME;

        const User = await getUserModel(dbName);

        //@ts-ignore
        const userId = req.user.id

        const userData = await User.findById(userId).select("-password");

        if (!userData) {
            throw createHttpError(404, "User not found");
        }

        console.log('userData', userData);

        const user: any = userData.emailSetting;
        const pass: any = userData.emailPassword;
        const provider: any = userData.emailType;

        console.log('user ---', user);
        console.log('pass ---', pass);
        console.log('provider ---', provider);


        const imapService = new MailService({ user, pass, provider });

        const folders = await imapService.getAllFolders();

        res.status(200).json({ folders });
    } catch (error) {
        next(error);
    }
};

export const createEmailFolderController = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { folderName } = req.body;
        const dbName = (req.headers["x-db-name"] as string) || DB_NAME;

        const User = await getUserModel(dbName);

        //@ts-ignore
        const userId = req.user.id

        const userData = await User.findById(userId).select("-password");

        if (!userData) {
            throw createHttpError(404, "User not found");
        }

        console.log('userData', userData);

        const user: any = userData.emailSetting;
        const pass: any = userData.emailPassword;
        const provider: any = userData.emailType;

        console.log('user ---', user);
        console.log('pass ---', pass);
        console.log('provider ---', provider);


        if (!folderName || typeof folderName !== 'string') {
            res.status(400).json({ error: 'Missing or invalid folderName in request body' });
            return;
        }

        const imapService = new MailService({ user, pass, provider });

        await imapService.createFolder(folderName);

        res.status(200).json({ message: `Folder '${folderName}' created successfully` });
    } catch (error) {
        next(error);
    }
};

// Rename Folder Controller
export const renameEmailFolderController = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { oldName, newName } = req.body;
        const dbName = (req.headers["x-db-name"] as string) || DB_NAME;

        const User = await getUserModel(dbName);

        //@ts-ignore
        const userId = req.user.id

        const userData = await User.findById(userId).select("-password");

        if (!userData) {
            throw createHttpError(404, "User not found");
        }

        console.log('userData', userData);

        const user: any = userData.emailSetting;
        const pass: any = userData.emailPassword;
        const provider: any = userData.emailType;

        console.log('user ---', user);
        console.log('pass ---', pass);
        console.log('provider ---', provider);


        if (!oldName || !newName || typeof oldName !== 'string' || typeof newName !== 'string') {
            res.status(400).json({ error: 'Missing or invalid oldName or newName' });
            return;
        }

        const imapService = new MailService({ user, pass, provider });

        await imapService.renameFolder(oldName, newName);

        res.status(200).json({ message: `Folder renamed from '${oldName}' to '${newName}'` });
    } catch (error) {
        next(error);
    }
};

export const moveEmailsToFolderController = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { uids, sourceFolder, destinationFolder } = req.body;

        const dbName = (req.headers["x-db-name"] as string) || DB_NAME;

        const User = await getUserModel(dbName);

        //@ts-ignore
        const userId = req.user.id

        const userData = await User.findById(userId).select("-password");

        if (!userData) {
            throw createHttpError(404, "User not found");
        }

        console.log('userData', userData);

        const user: any = userData.emailSetting;
        const pass: any = userData.emailPassword;
        const provider: any = userData.emailType;

        console.log('user ---', user);
        console.log('pass ---', pass);
        console.log('provider ---', provider);


        if (
            !Array.isArray(uids) ||
            typeof sourceFolder !== "string" ||
            typeof destinationFolder !== "string"
        ) {
            res.status(400).json({ message: "Invalid request body" });
            return
        }

        const mailService = new MailService({ user, pass, provider });
        await mailService.moveEmailsToFolder(uids, sourceFolder, destinationFolder);

        res.status(200).json({ success: true, message: "Emails moved successfully" });
    } catch (err) {
        console.error("Move Email Error:", err);
        next(err);
    }
};

