import logger from "@utils/logger";
import { ImapFlow, ImapFlowOptions } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";

export type MailProvider = "gmail" | "outlook";

interface ImapAuth {
    user: string;
    pass: string;
    provider: MailProvider;
}

export interface MailData {
    folder: string;
    from?: string;
    subject?: string;
    text?: string;
    html?: string;
    date?: Date;
}
interface Attachment {
    cid?: any;
    filename: string;
    content: Buffer | string;
    contentType?: string;
}

interface SendEmailOptions {
    from: string;
    to: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject: string;
    text?: string;
    html?: string;
    attachments?: Attachment[];
}
export interface MailData {
    folder: string;
    from?: string;
    to?: string;
    cc?: string;
    bcc?: string;
    subject?: string;
    messageId?: string;
    inReplyTo?: string;
    references?: string[] | string;
    date?: Date;
    headers?: Record<string, string>;
    text?: string;
    html?: string;
    attachments?: {
        filename: string;
        contentType: string;
        size: number;
        cid?: string;
        contentDisposition?: string;
    }[];
    uid: string;
    seen: boolean;
    starred: boolean;
    seq: string;
}


interface UpdateEmailFlagsOptions {
    uid: any;
    addFlags?: string[];
    removeFlags?: string[];
}

export class MailService {
    private client: ImapFlow;

    constructor(private auth: ImapAuth) {
        const config: ImapFlowOptions = {
            host: this.getHost(),
            port: 993,
            secure: true,
            auth: {
                user: auth.user,
                pass: auth.pass,
            },
            logger: false,
            socketTimeout: 60000, // ✅ Add socket timeout
        };

        this.client = new ImapFlow(config);

        // ✅ Periodic NOOP to keep connection alive
        setInterval(() => {
            if (this.client?.authenticated) {
                this.client.noop().catch(err =>
                    logger.warn("NOOP failed (safe to ignore if reconnects later):", err.message)
                );
            }

        }, 5 * 60 * 1000); // every 5 minutes
    }

    private getHost(): string {
        switch (this.auth.provider) {
            case "gmail":
                return "imap.gmail.com";
            case "outlook":
                return "outlook.office365.com";
            default:
                throw new Error("Unsupported provider");
        }
    }

