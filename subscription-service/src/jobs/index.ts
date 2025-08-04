import { agenda } from "../utils/agenda";
import { defineSubscriptionReminderJob } from "../jobs/subscriptionReminder";

export const initializeAgenda = async () => {
  defineSubscriptionReminderJob();

  await agenda.start();
};
