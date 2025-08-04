import { Job } from "agenda";
import { agenda } from "../utils/agenda";
import { getDbConnection } from "@config/database";
import EmailTemplateSchema from "@models/emailtemplate.model";
import { IEmailTemplate } from "@interfaces/emailtemplate.interface";
import { Model } from "mongoose";
import kongAxios from "../services/kong.service";

interface EventReminderJobData {
  dbName: string;
  companyObjId: string;
  eventId: string;
  event_title: string;
  event_date: string;
  start_time: string;
  location: string;
  event_url: string;
  email: string;
  user_name: string;
  when: string;
  company_id: string;
  assignee: string;
  userId: string
}

const getEmailTemplateModel = (dbName: string): Model<IEmailTemplate> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.EmailTemplate ||
    connection.model<IEmailTemplate>("EmailTemplate", EmailTemplateSchema)
  );
};

export const defineEventReminderJob = () => {

  agenda.define("send-event-reminder", async (job: Job<EventReminderJobData>) => {
    const {
      dbName,
      companyObjId,
      eventId,
      event_title,
      event_date,
      start_time,
      location,
      event_url,
      email,
      user_name,
      when,
      company_id,
      assignee,
      userId,
    } = job.attrs.data;

    try {
      const EmailTemplate = getEmailTemplateModel(dbName);
      const template = await EmailTemplate.findOne({
        slug: "calendar-event-reminder-email",
        isActive: true,
      }).select("htmlBody");

      if (!template) {
        console.warn("📭 No active template found for calendar-event-reminder-email");
        return;
      }

      const emailData = {
        user_name,
        event_title,
        event_date,
        start_time,
        location,
        event_url,
        when,
      };

      const configEmail = {
        method: "post",
        url: "/email/public/mail/send",
        data: {
          to: email,
          subject: `Reminder: ${event_title}`,
          htmlBody: template.htmlBody,
          message: "Event Reminder",
          emailData,
        },
      };

      await kongAxios(configEmail);

      const configSoket = {
        method: "post",
        url: "/chat/public/message/calendar",
        data: {
          roomName: 'general',
          content: 'There will be an event in 15 minutes',
          from: 'system',
          assignee,
          userId,
        },
      };

      await kongAxios(configSoket);
      console.log(`✅ Reminder (${when}) sent for event: ${eventId}`);

    } catch (err) {
      console.error(`❌ Failed to send event reminder for event ${eventId}:`, err);
    }
  });
};