    // ✅ Updated connectSafe with retry logic
    private async connectSafe(retries = 3): Promise<{ success: boolean; error?: string }> {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                await this.client.connect();
                return { success: true };
            } catch (error: any) {
                logger.error(`IMAP connection failed (attempt ${attempt})`, error);
                if (error?.authenticationFailed) return { success: false, error: "Invalid credentials" };
                if (error?.message?.includes("timeout")) return { success: false, error: "Connection timed out" };

                if (attempt < retries) {
                    await new Promise((res) => setTimeout(res, 2000)); // wait 2 seconds
                } else {
                    return { success: false, error: error?.message || "Unable to connect to mail server" };
                }
            }
        }

        return { success: false, error: "Exceeded connection retry limit" };
    }

    // ✅ You can keep your existing disconnect and other methods as-is
    async disconnect() {
        try {
            await this.client.logout();
        } catch (error) {
            logger.warn("IMAP disconnect failed", error);
        }
    }


    private getDefaultFolders(): string[] {
        return this.auth.provider === "gmail"
            ? ["INBOX", "[Gmail]/Sent Mail", "[Gmail]/Drafts"]
            : ["INBOX", "Sent Items", "Drafts"];
    }

    private async fetchEmailsFromFolderInternal(
        folder: string,
        limit: number = 10,
        offset: number = 1, // treated as page number
        searchQuery?: string
    ): Promise<(MailData & { replies: MailData[] })[]> {
        const mainFolderEmails: MailData[] = [];
        const relatedFolderEmails: MailData[] = [];

        const page = Math.max(offset, 1);
        const skip = (page - 1) * limit;

        let mainLock;
        try {
            mainLock = await this.client.getMailboxLock(folder);
            const mailbox = await this.client.mailboxOpen(folder);
            if (!mailbox) {
                logger.warn(`[${folder}] Failed to open mailbox`);
                return [];
            }

            const criteria = searchQuery?.trim()
                ? {
                    or: [
                        { from: searchQuery },
                        { to: searchQuery },
                        { subject: searchQuery },
                    ],
                }
                : {};

            const uids: any = await this.client.search(criteria);

            const sortedUIDs = [...uids].sort((a, b) => b - a);

            const paginatedUIDs = sortedUIDs.slice(skip, skip + limit);

            if (!paginatedUIDs.length) {
                return [];
            }

            const messages: any = this.client.fetch(paginatedUIDs, {
                uid: true,
                envelope: true,
                source: true,
                flags: true,
            });

            for await (const msg of messages) {
                try {
                    const parsed: any = await simpleParser(msg.source);
                    const flags = Array.isArray(msg.flags) ? msg.flags : Array.from(msg.flags ?? []);

                    mainFolderEmails.push({
                        uid: msg.uid,
                        seq: msg.seq,
                        folder,
                        from: parsed.from?.text || '',
                        to: parsed.to?.text || '',
                        cc: parsed.cc?.text || '',
                        bcc: parsed.bcc?.text || '',
                        subject: parsed.subject || '',
                        messageId: parsed.messageId || '',
                        inReplyTo: parsed.inReplyTo || '',
                        references: parsed.references || [],
                        date: parsed.date || new Date(),
                        headers: Object.fromEntries(parsed.headers || []),
                        text: parsed.text || '',
                        html: parsed.html || '',
                        seen: flags.includes('\\Seen'),
                        starred: flags.includes('\\Flagged'),
                        attachments: parsed.attachments?.map((att: any) => ({
                            filename: att.filename,
                            contentType: att.contentType,
                            size: att.size,
                            cid: att.cid,
                            contentDisposition: att.contentDisposition,
                            content: att.content.toString("base64"),
                        })) || [],
                    });
                } catch (parseErr) {
                    logger.warn(`[${folder}] Failed to parse email UID ${msg.uid}`, parseErr);
                }
            }
        } catch (err) {
            logger.error(`[${folder}] Error fetching emails:`, err);
            return [];
        } finally {
            if (mainLock) {
                try {
                    mainLock.release();
                    logger.info(`[${folder}] Released mailbox lock`);
                } catch (releaseErr) {
                    logger.warn(`[${folder}] Failed to release lock`, releaseErr);
                }
            }
        }

        // Related folders
        const relatedFolders = this.getThreadRelevantFolders(folder).filter((f) => f !== folder);
        const relatedFetchLimit = 50;

        for (const relatedFolder of relatedFolders) {
            let relatedLock;
            try {
                relatedLock = await this.client.getMailboxLock(relatedFolder);
                const mailbox = await this.client.mailboxOpen(relatedFolder);
                if (!mailbox) {
                    continue;
                }

                const uids: any = await this.client.search({});

                const sortedUIDs = [...uids].sort((a, b) => b - a).slice(0, relatedFetchLimit);

                if (!sortedUIDs.length) {
                    continue;
                }

                const messages: any = this.client.fetch(sortedUIDs, {
                    uid: true,
                    envelope: true,
                    source: true,
                    flags: true,
                });

                for await (const msg of messages) {
                    try {
                        const parsed: any = await simpleParser(msg.source);
                        const flags = Array.isArray(msg.flags) ? msg.flags : Array.from(msg.flags ?? []);


                        relatedFolderEmails.push({
                            uid: msg.uid,
                            seq: msg.seq,
                            folder: relatedFolder,
                            from: parsed.from?.text || '',
                            to: parsed.to?.text || '',
                            cc: parsed.cc?.text || '',
                            bcc: parsed.bcc?.text || '',
                            subject: parsed.subject || '',
                            messageId: parsed.messageId || '',
                            inReplyTo: parsed.inReplyTo || '',
                            references: parsed.references || [],
                            date: parsed.date || new Date(),
                            headers: Object.fromEntries(parsed.headers || []),
                            text: parsed.text || '',
                            html: parsed.html || '',
                            seen: flags.includes('\\Seen'),
                            starred: flags.includes('\\Flagged'),
                            attachments: parsed.attachments?.map((att: any) => ({
                                filename: att.filename,
                                contentType: att.contentType,
                                size: att.size,
                                cid: att.cid,
                                contentDisposition: att.contentDisposition,
                                content: att.content.toString("base64"),
                            })) || [],
                        });
                    } catch (parseErr) {
                        logger.warn(`[${relatedFolder}] Failed to parse email UID ${msg.uid}`, parseErr);
                    }
                }
            } catch (err) {
                logger.error(`[${relatedFolder}] Error fetching emails:`, err);
            } finally {
                if (relatedLock) {
                    try {
                        await relatedLock.release();
                    } catch (releaseErr) {
                        logger.warn(`[${relatedFolder}] Failed to release lock`, releaseErr);
                    }
                }
            }
        }

        const allEmails: any = [...mainFolderEmails, ...relatedFolderEmails];

        const messageIdMap = new Map<string, MailData>();
        allEmails.forEach((mail: MailData) => {
            if (mail.messageId) {
                messageIdMap.set(mail.messageId, mail);
            }
        });

        const threadMap = new Map<string, { root: MailData; replies: MailData[] }>();
        for (const email of allEmails) {
            const parentId =
                email.inReplyTo ||
                (Array.isArray(email.references) && email.references.length
                    ? email.references[email.references.length - 1]
                    : null);

            if (parentId && messageIdMap.has(parentId)) {
                const parent = messageIdMap.get(parentId)!;
                const threadRootId: any = parent.messageId;
                if (!threadMap.has(threadRootId)) {
                    threadMap.set(threadRootId, { root: parent, replies: [] });
                }
                threadMap.get(threadRootId)!.replies.push(email);
            } else {
                if (!threadMap.has(email.messageId)) {
                    threadMap.set(email.messageId, { root: email, replies: [] });
                }
            }
        }

        const filteredThreads = Array.from(threadMap.values()).filter((thread) => {
            const allThreadMails = [thread.root, ...thread.replies];
            return allThreadMails.some((mail) => mail.folder === folder);
        });

        filteredThreads.sort((a: any, b: any) => b.root.date.getTime() - a.root.date.getTime());

        const paginatedThreads = filteredThreads.slice(0, limit);

        return paginatedThreads.map((thread) => ({
            ...thread.root,
            replies: thread.replies,
        }));
    }

    private getThreadRelevantFolders(folder: string): string[] {
        if (folder === 'INBOX') {
            return ['INBOX', '[Gmail]/Sent Mail', '[Gmail]/Drafts'];
        } else if (folder === '[Gmail]/Sent Mail') {
            return ['[Gmail]/Sent Mail', 'INBOX', '[Gmail]/Drafts'];
        } else if (folder === '[Gmail]/Drafts') {
            return ['[Gmail]/Drafts', 'INBOX', '[Gmail]/Sent Mail'];
        } else {
            return [folder];
        }
    }

    async fetchEmailsFromFolder(
        folder: string,
        limit: number,
        offset: number,
        searchQuery?: string
    ): Promise<(MailData & { replies: MailData[] })[]> {
        try {
            const { success, error } = await this.connectSafe();
            if (!success) throw new Error(error);
            const threads = await this.fetchEmailsFromFolderInternal(folder, limit, offset, searchQuery);
            return threads;
        } catch (err) {
            logger.error(`Error in fetchEmailsFromFolder for folder ${folder}`, err);
            return [];
        } finally {
            try {
                await this.disconnect();
            } catch (disconnectErr) {
                logger.warn("Failed to disconnect IMAP client cleanly", disconnectErr);
            }
        }
    }

    async fetchAllFolders(limitPerFolder: number = 10, offset: number = 1): Promise<MailData[]> {
        const allEmails: MailData[] = [];
        try {
            const { success, error } = await this.connectSafe();
            if (!success) throw new Error(error);

            const folders = this.getDefaultFolders();
            for (const folder of folders) {
                const threads: any = await this.fetchEmailsFromFolderInternal(folder, limitPerFolder, offset);
                const flattenedEmails = threads.flatMap((thread: { root: any; replies: any; }) => [thread.root, ...thread.replies]);
                allEmails.push(...flattenedEmails);
            }
        } catch (error) {
            logger.error("Error fetching all folders", error);
        } finally {
            try {
                await this.disconnect();
            } catch (disconnectErr) {
                logger.warn("Failed to disconnect IMAP client cleanly", disconnectErr);
            }
        }

        return allEmails;
    }
    private getSmtpConfig() {
        return {
            host: this.auth.provider === "gmail" ? "smtp.gmail.com" : "smtp.office365.com",
            port: this.auth.provider === "gmail" ? 465 : 587,
            secure: this.auth.provider === "gmail",
            auth: {
                user: this.auth.user,
                pass: this.auth.pass,
            },
        };
    }

    async sendAndStoreEmail(options: SendEmailOptions): Promise<void> {
        try {
            const attachments = (options.attachments || []).map((att) => ({
                filename: att.filename,
                content: att.content,
                contentType: att.contentType,
                cid: att.cid,
                contentDisposition: att.cid ? 'inline' as "inline" : 'attachment' as "attachment"
            }));

            const to = Array.isArray(options.to) ? options.to.join(", ") : options.to;
            const cc = Array.isArray(options.cc) ? options.cc.join(", ") : options.cc;
            const bcc = Array.isArray(options.bcc) ? options.bcc.join(", ") : options.bcc;

            const transporter = nodemailer.createTransport(this.getSmtpConfig());

            await transporter.sendMail({
                from: options.from,
                to,
                cc,
                bcc,
                subject: options.subject,
                text: options.text,
                html: options.html,
                attachments,
            });

        } catch (err) {
            logger.error("sendAndStoreEmail", "Error sending email via SMTP", err);
            throw err;
        }
    }


    async saveDraftEmail(options: SendEmailOptions): Promise<void> {
        try {
            const attachments = (options.attachments || []).map((att) => ({
                filename: att.filename,
                content: att.content,
                contentType: att.contentType,
            }));

            const to = Array.isArray(options.to) ? options.to.join(", ") : options.to;
            const cc = Array.isArray(options.cc) ? options.cc.join(", ") : options.cc;
            const bcc = Array.isArray(options.bcc) ? options.bcc.join(", ") : options.bcc;

            const draftFolder = this.auth.provider === "gmail" ? "[Gmail]/Drafts" : "Drafts";

            const composer = new MailComposer({
                from: options.from,
                to,
                cc,
                bcc,
                subject: options.subject,
                text: options.text,
                html: options.html,
                attachments,
            });

            const raw = await new Promise<Buffer>((resolve, reject) => {
                composer.compile().build((err, message) => {
                    if (err) reject(err);
                    else resolve(message);
                });
            });

            const { success, error } = await this.connectSafe();
            if (!success) throw new Error(error);

            try {
                await this.client.append(draftFolder, raw, ['\\Draft']);
            } catch (err) {
                logger.error("saveDraftEmail", "Error saving email to Drafts", err);
                throw err;
            } finally {
                await this.disconnect();
            }
        } catch (err) {
            logger.error("saveDraftEmail", "Unexpected error", err);
            throw err;
        }
    }

    async getAllFolderStats(): Promise<Record<string, { total: number; unread: number }>> {
        try {
            const { success, error } = await this.connectSafe();
            if (!success) {
                throw new Error(error);
            }

            const result: Record<string, { total: number; unread: number }> = {};
            const folderTree = await this.client.list();

            const gmailSpecialFolders = new Set([
                'Starred', 'Sent Mail', 'Drafts', 'Trash',
                'Spam', 'All Mail', 'Important',
            ]);

            const flattenSelectableFolders = (boxes: any, parentPath = ''): string[] => {
                return Object.values(boxes).flatMap((box: any) => {
                    const delimiter = box.delimiter || '/';
                    const fullPath = parentPath ? `${parentPath}${delimiter}${box.name}` : box.name;

                    const hasNoSelect = box.flags instanceof Set
                        ? box.flags.has('\\Noselect')
                        : Array.isArray(box.flags)
                            ? box.flags.includes('\\Noselect')
                            : false;

                    if (hasNoSelect || !box.listed) {
                        return box.children ? flattenSelectableFolders(box.children, fullPath) : [];
                    }

                    const children = box.children ? flattenSelectableFolders(box.children, fullPath) : [];
                    return [fullPath, ...children];
                });
            };

            const allFolders = flattenSelectableFolders(folderTree);

            const normalizeFolderName = (folder: string): string => {
                const parts = folder.split('/');
                const last = parts[parts.length - 1];
                return gmailSpecialFolders.has(last) && !folder.startsWith('[Gmail]/')
                    ? `[Gmail]/${last}`
                    : folder;
            };

            for (const folder of allFolders) {
                try {
                    const normalized = normalizeFolderName(folder);

                    const lock = await this.client.getMailboxLock(normalized);
                    try {
                        await this.client.mailboxOpen(normalized);
                        const status = await this.client.status(normalized, {
                            messages: true,
                            unseen: true
                        });
                        result[folder] = {
                            total: status.messages || 0,
                            unread: status.unseen || 0,
                        };
                    } finally {
                        lock.release();
                    }
                } catch (err: any) {
                    logger.warn("getAllFolderStats", `Could not access folder "${folder}": ${err.message || err}`, err);
                }
            }

            return result;

        } catch (err) {
            throw err;
        } finally {
            await this.disconnect();
        }
    }

    async updateEmailFlags(options: UpdateEmailFlagsOptions): Promise<void> {
        const { uid: folderUidMapArray, addFlags = [], removeFlags = [] } = options;


        try {
            const { success, error } = await this.connectSafe();
            if (!success) throw new Error(error);
            for (const entry of folderUidMapArray) {
                const folder = Object.keys(entry)[0];
                const uid = entry[folder];
                const uidStr = String(uid);

                await this.client.mailboxOpen(folder);

                if (addFlags.includes('\\Deleted') && folder !== '[Gmail]/Trash') {
                    try {
                        await this.client.messageMove(uidStr, '[Gmail]/Trash', { uid: true });
                        await this.client.messageFlagsRemove(uidStr, ['\\Inbox'], { uid: true });
                    } catch (moveErr) {
                        logger.warn("updateEmailFlags", "Move failed, using copy/delete fallback", moveErr);
                        await this.client.messageCopy(uidStr, '[Gmail]/Trash', { uid: true });
                        await this.client.messageFlagsAdd(uidStr, ['\\Deleted'], { uid: true });
                        await this.client.messageFlagsRemove(uidStr, ['\\Inbox'], { uid: true });
                        await this.client.mailboxClose(); // expunge
                    }
                    continue;
                }

                if (addFlags.length > 0) {
                    await this.client.messageFlagsAdd(uidStr, addFlags, { uid: true });
                }

                if (removeFlags.length > 0) {
                    await this.client.messageFlagsRemove(uidStr, removeFlags, { uid: true });
                }
            }
        } catch (err) {
            logger.error("updateEmailFlags", "Error updating flags", err);
            throw err;
        } finally {
            await this.disconnect();
        }
    }

    async deleteEmailsPermanently(entries: { [folder: string]: number }[]): Promise<void> {

        try {
            const { success, error } = await this.connectSafe();
            if (!success) throw new Error(error);
            const folderMap = new Map<string, number[]>();

            for (const entry of entries) {
                const folder = Object.keys(entry)[0];
                const uid = entry[folder];
                if (!folderMap.has(folder)) folderMap.set(folder, []);
                folderMap.get(folder)!.push(uid);
            }

            for (const [folder, uids] of folderMap.entries()) {
                try {
                    const uidSet = uids.join(',');
                    await this.client.mailboxOpen(folder);
                    await this.client.messageFlagsAdd(uidSet, ['\\Deleted'], { uid: true });
                    await this.client.mailboxClose(); // triggers EXPUNGE
                } catch (err) {
                    logger.error("deleteEmailsPermanently", `Failed to delete in folder ${folder}`, err);
                }
            }
        } catch (err) {
            logger.error("deleteEmailsPermanently", "Unexpected error", err);
            throw err;
        } finally {
            await this.disconnect();
        }
    }

    async getAllFolders(): Promise<string[]> {

        try {
            const { success, error } = await this.connectSafe();
            if (!success) throw new Error(error);
            const mailboxList = await this.client.list();

            const flattenFolders = (boxes: any, path: string = ''): string[] => {
                return Object.values(boxes).flatMap((box: any) => {
                    const fullPath = path ? `${path}${box.delimiter}${box.name}` : box.name;
                    return box.children
                        ? [fullPath, ...flattenFolders(box.children, fullPath)]
                        : [fullPath];
                });
            };

            const allFolders = flattenFolders(mailboxList);

            const defaultFolders = new Set([
                'inbox', 'sent', 'sent mail', '[gmail]/sent mail',
                'drafts', '[gmail]/drafts', 'trash', '[gmail]/trash',
                'starred', '[gmail]/starred', 'spam', '[gmail]/spam',
                'important', '[gmail]/important', 'all mail', '[gmail]/all mail', '[gmail]'
            ]);

            return allFolders.filter(folder => !defaultFolders.has(folder.toLowerCase()));
        } finally {
            await this.disconnect();
        }
    }

    async createFolder(folderName: string): Promise<void> {

        try {
            const { success, error } = await this.connectSafe();
            if (!success) throw new Error(error);
            await this.client.mailboxCreate(folderName);
        } catch (err) {
            logger.error("createFolder", `Failed to create folder "${folderName}"`, err);
            throw err;
        } finally {
            await this.disconnect();
        }
    }

    async renameFolder(oldName: string, newName: string): Promise<void> {

        try {
            const { success, error } = await this.connectSafe();
            if (!success) throw new Error(error);
            await this.client.mailboxRename(oldName, newName);
        } catch (err) {
            logger.error("renameFolder", `Failed to rename folder "${oldName}" -> "${newName}"`, err);
            throw err;
        } finally {
            await this.disconnect();
        }
    }

    async moveEmailsToFolder(
        ids: number[],
        sourceFolder: string,
        destinationFolder: string,
        idsAreUIDs: boolean = false
    ): Promise<void> {
        try {
            const { success, error } = await this.connectSafe();
            if (!success) {
                throw new Error(error);
            }

            // Check destination folder exists
            const folders = await this.client.list();
            const folderNames = folders.map(f => f.path);
            if (!folderNames.includes(destinationFolder)) {
                throw new Error(`Destination folder "${destinationFolder}" not found on server.`);
            }

            const lock = await this.client.getMailboxLock(sourceFolder);
            try {
                const mailbox = await this.client.mailboxOpen(sourceFolder);
                if (!mailbox) {
                    const msg = `Failed to open mailbox: ${sourceFolder}`;
                    throw new Error(msg);
                }

                let uidsToMove: any;

                if (idsAreUIDs) {
                    uidsToMove = ids;
                } else {

                    const seqToUidMap = new Map<number, number>();
                    const messages = this.client.fetch(ids, { uid: true });

                    let foundCount = 0;
                    for await (const msg of messages) {
                        seqToUidMap.set(msg.seq, msg.uid);
                        foundCount++;
                    }

                    if (foundCount !== ids.length) {
                        const missingSeqs = ids.filter(seq => !seqToUidMap.has(seq));
                        throw new Error(`Some sequence numbers could not be mapped to UIDs`);
                    }

                    uidsToMove = ids.map(seq => seqToUidMap.get(seq)!) as number[];
                }

                if (uidsToMove.length === 0) {
                    return;
                }

                const supportsMove = this.client.capabilities.has('MOVE');

                if (supportsMove) {
                    // MOVE command expects UIDs, so pass uidsToMove with { uid: true }
                    await this.client.messageMove(uidsToMove, destinationFolder, { uid: true });
                } else {
                    // Copy by UIDs
                    await this.client.messageCopy(uidsToMove, destinationFolder, { uid: true });
                    // Delete messages by sequence number or UID depending on original input
                    if (!idsAreUIDs) {
                        await this.client.messageDelete(ids);
                    } else {
                        await this.client.messageDelete(uidsToMove, { uid: true });
                    }
                }

                // Open destination folder and verify moved messages exist
                await this.client.mailboxOpen(destinationFolder);
                // NOOP to refresh state
                try {
                    await this.client.noop();
                } catch { }

            } catch (err) {
                throw err;
            } finally {
                lock.release();
                await this.disconnect();
            }
        } catch (error) {
            console.error(`[moveEmailsToFolder] Failed to move messages:`, error);
        }
    }

}

