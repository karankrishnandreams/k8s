import { ImapFlow, ImapFlowOptions } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";

interface ImapAuth {
    user: string;
    pass: string;
    folder: string;
    limit: number;
}

interface SmtpMailOptions {
    user: string;
    pass: string;
    to: string;
    subject: string;
    text?: string;
    html?: string;
}

interface ImapFlowOptionsWithAuthHandler extends ImapFlowOptions {
    authHandler?: (
        log: any,
        imapClient: any,
        auth: any
    ) => Promise<void>;
}

export const fetchOutlookEmails = async ({
    user,
    pass,
    folder,
    limit,
}: ImapAuth) => {
    const client = new ImapFlow({
        host: "outlook.office365.com",
        port: 993,
        secure: true,
        auth: { user, pass }, // just this, no authHandler override
    });

    const messages: any[] = [];

    try {
        await client.connect();
        const mailbox = await client.mailboxOpen(folder);

        const startSeq = Math.max(1, mailbox.exists - limit + 1);

        for await (const msg of client.fetch(`${startSeq}:*`, {
            uid: true,
            envelope: true,
            source: true,
        })) {
            if (!msg.source) continue;
            const parsed: any = await simpleParser(msg.source);
            messages.push({
                uid: msg.uid,
                from: parsed.from?.text,
                to: parsed.to?.text,
                subject: parsed.subject,
                date: parsed.date,
                text: parsed.text,
                html: parsed.html,
            });
        }
    } catch (error) {
        console.error("❌ Error in fetchOutlookEmails:", error);
        throw error;
    } finally {
        if (client && client.usable) {
            await client.logout().catch(() => null);
        }
    }

    return messages;
};

export const sendOutlookEmailViaSmtp = async ({
    user,
    pass,
    to,
    subject,
    text,
    html,
}: SmtpMailOptions) => {
    const transporter = nodemailer.createTransport({
        host: "smtp.office365.com",
        port: 587,
        secure: false,
        auth: { user, pass },
    });

    const info = await transporter.sendMail({
        from: user,
        to,
        subject,
        text,
        html,
    });

    return { messageId: info.messageId };
};
