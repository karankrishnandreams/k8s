import { agenda } from "../utils/agenda";
import { defineSubscriptionReminderJob } from "../jobs/subscriptionReminder";
import { defineEventReminderJob } from "./calendarReminder";

export const initializeAgenda = async () => {
  defineSubscriptionReminderJob();
  defineEventReminderJob();

  // await agenda.start();
};
