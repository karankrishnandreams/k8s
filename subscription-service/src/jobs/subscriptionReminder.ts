import { Job } from "agenda";
import { agenda } from "../utils/agenda";
import kongAxios from "../services/kong.service";
import { getDbConnection } from "@config/database";
import { Model } from "mongoose";
import { IEmailTemplate } from "@interfaces/emailtemplate.interface";
import EmailTemplateSchema from "@models/emailtemplate.model";

interface ReminderJobData {
  dbName: string;
  companyId: string;
  companyObjId: string;
  when: string;
  nextBillingDate: Date;
  companyEmail: string;
}

const getEmailTemplateModel = (dbName: string): Model<IEmailTemplate> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.EmailTemplate ||
    connection.model<IEmailTemplate>("EmailTemplate", EmailTemplateSchema)
  );
};

export const defineSubscriptionReminderJob = () => {
  agenda.define("send-subscription-reminder", async (job: Job<ReminderJobData>) => {
    const { dbName, companyId, when, nextBillingDate, companyEmail } = job.attrs.data;

    const EmailTemplate = getEmailTemplateModel(dbName);
    const template = await EmailTemplate.findOne({
      slug: "subscription-reminder",
      isActive: true,
    }).select("htmlBody");

    if (!template) return;

    await kongAxios({
      method: "post",
      url: "/email/public/mail/send",
      data: {
        to: companyEmail,
        subject: `Subscription Reminder - ${when}`,
        htmlBody: template.htmlBody,
        message: "Subscription reminder",
        emailData: {
          name: "User Name", // TODO: Replace with real user name
          dueDate: nextBillingDate,
          reminderType: when,
        },
      },
    });

    console.log(`✅ Reminder "${when}" sent for company ${companyId}`);
  });
};
