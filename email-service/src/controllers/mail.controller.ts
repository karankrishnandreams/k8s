// controllers/mail.controller.ts

import {
  compileTemplateFromString,
  sendEmail,
} from "@utils/email.utils";
import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";

const unescapeHtmlString = (str: string): string => {
  return str.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
};

export const sendSimpleEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { to, subject, htmlBody, emailData } = req.body;

    if (!to || !subject || !htmlBody || !emailData) {
      throw createHttpError(400, "Missing required email fields");
    }

    // Unescape before compiling
    const cleanHtmlBody = unescapeHtmlString(htmlBody);
    // Inject values
    const html = compileTemplateFromString(cleanHtmlBody, emailData);
    await sendEmail({ to, subject, html });
    res.status(200).json({ message: "Email sent successfully" });
  } catch (error) {
    next(error);
  }
};

// export const sendEmailWithFile = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     const { to, subject, htmlBody, emailData, attachments } = req.body;

//     if (!to || !subject || !htmlBody || !emailData || !attachments) {
//       res
//         .status(400)
//         .json({ error: "Missing required email fields or attachments" });
//       return;
//     }

//     // Inject values
//     const html = compileTemplateFromString(htmlBody, emailData);

//     await sendEmailWithAttachment({ to, subject, html, attachments });

//     res
//       .status(200)
//       .json({ message: "Email with attachment sent successfully" });
//   } catch (error) {
//     next(error);
//   }
// };

// export const sendMultipleEmails = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     const { form_id, type, subject, htmlBody, patient, staff } = req.body;

//     if (type !== "Email") {
//       res
//         .status(400)
//         .json({ error: "Only 'email' type is supported currently." });
//       return;
//     }

//     if (!subject || !htmlBody) {
//       res
//         .status(400)
//         .json({ error: "Missing subject or htmlBody in request body" });
//       return;
//     }

//     // Fallback to empty array if patient/staff is undefined
//     const recipients = [
//       ...(Array.isArray(patient) ? patient : []),
//       ...(Array.isArray(staff) ? staff : []),
//     ];

//     if (recipients.length === 0) {
//       res.status(400).json({ error: "No recipients found" });
//       return;
//     }

//     const emailPromises = recipients.map(async ({ email, emailData }) => {
//       if (!email || !emailData) return;

//       const html = compileTemplateFromString(htmlBody, emailData);
//       return sendEmail({ to: email, subject, html });
//     });

//     await Promise.all(emailPromises);

//     res.status(200).json({ message: "Emails sent successfully" });
//   } catch (error) {
//     next(error);
//   }
// };
