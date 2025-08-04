import sgMail from "@sendgrid/mail";
import Handlebars from "handlebars";

//@ts-ignore
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export const sendEmail = async ({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) => {
  const msg = {
    to,
    from: process.env.SENDGRID_FROM_EMAIL as string,
    subject,
    html,
  };

  return sgMail.send(msg);
};

// export const sendEmailWithAttachment = async ({
//   to,
//   subject,
//   html,
//   attachments,
// }: {
//   to: string;
//   subject: string;
//   html: string;
//   attachments: { filename: string; path: string }[];
// }) => {
//   const fs = await import("fs/promises");

//   const formattedAttachments = await Promise.all(
//     attachments.map(async (att) => {
//       const content = await fs.readFile(att.path, { encoding: "base64" });
//       return {
//         content,
//         filename: att.filename,
//         type: "application/pdf", // adjust MIME type as needed
//         disposition: "attachment",
//       };
//     })
//   );

//   const msg = {
//     to,
//     from: process.env.SENDGRID_FROM_EMAIL as string,
//     subject,
//     html,
//     attachments: formattedAttachments,
//   };

//   return sgMail.send(msg);
// };

export const compileTemplateFromString = (
  htmlBody: string,
  data: Record<string, any>
): string => {
  const template = Handlebars.compile(htmlBody);
  return template(data);
};

// interface EmailPayload {
//   to: string;
//   subject: string;
//   htmlBody: string;
// }

// export async function sendEmail({ to, subject, htmlBody }: EmailPayload): Promise<void> {
//   const transporter = nodemailer.createTransport({
//     host: process.env.EMAIL_HOST,
//     port: 465,
//     secure: false, // use TLS with port 587
//     auth: {
//       user: process.env.EMAIL_ADDRESS,
//       pass: process.env.EMAIL_PASSWORD,
//     },
//     tls: {
//       minVersion: 'TLSv1.2',
//     },
//   });


//   const mailOptions = {
//     from: process.env.SENDGRID_FROM_EMAIL as string,
//     to,
//     subject,
//     htmlBody,
//   };

//   try {
//     const info = await transporter.sendMail(mailOptions);
//     console.log('Email sent:', info.response);
//   } catch (err) {
//     console.error('Failed to send email:', err);
//   }
// }
